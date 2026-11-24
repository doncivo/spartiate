import { describe, expect, it } from 'vitest';
import type { SqlDriver } from '../driver';
import { openSqliteWasmDriver } from '../drivers/sqliteWasm';
import { migrate } from '../migrator';
import { LEGACY_DEFAULT_PROFILE_ID, migration0022DefaultProfileRename } from './0022_default_profile_rename';
import { migrations } from './index';

/**
 * DATA-0292 (BL-138, D-489) : migration 0022 (schéma 22), ADDITIVE : aucun objet créé ni modifié, aucune table publiée touchée. Elle rattache l'ancien
 * identifiant du profil de matériel par défaut au nouveau (« salle-complete ») dans les trois réglages LOCAUX qui peuvent le porter. Les lignes de
 * `equipment_profile` (UUID) ne le portent jamais ; exports et journaux de synchro non plus (réglage actif jamais publié ni exporté).
 */
const DEV = '0f8fad5b-d9cb-469f-a165-70867728950e';
const BASE = 22;
const OLD = LEGACY_DEFAULT_PROFILE_ID;
const AT = '2026-11-24T08:00:00.000Z';
const h = (ms: number): string => `${String(ms).padStart(15, '0')}-0000-${DEV}`;

async function dbAt21(): Promise<SqlDriver> {
  const db = await openSqliteWasmDriver();
  await migrate(db, migrations.slice(0, BASE - 1));
  await db.execute('DELETE FROM sync_outbox');
  return db;
}
const put = (db: SqlDriver, key: string, value: unknown): Promise<unknown> =>
  db.execute('INSERT INTO settings (key, value, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?)', [key, JSON.stringify(value), AT, DEV, h(1)]);
const get = async (db: SqlDriver, key: string): Promise<unknown> => {
  const rows = await db.select<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return rows[0] === undefined ? undefined : JSON.parse(rows[0].value);
};

describe('migration 0022 : identifiant du profil par défaut renommé (DATA-0292, schéma 22)', () => {
  it('registre : 0001 à 0022 ; version 22, nom default_profile_rename', () => {
    expect(migrations.slice(0, 22).map((m) => m.version)).toEqual(Array.from({ length: 22 }, (_, i) => i + 1));
    expect(migrations[21]).toBe(migration0022DefaultProfileRename);
    expect(migration0022DefaultProfileRename.name).toBe('default_profile_rename');
  });

  it('additive : schéma identique (aucun objet créé, modifié ni supprimé), rien mis en file de synchro', async () => {
    const db = await dbAt21();
    const before = await db.select<{ name: string; sql: string }>("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name");
    await migrate(db, migrations.slice(0, BASE));
    expect(await db.select("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name")).toEqual(before);
    expect(await db.select('SELECT * FROM sync_outbox')).toEqual([]);
    expect(await db.select('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1')).toEqual([{ version: 22 }]);
    await db.close();
  });

  it('profil actif : l’ancien identifiant devient « salle-complete » ; les autres valeurs ne changent pas', async () => {
    for (const [stored, expected] of [
      [OLD, 'salle-complete'],
      ['salle-complete', 'salle-complete'],
      ['salle-commerciale', 'salle-commerciale'],
      ['0f8fad5b-d9cb-469f-a165-70867728950e', '0f8fad5b-d9cb-469f-a165-70867728950e'],
      [null, null],
    ] as const) {
      const db = await dbAt21();
      await put(db, 'training.activeEquipmentProfile', stored);
      await migrate(db, migrations.slice(0, BASE));
      expect(await get(db, 'training.activeEquipmentProfile'), String(stored)).toBe(expected);
      await db.close();
    }
  });

  it('brouillon et réponses de l’onboarding : seul equipmentProfileId change, le reste de l’objet est intact', async () => {
    const db = await dbAt21();
    const draft = { step: 'plan', equipmentProfileId: OLD, days: [1, 3, 5], note: 'à garder' };
    const answers = { equipmentProfileId: 'salle-commerciale', variety: 'high' };
    const other = { equipmentProfileId: OLD };
    await put(db, 'onboarding.draft', draft);
    await put(db, 'onboarding.answers', answers);
    await put(db, 'training.cycleWeeks', other);
    await migrate(db, migrations.slice(0, BASE));
    expect(await get(db, 'onboarding.draft')).toEqual({ ...draft, equipmentProfileId: 'salle-complete' });
    expect(await get(db, 'onboarding.answers')).toEqual(answers);
    expect(await get(db, 'training.cycleWeeks')).toEqual(other);
    await db.close();
  });

  it('valeurs illisibles ou d’un autre type : ignorées sans erreur, intactes', async () => {
    const db = await dbAt21();
    await db.execute('INSERT INTO settings (key, value, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?)', ['onboarding.draft', 'pas du json {', AT, DEV, h(2)]);
    await put(db, 'onboarding.answers', ['liste']);
    await migrate(db, migrations.slice(0, BASE));
    expect(await db.select<{ value: string }>("SELECT value FROM settings WHERE key = 'onboarding.draft'")).toEqual([{ value: 'pas du json {' }]);
    expect(await get(db, 'onboarding.answers')).toEqual(['liste']);
    await db.close();
  });

  it('base sans aucun de ces réglages : rien créé', async () => {
    const db = await dbAt21();
    const before = await db.select('SELECT key FROM settings ORDER BY key');
    await migrate(db, migrations.slice(0, BASE));
    expect(await db.select('SELECT key FROM settings ORDER BY key')).toEqual(before);
    await db.close();
  });

  it('lignes de profil de matériel (UUID) : intactes, aucune écriture publiée', async () => {
    const db = await dbAt21();
    const id = '0f8fad5b-d9cb-469f-a165-70867728951f';
    await db.execute(
      "INSERT INTO equipment_profile (id, name, kind, inventory, increments, created_at, updated_at, device_id, hlc) VALUES (?, 'Maison', 'maison', '{}', '{}', ?, ?, ?, ?)",
      [id, AT, AT, DEV, h(3)],
    );
    await db.execute('DELETE FROM sync_outbox');
    await migrate(db, migrations.slice(0, BASE));
    expect(await db.select('SELECT id, name, hlc FROM equipment_profile')).toEqual([{ id, name: 'Maison', hlc: h(3) }]);
    expect(await db.select('SELECT * FROM sync_outbox')).toEqual([]);
    await db.close();
  });
});
