import { describe, expect, it } from 'vitest';
import { publishedColumns, SYNC_CATALOGUE } from '../../domain/sync/syncTables';
import type { SqlDriver } from '../driver';
import { openSqliteWasmDriver } from '../drivers/sqliteWasm';
import { migrate, readAppliedMigrations } from '../migrator';
import { migration0014RoutineCircuit } from './0014_routine_circuit';
import { migrations } from './index';

/**
 * I6-03b : migration 0014 — groupe de circuit (superset, triset, circuit) défini dans un jour de routine : `routine_exercise.circuit_id` et
 * `routine_exercise.circuit_rest_sec`, colonnes PUBLIÉES. Une routine se modifie à tout moment (pas de garde comme la séance close) : une écriture
 * des deux colonnes est capturée champ par champ par un déclencheur PROPRE (`sync_routine_exercise_circuit_au`, `AFTER UPDATE OF`, modèle de la
 * difficulté en 0006) ; le corps publié de `sync_routine_exercise_au` (0002) n'est pas modifié. Aucune contrainte croisée entre colonnes.
 */
const DEV = '0f8fad5b-d9cb-469f-a165-70867728950e';
const AT = '2026-11-12T18:00:00.000Z';
const R = '5e1a0c2d-0000-4000-8000-000000000101';
const D = '5e1a0c2d-0000-4000-8000-000000000102';
const L1 = '5e1a0c2d-0000-4000-8000-000000000103';
const h = (ms: number): string => `${String(ms).padStart(15, '0')}-0000-${DEV}`;

const dbAt = async (version: number): Promise<SqlDriver> => {
  const db = await openSqliteWasmDriver();
  await migrate(db, migrations.filter((m) => m.version <= version));
  return db;
};
const insertDay = async (db: SqlDriver): Promise<void> => {
  await db.execute(`INSERT INTO routine (id, name, mode, created_at, updated_at, device_id, hlc) VALUES (?, 'Haut / Bas', 'libre', ?, ?, ?, ?)`, [R, AT, AT, DEV, h(1)]);
  await db.execute(`INSERT INTO routine_day (id, routine_id, name, day_order, created_at, updated_at, device_id, hlc) VALUES (?, ?, 'Haut A', 1, ?, ?, ?, ?)`, [D, R, AT, AT, DEV, h(1)]);
};
const insertLine = (db: SqlDriver, circuitId: string | null, rest: number | null, id = L1): Promise<unknown> =>
  db.execute(
    `INSERT INTO routine_exercise (id, routine_day_id, exercise_id, exercise_name, sets, rep_min, rep_max, rir, rest_sec, position, circuit_id, circuit_rest_sec, created_at, updated_at, device_id, hlc)
     VALUES (?, ?, 'bench-press-barbell', 'Développé', 3, 6, 10, NULL, 120, 0, ?, ?, ?, ?, ?, ?)`,
    [id, D, circuitId, rest, AT, AT, DEV, h(1)],
  );
const names = async (db: SqlDriver) => (await db.select<{ name: string; type: string }>(`SELECT name, type FROM sqlite_master WHERE type IN ('table', 'trigger') ORDER BY name`)).map((r) => `${r.type}:${r.name}`);

describe('migration 0014 : routine_circuit (I6-03b)', () => {
  it('registre : 0001 à 0014 ; version 14, nom routine_circuit', () => {
    expect(migrations.slice(0, 14).map((m) => m.version)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(migrations[13]).toBe(migration0014RoutineCircuit);
    expect(migration0014RoutineCircuit.name).toBe('routine_circuit');
  });

  it('base neuve : deux colonnes nulles par défaut, aucune table, un seul déclencheur ajouté', async () => {
    const before = await dbAt(13);
    const after = await dbAt(14);
    expect([...(await names(after))].sort()).toEqual([...(await names(before)), 'trigger:sync_routine_exercise_circuit_au'].sort());
    await insertDay(after);
    await after.execute(
      `INSERT INTO routine_exercise (id, routine_day_id, exercise_id, exercise_name, sets, rep_min, rep_max, rest_sec, position, created_at, updated_at, device_id, hlc) VALUES (?, ?, 'row-barbell', 'Rowing', 3, 8, 12, 90, 1, ?, ?, ?, ?)`,
      [L1, D, AT, AT, DEV, h(1)],
    );
    expect(await after.select('SELECT circuit_id, circuit_rest_sec FROM routine_exercise')).toEqual([{ circuit_id: null, circuit_rest_sec: null }]);
    expect((await readAppliedMigrations(after)).map((m) => m.version)).toContain(14);
  });

  it('mise à jour depuis la version 13 : les lignes existantes gardent toutes leurs valeurs, groupe nul, rien de mis en file par la migration', async () => {
    const db = await dbAt(13);
    await insertDay(db);
    await db.execute(
      `INSERT INTO routine_exercise (id, routine_day_id, exercise_id, exercise_name, sets, rep_min, rep_max, rir, rest_sec, position, created_at, updated_at, device_id, hlc) VALUES (?, ?, 'bench-press-barbell', 'Développé', 4, 6, 10, 2, 150, 0, ?, ?, ?, ?)`,
      [L1, D, AT, AT, DEV, h(1)],
    );
    await db.execute('DELETE FROM sync_outbox');
    await migrate(db, migrations);
    expect(await db.select('SELECT sets, rir, rest_sec, circuit_id, circuit_rest_sec FROM routine_exercise')).toEqual([{ sets: 4, rir: 2, rest_sec: 150, circuit_id: null, circuit_rest_sec: null }]);
    expect(await db.select('SELECT 1 FROM sync_outbox')).toEqual([]);
  });

  it('contraintes : identifiant de groupe de 1 à 64 caractères, repos de 0 à 3 600 s', async () => {
    const db = await dbAt(14);
    await insertDay(db);
    await expect(insertLine(db, '', null)).rejects.toThrow();
    await expect(insertLine(db, 'x'.repeat(65), null)).rejects.toThrow();
    await expect(insertLine(db, 'c1', -1)).rejects.toThrow();
    await expect(insertLine(db, 'c1', 3601)).rejects.toThrow();
    await expect(insertLine(db, 'c1', 0)).resolves.toBeDefined();
  });

  it('création d’une ligne groupée : la ligne entière part en file (déclencheur _ai de la 0002), colonnes de groupe comprises', async () => {
    const db = await dbAt(14);
    await insertDay(db);
    await db.execute('DELETE FROM sync_outbox');
    await insertLine(db, 'c1', 15);
    expect(await db.select("SELECT field FROM sync_outbox WHERE table_name = 'routine_exercise'")).toEqual([{ field: '*' }]);
    expect([...publishedColumns(SYNC_CATALOGUE.table('routine_exercise') as never)].slice(-2)).toEqual(['circuit_id', 'circuit_rest_sec']);
  });

  it('modification du groupe d’une ligne existante : capturée champ par champ, horloge de base = horloge précédente de la ligne', async () => {
    const db = await dbAt(14);
    await insertDay(db);
    await insertLine(db, null, null);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('DELETE FROM sync_field_clock');
    await db.execute('UPDATE routine_exercise SET circuit_id = ?, circuit_rest_sec = ?, updated_at = ?, hlc = ? WHERE id = ?', ['c1', 20, AT, h(5), L1]);
    expect(await db.select<{ field: string }>("SELECT field FROM sync_outbox WHERE table_name = 'routine_exercise' ORDER BY field")).toEqual([{ field: 'circuit_id' }, { field: 'circuit_rest_sec' }]);
    const clocks = await db.select<{ field: string; hlc: string; base_hlc: string | null }>("SELECT field, hlc, base_hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' ORDER BY field");
    expect(clocks).toEqual([
      { field: '*', hlc: h(1), base_hlc: null },
      { field: 'circuit_id', hlc: h(5), base_hlc: h(1) },
      { field: 'circuit_rest_sec', hlc: h(5), base_hlc: h(1) },
    ]);
    // Effacer le groupe (« Défaire le groupe ») est aussi capturé ; une écriture sans changement ne met rien en file.
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('UPDATE routine_exercise SET circuit_id = NULL, circuit_rest_sec = NULL, updated_at = ?, hlc = ? WHERE id = ?', [AT, h(6), L1]);
    expect((await db.select<{ field: string }>("SELECT field FROM sync_outbox WHERE table_name = 'routine_exercise' ORDER BY field")).map((r) => r.field)).toEqual(['circuit_id', 'circuit_rest_sec']);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('UPDATE routine_exercise SET circuit_id = NULL, sets = 4, updated_at = ?, hlc = ? WHERE id = ?', [AT, h(7), L1]);
    expect((await db.select<{ field: string }>("SELECT field FROM sync_outbox WHERE table_name = 'routine_exercise' ORDER BY field")).map((r) => r.field)).toEqual(['sets']);
  });

  it('écriture appliquée par la synchro (garde sync_guard) : rien n’est capturé', async () => {
    const db = await dbAt(14);
    await insertDay(db);
    await insertLine(db, null, null);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('INSERT INTO sync_guard (id) VALUES (1)');
    await db.execute('UPDATE routine_exercise SET circuit_id = ?, circuit_rest_sec = ?, hlc = ? WHERE id = ?', ['c1', 20, h(5), L1]);
    await db.execute('DELETE FROM sync_guard');
    expect(await db.select('SELECT 1 FROM sync_outbox')).toEqual([]);
  });
});
