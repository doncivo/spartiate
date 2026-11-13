import { describe, expect, it } from 'vitest';
import { SYNC_CATALOGUE, publishedColumns } from '../../domain/sync/syncTables';
import type { SqlDriver } from '../driver';
import { openSqliteWasmDriver } from '../drivers/sqliteWasm';
import { migrate } from '../migrator';
import { CAPTURE_TABLES_V7, migration0007Mesocycle } from './0007_mesocycle';
import { migrations } from './index';

/**
 * I3-02 : migration 0007 — table `mesocycle` (§ 20.2, publiée, UUID) : routine suivie (référence logique), début, durée ou blocs illimités,
 * deload planifié ou anticipé, origine de bloc, rotation, pauses (JSON), statut et issue du bilan. Déclencheurs de capture sur le modèle de la
 * 0002 (aucune séance ouverte en jeu : D-27 inchangé). Aucune migration publiée modifiée.
 */

const DEV = '0f8fad5b-d9cb-469f-a165-70867728950e';
const h = (ms: number): string => `${String(ms).padStart(15, '0')}-0000-${DEV}`;
const AT = '2026-11-08T08:00:00.000Z';
const M = '6c2b1d3e-0000-4000-8000-000000000001';
const R = '6c2b1d3e-0000-4000-8000-0000000000aa';

async function freshDb(): Promise<SqlDriver> {
  const db = await openSqliteWasmDriver();
  await migrate(db, migrations);
  return db;
}
const insert = (db: SqlDriver, over: Record<string, unknown> = {}): Promise<unknown> => {
  const row: Record<string, unknown> = {
    id: M,
    routine_id: R,
    start_date: '2026-11-02',
    weeks: 5,
    unlimited: 0,
    deload_week: null,
    block_origin_week: 1,
    block_origin_index: 0,
    rotation_index: 0,
    pauses: '[]',
    status: 'active',
    outcome: null,
    ended_on: null,
    created_at: AT,
    updated_at: AT,
    device_id: DEV,
    hlc: h(1),
    ...over,
  };
  const cols = Object.keys(row);
  return db.execute(`INSERT INTO mesocycle (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map((c) => row[c] as string | number | null));
};
const outbox = (db: SqlDriver) => db.select<{ table_name: string; row_id: string; field: string }>('SELECT table_name, row_id, field FROM sync_outbox ORDER BY seq');

describe('migration 0007 : mesocycle (I3-02)', () => {
  it('registre : 0001 à 0007 en tête (la 0008 de nutrition suit) ; version 7, nom mesocycle', () => {
    expect(migrations.slice(0, 7).map((m) => m.version)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(migrations[6]).toBe(migration0007Mesocycle);
    expect(migration0007Mesocycle.name).toBe('mesocycle');
  });

  it('0006 → 0007 : table créée vide, rien mis en file, les données existantes intactes', async () => {
    const db = await openSqliteWasmDriver();
    await migrate(db, migrations.slice(0, 6));
    await db.execute('DELETE FROM sync_outbox');
    await migrate(db, migrations);
    expect(await db.select('SELECT * FROM mesocycle')).toEqual([]);
    expect(await outbox(db)).toEqual([]);
    await db.close();
  });

  it('CHECK : durée 4 à 7, statut, issue, booléen, semaines et index positifs', async () => {
    const db = await freshDb();
    for (const [i, bad] of (
      [
        { weeks: 3 },
        { weeks: 8 },
        { status: 'paused' },
        { outcome: 'other' },
        { unlimited: 2 },
        { deload_week: 0 },
        { block_origin_week: 0 },
        { block_origin_index: -1 },
        { rotation_index: -1 },
        { routine_id: '' },
      ] as const
    ).entries())
      await expect(insert(db, { id: `6c2b1d3e-0000-4000-8000-0000000001${String(i).padStart(2, '0')}`, ...bad }), JSON.stringify(bad)).rejects.toThrow();
    await insert(db, { status: 'completed', outcome: 'repeat', ended_on: '2026-12-07' });
    await db.close();
  });

  it('copie figée = catalogue ; capture : insertion en ligne entière, modification champ par champ avec base_hlc, restauration « + »', async () => {
    const table = SYNC_CATALOGUE.table('mesocycle');
    if (!table) throw new Error('mesocycle absent du catalogue');
    for (const [name, columns] of CAPTURE_TABLES_V7) expect([...columns], name).toEqual([...publishedColumns(table)].filter((c) => c !== 'next_weeks' && c !== 'ramp_up')); // 0019 (PROG-01) : capture propre
    const db = await freshDb();
    await insert(db);
    expect(await outbox(db)).toEqual([{ table_name: 'mesocycle', row_id: M, field: '*' }]);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute(`UPDATE mesocycle SET pauses = '[{"from":"2026-11-09","to":null,"lightWeek":false}]', hlc = ? WHERE id = ?`, [h(5), M]);
    expect(await outbox(db)).toEqual([{ table_name: 'mesocycle', row_id: M, field: 'pauses' }]);
    expect(await db.select("SELECT field, hlc, base_hlc FROM sync_field_clock WHERE row_id = ? ORDER BY field", [M])).toEqual([
      { field: '*', hlc: h(1), base_hlc: null },
      { field: 'pauses', hlc: h(5), base_hlc: h(1) },
    ]);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('UPDATE mesocycle SET deleted_at = ?, hlc = ? WHERE id = ?', [AT, h(6), M]);
    await db.execute('UPDATE mesocycle SET deleted_at = NULL, hlc = ? WHERE id = ?', [h(7), M]);
    expect((await outbox(db)).map((o) => o.field).sort()).toEqual(['+', 'deleted_at']);
    await db.close();
  });

  it('sous sync_guard : aucune capture ; relance sans effet', async () => {
    const db = await freshDb();
    await db.execute('INSERT INTO sync_guard (id) VALUES (1)');
    await insert(db);
    await db.execute("UPDATE mesocycle SET status = 'completed', outcome = 'stopped', ended_on = '2026-11-08', hlc = ? WHERE id = ?", [h(2), M]);
    expect(await outbox(db)).toEqual([]);
    expect(await db.select('SELECT * FROM sync_field_clock')).toEqual([]);
    expect((await migrate(db, migrations)).applied).toEqual([]);
    await db.close();
  });
});
