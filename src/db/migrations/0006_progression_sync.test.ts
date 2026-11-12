import { describe, expect, it } from 'vitest';
import { SYNC_CATALOGUE, publishedColumns } from '../../domain/sync/syncTables';
import type { SqlDriver } from '../driver';
import { openSqliteWasmDriver } from '../drivers/sqliteWasm';
import { migrate, migrationChecksum, readAppliedMigrations } from '../migrator';
import { CAPTURE_TABLES_V4 } from './0004_workout_sync';
import { CAPTURE_TABLES_V6, migration0006ProgressionSync } from './0006_progression_sync';
import { migrations } from './index';

/**
 * I2-01 (PR 2/2) : migration 0006 — difficulté Facile / Juste / Dur sur les séries (`workout_set.difficulty`, publiée avec la séance close),
 * publication de `progression_profile` et `recommendation_decision` (déclencheurs de capture sur le modèle de la 0002), report des lignes
 * locales écrites en 0.3.0.
 */

const DEV = '0f8fad5b-d9cb-469f-a165-70867728950e';
const h = (ms: number): string => `${String(ms).padStart(15, '0')}-0000-${DEV}`;
const AT = '2026-11-07T18:00:00.000Z';
const END = '2026-11-07T19:00:00.000Z';
const W = '5e1a0c2d-0000-4000-8000-000000000001';
const S1 = '5e1a0c2d-0000-4000-8000-000000000011';
const D = '5e1a0c2d-0000-4000-8000-0000000000d1';
const P = 'progression|bench-press-barbell';

async function freshDb(): Promise<SqlDriver> {
  const db = await openSqliteWasmDriver();
  await migrate(db, migrations);
  return db;
}

const insertWorkout = (db: SqlDriver, endedAt: string | null = null): Promise<unknown> =>
  db.execute(`INSERT INTO workout (id, name, started_at, ended_at, source, created_at, updated_at, device_id, hlc) VALUES (?, 'Haut A', ?, ?, 'empty', ?, ?, ?, ?)`, [W, AT, endedAt, AT, AT, DEV, h(1)]);
const insertSet = (db: SqlDriver, difficulty: string | null = null): Promise<unknown> =>
  db.execute(
    `INSERT INTO workout_set (id, workout_id, exercise_id, exercise_name, position, set_kind, difficulty, created_at, updated_at, device_id, hlc) VALUES (?, ?, 'bench-press-barbell', 'Développé', 0, 'work', ?, ?, ?, ?, ?)`,
    [S1, W, difficulty, AT, AT, DEV, h(1)],
  );
const insertProfile = (db: SqlDriver): Promise<unknown> =>
  db.execute(
    `INSERT INTO progression_profile (id, exercise_id, estimated_1rm_kg, confidence, last_easy_recalibration_at, engine_version, created_at, updated_at, device_id, hlc)
     VALUES (?, 'bench-press-barbell', 80, 0.5, NULL, 1, ?, ?, ?, ?)`,
    [P, AT, AT, DEV, h(1)],
  );
const insertDecision = (db: SqlDriver): Promise<unknown> =>
  db.execute(
    `INSERT INTO recommendation_decision (id, exercise_id, workout_id, workout_set_id, engine_version, prescription, reasons, accepted, chosen_load_kg, chosen_reps, decided_at, created_at, updated_at, device_id, hlc)
     VALUES (?, 'bench-press-barbell', ?, NULL, 1, '{}', '[]', 1, 62.5, '[8,8,8]', ?, ?, ?, ?, ?)`,
    [D, W, AT, AT, AT, DEV, h(1)],
  );
const outbox = (db: SqlDriver) => db.select<{ table_name: string; row_id: string; field: string }>('SELECT table_name, row_id, field FROM sync_outbox ORDER BY seq');
const technical = async (db: SqlDriver): Promise<unknown[]> => [
  ...(await db.select('SELECT * FROM sync_outbox')),
  ...(await db.select('SELECT * FROM sync_field_clock')),
  ...(await db.select('SELECT * FROM sync_tombstone')),
];

describe('migration 0006 : progression_sync (I2-01, PR 2/2)', () => {
  it('registre : 0001 à 0006 ; version 6, nom progression_sync', () => {
    expect(migrations.map((m) => m.version).slice(0, 6)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(migrations[5]).toBe(migration0006ProgressionSync);
    expect(migration0006ProgressionSync.name).toBe('progression_sync');
  });

  it('0005 → 0006 : difficulté nulle sur les séries existantes ; profils écrits en 0.3.0 mis en file ; décision d’une séance ouverte jamais capturée', async () => {
    const db = await openSqliteWasmDriver();
    await migrate(db, migrations.slice(0, 5));
    await insertWorkout(db);
    await db.execute(`INSERT INTO workout_set (id, workout_id, exercise_id, exercise_name, position, set_kind, created_at, updated_at, device_id, hlc) VALUES (?, ?, 'bench-press-barbell', 'Développé', 0, 'work', ?, ?, ?, ?)`, [S1, W, AT, AT, DEV, h(1)]);
    await insertProfile(db);
    await insertDecision(db);
    expect(await technical(db)).toEqual([]);
    const report = await migrate(db, migrations.slice(0, 6));
    expect(report.applied).toEqual([6]);
    expect(await db.select('SELECT difficulty FROM workout_set')).toEqual([{ difficulty: null }]);
    expect(await outbox(db)).toEqual([{ table_name: 'progression_profile', row_id: P, field: '*' }]);
    expect(await db.select('PRAGMA foreign_key_check')).toEqual([]);
    expect((await readAppliedMigrations(db)).at(-1)).toMatchObject({ version: 6, name: 'progression_sync', checksum: migrationChecksum(migration0006ProgressionSync) });
    await db.close();
  });

  it('revue #61 (D-27) : décision prise dans une séance ouverte jamais capturée ; part en ligne entière avec la clôture ; séance abandonnée : jamais', async () => {
    const db = await freshDb();
    await insertWorkout(db);
    await insertSet(db);
    await insertDecision(db);
    await db.execute('UPDATE recommendation_decision SET chosen_load_kg = 60, hlc = ? WHERE id = ?', [h(2), D]);
    expect(await technical(db)).toEqual([]);
    await db.execute('UPDATE workout SET deleted_at = ?, hlc = ? WHERE id = ?', [END, h(3), W]);
    expect(await technical(db)).toEqual([]);
    await db.execute('UPDATE workout SET deleted_at = NULL, hlc = ? WHERE id = ?', [h(4), W]);
    await db.execute('UPDATE workout SET ended_at = ?, hlc = ? WHERE id = ?', [END, h(5), W]);
    // Ordre de la file sans importance (rang du catalogue à la publication) : comparé trié.
    expect([...(await outbox(db))].sort((x, y) => (x.table_name < y.table_name ? -1 : 1))).toEqual([
      { table_name: 'recommendation_decision', row_id: D, field: '*' },
      { table_name: 'workout', row_id: W, field: '*' },
      { table_name: 'workout_set', row_id: S1, field: '*' },
    ]);
    await db.close();
  });

  it('difficulté : easy, ok, hard ou nulle (CHECK)', async () => {
    const db = await freshDb();
    await insertWorkout(db);
    await expect(insertSet(db, 'tres-dur')).rejects.toThrow();
    await insertSet(db, 'hard');
    for (const value of ['easy', 'ok', null]) await db.execute('UPDATE workout_set SET difficulty = ? WHERE id = ?', [value, S1]);
    await expect(db.execute("UPDATE workout_set SET difficulty = 'facile' WHERE id = ?", [S1])).rejects.toThrow();
    await db.close();
  });

  it('copie figée = catalogue : progression_profile et recommendation_decision ; workout_set = copie de la 0004 + difficulty', async () => {
    const table = (name: string) => SYNC_CATALOGUE.table(name) ?? (() => { throw new Error(name); })();
    for (const [name, columns] of CAPTURE_TABLES_V6) expect([...columns], name).toEqual([...publishedColumns(table(name))]);
    const v4Set = CAPTURE_TABLES_V4[1][1];
    expect(publishedColumns(table('workout_set')).filter((c) => c !== 'difficulty' && c !== 'circuit_id' && c !== 'circuit_rest_sec')).toEqual([...v4Set]);
    expect(publishedColumns(table('workout_set'))).toContain('difficulty');
    // Base arrêtée à la 0006 (I3-02 ajoute ensuite les deux déclencheurs de mesocycle).
    const db = await openSqliteWasmDriver();
    await migrate(db, migrations.slice(0, 6));
    const names = (await db.select<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name")).map((r) => r.name);
    expect(names).toHaveLength(24);
    for (const n of ['sync_progression_profile_ai', 'sync_progression_profile_au', 'sync_recommendation_decision_ai', 'sync_recommendation_decision_au', 'sync_workout_set_difficulty_au', 'sync_workout_close_decisions_au'])
      expect(names).toContain(n);
    // Revue de la #61 (D-27) : une décision suit sa séance, comme une série (parent, publiable seulement close).
    expect(table('recommendation_decision').parents).toEqual([{ column: 'workout_id', table: 'workout' }]);
    expect(table('recommendation_decision').publishWhen).toEqual({ parent: 'workout_id' });
    await db.close();
  });

  it('progression_profile et recommendation_decision (séance close) : insertion en ligne entière, modification champ par champ avec base_hlc, restauration « + »', async () => {
    const db = await freshDb();
    await insertWorkout(db, END);
    await db.execute('DELETE FROM sync_outbox');
    await insertProfile(db);
    await insertDecision(db);
    expect(await outbox(db)).toEqual([
      { table_name: 'progression_profile', row_id: P, field: '*' },
      { table_name: 'recommendation_decision', row_id: D, field: '*' },
    ]);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('UPDATE progression_profile SET confidence = 0.7, estimated_1rm_kg = 84, hlc = ? WHERE id = ?', [h(5), P]);
    expect((await outbox(db)).map((o) => o.field).sort()).toEqual(['confidence', 'estimated_1rm_kg']);
    expect(await db.select("SELECT field, hlc, base_hlc FROM sync_field_clock WHERE row_id = ? AND field IN ('*', 'confidence') ORDER BY field", [P])).toEqual([
      { field: '*', hlc: h(1), base_hlc: null },
      { field: 'confidence', hlc: h(5), base_hlc: h(1) },
    ]);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('UPDATE recommendation_decision SET deleted_at = ?, hlc = ? WHERE id = ?', [END, h(6), D]);
    await db.execute('UPDATE recommendation_decision SET deleted_at = NULL, hlc = ? WHERE id = ?', [h(7), D]);
    expect((await outbox(db)).map((o) => o.field).sort()).toEqual(['+', 'deleted_at']);
    await db.close();
  });

  it('difficulté : jamais capturée sur une séance ouverte ; part avec la séance à la clôture ; corrigée sur une séance close, capturée seule avec base_hlc', async () => {
    const db = await freshDb();
    await insertWorkout(db);
    await insertSet(db);
    await db.execute("UPDATE workout_set SET difficulty = 'hard', hlc = ? WHERE id = ?", [h(2), S1]);
    expect(await technical(db)).toEqual([]);
    await db.execute('UPDATE workout SET ended_at = ?, hlc = ? WHERE id = ?', [END, h(3), W]);
    expect(await outbox(db)).toEqual([
      { table_name: 'workout', row_id: W, field: '*' },
      { table_name: 'workout_set', row_id: S1, field: '*' },
    ]);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute("UPDATE workout_set SET difficulty = 'ok', hlc = ? WHERE id = ?", [h(4), S1]);
    expect(await outbox(db)).toEqual([{ table_name: 'workout_set', row_id: S1, field: 'difficulty' }]);
    expect(await db.select("SELECT field, hlc, base_hlc FROM sync_field_clock WHERE row_id = ? AND field = 'difficulty'", [S1])).toEqual([{ field: 'difficulty', hlc: h(4), base_hlc: h(2) }]);
    // Autres champs de la série : capture d'origine (0004) inchangée, la difficulté non touchée n'est pas remise en file.
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('UPDATE workout_set SET load_kg = 62.5, hlc = ? WHERE id = ?', [h(5), S1]);
    expect(await outbox(db)).toEqual([{ table_name: 'workout_set', row_id: S1, field: 'load_kg' }]);
    await db.close();
  });

  it('sous sync_guard : aucune capture des trois tables', async () => {
    const db = await freshDb();
    await db.execute('INSERT INTO sync_guard (id) VALUES (1)');
    await insertWorkout(db, END);
    await insertSet(db, 'easy');
    await db.execute("UPDATE workout_set SET difficulty = 'hard', hlc = ? WHERE id = ?", [h(2), S1]);
    await insertProfile(db);
    await insertDecision(db);
    await db.execute('UPDATE progression_profile SET confidence = 0.9, hlc = ? WHERE id = ?', [h(3), P]);
    expect(await technical(db)).toEqual([]);
    await db.close();
  });

  it('relance sans effet', async () => {
    const db = await freshDb();
    expect((await migrate(db, migrations)).applied).toEqual([]);
    await db.close();
  });
});
