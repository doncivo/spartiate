import { describe, expect, it } from 'vitest';
import { publishedColumns, SYNC_CATALOGUE } from '../../domain/sync/syncTables';
import type { SqlDriver } from '../driver';
import { openSqliteWasmDriver } from '../drivers/sqliteWasm';
import { migrate, readAppliedMigrations } from '../migrator';
import { migration0013WorkoutCircuit } from './0013_workout_circuit';
import { migrations } from './index';

/**
 * I6-03 : migration 0013 — groupement de circuit (superset, triset, circuit) sur les séries d'une séance : `workout_set.circuit_id` et
 * `workout_set.circuit_rest_sec`, colonnes PUBLIÉES avec la séance close (le rejeu et l'historique d'un autre appareil en ont besoin).
 * Schéma additif : aucune table, aucun déclencheur (les colonnes ne s'écrivent que sur une séance OUVERTE, jamais capturée, D-27 ; la
 * clôture met la ligne entière en file, colonnes comprises) ; aucune contrainte croisée entre colonnes (leçon A1 d'I6-01).
 */
const DEV = '0f8fad5b-d9cb-469f-a165-70867728950e';
const AT = '2026-11-12T18:00:00.000Z';
const W = '5e1a0c2d-0000-4000-8000-000000000001';
const S1 = '5e1a0c2d-0000-4000-8000-000000000011';
const h = (ms: number): string => `${String(ms).padStart(15, '0')}-0000-${DEV}`;

const dbAt = async (version: number): Promise<SqlDriver> => {
  const db = await openSqliteWasmDriver();
  await migrate(db, migrations.filter((m) => m.version <= version));
  return db;
};
const insertWorkout = (db: SqlDriver, endedAt: string | null = null): Promise<unknown> =>
  db.execute(`INSERT INTO workout (id, name, started_at, ended_at, source, created_at, updated_at, device_id, hlc) VALUES (?, 'Haut A', ?, ?, 'empty', ?, ?, ?, ?)`, [W, AT, endedAt, AT, AT, DEV, h(1)]);
const insertSet = (db: SqlDriver, circuitId: string | null, rest: number | null): Promise<unknown> =>
  db.execute(
    `INSERT INTO workout_set (id, workout_id, exercise_id, exercise_name, position, set_kind, circuit_id, circuit_rest_sec, created_at, updated_at, device_id, hlc)
     VALUES (?, ?, 'bench-press-barbell', 'Développé', 0, 'work', ?, ?, ?, ?, ?, ?)`,
    [S1, W, circuitId, rest, AT, AT, DEV, h(1)],
  );

describe('migration 0013 : workout_circuit (I6-03)', () => {
  it('registre : 0001 à 0013 ; version 13, nom workout_circuit', () => {
    expect(migrations.slice(0, 13).map((m) => m.version)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(migrations[12]).toBe(migration0013WorkoutCircuit);
    expect(migration0013WorkoutCircuit.name).toBe('workout_circuit');
  });

  it('base neuve : deux colonnes nulles par défaut, aucune table, aucun déclencheur ajouté', async () => {
    const before = await dbAt(12);
    const after = await dbAt(13);
    const names = async (db: SqlDriver) => (await db.select<{ name: string; type: string }>(`SELECT name, type FROM sqlite_master WHERE type IN ('table', 'trigger') ORDER BY name`)).map((r) => `${r.type}:${r.name}`);
    expect(await names(after)).toEqual(await names(before));
    await insertWorkout(after);
    await insertSet(after, null, null);
    expect(await after.select('SELECT circuit_id, circuit_rest_sec FROM workout_set')).toEqual([{ circuit_id: null, circuit_rest_sec: null }]);
    expect((await readAppliedMigrations(after)).map((m) => m.version)).toContain(13);
  });

  it('mise à jour depuis la version 12 : les séries existantes gardent toutes leurs valeurs, groupe nul', async () => {
    const db = await dbAt(12);
    await insertWorkout(db);
    await db.execute(
      `INSERT INTO workout_set (id, workout_id, exercise_id, exercise_name, position, set_kind, reps, load_kg, done, created_at, updated_at, device_id, hlc)
       VALUES (?, ?, 'bench-press-barbell', 'Développé', 0, 'work', 8, 60, 1, ?, ?, ?, ?)`,
      [S1, W, AT, AT, DEV, h(1)],
    );
    await migrate(db, migrations);
    expect(await db.select('SELECT reps, load_kg, done, circuit_id, circuit_rest_sec FROM workout_set')).toEqual([{ reps: 8, load_kg: 60, done: 1, circuit_id: null, circuit_rest_sec: null }]);
  });

  it('contraintes : identifiant de groupe de 1 à 64 caractères, repos de 0 à 3 600 s', async () => {
    const db = await dbAt(13);
    await insertWorkout(db);
    await expect(insertSet(db, '', null)).rejects.toThrow();
    await expect(insertSet(db, 'x'.repeat(65), null)).rejects.toThrow();
    await expect(insertSet(db, 'c1', -1)).rejects.toThrow();
    await expect(insertSet(db, 'c1', 3601)).rejects.toThrow();
    await expect(insertSet(db, 'c1', 0)).resolves.toBeDefined();
  });

  it('séance ouverte : l’écriture du groupe ne met rien en file (D-27)', async () => {
    const db = await dbAt(13);
    await insertWorkout(db);
    await insertSet(db, 'c1', 20);
    await db.execute('UPDATE workout_set SET circuit_rest_sec = 30, updated_at = ?, hlc = ? WHERE id = ?', [AT, h(2), S1]);
    expect(await db.select("SELECT 1 FROM sync_outbox WHERE table_name IN ('workout', 'workout_set')")).toEqual([]);
  });

  it('clôture : la série part en ligne entière, donc avec ses colonnes de groupe publiées', async () => {
    const db = await dbAt(13);
    await insertWorkout(db);
    await insertSet(db, 'c1', 20);
    await db.execute('UPDATE workout_set SET updated_at = ?, hlc = ? WHERE id = ?', [AT, h(3), S1]);
    await db.execute('UPDATE workout SET ended_at = ?, updated_at = ?, hlc = ? WHERE id = ?', ['2026-11-12T19:00:00.000Z', '2026-11-12T19:00:00.000Z', h(3), W]);
    expect(await db.select("SELECT table_name, field FROM sync_outbox WHERE table_name = 'workout_set'")).toEqual([{ table_name: 'workout_set', field: '*' }]);
    expect([...publishedColumns(SYNC_CATALOGUE.table('workout_set') as never)]).toEqual(expect.arrayContaining(['circuit_id', 'circuit_rest_sec']));
  });
});
