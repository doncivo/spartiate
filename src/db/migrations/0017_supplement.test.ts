import { describe, expect, it } from 'vitest';
import type { SqlDriver } from '../driver';
import { openSqliteWasmDriver } from '../drivers/sqliteWasm';
import { migrate } from '../migrator';
import { CAPTURE_TABLES_V17, migration0017Supplement } from './0017_supplement';
import { migrations } from './index';

/**
 * I6-05 (§ 15.3, D-210) : migration additive — `supplement` (compléments) et `supplement_intake` (prises cochées), PUBLIÉES, écrites par les deux
 * appareils. Deux tables neuves ; AUCUN objet existant modifié ; rien mis en file.
 */
const DEV = '0f8fad5b-d9cb-469f-a165-70867728950e';
const h = (ms: number): string => `${String(ms).padStart(15, '0')}-0000-${DEV}`;
const AT = '2026-11-13T08:00:00.000Z';
const SUP = '30000000-0000-4000-8000-000000000001';
const POS = migrations.indexOf(migration0017Supplement);

async function freshDb(): Promise<SqlDriver> {
  const db = await openSqliteWasmDriver();
  await migrate(db, migrations.slice(0, POS + 1));
  return db;
}
type Row = Record<string, string | number | null>;
const supplement = (over: Row = {}): Row => ({
  id: SUP, name: 'Créatine', dose: 5, unit: 'g', times: '["08:00"]', days: 127, active: 1, created_at: AT, updated_at: AT, device_id: DEV, hlc: h(1), ...over,
});
const intake = (over: Row = {}): Row => ({
  id: `intake|${SUP}|2026-11-13|08:00`, supplement_id: SUP, date: '2026-11-13', moment: '08:00', taken_at: AT, created_at: AT, updated_at: AT, device_id: DEV, hlc: h(1), ...over,
});
const insert = (db: SqlDriver, table: string, row: Row): Promise<unknown> => {
  const cols = Object.keys(row);
  return db.execute(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map((c) => row[c] ?? null));
};
const outbox = (db: SqlDriver) => db.select<{ table_name: string; row_id: string; field: string }>('SELECT table_name, row_id, field FROM sync_outbox ORDER BY seq');

describe('migration supplement (I6-05)', () => {
  it('registre : dix-septième migration, nom supplement, version = rang (I6-06 ajoute la 0018 après elle)', () => {
    expect(migrations[16]).toBe(migration0017Supplement);
    expect(migration0017Supplement.version).toBe(17);
    expect(migration0017Supplement.name).toBe('supplement');
  });

  it('base précédente → nouvelle : deux tables, deux index, quatre déclencheurs, rien en file, AUCUN objet existant modifié', async () => {
    const db = await openSqliteWasmDriver();
    await migrate(db, migrations.slice(0, POS));
    await db.execute('DELETE FROM sync_outbox');
    const before = await db.select<{ name: string; sql: string }>("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name");
    const triggers = (await db.select("SELECT 1 FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'sync_%'")).length;
    await migrate(db, migrations.slice(0, POS + 1));
    const after = await db.select<{ name: string; sql: string }>("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name");
    const beforeNames = new Set(before.map((r) => r.name));
    for (const row of before) expect(after.find((r) => r.name === row.name), row.name).toEqual(row);
    expect(after.filter((r) => !beforeNames.has(r.name)).map((r) => r.name).sort()).toEqual([
      'supplement',
      'supplement_intake',
      'supplement_intake_date_idx',
      'supplement_name_idx',
      'sync_supplement_ai',
      'sync_supplement_au',
      'sync_supplement_intake_ai',
      'sync_supplement_intake_au',
    ]);
    expect(await db.select("SELECT 1 FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'sync_%'")).toHaveLength(triggers + 4);
    expect(await outbox(db)).toEqual([]);
    await db.close();
  });

  it('copie figée des colonnes capturées', () => {
    expect(CAPTURE_TABLES_V17).toEqual([
      ['supplement', ['name', 'dose', 'unit', 'times', 'days', 'active', 'created_at', 'deleted_at']],
      ['supplement_intake', ['supplement_id', 'date', 'moment', 'taken_at', 'created_at', 'deleted_at']],
    ]);
  });

  it('insertion : ligne entière en file ; mise à jour : champ par champ ; restauration : « + »', async () => {
    const db = await freshDb();
    await insert(db, 'supplement', supplement());
    await insert(db, 'supplement_intake', intake());
    expect(await outbox(db)).toEqual([
      { table_name: 'supplement', row_id: SUP, field: '*' },
      { table_name: 'supplement_intake', row_id: `intake|${SUP}|2026-11-13|08:00`, field: '*' },
    ]);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('UPDATE supplement SET active = 0, hlc = ? WHERE id = ?', [h(2), SUP]);
    await db.execute('UPDATE supplement_intake SET deleted_at = ?, hlc = ? WHERE supplement_id = ?', [AT, h(2), SUP]);
    await db.execute('UPDATE supplement_intake SET deleted_at = NULL, hlc = ? WHERE supplement_id = ?', [h(3), SUP]);
    expect((await outbox(db)).map((r) => `${r.table_name}.${r.field}`)).toEqual(['supplement.active', 'supplement_intake.deleted_at', 'supplement_intake.+']);
    await db.close();
  });

  it.each([
    ['supplement', supplement({ name: '' })],
    ['supplement', supplement({ name: 'x'.repeat(81) })],
    ['supplement', supplement({ dose: 0 })],
    ['supplement', supplement({ unit: '' })],
    ['supplement', supplement({ times: '[]' })],
    ['supplement', supplement({ times: 'pas du json' })],
    ['supplement', supplement({ days: 0 })],
    ['supplement', supplement({ days: 128 })],
    ['supplement', supplement({ active: 2 })],
    ['supplement_intake', intake({ id: 'intake|autre' })],
    ['supplement_intake', intake({ date: '13/11/2026', id: `intake|${SUP}|13/11/2026|08:00` })],
    ['supplement_intake', intake({ moment: '8h', id: `intake|${SUP}|2026-11-13|8h` })],
  ])('CHECK : %s invalide refusée', async (table, row) => {
    const db = await freshDb();
    await expect(insert(db, table, row)).rejects.toThrow();
    await db.close();
  });
});
