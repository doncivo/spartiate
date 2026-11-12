import { describe, expect, it } from 'vitest';
import type { SqlDriver } from '../driver';
import { openSqliteWasmDriver } from '../drivers/sqliteWasm';
import { migrate } from '../migrator';
import { CAPTURE_TABLES_V11, migration0011RecoveryFactor } from './0011_recovery_factor';
import { migrations } from './index';

/**
 * I6-01 point C : migration 0011 (schéma 11) — `recovery_factor`, journal de facteurs (PRD § 16.7, § 20.2). UNE TABLE NEUVE, publiée, écrite par les deux
 * appareils ; AUCUNE table existante n'est modifiée. Une ligne par date locale (la veille du matin de saisie), identifiant `recovery_factor|AAAA-MM-JJ`.
 */
const DEV = '0f8fad5b-d9cb-469f-a165-70867728950e';
const h = (ms: number): string => `${String(ms).padStart(15, '0')}-0000-${DEV}`;
const AT = '2026-11-10T08:00:00.000Z';
const BASE = 11;

async function freshDb(): Promise<SqlDriver> {
  const db = await openSqliteWasmDriver();
  await migrate(db, migrations.slice(0, BASE));
  return db;
}
type Row = Record<string, string | number | null>;
const factor = (over: Row = {}): Row => ({
  id: 'recovery_factor|2026-11-09', date: '2026-11-09', factors: '["alcohol","stress"]', none: 0, created_at: AT, updated_at: AT, device_id: DEV, hlc: h(1), ...over,
});
const insert = (db: SqlDriver, row: Row): Promise<unknown> => {
  const cols = Object.keys(row);
  return db.execute(`INSERT INTO recovery_factor (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map((c) => row[c] ?? null));
};
const outbox = (db: SqlDriver) => db.select<{ table_name: string; row_id: string; field: string }>('SELECT table_name, row_id, field FROM sync_outbox ORDER BY seq');

describe('migration 0011 : journal de facteurs (I6-01, schéma 11)', () => {
  it('registre : 0001 à 0011 ; version 11, nom recovery_factor', () => {
    expect(migrations.slice(0, 11).map((m) => m.version)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(migrations[10]).toBe(migration0011RecoveryFactor);
    expect(migration0011RecoveryFactor.name).toBe('recovery_factor');
  });

  it('base 0010 → 0011 : une table vide, rien mis en file, AUCUNE table existante modifiée', async () => {
    const db = await openSqliteWasmDriver();
    await migrate(db, migrations.slice(0, BASE - 1));
    await db.execute('DELETE FROM sync_outbox');
    const before = await db.select<{ name: string; sql: string }>("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name");
    await migrate(db, migrations.slice(0, BASE));
    const after = await db.select<{ name: string; sql: string }>("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name");
    const beforeNames = new Set(before.map((r) => r.name));
    for (const row of before) expect(after.find((r) => r.name === row.name), row.name).toEqual(row);
    expect(after.filter((r) => !beforeNames.has(r.name)).map((r) => r.name).sort()).toEqual(['recovery_factor', 'sync_recovery_factor_ai', 'sync_recovery_factor_au']);
    expect(await db.select('SELECT * FROM recovery_factor')).toEqual([]);
    expect(await outbox(db)).toEqual([]);
    await db.close();
  });

  it('index : la plage de dates est servie par un index', async () => {
    const db = await freshDb();
    const detail = (await db.select<{ detail: string }>("EXPLAIN QUERY PLAN SELECT * FROM recovery_factor WHERE date >= '2026-10-01' AND date <= '2026-11-30' AND deleted_at IS NULL")).map((p) => p.detail).join(' ');
    expect(detail).toMatch(/USING (COVERING )?INDEX/);
    await db.close();
  });

  it('identifiant « recovery_factor| » + date, une ligne par date, tableau JSON de 32 éléments au plus ; la cohérence « rien de particulier » / facteurs est tranchée à la lecture (relecture D-26, A1)', async () => {
    const db = await freshDb();
    const bad: Row[] = [
      { id: 'recovery_factor|2026-11-10' },
      { id: 'recovery|2026-11-09' },
      { date: '2026-11-9', id: 'recovery_factor|2026-11-9' },
      { date: null },
      { factors: 'pas du json' },
      { factors: '{"a":1}' },
      { factors: null },
      { factors: JSON.stringify(Array.from({ length: 33 }, (_, i) => 'f' + String(i))) },
      { none: 2 },
      { none: null },
      { device_id: null },
      { hlc: null },
      { created_at: null },
    ];
    for (const over of bad) await expect(insert(db, factor(over)), JSON.stringify(over).slice(0, 80)).rejects.toThrow();
    await insert(db, factor());
    await expect(insert(db, factor({ id: 'recovery_factor|2026-11-09' }))).rejects.toThrow();
    await insert(db, factor({ id: 'recovery_factor|2026-11-10', date: '2026-11-10', factors: '[]', none: 1 }));
    await insert(db, factor({ id: 'recovery_factor|2026-11-11', date: '2026-11-11', factors: '[]', none: 0 }));
    expect(await db.select('SELECT date, none FROM recovery_factor ORDER BY date')).toEqual([
      { date: '2026-11-09', none: 0 },
      { date: '2026-11-10', none: 1 },
      { date: '2026-11-11', none: 0 },
    ]);
    await db.close();
  });

  it('copie figée : colonnes capturées = colonnes métier de la table (hors id, updated_at, device_id, hlc)', async () => {
    expect(CAPTURE_TABLES_V11.map(([name]) => name)).toEqual(['recovery_factor']);
    const db = await freshDb();
    const real = (await db.select<{ name: string }>('PRAGMA table_info(recovery_factor)')).map((c) => c.name).filter((c) => !['id', 'updated_at', 'device_id', 'hlc'].includes(c));
    expect([...CAPTURE_TABLES_V11[0][1]].sort()).toEqual(real.sort());
    await db.close();
  });

  it('deux déclencheurs de capture (un `_ai` et un `_au`), 46 au total', async () => {
    const db = await freshDb();
    const names = (await db.select<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'sync_recovery_factor%' ORDER BY name")).map((r) => r.name);
    expect(names).toEqual(['sync_recovery_factor_ai', 'sync_recovery_factor_au']);
    expect(await db.select("SELECT 1 FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'sync_%'")).toHaveLength(46);
    await db.close();
  });

  it.each([
    ['factors', '["travel"]'],
    ['none', 1],
  ] as const)('capture de recovery_factor.%s : insertion en ligne entière, modification champ par champ avec base_hlc, restauration « + »', async (column, value) => {
    const db = await freshDb();
    const id = 'recovery_factor|2026-11-09';
    await db.execute('DELETE FROM sync_outbox');
    await insert(db, factor());
    expect(await outbox(db)).toEqual([{ table_name: 'recovery_factor', row_id: id, field: '*' }]);
    await db.execute('DELETE FROM sync_outbox');
    // `none` = 1 exige un tableau vide : les deux colonnes changent ensemble.
    if (column === 'none') await db.execute('UPDATE recovery_factor SET factors = ?, none = ?, hlc = ? WHERE id = ?', ['[]', value, h(5), id]);
    else await db.execute(`UPDATE recovery_factor SET ${column} = ?, hlc = ? WHERE id = ?`, [value, h(5), id]);
    expect((await outbox(db)).map((o) => o.field).sort()).toEqual(column === 'none' ? ['factors', 'none'] : ['factors']);
    expect(await db.select('SELECT field, hlc, base_hlc FROM sync_field_clock WHERE table_name = ? AND row_id = ? AND field = ?', ['recovery_factor', id, column])).toEqual([{ field: column, hlc: h(5), base_hlc: h(1) }]);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('UPDATE recovery_factor SET deleted_at = ?, hlc = ? WHERE id = ?', [AT, h(6), id]);
    await db.execute('UPDATE recovery_factor SET deleted_at = NULL, hlc = ? WHERE id = ?', [h(7), id]);
    expect((await outbox(db)).map((o) => o.field).sort()).toEqual(['+', 'deleted_at']);
    await db.close();
  });

  it('recréation d’un identifiant supprimé : la tombstone est retirée', async () => {
    const db = await freshDb();
    await db.execute("INSERT INTO sync_tombstone (table_name, row_id, deleted_hlc, purged_at) VALUES ('recovery_factor', 'recovery_factor|2026-11-09', ?, ?)", [h(2), AT]);
    await insert(db, factor());
    expect(await db.select("SELECT 1 FROM sync_tombstone WHERE table_name = 'recovery_factor'")).toEqual([]);
    await db.close();
  });

  it('sous sync_guard : aucune capture ; relance sans effet', async () => {
    const db = await freshDb();
    await db.execute('INSERT INTO sync_guard (id) VALUES (1)');
    await insert(db, factor());
    await db.execute('UPDATE recovery_factor SET factors = ?, hlc = ? WHERE id = ?', ['[]', h(2), 'recovery_factor|2026-11-09']);
    expect(await outbox(db)).toEqual([]);
    expect(await db.select('SELECT * FROM sync_field_clock')).toEqual([]);
    expect((await migrate(db, migrations.slice(0, BASE))).applied).toEqual([]);
    await db.close();
  });
});
