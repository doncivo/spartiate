import { describe, expect, it } from 'vitest';
import { publishedColumns, SYNC_CATALOGUE } from '../../domain/sync/syncTables';
import type { SqlDriver } from '../driver';
import { openSqliteWasmDriver } from '../drivers/sqliteWasm';
import { migrate } from '../migrator';
import { migration0019ProgramRestDay } from './0019_program_rest_day';
import { migrations } from './index';

/**
 * PROG-01 : migration 0019 — `mesocycle.next_weeks`, `mesocycle.ramp_up` (D-267), `nutrition_target.rest_kcal`, `rest_carb_g`, `training_days`
 * (D-270, D-271). Colonnes PUBLIÉES, capturées à la création par les `_ai` existants (ligne entière) et à la modification par deux déclencheurs
 * propres ; aucune ligne existante modifiée ni mise en file. Données synthétiques.
 */
const DEV = '0f8fad5b-d9cb-469f-a165-70867728950e';
const AT = '2026-11-13T18:00:00.000Z';
const M = '7a1b0c2d-0000-4000-8000-000000000201';
const T = '7a1b0c2d-0000-4000-8000-000000000202';
const R = '7a1b0c2d-0000-4000-8000-000000000203';
const h = (ms: number): string => `${String(ms).padStart(15, '0')}-0000-${DEV}`;

const dbAt = async (version: number): Promise<SqlDriver> => {
  const db = await openSqliteWasmDriver();
  await migrate(db, migrations.filter((m) => m.version <= version));
  return db;
};
const insertCycle = (db: SqlDriver): Promise<unknown> =>
  db.execute(
    `INSERT INTO mesocycle (id, routine_id, start_date, weeks, unlimited, deload_week, block_origin_week, block_origin_index, rotation_index, pauses, status, outcome, ended_on, created_at, updated_at, device_id, hlc)
     VALUES (?, ?, '2026-11-16', 5, 0, NULL, 1, 0, 0, '[]', 'active', NULL, NULL, ?, ?, ?, ?)`,
    [M, R, AT, AT, DEV, h(1)],
  );
const insertTarget = (db: SqlDriver, rest: { kcal: number | null; carb: number | null; days: string | null } | null): Promise<unknown> =>
  rest === null
    ? db.execute(
        `INSERT INTO nutrition_target (id, week_start, kcal, protein_g, fat_g, carb_g, source, accepted, engine_version, created_at, updated_at, device_id, hlc)
         VALUES (?, '2026-11-16', 2500, 150, 70, 316, 'manual', 1, NULL, ?, ?, ?, ?)`,
        [T, AT, AT, DEV, h(1)],
      )
    : db.execute(
        `INSERT INTO nutrition_target (id, week_start, kcal, protein_g, fat_g, carb_g, source, accepted, engine_version, rest_kcal, rest_carb_g, training_days, created_at, updated_at, device_id, hlc)
         VALUES (?, '2026-11-16', 2500, 150, 70, 316, 'manual', 1, NULL, ?, ?, ?, ?, ?, ?, ?)`,
        [T, rest.kcal, rest.carb, rest.days, AT, AT, DEV, h(1)],
      );
const outbox = async (db: SqlDriver, table: string): Promise<string[]> =>
  (await db.select<{ field: string }>(`SELECT field FROM sync_outbox WHERE table_name = '${table}' ORDER BY field`)).map((r) => r.field);

describe('migration 0019 : program_rest_day (PROG-01)', () => {
  it('registre : 0001 à 0019 ; version 19, nom program_rest_day', () => {
    expect(migrations.map((m) => m.version)).toEqual(Array.from({ length: 19 }, (_, i) => i + 1));
    expect(migrations[18]).toBe(migration0019ProgramRestDay);
    expect(migration0019ProgramRestDay.name).toBe('program_rest_day');
  });

  it('mise à jour depuis la version 18 : lignes existantes intactes, colonnes nulles, rien de mis en file', async () => {
    const db = await dbAt(18);
    await insertCycle(db);
    await insertTarget(db, null);
    await db.execute('DELETE FROM sync_outbox');
    await migrate(db, migrations);
    expect(await db.select('SELECT weeks, status, next_weeks, ramp_up FROM mesocycle')).toEqual([{ weeks: 5, status: 'active', next_weeks: null, ramp_up: null }]);
    expect(await db.select('SELECT kcal, carb_g, rest_kcal, rest_carb_g, training_days FROM nutrition_target')).toEqual([{ kcal: 2500, carb_g: 316, rest_kcal: null, rest_carb_g: null, training_days: null }]);
    expect(await db.select('SELECT 1 FROM sync_outbox')).toEqual([]);
  });

  it('contraintes : durée suivante 4 à 7, reprise 0 / 1, cible de repos positive, jours ISO', async () => {
    const db = await dbAt(19);
    await insertCycle(db);
    await expect(db.execute('UPDATE mesocycle SET next_weeks = 3 WHERE id = ?', [M])).rejects.toThrow();
    await expect(db.execute('UPDATE mesocycle SET next_weeks = 8 WHERE id = ?', [M])).rejects.toThrow();
    await expect(db.execute('UPDATE mesocycle SET ramp_up = 2 WHERE id = ?', [M])).rejects.toThrow();
    await expect(db.execute('UPDATE mesocycle SET next_weeks = 4, ramp_up = 1 WHERE id = ?', [M])).resolves.toBeDefined();
    await expect(insertTarget(db, { kcal: 0, carb: 200, days: '1,2' })).rejects.toThrow();
    await expect(insertTarget(db, { kcal: 2250, carb: -1, days: '1,2' })).rejects.toThrow();
    await expect(insertTarget(db, { kcal: 2250, carb: 250, days: '0,1' })).rejects.toThrow();
    await expect(insertTarget(db, { kcal: 2250, carb: 250, days: '1,2,4,5,6' })).resolves.toBeDefined();
  });

  it('catalogue : colonnes publiées en fin de table', () => {
    expect([...publishedColumns(SYNC_CATALOGUE.table('mesocycle') as never)]).toEqual(expect.arrayContaining(['next_weeks', 'ramp_up']));
    expect([...publishedColumns(SYNC_CATALOGUE.table('nutrition_target') as never)]).toEqual(expect.arrayContaining(['rest_kcal', 'rest_carb_g', 'training_days']));
  });

  it('création : la ligne entière part en file, nouvelles colonnes comprises', async () => {
    const db = await dbAt(19);
    await insertTarget(db, { kcal: 2250, carb: 254, days: '1,2,4,5,6' });
    expect(await outbox(db, 'nutrition_target')).toEqual(['*']);
  });

  it('modification : capturée champ par champ (déclencheurs propres), horloge de base = horloge précédente', async () => {
    const db = await dbAt(19);
    await insertCycle(db);
    await insertTarget(db, null);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('DELETE FROM sync_field_clock');
    await db.execute('UPDATE mesocycle SET next_weeks = 4, updated_at = ?, hlc = ? WHERE id = ?', [AT, h(5), M]);
    expect(await outbox(db, 'mesocycle')).toEqual(['next_weeks']);
    expect(await db.select("SELECT field, hlc, base_hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND field = 'next_weeks'")).toEqual([{ field: 'next_weeks', hlc: h(5), base_hlc: h(1) }]);
    await db.execute('UPDATE mesocycle SET ramp_up = 1, updated_at = ?, hlc = ? WHERE id = ?', [AT, h(6), M]);
    expect(await outbox(db, 'mesocycle')).toEqual(['next_weeks', 'ramp_up']);
    await db.execute('UPDATE nutrition_target SET rest_kcal = 2250, rest_carb_g = 254, training_days = ?, updated_at = ?, hlc = ? WHERE id = ?', ['1,2,4,5,6', AT, h(7), T]);
    expect(await outbox(db, 'nutrition_target')).toEqual(['rest_carb_g', 'rest_kcal', 'training_days']);
  });

  it('écriture appliquée par la synchro (garde sync_guard) : rien n’est capturé', async () => {
    const db = await dbAt(19);
    await insertCycle(db);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('INSERT INTO sync_guard (id) VALUES (1)');
    await db.execute('UPDATE mesocycle SET next_weeks = 6, ramp_up = 1, hlc = ? WHERE id = ?', [h(5), M]);
    expect(await db.select('SELECT 1 FROM sync_outbox')).toEqual([]);
  });
});
