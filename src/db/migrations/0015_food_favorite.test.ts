import { describe, expect, it } from 'vitest';
import type { SqlDriver } from '../driver';
import { openSqliteWasmDriver } from '../drivers/sqliteWasm';
import { migrate } from '../migrator';
import { CAPTURE_TABLES_V15, migration0015FoodFavorite } from './0015_food_favorite';
import { migrations } from './index';

/**
 * FIX-0181 (D-171, révise D-79 par décision d'Ali du 12/11) : migration 0015 (schéma 15) — `food_favorite`, favoris de la recherche d'aliments,
 * PUBLIÉS et écrits par les deux appareils. UNE TABLE NEUVE ; AUCUNE table existante n'est modifiée ; aucune donnée migrée en SQL (la reprise
 * des favoris locaux `nutrition.favorites` se fait une fois par le dépôt, avec l'horloge de synchro de l'appareil).
 */
const DEV = '0f8fad5b-d9cb-469f-a165-70867728950e';
const h = (ms: number): string => `${String(ms).padStart(15, '0')}-0000-${DEV}`;
const AT = '2026-11-13T08:00:00.000Z';
const BASE = 15;
const UUID = '20000000-0000-4000-8000-000000000001';

async function freshDb(): Promise<SqlDriver> {
  const db = await openSqliteWasmDriver();
  await migrate(db, migrations.slice(0, BASE));
  return db;
}
type Row = Record<string, string | number | null>;
const favorite = (over: Row = {}): Row => ({
  id: `favorite|${UUID}`, source: 'custom', ref: UUID, added_at: AT, created_at: AT, updated_at: AT, device_id: DEV, hlc: h(1), ...over,
});
const insert = (db: SqlDriver, row: Row): Promise<unknown> => {
  const cols = Object.keys(row);
  return db.execute(`INSERT INTO food_favorite (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map((c) => row[c] ?? null));
};
const outbox = (db: SqlDriver) => db.select<{ table_name: string; row_id: string; field: string }>('SELECT table_name, row_id, field FROM sync_outbox ORDER BY seq');

describe('migration 0015 : favoris publiés (FIX-0181, schéma 15)', () => {
  it('registre : 0001 à 0016, quinzième (la 0016, I6-05, la suit) ; version 15, nom food_favorite', () => {
    expect(migrations.map((m) => m.version)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    expect(migrations[14]).toBe(migration0015FoodFavorite);
    expect(migration0015FoodFavorite.name).toBe('food_favorite');
  });

  it('base 0014 → 0015 : une table vide, un index, deux déclencheurs, rien mis en file, AUCUN objet existant modifié', async () => {
    const db = await openSqliteWasmDriver();
    await migrate(db, migrations.slice(0, BASE - 1));
    await db.execute('DELETE FROM sync_outbox');
    const before = await db.select<{ name: string; sql: string }>("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name");
    await migrate(db, migrations.slice(0, BASE));
    const after = await db.select<{ name: string; sql: string }>("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name");
    const beforeNames = new Set(before.map((r) => r.name));
    for (const row of before) expect(after.find((r) => r.name === row.name), row.name).toEqual(row);
    expect(after.filter((r) => !beforeNames.has(r.name)).map((r) => r.name).sort()).toEqual(['food_favorite', 'food_favorite_added_idx', 'sync_food_favorite_ai', 'sync_food_favorite_au']);
    expect(await db.select('SELECT * FROM food_favorite')).toEqual([]);
    expect(await outbox(db)).toEqual([]);
    expect(await db.select("SELECT 1 FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'sync_%'")).toHaveLength(53); // 51 avec la 0014 (I6-03b), 53 avec la 0015 (FIX-0181).
    await db.close();
  });

  it('copie figée des colonnes capturées : source, ref, added_at, created_at, deleted_at', () => {
    expect(CAPTURE_TABLES_V15).toEqual([['food_favorite', ['source', 'ref', 'added_at', 'created_at', 'deleted_at']]]);
  });

  it('CHECK : identifiant naturel favorite|<ref>, source au format court, ref de 1 à 64 caractères sans « | »', async () => {
    const db = await freshDb();
    await insert(db, favorite());
    await insert(db, favorite({ id: 'favorite|ciqual:20', source: 'ciqual', ref: 'ciqual:20' }));
    const bad: Row[] = [
      favorite({ id: 'favorite|autre', ref: UUID }),
      favorite({ id: `x|${UUID}` }),
      favorite({ id: 'favorite|', ref: '' }),
      favorite({ id: `favorite|${'a'.repeat(65)}`, ref: 'a'.repeat(65) }),
      favorite({ id: 'favorite|a|b', ref: 'a|b' }),
      favorite({ id: 'favorite|ciqual:21', ref: 'ciqual:21', source: 'Ciqual' }),
      favorite({ id: 'favorite|ciqual:22', ref: 'ciqual:22', source: '' }),
      favorite({ id: 'favorite|ciqual:23', ref: 'ciqual:23', added_at: null }),
    ];
    for (const row of bad) await expect(insert(db, row), JSON.stringify(row)).rejects.toThrow();
    expect(await db.select('SELECT id FROM food_favorite ORDER BY id')).toEqual([{ id: 'favorite|20000000-0000-4000-8000-000000000001' }, { id: 'favorite|ciqual:20' }]);
    await db.close();
  });

  it('capture : insertion = ligne entière ; suppression logique = champ deleted_at ; rétablissement = « + » ; garde : rien', async () => {
    const db = await freshDb();
    await insert(db, favorite());
    expect(await outbox(db)).toEqual([{ table_name: 'food_favorite', row_id: `favorite|${UUID}`, field: '*' }]);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('UPDATE food_favorite SET deleted_at = ?, updated_at = ?, hlc = ? WHERE id = ?', [AT, AT, h(2), `favorite|${UUID}`]);
    expect(await outbox(db)).toEqual([{ table_name: 'food_favorite', row_id: `favorite|${UUID}`, field: 'deleted_at' }]);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('UPDATE food_favorite SET deleted_at = NULL, added_at = ?, updated_at = ?, hlc = ? WHERE id = ?', ['2026-11-13T09:00:00.000Z', AT, h(3), `favorite|${UUID}`]);
    expect((await outbox(db)).map((r) => r.field).sort()).toEqual(['+', 'added_at', 'deleted_at']);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('INSERT OR IGNORE INTO sync_guard (id) VALUES (1)');
    await insert(db, favorite({ id: 'favorite|ciqual:20', source: 'ciqual', ref: 'ciqual:20' }));
    await db.execute('DELETE FROM sync_guard');
    expect(await outbox(db)).toEqual([]);
    await db.close();
  });

  it('index : la liste des favoris vivants, la plus récente d’abord, est servie par un index', async () => {
    const db = await freshDb();
    const detail = (await db.select<{ detail: string }>('EXPLAIN QUERY PLAN SELECT * FROM food_favorite WHERE deleted_at IS NULL ORDER BY added_at DESC')).map((p) => p.detail).join(' ');
    expect(detail).toMatch(/USING (COVERING )?INDEX food_favorite_added_idx/);
    await db.close();
  });
});
