import { describe, expect, it } from 'vitest';
import type { SqlDriver } from '../driver';
import { openSqliteWasmDriver } from '../drivers/sqliteWasm';
import { migrate } from '../migrator';
import { CAPTURE_TABLES_V17, migration0017Cardio } from './0017_cardio';
import { migrations } from './index';

/**
 * I6-06 (D-221) : migration 0017 (schéma 17) — `cardio_session` PUBLIÉE (écrite par les deux appareils) et `cardio_track` LOCALE (tracé GPS, jamais
 * publié ni exporté). DEUX TABLES NEUVES ; AUCUNE table existante n'est modifiée ; aucune donnée migrée.
 */
const DEV = '0f8fad5b-d9cb-469f-a165-70867728950e';
const h = (ms: number): string => `${String(ms).padStart(15, '0')}-0000-${DEV}`;
const AT = '2026-11-13T08:00:00.000Z';
const INDEX = migrations.findIndex((m) => m === migration0017Cardio);
const BASE = INDEX + 1;
const S1 = '30000000-0000-4000-8000-000000000001';
const S2 = '30000000-0000-4000-8000-000000000002';

async function freshDb(): Promise<SqlDriver> {
  const db = await openSqliteWasmDriver();
  await migrate(db, migrations.slice(0, BASE));
  return db;
}
type Row = Record<string, string | number | null>;
const session = (over: Row = {}): Row => ({
  id: S1, kind: 'run', started_at: AT, duration_sec: 2700, distance_m: 7500, avg_hr: 152, rpe: 7, source: 'manual', notes: '', created_at: AT, updated_at: AT, device_id: DEV, hlc: h(1), ...over,
});
const insert = (db: SqlDriver, table: string, row: Row): Promise<unknown> => {
  const cols = Object.keys(row);
  return db.execute(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map((c) => row[c] ?? null));
};
const outbox = (db: SqlDriver) => db.select<{ table_name: string; row_id: string; field: string }>('SELECT table_name, row_id, field FROM sync_outbox ORDER BY seq');

describe('migration 0017 : cardio (I6-06, schéma 17)', () => {
  it('registre : version 17, nom cardio, après la 0016 (data_reset) ; toutes les versions se suivent', () => {
    expect(INDEX).toBeGreaterThanOrEqual(16);
    expect(migration0017Cardio.version).toBe(INDEX + 1);
    expect(migration0017Cardio.name).toBe('cardio');
    expect(migrations.map((m) => m.version)).toEqual(migrations.map((_, i) => i + 1));
  });

  it('base précédente → 0017 : deux tables vides, un index, deux déclencheurs, rien mis en file, AUCUN objet existant modifié', async () => {
    const db = await openSqliteWasmDriver();
    await migrate(db, migrations.slice(0, BASE - 1));
    await db.execute('DELETE FROM sync_outbox');
    const before = await db.select<{ name: string; sql: string }>("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name");
    const triggersBefore = (await db.select("SELECT 1 FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'sync_%'")).length;
    await migrate(db, migrations.slice(0, BASE));
    const after = await db.select<{ name: string; sql: string }>("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name");
    const beforeNames = new Set(before.map((r) => r.name));
    for (const row of before) expect(after.find((r) => r.name === row.name), row.name).toEqual(row);
    expect(after.filter((r) => !beforeNames.has(r.name)).map((r) => r.name).sort()).toEqual(['cardio_session', 'cardio_session_started_idx', 'cardio_track', 'sync_cardio_session_ai', 'sync_cardio_session_au']);
    expect(await db.select('SELECT * FROM cardio_session')).toEqual([]);
    expect(await db.select('SELECT * FROM cardio_track')).toEqual([]);
    expect(await outbox(db)).toEqual([]);
    expect((await db.select("SELECT 1 FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'sync_%'")).length).toBe(triggersBefore + 2);
    await db.close();
  });

  it('copie figée des colonnes capturées (le tracé n’en fait pas partie)', () => {
    expect(CAPTURE_TABLES_V17).toEqual([['cardio_session', ['kind', 'started_at', 'duration_sec', 'distance_m', 'avg_hr', 'rpe', 'source', 'notes', 'created_at', 'deleted_at']]]);
  });

  it('CHECK de cardio_session : bornes du domaine (durée, distance, FC, ressenti, source, notes, format du type)', async () => {
    const db = await freshDb();
    await insert(db, 'cardio_session', session());
    await insert(db, 'cardio_session', session({ id: S2, kind: 'skierg', distance_m: null, avg_hr: null, rpe: 10, source: 'gps', notes: 'x'.repeat(2000) }));
    const bad: Row[] = [
      session({ kind: '' }),
      session({ kind: 'Run' }),
      session({ kind: 'r'.repeat(33) }),
      session({ started_at: '2026-11-13' }),
      session({ duration_sec: 0 }),
      session({ duration_sec: 86401 }),
      session({ duration_sec: 12.5 }),
      session({ distance_m: 0 }),
      session({ distance_m: 1_000_001 }),
      session({ avg_hr: 29 }),
      session({ avg_hr: 251 }),
      session({ rpe: 0 }),
      session({ rpe: 11 }),
      session({ rpe: 5.5 }),
      session({ source: 'watch' }),
      session({ notes: 'x'.repeat(2001) }),
      session({ notes: null }),
    ];
    for (const [i, row] of bad.entries()) await expect(insert(db, 'cardio_session', { ...row, id: `30000000-0000-4000-8000-1000000000${String(i).padStart(2, '0')}` }), JSON.stringify(row)).rejects.toThrow();
    expect(await db.select('SELECT id FROM cardio_session ORDER BY id')).toEqual([{ id: S1 }, { id: S2 }]);
    await db.close();
  });

  it('CHECK de cardio_track : texte non vide et borné, nombre de points positif ; aucune colonne de synchro', async () => {
    const db = await freshDb();
    await insert(db, 'cardio_track', { session_id: S1, points: '{"v":1,"p":[]}', point_count: 0, saved_at: AT });
    for (const row of [
      { session_id: S2, points: '', point_count: 0, saved_at: AT },
      { session_id: S2, points: 'x'.repeat(2_000_001), point_count: 0, saved_at: AT },
      { session_id: S2, points: '{}', point_count: -1, saved_at: AT },
    ]) await expect(insert(db, 'cardio_track', row)).rejects.toThrow();
    const cols = (await db.select<{ name: string }>("SELECT name FROM pragma_table_info('cardio_track') ORDER BY cid")).map((r) => r.name);
    expect(cols).toEqual(['session_id', 'points', 'point_count', 'saved_at']);
    expect(await outbox(db)).toEqual([]);
    expect(await db.select("SELECT 1 FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'cardio_track'")).toEqual([]);
    await db.close();
  });

  it('capture : insertion = ligne entière ; modification = champs ; suppression logique ; rétablissement = « + » ; garde : rien', async () => {
    const db = await freshDb();
    await insert(db, 'cardio_session', session());
    expect(await outbox(db)).toEqual([{ table_name: 'cardio_session', row_id: S1, field: '*' }]);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('UPDATE cardio_session SET rpe = 8, distance_m = 7600, updated_at = ?, hlc = ? WHERE id = ?', [AT, h(2), S1]);
    expect((await outbox(db)).map((r) => r.field).sort()).toEqual(['distance_m', 'rpe']);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('UPDATE cardio_session SET deleted_at = ?, updated_at = ?, hlc = ? WHERE id = ?', [AT, AT, h(3), S1]);
    expect((await outbox(db)).map((r) => r.field)).toEqual(['deleted_at']);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('UPDATE cardio_session SET deleted_at = NULL, updated_at = ?, hlc = ? WHERE id = ?', [AT, h(4), S1]);
    expect((await outbox(db)).map((r) => r.field).sort()).toEqual(['+', 'deleted_at']);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('INSERT OR IGNORE INTO sync_guard (id) VALUES (1)');
    await insert(db, 'cardio_session', session({ id: S2 }));
    await db.execute('DELETE FROM sync_guard');
    expect(await outbox(db)).toEqual([]);
    await db.close();
  });

  it('index : la liste des séances vivantes, la plus récente d’abord, est servie par un index', async () => {
    const db = await freshDb();
    const detail = (await db.select<{ detail: string }>('EXPLAIN QUERY PLAN SELECT * FROM cardio_session WHERE deleted_at IS NULL ORDER BY started_at DESC')).map((p) => p.detail).join(' ');
    expect(detail).toMatch(/USING (COVERING )?INDEX cardio_session_started_idx/);
    await db.close();
  });
});
