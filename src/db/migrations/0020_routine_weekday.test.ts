import { describe, expect, it } from 'vitest';
import { publishedColumns, SYNC_CATALOGUE } from '../../domain/sync/syncTables';
import type { SqlDriver } from '../driver';
import { openSqliteWasmDriver } from '../drivers/sqliteWasm';
import { migrate } from '../migrator';
import { migration0020RoutineWeekday } from './0020_routine_weekday';
import { migrations } from './index';

/**
 * PROG-04 : migration 0020 — `routine_day.weekday` (jour de la semaine ISO 1 à 7, facultatif). Colonne PUBLIÉE, capturée à la création par le `_ai`
 * existant (ligne entière) et à la modification par un déclencheur propre. Rattachement des jours existants dont le nom commence par un jour de la
 * semaine, unique dans sa routine, sans mise en file (chaque appareil fait le même calcul en migrant). Données synthétiques.
 */
const DEV = '0f8fad5b-d9cb-469f-a165-70867728950e';
const AT = '2026-11-19T18:00:00.000Z';
const u = (n: number): string => `7a1b0c2d-0000-4000-8000-${String(n).padStart(12, '0')}`;
const h = (ms: number): string => `${String(ms).padStart(15, '0')}-0000-${DEV}`;

const dbAt = async (version: number): Promise<SqlDriver> => {
  const db = await openSqliteWasmDriver();
  await migrate(db, migrations.filter((m) => m.version <= version));
  return db;
};
const routine = (db: SqlDriver, id: string) => db.execute("INSERT INTO routine (id, name, mode, created_at, updated_at, device_id, hlc) VALUES (?, 'Programme', 'programme', ?, ?, ?, ?)", [id, AT, AT, DEV, h(1)]);
const day = (db: SqlDriver, id: string, routineId: string, name: string, order: number) =>
  db.execute('INSERT INTO routine_day (id, routine_id, name, day_order, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, routineId, name, order, AT, AT, DEV, h(1)]);
const outbox = async (db: SqlDriver): Promise<string[]> => (await db.select<{ field: string }>("SELECT field FROM sync_outbox WHERE table_name = 'routine_day' ORDER BY field")).map((r) => r.field);

describe('migration 0020 : routine_weekday (PROG-04)', () => {
  it('registre : 0001 à 0020 ; version 20, nom routine_weekday', () => {
    expect(migrations.map((m) => m.version)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(migrations[19]).toBe(migration0020RoutineWeekday);
    expect(migration0020RoutineWeekday.name).toBe('routine_weekday');
  });

  it('depuis la version 19 : jours nommés « Lundi — … » rattachés (unique par routine), les autres nuls, rien de mis en file', async () => {
    const db = await dbAt(19);
    await routine(db, u(1));
    await day(db, u(2), u(1), 'Lundi — Poussée', 1);
    await day(db, u(3), u(1), 'mardi - Bas du corps', 2);
    await day(db, u(4), u(1), 'Jeudi — Poussée', 3);
    await day(db, u(5), u(1), 'Haut A', 4);
    await day(db, u(6), u(1), 'Dimanche', 5);
    await routine(db, u(10));
    await day(db, u(11), u(10), 'Lundi A', 1);
    await day(db, u(12), u(10), 'Lundi B', 2);
    await day(db, u(13), u(10), 'Lundis', 3);
    await db.execute('DELETE FROM sync_outbox');
    await migrate(db, migrations);
    expect(await db.select('SELECT name, weekday FROM routine_day ORDER BY id')).toEqual([
      { name: 'Lundi — Poussée', weekday: 1 },
      { name: 'mardi - Bas du corps', weekday: 2 },
      { name: 'Jeudi — Poussée', weekday: 4 },
      { name: 'Haut A', weekday: null },
      { name: 'Dimanche', weekday: 7 },
      { name: 'Lundi A', weekday: null },
      { name: 'Lundi B', weekday: null },
      { name: 'Lundis', weekday: null },
    ]);
    expect(await db.select('SELECT 1 FROM sync_outbox')).toEqual([]);
    expect(await db.select('SELECT 1 FROM sync_guard')).toEqual([]);
  });

  it('contrainte : 1 à 7 ou nul', async () => {
    const db = await dbAt(20);
    await routine(db, u(1));
    await day(db, u(2), u(1), 'Jour', 1);
    await expect(db.execute('UPDATE routine_day SET weekday = 0 WHERE id = ?', [u(2)])).rejects.toThrow();
    await expect(db.execute('UPDATE routine_day SET weekday = 8 WHERE id = ?', [u(2)])).rejects.toThrow();
    await expect(db.execute('UPDATE routine_day SET weekday = 4 WHERE id = ?', [u(2)])).resolves.toBeDefined();
  });

  it('catalogue : colonne publiée', () => {
    expect([...publishedColumns(SYNC_CATALOGUE.table('routine_day') as never)]).toEqual(expect.arrayContaining(['weekday']));
  });

  it('modification : capturée champ par champ (déclencheur propre) ; garde de synchro : rien', async () => {
    const db = await dbAt(20);
    await routine(db, u(1));
    await day(db, u(2), u(1), 'Jour', 1);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('DELETE FROM sync_field_clock');
    await db.execute('UPDATE routine_day SET weekday = 4, updated_at = ?, hlc = ? WHERE id = ?', [AT, h(5), u(2)]);
    expect(await outbox(db)).toEqual(['weekday']);
    expect(await db.select("SELECT hlc, base_hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND field = 'weekday'")).toEqual([{ hlc: h(5), base_hlc: h(1) }]);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('INSERT INTO sync_guard (id) VALUES (1)');
    await db.execute('UPDATE routine_day SET weekday = 5, hlc = ? WHERE id = ?', [h(6), u(2)]);
    expect(await outbox(db)).toEqual([]);
  });
});
