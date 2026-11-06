import { expect, test, type Page } from '@playwright/test';
import { migrations } from '../../src/db/migrations/index';
import { APP_READY_TIMEOUT_MS } from './helpers/app';

/** Schéma courant de l'app (plus haute migration) : la migration de test vient juste après, quel que soit le nombre de migrations de l'app. */
const BASE = Math.max(...migrations.map((m) => m.version));

/**
 * I-06 — Je mets à jour l'app iPhone depuis SideStore (critère 17).
 *
 * Projet `iphone`, prises de développement seulement : `__ctAppVersion` (version 0.3.0 simulée), `__ctDbOpen` (base SQLite Wasm préremplie
 * à la version de schéma N = toutes les migrations sauf la dernière, avec une tâche du jour ; l'app applique la dernière migration au
 * démarrage), `__ctMigrationBackup` et `__ctStartupRecovery` (faux port de sauvegarde et faux service de restauration). Trois cas :
 * mise à jour réussie, migration en échec, base plus récente que l'app.
 */

type Mode = 'update' | 'fail' | 'newer' | 'backup' | 'restore-fails';

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

async function installAtN(page: Page, mode: Mode): Promise<void> {
  await page.addInitScript(
    ({ mode, base }) => {
      const g = globalThis as Record<string, unknown>;
      g['__ctAppVersion'] = '0.3.0';
      g['__ctDbOpen'] = async () => {
        // Modules du serveur de développement (même instance que l'app : mêmes URL).
        const load = (path: string): Promise<unknown> => import(/* @vite-ignore */ path);
        const drivers = (await load('/src/db/drivers/sqliteWasm.ts')) as { openSqliteWasmDriver: () => Promise<Record<string, unknown>> };
        const migrator = (await load('/src/db/migrator.ts')) as { migrate: (db: unknown, list: unknown[]) => Promise<unknown> };
        const { migrations } = (await load('/src/db/migrations/index.ts')) as { migrations: unknown[] };
        type Driver = {
          kind: string;
          execute: (sql: string, params?: unknown[]) => Promise<unknown>;
          select: (sql: string, params?: unknown[]) => Promise<unknown[]>;
          transaction: (fn: (tx: { execute: Driver['execute']; select: Driver['select'] }) => Promise<unknown>) => Promise<unknown>;
          close: () => Promise<void>;
        };
        const db = (await drivers.openSqliteWasmDriver()) as unknown as Driver;
        await migrator.migrate(db, migrations);
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
        const hlc = `${String(Date.now()).padStart(15, '0')}-0000-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`;
        if (mode === 'update') {
          // Données d'avant la mise à jour (base neuve, schéma 1) : le profil et une pesée du jour, relus après la mise à jour.
          await db.execute(
            "INSERT INTO profile (id, sex, birth_year, height_cm, goal, experience, units, created_at, updated_at, device_id, hlc) VALUES ('profile|singleton', 'male', 1990, 181, NULL, NULL, NULL, '2026-10-05T08:00:00.000Z', '2026-10-05T08:00:00.000Z', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ?)",
            [hlc],
          );
          await db.execute(
            "INSERT INTO body_weight (id, date, kg, source, timezone, health_uuid, measured_at, created_at, updated_at, device_id, hlc) VALUES (?, ?, 82.4, 'manual', 'Europe/Paris', NULL, NULL, '2026-10-05T08:00:00.000Z', '2026-10-05T08:00:00.000Z', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ?)",
            ['weight|' + today + '|manual', today, hlc],
          );
        }
        await db.execute('DELETE FROM sync_outbox');
        if (mode === 'newer') {
          // Base passée par une version plus récente (N+2), puis IPA plus ancienne réinstallée.
          await migrator.migrate(db, migrations);
          await db.execute("INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (99, 'future', '00000000', '2026-10-20T08:00:00.000Z')");
        }
        if (mode !== 'fail' && mode !== 'restore-fails') return db;
        // Migration volontairement en échec : toute instruction de la migration de test 2 (colonne i06_note, ajoutée par __ctExtraMigrations) est refusée. Une nouvelle migration oblige à changer ce fragment, les versions ci-dessous et le gel de scripts/ios/i06.test.ts.
        const refuse = (sql: string): boolean => sql.includes('i06_note');
        return {
          kind: db.kind,
          execute: (sql: string, params?: unknown[]) => (refuse(sql) ? Promise.reject(new Error('échec simulé de la migration')) : db.execute(sql, params)),
          select: (sql: string, params?: unknown[]) => db.select(sql, params),
          transaction: (fn: Parameters<Driver['transaction']>[0]) =>
            db.transaction((tx) => fn({ select: (sql, params) => tx.select(sql, params), execute: (sql, params) => (refuse(sql) ? Promise.reject(new Error('échec simulé de la migration')) : tx.execute(sql, params)) })),
          close: () => db.close(),
        };
      };
      if (mode === 'fail' || mode === 'restore-fails' || mode === 'backup') {
        // N+1 simulée : une migration de test à la suite de la migration 1 (données de N intactes).
        g['__ctExtraMigrations'] = [{ version: base + 1, name: 'test_i06_additive', statements: ['ALTER TABLE profile ADD COLUMN i06_note TEXT'] }];
      }
      if (mode === 'backup') {
        // QA : disque plein, la sauvegarde d'avant la mise à jour échoue (aucune migration lancée).
        g['__ctMigrationBackup'] = { backup: () => Promise.reject(new Error('disque plein')) };
      }
      if (mode === 'fail' || mode === 'restore-fails') {
        const pad = (n: number): string => String(n).padStart(4, '0');
        g['__ctMigrationBackup'] = {
          backup: (request: { fromVersion: number; toVersion: number; stamp: string }) =>
            Promise.resolve({ name: `spartiate-pre-migration-v${pad(request.fromVersion)}-to-v${pad(request.toVersion)}-${request.stamp}.db` }),
        };
        g['__ctRestored'] = [];
        g['__ctStartupRecovery'] = {
          available: () => true,
          list: () => Promise.resolve({ directory: null, versions: [] }),
          createDaily: () => Promise.resolve({ created: false }),
          restore: (request: { name: string }) => {
            (g['__ctRestored'] as string[]).push(request.name);
            if (mode === 'restore-fails') return Promise.reject(new Error('restauration impossible'));
            return Promise.resolve({ marker: 'not-configured', markerCode: null });
          },
          restart: () => new Promise<void>(() => undefined),
        };
      }
    },
    { mode, base: BASE },
  );
}

test.describe('I-06 — mise à jour N vers N+1 (iPhone, base préremplie, version simulée)', () => {
  test.use({ userAgent: IPHONE_UA });
  test.skip(({ isMobile }) => !isMobile, 'La mise à jour par SideStore concerne l’iPhone (projet iphone).');

  test('premier lancement de 0.3.0 : Aujourd’hui, « À propos » affiche 0.3.0, aucun écran d’échec', async ({ page }) => {
    await installAtN(page, 'update');
    await page.goto('/');
    await expect(page.locator('.app-shell')).toHaveAttribute('data-db-status', 'ready', { timeout: APP_READY_TIMEOUT_MS });
    await expect(page.getByTestId('db-failure-detail')).toHaveCount(0);
    await page.getByRole('navigation').getByText('Plus', { exact: true }).click();
    await expect(page.getByText('Version 0.3.0', { exact: true })).toBeVisible({ timeout: APP_READY_TIMEOUT_MS });
    // Données affichées après la mise à jour : le profil et la pesée d'avant sont relus.
    await page.getByRole('button', { name: 'Profil et poids' }).click();
    await expect(page.getByLabel('Taille (cm)')).toHaveValue('181', { timeout: APP_READY_TIMEOUT_MS });
    await expect(page.getByLabel('Année de naissance')).toHaveValue('1990');
    await expect(page.getByText('82,4 kg')).toBeVisible();
  });

  test('migration en échec : écran d’échec avec étape, versions, trois actions ; « Restaurer » confirmé appelle la restauration', async ({ page }) => {
    await installAtN(page, 'fail');
    await page.goto('/');
    await expect(page.getByRole('alert').first()).toHaveText('Impossible d’ouvrir la base de données.', { timeout: APP_READY_TIMEOUT_MS });
    await expect(page.getByText('Tes données sont intactes. Ne supprime pas Spartiate. Envoie le détail pour obtenir un correctif.')).toBeVisible();
    const pad = (n: number): string => String(n).padStart(4, '0');
    const detail = page.getByTestId('db-failure-detail');
    await expect(detail).toContainText(`Étape : migration ${String(BASE + 1)}`);
    await expect(detail).toContainText('Version de l’app : 0.3.0');
    await expect(detail).toContainText(`Schéma de la base : ${String(BASE)} (dernier connu de l’app : ${String(BASE + 1)})`);
    await expect(detail).toContainText(`Sauvegarde d’avant la mise à jour : spartiate-pre-migration-v${pad(BASE)}-to-v${pad(BASE + 1)}-`);
    await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copier le détail' })).toBeVisible();
    const restore = page.getByRole('button', { name: 'Restaurer la sauvegarde d’avant la mise à jour' });
    await expect(restore).toBeVisible();
    const box = await restore.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    await restore.click();
    const dialog = page.getByRole('alertdialog', { name: 'Restaurer la sauvegarde d’avant la mise à jour ?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Annuler' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Restaurer', exact: true }).click();
    await expect(page.getByText('Restauration en cours…')).toBeVisible();
    // QA : « Restauration en cours… » s'affiche avant que le module de restauration (chargé à la demande) appelle le service : on attend
    // l'appel (condition), on ne lit pas le compteur au hasard (échec observé en suite parallèle).
    const readRestored = () => page.evaluate(() => (globalThis as { __ctRestored?: string[] }).__ctRestored ?? []);
    await expect.poll(async () => (await readRestored()).length).toBe(1);
    const restored = await readRestored();
    expect(restored[0]).toMatch(new RegExp(`^spartiate-pre-migration-v${pad(BASE)}-to-v${pad(BASE + 1)}-\\d{8}T\\d{6}Z\\.db$`));
  });

  test('base plus récente que l’app : consigne SideStore, données non modifiées, pas de restauration, jamais de page blanche', async ({ page }) => {
    await installAtN(page, 'newer');
    await page.goto('/');
    await expect(page.getByRole('alert').first()).toHaveText(
      'Cette version de Spartiate est plus ancienne que tes données. Installe la dernière version depuis SideStore. Tes données ne sont pas modifiées.',
      { timeout: APP_READY_TIMEOUT_MS },
    );
    await expect(page.getByText(/inconnue de cette version/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Copier le détail' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restaurer la sauvegarde d’avant la mise à jour' })).toHaveCount(0);
  });

  // QA I-06 : états d'échec durables de la mise à jour, chacun visible avec son action (règle d'Ali), jamais de page blanche.
  test('QA sauvegarde impossible (disque plein) : message d’espace disque, base non migrée, Réessayer et Copier le détail, pas de restauration', async ({ page }) => {
    await installAtN(page, 'backup');
    await page.goto('/');
    await expect(page.getByRole('alert').first()).toContainText('la sauvegarde de sécurité a échoué', { timeout: APP_READY_TIMEOUT_MS });
    await expect(page.getByRole('alert').first()).toContainText('Libère de l’espace disque');
    await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copier le détail' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restaurer la sauvegarde d’avant la mise à jour' })).toHaveCount(0);
    await expect(page.getByTestId('db-failure-detail')).toContainText('Version de l’app : 0.3.0');
    await expect(page.locator('.app-shell')).not.toHaveAttribute('data-db-status', 'ready');
  });

  test('QA restauration en échec : raison et code affichés, l’écran garde ses actions, la restauration peut être relancée', async ({ page }) => {
    await installAtN(page, 'restore-fails');
    await page.goto('/');
    const restore = page.getByRole('button', { name: 'Restaurer la sauvegarde d’avant la mise à jour' });
    await expect(restore).toBeVisible({ timeout: APP_READY_TIMEOUT_MS });
    for (const attempt of [1, 2]) {
      await restore.click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Restaurer', exact: true }).click();
      await expect(page.getByText('La restauration n’a pas abouti.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Copier le détail' })).toBeVisible();
      await expect(restore).toBeEnabled();
      const calls = await page.evaluate(() => (globalThis as { __ctRestored?: string[] }).__ctRestored ?? []);
      expect(calls).toHaveLength(attempt);
    }
  });
});
