import { expect, test, type Page } from '@playwright/test';
import { installFakeFiles, savedFiles, setPickBytes } from './helpers/files';
import { openToday } from './helpers/today';

/**
 * C-193 (PRD § 23.1, « export / import ») : trois pesées synthétiques, export de l'archive (service de fichiers simulé), import de la même
 * archive (rien à changer), import en mode « Remplacer » après une pesée de plus (une suppression, annoncée avant confirmation), archive
 * invalide refusée sans rien modifier. PC (1 440 px) et iPhone (440 px). Aucune donnée réelle.
 */
const nav = (page: Page, name: string) => page.getByRole('navigation').getByRole('button', { name, exact: true });

const insertWeight = async (page: Page, date: string, kg: number): Promise<void> => {
  await page.evaluate(
    async ([day, value]) => {
      const stamp = '2026-11-08T10:00:00.000Z';
      await window.__ctTest?.execute(
        "INSERT INTO body_weight (id, date, kg, source, timezone, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, 'manual', 'Europe/Paris', ?, ?, '0f8fad5b-d9cb-469f-a165-70867728950e', ?)",
        [`weight|${String(day)}|manual`, day, value, stamp, stamp, `00179421840${String(day).slice(-2)}00-0000-0f8fad5b-d9cb-469f-a165-70867728950e`],
      );
    },
    [date, kg] as const,
  );
};

const openExportImport = async (page: Page): Promise<void> => {
  await nav(page, 'Plus').click();
  await page.getByRole('button', { name: /^Export et import/ }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Export et import' })).toBeVisible();
};

test.beforeEach(async ({ page }) => {
  await installFakeFiles(page);
  await page.clock.setFixedTime(new Date('2026-11-08T11:00:00Z'));
  await openToday(page);
  for (const [date, kg] of [['2026-11-03', 105.0], ['2026-11-05', 104.5], ['2026-11-06', 104.0]] as const) await insertWeight(page, date, kg);
  await openExportImport(page);
});

test('export puis import de la même archive : aperçu sans changement, import terminé', async ({ page }) => {
  await page.getByRole('button', { name: 'Exporter mes données', exact: true }).click();
  await expect(page.locator('.ct-body__message')).toContainText('Archive enregistrée');
  const [archive] = await savedFiles(page);
  expect(archive?.mime).toBe('application/zip');
  expect(archive?.name).toMatch(/\.zip$/);
  expect(archive?.bytes.length ?? 0).toBeGreaterThan(100);

  await setPickBytes(page, { name: archive?.name ?? 'archive.zip', bytes: archive?.bytes ?? [] });
  await page.getByRole('button', { name: 'Choisir une archive…' }).click();
  const preview = page.getByRole('region', { name: 'Aperçu de l’import' });
  await expect(preview).toBeVisible();
  await expect(preview.getByText('Ajouts : 0')).toBeVisible();
  await expect(preview.getByText('Modifications : 0')).toBeVisible();
  await expect(preview.getByText('Suppressions : 0')).toBeVisible();
  await preview.getByRole('button', { name: 'Confirmer l’import' }).click();
  await expect(page.locator('.ct-body__message')).toHaveText('Import terminé. Ajouts : 0 ; modifications : 0 ; suppressions : 0.');
});

test('mode « Remplacer » : la pesée absente de l’archive est annoncée comme suppression avant la confirmation', async ({ page }) => {
  await page.getByRole('button', { name: 'Exporter mes données', exact: true }).click();
  await expect(page.locator('.ct-body__message')).toContainText('Archive enregistrée');
  const [archive] = await savedFiles(page);
  await insertWeight(page, '2026-11-07', 103.5);

  await setPickBytes(page, { name: archive?.name ?? 'archive.zip', bytes: archive?.bytes ?? [] });
  await page.getByRole('button', { name: 'Choisir une archive…' }).click();
  const preview = page.getByRole('region', { name: 'Aperçu de l’import' });
  await expect(preview.getByText('Suppressions : 0')).toBeVisible();
  await preview.getByRole('radio', { name: 'Remplacer', exact: true }).click();
  await expect(preview.getByText('Suppressions : 1')).toBeVisible();
  await preview.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Aperçu de l’import' })).toHaveCount(0);
});

test('archive invalide : refusée en texte, aucun aperçu, rien de modifié', async ({ page }) => {
  await setPickBytes(page, { name: 'notes.zip', bytes: Array.from(new TextEncoder().encode('ceci n’est pas une archive')) });
  await page.getByRole('button', { name: 'Choisir une archive…' }).click();
  await expect(page.locator('.ct-body__message')).toContainText('Archive refusée : ce fichier n’est pas une archive Spartiate. Rien n’a été modifié.');
  await expect(page.getByRole('region', { name: 'Aperçu de l’import' })).toHaveCount(0);
});

test('annulation du sélecteur : aucun message, aucun aperçu', async ({ page }) => {
  await setPickBytes(page, null);
  await page.getByRole('button', { name: 'Choisir une archive…' }).click();
  await expect(page.locator('.ct-body__message')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Aperçu de l’import' })).toHaveCount(0);
});
