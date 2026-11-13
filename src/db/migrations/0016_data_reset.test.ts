import { describe, expect, it } from 'vitest';
import { openSqliteWasmDriver } from '../drivers/sqliteWasm';
import { migrate } from '../migrator';
import { CAPTURE_TABLES_V16, migration0016DataReset } from './0016_data_reset';
import { migrations } from './index';

/**
 * RESET-01 (D-183) : migration 0016 (schéma 16) — `data_reset`, remises à zéro des données, PUBLIÉE. UNE TABLE NEUVE ; AUCUNE table existante n'est
 * modifiée ; aucune donnée migrée.
 */
const DEV = '0f8fad5b-d9cb-469f-a165-70867728950e';
const AT = '2026-11-13T08:00:00.000Z';
const ID = '20000000-0000-4000-8000-000000000016';
const HLC = `${String(Date.parse(AT)).padStart(15, '0')}-0000-${DEV}`;

describe('migration 0016 : remises à zéro publiées (RESET-01, schéma 16)', () => {
  it('registre : 0001 à 0016, seizième et dernière ; version 16, nom data_reset', () => {
    expect(migrations.map((m) => m.version)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    expect(migrations[15]).toBe(migration0016DataReset);
    expect(migration0016DataReset.name).toBe('data_reset');
  });

  it('base 0015 → 0016 : une table vide, deux déclencheurs, rien mis en file, AUCUN objet existant modifié', async () => {
    const db = await openSqliteWasmDriver();
    await migrate(db, migrations.slice(0, 15));
    await db.execute('DELETE FROM sync_outbox');
    const before = await db.select<{ name: string; sql: string }>("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name");
    await migrate(db, migrations.slice(0, 16));
    const after = await db.select<{ name: string; sql: string }>("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name");
    const beforeNames = new Set(before.map((r) => r.name));
    for (const row of before) expect(after.find((r) => r.name === row.name), row.name).toEqual(row);
    expect(after.filter((r) => !beforeNames.has(r.name)).map((r) => r.name).sort()).toEqual(['data_reset', 'sync_data_reset_ai', 'sync_data_reset_au']);
    expect(await db.select('SELECT * FROM data_reset')).toEqual([]);
    expect(await db.select('SELECT * FROM sync_outbox')).toEqual([]);
    expect(await db.select("SELECT 1 FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'sync_%'")).toHaveLength(55); // 53 avec la 0015 (FIX-0181), 55 avec la 0016 (RESET-01).
    await db.close();
  });

  it('copie figée des colonnes capturées : created_at, deleted_at', () => {
    expect(CAPTURE_TABLES_V16).toEqual([['data_reset', ['created_at', 'deleted_at']]]);
  });

  it('capture : insertion = ligne entière « * » ; sous garde : rien', async () => {
    const db = await openSqliteWasmDriver();
    await migrate(db, migrations);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('INSERT INTO data_reset (id, created_at, updated_at, deleted_at, device_id, hlc) VALUES (?, ?, ?, NULL, ?, ?)', [ID, AT, AT, DEV, HLC]);
    expect(await db.select('SELECT table_name, row_id, field FROM sync_outbox')).toEqual([{ table_name: 'data_reset', row_id: ID, field: '*' }]);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('INSERT INTO sync_guard (id) VALUES (1)');
    await db.execute('INSERT INTO data_reset (id, created_at, updated_at, deleted_at, device_id, hlc) VALUES (?, ?, ?, NULL, ?, ?)', [ID.replace('16', '17'), AT, AT, DEV, HLC]);
    await db.execute('DELETE FROM sync_guard');
    expect(await db.select('SELECT 1 FROM sync_outbox')).toEqual([]);
    await db.close();
  });
});
