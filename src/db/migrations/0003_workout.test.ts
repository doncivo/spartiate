import { describe, expect, it } from 'vitest';
import { SYNC_CATALOGUE } from '../../domain/sync/syncTables';
import type { SqlDriver } from '../driver';
import { openSqliteWasmDriver } from '../drivers/sqliteWasm';
import { migrate, migrationChecksum, readAppliedMigrations } from '../migrator';
import { migration0001SpartiateInit } from './0001_spartiate_init';
import { migration0002Training } from './0002_training';
import { migration0003Workout } from './0003_workout';
import { migrations } from './index';

/** I1-02 : migration 0003 (séance active locale), D-27 : une séance ouverte reste locale, donc ni catalogue ni déclencheurs de capture. */

const DEV = '0f8fad5b-d9cb-469f-a165-70867728950e';
const h = (ms: number): string => `${String(ms).padStart(15, '0')}-0000-${DEV}`;
const AT = '2026-11-02T17:00:00.000Z';
const W = '5e1a0c2d-0000-4000-8000-000000000001';
const S = '5e1a0c2d-0000-4000-8000-000000000011';

async function freshDb(): Promise<SqlDriver> {
  const db = await openSqliteWasmDriver();
  await migrate(db, migrations);
  return db;
}

const names = async (db: SqlDriver, type: string): Promise<string[]> =>
  (await db.select<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%' ORDER BY name`, [type])).map((r) => r.name);
const cols = async (db: SqlDriver, table: string): Promise<string[]> =>
  (await db.select<{ name: string; type: string; notnull: number; pk: number }>(`PRAGMA table_info(${table})`)).map((c) => `${c.name}:${c.type}:${c.notnull}:${c.pk}`);

const COMMON = ['created_at:TEXT:1:0', 'updated_at:TEXT:1:0', 'deleted_at:TEXT:0:0', 'device_id:TEXT:1:0', 'hlc:TEXT:1:0'];

const insertWorkout = (db: SqlDriver, id = W, over: Record<string, unknown> = {}): Promise<unknown> => {
  const v = { name: 'Haut A', source: 'empty', ...over };
  return db.execute(
    `INSERT INTO workout (id, name, started_at, source, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, v.name as string, AT, v.source as string, AT, AT, DEV, h(1)],
  );
};
const insertSet = (db: SqlDriver, id = S, workoutId = W, over: Record<string, unknown> = {}): Promise<unknown> => {
  const v = { position: 0, set_kind: 'work', ...over };
  return db.execute(
    `INSERT INTO workout_set (id, workout_id, exercise_id, exercise_name, position, set_kind, created_at, updated_at, device_id, hlc) VALUES (?, ?, 'bench-press-barbell', 'Développé', ?, ?, ?, ?, ?, ?)`,
    [id, workoutId, v.position as number, v.set_kind as string, AT, AT, DEV, h(1)],
  );
};

describe('migration 0003 : workout (I1-02, D-27, D-71)', () => {
  it('registre : 0001, 0002 puis 0003 (version 3, workout) ; 0001 et 0002 inchangées', () => {
    expect(migrations).toEqual([migration0001SpartiateInit, migration0002Training, migration0003Workout]);
    expect(migration0003Workout.version).toBe(3);
    expect(migration0003Workout.name).toBe('workout');
  });

  it('base vide : workout et workout_set créées, index explicites présents, aucun déclencheur ajouté', async () => {
    const db = await freshDb();
    const tables = await names(db, 'table');
    expect(tables).toContain('workout');
    expect(tables).toContain('workout_set');
    for (const t of ['mesocycle', 'recommendation_decision']) expect(tables).not.toContain(t);
    const indexes = await names(db, 'index');
    for (const i of ['idx_workout_open', 'idx_workout_started', 'idx_workout_set_workout', 'idx_workout_set_exercise']) expect(indexes).toContain(i);
    const triggers = await names(db, 'trigger');
    expect(triggers).toHaveLength(14);
    expect(triggers.filter((t) => /workout/.test(t))).toEqual([]);
    expect(await db.select('PRAGMA integrity_check')).toEqual([{ integrity_check: 'ok' }]);
    await db.close();
  });

  it('colonnes exactes des deux tables (types, nullabilités)', async () => {
    const db = await freshDb();
    expect(await cols(db, 'workout')).toEqual([
      'id:TEXT:1:1',
      'routine_id:TEXT:0:0',
      'routine_day_id:TEXT:0:0',
      'name:TEXT:1:0',
      'started_at:TEXT:1:0',
      'ended_at:TEXT:0:0',
      'source:TEXT:1:0',
      'copied_from_workout_id:TEXT:0:0',
      'rest_timer_end_at:TEXT:0:0',
      'rest_timer_seconds:INTEGER:1:0',
      'notes:TEXT:1:0',
      ...COMMON,
    ]);
    expect(await cols(db, 'workout_set')).toEqual([
      'id:TEXT:1:1',
      'workout_id:TEXT:1:0',
      'exercise_id:TEXT:1:0',
      'exercise_name:TEXT:1:0',
      'position:INTEGER:1:0',
      'set_kind:TEXT:1:0',
      'target_reps_min:INTEGER:0:0',
      'target_reps_max:INTEGER:0:0',
      'target_load_kg:REAL:0:0',
      'target_rest_sec:INTEGER:0:0',
      'reps:INTEGER:0:0',
      'load_kg:REAL:0:0',
      'duration_sec:INTEGER:0:0',
      'rir:INTEGER:0:0',
      'done:INTEGER:1:0',
      'done_at:TEXT:0:0',
      ...COMMON,
    ]);
    await db.close();
  });

  it('0001 → 0002 → 0003 clés étrangères actives : données conservées, aucune violation, sauvegarde d’historique', async () => {
    const db = await openSqliteWasmDriver();
    await migrate(db, [migration0001SpartiateInit, migration0002Training]);
    expect(await db.select('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 1 }]);
    await db.execute("INSERT INTO routine (id, name, mode, created_at, updated_at, device_id, hlc) VALUES ('5e1a0c2d-0000-4000-8000-0000000000a1', 'Haut / Bas', 'programme', ?, ?, ?, ?)", [AT, AT, DEV, h(1)]);
    await db.execute("INSERT INTO body_weight (id, date, kg, source, timezone, created_at, updated_at, device_id, hlc) VALUES ('weight|2026-11-01|manual', '2026-11-01', 82.4, 'manual', 'Europe/Paris', ?, ?, ?, ?)", [AT, AT, DEV, h(1)]);
    const outboxBefore = await db.select('SELECT * FROM sync_outbox ORDER BY seq');
    const report = await migrate(db, migrations);
    expect(report.applied).toEqual([3]);
    expect(await db.select('SELECT name FROM routine')).toEqual([{ name: 'Haut / Bas' }]);
    expect(await db.select('SELECT kg FROM body_weight')).toEqual([{ kg: 82.4 }]);
    expect(await db.select('SELECT * FROM sync_outbox ORDER BY seq')).toEqual(outboxBefore);
    expect(await db.select('PRAGMA foreign_key_check')).toEqual([]);
    expect(await db.select('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 1 }]);
    const applied = await readAppliedMigrations(db);
    expect(applied.map((a) => [a.version, a.name, a.checksum])).toEqual([
      [1, 'spartiate_init', migrationChecksum(migration0001SpartiateInit)],
      [2, 'training', migrationChecksum(migration0002Training)],
      [3, 'workout', migrationChecksum(migration0003Workout)],
    ]);
    await db.close();
  });

  it('références : workout_set.workout_id est la seule clé étrangère, sans CASCADE ; routine et exercice restent des références logiques', async () => {
    const db = await freshDb();
    expect(await db.select('PRAGMA foreign_key_list(workout)')).toEqual([]);
    const fks = await db.select<{ table: string; from: string }>('PRAGMA foreign_key_list(workout_set)');
    expect(fks.map((f) => `${f.from}->${f.table}`)).toEqual(['workout_id->workout']);
    const ddl = await db.select<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name IN ('workout', 'workout_set')");
    expect(ddl.some((t) => /CASCADE|SET NULL/i.test(t.sql))).toBe(false);
    await insertWorkout(db, W, {});
    await db.execute("UPDATE workout SET routine_id = 'routine-inconnue', routine_day_id = 'jour-inconnu', copied_from_workout_id = 'seance-absente' WHERE id = ?", [W]);
    await expect(insertSet(db, S, '5e1a0c2d-0000-4000-8000-0000000000ee')).rejects.toThrow();
    await insertSet(db);
    await expect(db.execute('DELETE FROM workout WHERE id = ?', [W])).rejects.toThrow();
    await db.close();
  });

  it('CHECK : source, type de série, positions et valeurs de saisie', async () => {
    const db = await freshDb();
    await expect(insertWorkout(db, W, { source: 'import' })).rejects.toThrow();
    for (const source of ['empty', 'routine', 'copy']) await insertWorkout(db, `5e1a0c2d-0000-4000-8000-0000000000${source.length}0`, { source });
    await insertWorkout(db);
    await expect(insertSet(db, S, W, { set_kind: 'failure' })).rejects.toThrow();
    await expect(insertSet(db, S, W, { position: -1 })).rejects.toThrow();
    for (const [i, k] of ['warmup', 'work', 'drop', 'partial', 'timed'].entries()) await insertSet(db, `5e1a0c2d-0000-4000-8000-0000000002${String(i).padStart(2, '0')}`, W, { set_kind: k });
    await insertSet(db);
    await expect(db.execute('UPDATE workout_set SET done = 2 WHERE id = ?', [S])).rejects.toThrow();
    await expect(db.execute('UPDATE workout_set SET reps = 0 WHERE id = ?', [S])).rejects.toThrow();
    await expect(db.execute('UPDATE workout_set SET rir = 6 WHERE id = ?', [S])).rejects.toThrow();
    await expect(db.execute('UPDATE workout_set SET load_kg = -1 WHERE id = ?', [S])).rejects.toThrow();
    await expect(db.execute('UPDATE workout SET rest_timer_seconds = -1 WHERE id = ?', [W])).rejects.toThrow();
    await expect(db.execute('UPDATE workout_set SET target_reps_min = 10, target_reps_max = 8 WHERE id = ?', [S])).rejects.toThrow();
    await db.close();
  });

  it('D-27 : ni insertion, ni modification, ni suppression logique, ni restauration ne touche la file de synchro', async () => {
    const db = await freshDb();
    await insertWorkout(db);
    await insertSet(db);
    await db.execute("UPDATE workout_set SET reps = 8, load_kg = 60, done = 1, done_at = ?, hlc = ? WHERE id = ?", [AT, h(2), S]);
    await db.execute('UPDATE workout SET rest_timer_end_at = ?, hlc = ? WHERE id = ?', [AT, h(2), W]);
    await db.execute('UPDATE workout_set SET deleted_at = ?, hlc = ? WHERE id = ?', [AT, h(3), S]);
    await db.execute('UPDATE workout_set SET deleted_at = NULL, hlc = ? WHERE id = ?', [h(4), S]);
    await db.execute('UPDATE workout SET deleted_at = ?, hlc = ? WHERE id = ?', [AT, h(3), W]);
    expect(await db.select('SELECT * FROM sync_outbox')).toEqual([]);
    expect(await db.select('SELECT * FROM sync_field_clock')).toEqual([]);
    expect(await db.select('SELECT * FROM sync_tombstone')).toEqual([]);
    await db.close();
  });

  it('D-27 : workout et workout_set ne sont pas dans le catalogue de synchro (I1-03 les ajoutera avec des déclencheurs gardés)', () => {
    expect(SYNC_CATALOGUE.table('workout')).toBeUndefined();
    expect(SYNC_CATALOGUE.table('workout_set')).toBeUndefined();
  });

  it('plans : séance ouverte et séries par séance sans balayage de table', async () => {
    const db = await freshDb();
    const open = await db.select<{ detail: string }>("EXPLAIN QUERY PLAN SELECT * FROM workout WHERE ended_at IS NULL AND deleted_at IS NULL ORDER BY started_at DESC LIMIT 1");
    expect(open.map((r) => r.detail).join(' ')).toMatch(/idx_workout_(open|started)/);
    const sets = await db.select<{ detail: string }>('EXPLAIN QUERY PLAN SELECT * FROM workout_set WHERE workout_id = ? AND deleted_at IS NULL ORDER BY position, id', [W]);
    expect(sets.map((r) => r.detail).join(' ')).toMatch(/idx_workout_set_workout/);
    const byExercise = await db.select<{ detail: string }>("EXPLAIN QUERY PLAN SELECT * FROM workout_set WHERE exercise_id = ? ORDER BY created_at DESC", ['x']);
    expect(byExercise.map((r) => r.detail).join(' ')).toMatch(/idx_workout_set_exercise/);
    await db.close();
  });

  it('relance sans effet', async () => {
    const db = await freshDb();
    expect((await migrate(db, migrations)).applied).toEqual([]);
    await db.close();
  });
});
