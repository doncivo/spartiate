import { describe, expect, it } from 'vitest';
import { SYNC_CATALOGUE, publishedColumns } from '../../domain/sync/syncTables';
import type { SqlDriver } from '../driver';
import { openSqliteWasmDriver } from '../drivers/sqliteWasm';
import { migrate, migrationChecksum, readAppliedMigrations } from '../migrator';
import { CAPTURE_TABLES_V4, migration0004WorkoutSync } from './0004_workout_sync';
import { migrations } from './index';

/** I1-03 : migration 0004 (publication des séances closes, D-27) : déclencheurs gardés, clôture = agrégat en file d'un bloc. */

const DEV = '0f8fad5b-d9cb-469f-a165-70867728950e';
const h = (ms: number): string => `${String(ms).padStart(15, '0')}-0000-${DEV}`;
const AT = '2026-11-02T17:00:00.000Z';
const END = '2026-11-02T18:00:00.000Z';
const W = '5e1a0c2d-0000-4000-8000-000000000001';
const S1 = '5e1a0c2d-0000-4000-8000-000000000011';
const S2 = '5e1a0c2d-0000-4000-8000-000000000012';

async function freshDb(): Promise<SqlDriver> {
  const db = await openSqliteWasmDriver();
  await migrate(db, migrations);
  return db;
}

const insertWorkout = (db: SqlDriver, id = W, endedAt: string | null = null): Promise<unknown> =>
  db.execute(`INSERT INTO workout (id, name, started_at, ended_at, source, created_at, updated_at, device_id, hlc) VALUES (?, 'Haut A', ?, ?, 'empty', ?, ?, ?, ?)`, [id, AT, endedAt, AT, AT, DEV, h(1)]);
const insertSet = (db: SqlDriver, id: string, position: number, workoutId = W): Promise<unknown> =>
  db.execute(
    `INSERT INTO workout_set (id, workout_id, exercise_id, exercise_name, position, set_kind, created_at, updated_at, device_id, hlc) VALUES (?, ?, 'bench-press-barbell', 'Développé', ?, 'work', ?, ?, ?, ?)`,
    [id, workoutId, position, AT, AT, DEV, h(1)],
  );
const outbox = (db: SqlDriver) => db.select<{ table_name: string; row_id: string; field: string }>('SELECT table_name, row_id, field FROM sync_outbox ORDER BY seq');
const technical = async (db: SqlDriver): Promise<unknown[]> => [
  ...(await db.select('SELECT * FROM sync_outbox')),
  ...(await db.select('SELECT * FROM sync_field_clock')),
  ...(await db.select('SELECT * FROM sync_tombstone')),
];

describe('migration 0004 : workout_sync (I1-03, D-27)', () => {
  it('registre : 0004 suit 0001 à 0003 (0005 ensuite, I2-01) ; version 4, nom workout_sync', () => {
    expect(migrations.slice(0, 4).map((m) => m.version)).toEqual([1, 2, 3, 4]);
    expect(migrations[3]).toBe(migration0004WorkoutSync);
    expect(migration0004WorkoutSync.name).toBe('workout_sync');
  });

  it('0003 → 0004 clés étrangères actives : séance ouverte et séance close conservées, aucune violation, aucune capture rétroactive', async () => {
    const db = await openSqliteWasmDriver();
    await migrate(db, migrations.slice(0, 3));
    await insertWorkout(db);
    await insertSet(db, S1, 0);
    await insertWorkout(db, '5e1a0c2d-0000-4000-8000-000000000002', END);
    expect(await db.select('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 1 }]);
    const report = await migrate(db, migrations.slice(0, 4));
    expect(report.applied).toEqual([4]);
    expect(await db.select('SELECT id FROM workout ORDER BY id')).toHaveLength(2);
    expect(await db.select('SELECT corrected_at FROM workout_set')).toEqual([{ corrected_at: null }]);
    expect(await technical(db)).toEqual([]);
    expect(await db.select('PRAGMA foreign_key_check')).toEqual([]);
    expect((await readAppliedMigrations(db)).at(-1)).toMatchObject({ version: 4, name: 'workout_sync', checksum: migrationChecksum(migration0004WorkoutSync) });
    await db.close();
  });

  it('copie figée de capture = colonnes publiées du catalogue ; colonnes locales du repos absentes des déclencheurs', async () => {
    // La 0006 (I2-01) ajoute `workout_set.difficulty`, capturée par son propre déclencheur ; la 0013 (I6-03) ajoute les colonnes de groupe, jamais capturées (séance ouverte, clôture en ligne entière) : la copie de la 0004 reste le reste du catalogue.
    for (const [table, columns] of CAPTURE_TABLES_V4) expect([...columns], table).toEqual([...publishedColumns(SYNC_CATALOGUE.table(table) ?? (() => { throw new Error(table); })())].filter((c) => c !== 'difficulty' && c !== 'circuit_id' && c !== 'circuit_rest_sec'));
    const db = await freshDb();
    const triggers = await db.select<{ name: string; sql: string }>("SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'sync_workout%' ORDER BY name");
    expect(triggers.map((t) => t.name)).toEqual(['sync_workout_ai', 'sync_workout_au', 'sync_workout_close_decisions_au', 'sync_workout_set_ai', 'sync_workout_set_au', 'sync_workout_set_difficulty_au']);
    expect(triggers.some((t) => /rest_timer/.test(t.sql))).toBe(false);
    expect(triggers.every((t) => /ended_at/.test(t.sql))).toBe(true);
    // 18 en version 4 ; 24 avec la 0006 (I2-01 : deux tables de progression, la difficulté, les décisions à la clôture) ; 26 avec la 0007 (I3-02 : mesocycle) ; 34 avec la 0008 (I4-02 : food, food_portion, meal_entry, nutrition_target) ; 40 avec la 0009 (I4-07 : day_completeness, recipe, recipe_ingredient) ; 44 avec la 0010 (I5-01 : recovery_day, muscle_recovery) ; 46 avec la 0011 (I6-01 : recovery_factor).
    expect((await db.select<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'trigger'")).length).toBe(59); // 59 avec la 0017 (I6-05 : compléments et prises) ; 50 avec la 0012 (I6-02) ; 51 avec la 0014 (I6-03b : capture propre des colonnes de groupe de routine_exercise) ; 53 avec la 0015 (FIX-0181 : food_favorite) ; 55 avec la 0016 (RESET-01 : data_reset).
    await db.close();
  });

  it('séance ouverte : insertion, saisie, ajout et retrait de séries, repos, abandon : rien dans la file, les horloges ni les traces', async () => {
    const db = await freshDb();
    await insertWorkout(db);
    await insertSet(db, S1, 0);
    await insertSet(db, S2, 1);
    await db.execute('UPDATE workout_set SET reps = 8, load_kg = 60, done = 1, done_at = ?, hlc = ? WHERE id = ?', [AT, h(2), S1]);
    await db.execute('UPDATE workout SET rest_timer_end_at = ?, rest_timer_seconds = 90, notes = ?, hlc = ? WHERE id = ?', [AT, 'note', h(3), W]);
    await db.execute('UPDATE workout_set SET deleted_at = ?, hlc = ? WHERE id = ?', [AT, h(4), S2]);
    await db.execute('UPDATE workout SET deleted_at = ?, hlc = ? WHERE id = ?', [AT, h(5), W]);
    expect(await technical(db)).toEqual([]);
    await db.close();
  });

  it('clôture : la séance puis toutes ses séries en ligne entière, dans la même instruction, sans horloge de champ', async () => {
    const db = await freshDb();
    await insertWorkout(db);
    await insertSet(db, S2, 1);
    await insertSet(db, S1, 0);
    await db.execute('UPDATE workout SET ended_at = ?, hlc = ? WHERE id = ?', [END, h(9), W]);
    expect(await outbox(db)).toEqual([
      { table_name: 'workout', row_id: W, field: '*' },
      { table_name: 'workout_set', row_id: S1, field: '*' },
      { table_name: 'workout_set', row_id: S2, field: '*' },
    ]);
    expect(await db.select('SELECT * FROM sync_field_clock')).toEqual([]);
    await db.close();
  });

  it('séance close : correction champ par champ avec base_hlc ; série ajoutée en ligne entière ; suppression logique puis restauration « + »', async () => {
    const db = await freshDb();
    await insertWorkout(db, W, END);
    await insertSet(db, S1, 0);
    expect(await outbox(db)).toEqual([
      { table_name: 'workout', row_id: W, field: '*' },
      { table_name: 'workout_set', row_id: S1, field: '*' },
    ]);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('UPDATE workout_set SET load_kg = 62.5, corrected_at = ?, hlc = ? WHERE id = ?', [END, h(10), S1]);
    expect((await outbox(db)).map((o) => o.field).sort()).toEqual(['corrected_at', 'load_kg']);
    expect(await db.select("SELECT field, hlc, base_hlc FROM sync_field_clock WHERE row_id = ? AND field IN ('*', 'load_kg') ORDER BY field", [S1])).toEqual([
      { field: '*', hlc: h(1), base_hlc: null },
      { field: 'load_kg', hlc: h(10), base_hlc: h(1) },
    ]);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('UPDATE workout SET rest_timer_end_at = ?, hlc = ? WHERE id = ?', [END, h(11), W]);
    expect(await outbox(db)).toEqual([]);
    await db.execute('UPDATE workout SET deleted_at = ?, hlc = ? WHERE id = ?', [END, h(12), W]);
    await db.execute('UPDATE workout SET deleted_at = NULL, hlc = ? WHERE id = ?', [h(13), W]);
    expect((await outbox(db)).map((o) => o.field).sort()).toEqual(['+', 'deleted_at']);
    await db.close();
  });

  it('sous sync_guard (application d’un enregistrement reçu) : aucune capture, même pour une séance close', async () => {
    const db = await freshDb();
    await db.execute('INSERT INTO sync_guard (id) VALUES (1)');
    await insertWorkout(db, W, END);
    await insertSet(db, S1, 0);
    await db.execute('UPDATE workout_set SET reps = 5, hlc = ? WHERE id = ?', [h(2), S1]);
    expect(await technical(db)).toEqual([]);
    await db.close();
  });

  it('relance sans effet', async () => {
    const db = await freshDb();
    expect((await migrate(db, migrations)).applied).toEqual([]);
    await db.close();
  });
});
