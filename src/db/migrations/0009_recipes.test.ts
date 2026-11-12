import { describe, expect, it } from 'vitest';
import { SYNC_CATALOGUE, publishedColumns } from '../../domain/sync/syncTables';
import type { SqlDriver } from '../driver';
import { openSqliteWasmDriver } from '../drivers/sqliteWasm';
import { migrate } from '../migrator';
import { CAPTURE_TABLES_V9, migration0009Recipes } from './0009_recipes';
import { migrations } from './index';

/**
 * I4-07 : migration 0009 — `day_completeness`, `recipe`, `recipe_ingredient` (D-80, D-81 ; § 20.2, publiées). TROIS TABLES NEUVES : aucune
 * table existante n'est modifiée (ni liste ni CHECK de `meal_entry` ou `food` élargis : un champ hors liste sur une ligne nouvelle resterait
 * bloqué sans fin sur un appareil en schéma 8). Identifiant naturel `day|AAAA-MM-JJ` ; ingrédient → recette par clé étrangère ; valeurs
 * pour 100 g nullables (inconnu = NULL, jamais 0) ; déclencheurs de capture sur le modèle de la 0008.
 */

const DEV = '0f8fad5b-d9cb-469f-a165-70867728950e';
const h = (ms: number): string => `${String(ms).padStart(15, '0')}-0000-${DEV}`;
const AT = '2026-11-09T08:00:00.000Z';
const R = '7d3c2e4f-0000-4000-8000-000000000001';
const I = '7d3c2e4f-0000-4000-8000-000000000002';
const uuid = (n: number): string => `7d3c2e4f-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`;

async function freshDb(): Promise<SqlDriver> {
  const db = await openSqliteWasmDriver();
  await migrate(db, migrations);
  return db;
}
type Row = Record<string, string | number | null>;
const meta = (hlc = 1): Row => ({ created_at: AT, updated_at: AT, device_id: DEV, hlc: h(hlc) });
const insert = (db: SqlDriver, table: string, row: Row): Promise<unknown> => {
  const cols = Object.keys(row);
  return db.execute(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map((c) => row[c] ?? null));
};
const day = (over: Row = {}): Row => ({ id: 'day|2026-11-09', date: '2026-11-09', state: 'complete', ...meta(), ...over });
const recipe = (over: Row = {}): Row => ({ id: R, name: 'Poulet-riz synthétique', servings: 4, cooked_weight_g: 1200, ...meta(), ...over });
const ingredient = (over: Row = {}): Row => ({
  id: I, recipe_id: R, position: 0, name: 'Riz synthétique', source: 'custom', food_ref: null, grams: 300, kcal_100g: 130, protein_100g: 2.7, fat_100g: 0.3, carb_100g: 28, fiber_100g: 0.4, ...meta(), ...over,
});
const outbox = (db: SqlDriver) => db.select<{ table_name: string; row_id: string; field: string }>('SELECT table_name, row_id, field FROM sync_outbox ORDER BY seq');

describe('migration 0009 : recettes et journée complète (I4-07)', () => {
  it('registre : 0001 à 0009 ; version 9, nom recipes', () => {
    expect(migrations.slice(0, 9).map((m) => m.version)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(migrations[8]).toBe(migration0009Recipes);
    expect(migration0009Recipes.name).toBe('recipes');
  });

  it('base vide → 0009 : trois tables vides, rien mis en file, AUCUNE table existante modifiée', async () => {
    const db = await openSqliteWasmDriver();
    await migrate(db, migrations.slice(0, 8));
    await db.execute('DELETE FROM sync_outbox');
    const before = await db.select<{ name: string; sql: string }>("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name");
    await migrate(db, migrations.slice(0, 9));
    const after = await db.select<{ name: string; sql: string }>("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name");
    const beforeNames = new Set(before.map((r) => r.name));
    for (const row of before) expect(after.find((r) => r.name === row.name), row.name).toEqual(row);
    const added = after.filter((r) => !beforeNames.has(r.name)).map((r) => r.name);
    expect(added.filter((n) => !n.startsWith('sync_') && !n.startsWith('idx_') && !n.startsWith('sqlite_')).sort()).toEqual(['day_completeness', 'recipe', 'recipe_ingredient']);
    for (const t of ['day_completeness', 'recipe', 'recipe_ingredient']) expect(await db.select(`SELECT * FROM ${t}`)).toEqual([]);
    expect(await outbox(db)).toEqual([]);
    await db.close();
  });

  it('index : ingrédients d’une recette par rang ; date unique de la déclaration', async () => {
    const db = await freshDb();
    const names = (await db.select<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'")).map((i) => i.name);
    expect(names).toContain('idx_recipe_ingredient_recipe');
    const plan = await db.select<{ detail: string }>("EXPLAIN QUERY PLAN SELECT * FROM recipe_ingredient WHERE recipe_id = 'x' AND deleted_at IS NULL ORDER BY position");
    expect(plan.map((p) => p.detail).join(' ')).toContain('idx_recipe_ingredient_recipe');
    const planDay = await db.select<{ detail: string }>("EXPLAIN QUERY PLAN SELECT * FROM day_completeness WHERE date >= '2026-11-01' AND date <= '2026-11-30' AND deleted_at IS NULL");
    expect(planDay.map((p) => p.detail).join(' ')).toMatch(/USING (COVERING )?INDEX/);
    await db.close();
  });

  it('day_completeness : identifiant = « day| » + date, date au bon format, état fermé, une ligne par date', async () => {
    const db = await freshDb();
    const bad: Row[] = [
      { id: 'day|2026-11-10' }, // identifiant différent de la date
      { id: R },
      { date: '2026-11-9', id: 'day|2026-11-9' },
      { state: 'partial' },
      { state: null },
    ];
    for (const [i, over] of bad.entries()) await expect(insert(db, 'day_completeness', day(over)), `${i} ${JSON.stringify(over)}`).rejects.toThrow();
    await insert(db, 'day_completeness', day());
    await expect(insert(db, 'day_completeness', day({ state: 'incomplete' }))).rejects.toThrow(); // même date : une seule ligne
    await insert(db, 'day_completeness', day({ id: 'day|2026-11-10', date: '2026-11-10', state: 'incomplete' }));
    await db.close();
  });

  it('recipe : nom, portions entières 1..100, poids cuit nul ou dans ]0 ; 20 000]', async () => {
    const db = await freshDb();
    const bad: Row[] = [
      { name: '' },
      { name: 'x'.repeat(121) },
      { servings: 0 },
      { servings: 101 },
      { servings: 2.5 },
      { servings: null },
      { cooked_weight_g: 0 },
      { cooked_weight_g: -5 },
      { cooked_weight_g: 20_001 },
    ];
    for (const [i, over] of bad.entries()) await expect(insert(db, 'recipe', recipe({ id: uuid(i), ...over })), JSON.stringify(over)).rejects.toThrow();
    await insert(db, 'recipe', recipe());
    await insert(db, 'recipe', recipe({ id: uuid(50), cooked_weight_g: null, servings: 100, name: 'x'.repeat(120) }));
    await insert(db, 'recipe', recipe({ id: uuid(51), cooked_weight_g: 20_000, servings: 1 }));
    await db.close();
  });

  it('recipe_ingredient : clé étrangère vers la recette, rang, nom, provenance, grammes, valeurs pour 100 g bornées comme food', async () => {
    const db = await freshDb();
    await expect(insert(db, 'recipe_ingredient', ingredient())).rejects.toThrow(); // recette absente
    await insert(db, 'recipe', recipe());
    const bad: Row[] = [
      { position: -1 },
      { name: '' },
      { name: 'x'.repeat(121) },
      { source: 'manual' },
      { source: 'estimate' },
      { food_ref: '' },
      { food_ref: 'x'.repeat(129) },
      { grams: 0 },
      { grams: -1 },
      { grams: 10_001 },
      { kcal_100g: -1 },
      { kcal_100g: 901 },
      { protein_100g: 100.5 },
      { fat_100g: -0.1 },
      { carb_100g: 101 },
      { fiber_100g: -1 },
    ];
    for (const [i, over] of bad.entries()) await expect(insert(db, 'recipe_ingredient', ingredient({ id: uuid(i), ...over })), JSON.stringify(over)).rejects.toThrow();
    await insert(db, 'recipe_ingredient', ingredient());
    await insert(db, 'recipe_ingredient', ingredient({ id: uuid(60), position: 1, source: 'ciqual', food_ref: 'ciqual:1000', kcal_100g: null, protein_100g: null, fat_100g: null, carb_100g: null, fiber_100g: null }));
    await insert(db, 'recipe_ingredient', ingredient({ id: uuid(61), position: 2, source: 'off', food_ref: 'x'.repeat(128), grams: 10_000, kcal_100g: 900 }));
    await db.close();
  });

  it('meal_entry : une prise de recette (food_id « recipe:<id> », source custom) est une entrée ordinaire, sans fiche ni recette requise', async () => {
    const db = await freshDb();
    await insert(db, 'meal_entry', {
      id: uuid(70), date: '2026-11-09', time: '12:30', food_id: `recipe:${R}`, food_name: 'Poulet-riz synthétique', source: 'custom', grams: 300, kcal: 390, protein_g: 30, fat_g: 10, carb_g: 40,
      method: 'search', confidence: null, ...meta(),
    });
    expect(await db.select('SELECT food_id FROM meal_entry')).toEqual([{ food_id: `recipe:${R}` }]);
    await db.close();
  });

  it('copie figée = catalogue pour chaque table, recette avant ingrédient', () => {
    expect(CAPTURE_TABLES_V9.map(([name]) => name)).toEqual(['day_completeness', 'recipe', 'recipe_ingredient']);
    for (const [name, columns] of CAPTURE_TABLES_V9) {
      const table = SYNC_CATALOGUE.table(name);
      if (!table) throw new Error(`${name} absent du catalogue`);
      expect([...columns], name).toEqual([...publishedColumns(table)]);
    }
  });

  it('six déclencheurs de capture, un `_ai` et un `_au` par table', async () => {
    const db = await freshDb();
    const names = (await db.select<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'trigger' AND (name LIKE 'sync_day_completeness_%' OR name LIKE 'sync_recipe%') ORDER BY name")).map((r) => r.name);
    expect(names).toEqual(['sync_day_completeness_ai', 'sync_day_completeness_au', 'sync_recipe_ai', 'sync_recipe_au', 'sync_recipe_ingredient_ai', 'sync_recipe_ingredient_au']);
    expect(await db.select("SELECT 1 FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'sync_%'")).toHaveLength(51); // 40 avec la 0009, 44 avec la 0010 (I5-01), 46 avec la 0011 (I6-01), 50 avec la 0012 (I6-02), 51 avec la 0014 (I6-03b)
    await db.close();
  });

  it.each([
    ['day_completeness', 'state', 'incomplete', () => day()],
    ['recipe', 'servings', 6, () => recipe()],
    ['recipe', 'cooked_weight_g', null, () => recipe()],
    ['recipe_ingredient', 'grams', 250, () => ingredient()],
    ['recipe_ingredient', 'kcal_100g', null, () => ingredient()],
  ] as const)('capture de %s.%s : insertion en ligne entière, modification champ par champ avec base_hlc, restauration « + »', async (table, column, value, make) => {
    const db = await freshDb();
    const row = make();
    const id = String(row['id']);
    if (table === 'recipe_ingredient') await insert(db, 'recipe', recipe());
    await db.execute('DELETE FROM sync_outbox');
    await insert(db, table, row);
    expect(await outbox(db)).toEqual([{ table_name: table, row_id: id, field: '*' }]);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute(`UPDATE ${table} SET ${column} = ?, hlc = ? WHERE id = ?`, [value, h(5), id]);
    expect(await outbox(db)).toEqual([{ table_name: table, row_id: id, field: column }]);
    expect(await db.select('SELECT field, hlc, base_hlc FROM sync_field_clock WHERE table_name = ? AND row_id = ? ORDER BY field', [table, id])).toEqual([
      { field: '*', hlc: h(1), base_hlc: null },
      { field: column, hlc: h(5), base_hlc: h(1) },
    ]);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute(`UPDATE ${table} SET deleted_at = ?, hlc = ? WHERE id = ?`, [AT, h(6), id]);
    await db.execute(`UPDATE ${table} SET deleted_at = NULL, hlc = ? WHERE id = ?`, [h(7), id]);
    expect((await outbox(db)).map((o) => o.field).sort()).toEqual(['+', 'deleted_at']);
    await db.close();
  });

  it('recréation d’un identifiant supprimé : la tombstone est retirée (insertion)', async () => {
    const db = await freshDb();
    await db.execute("INSERT INTO sync_tombstone (table_name, row_id, deleted_hlc, purged_at) VALUES ('day_completeness', 'day|2026-11-09', ?, ?)", [h(2), AT]);
    await insert(db, 'day_completeness', day());
    expect(await db.select("SELECT 1 FROM sync_tombstone WHERE table_name = 'day_completeness'")).toEqual([]);
    await db.close();
  });

  it('sous sync_guard : aucune capture ; relance sans effet', async () => {
    const db = await freshDb();
    await db.execute('INSERT INTO sync_guard (id) VALUES (1)');
    await insert(db, 'day_completeness', day());
    await insert(db, 'recipe', recipe());
    await insert(db, 'recipe_ingredient', ingredient());
    await db.execute('UPDATE recipe SET servings = 2, hlc = ? WHERE id = ?', [h(2), R]);
    expect(await outbox(db)).toEqual([]);
    expect(await db.select('SELECT * FROM sync_field_clock')).toEqual([]);
    expect((await migrate(db, migrations)).applied).toEqual([]);
    await db.close();
  });

  it('une recette supprimée laisse l’entrée de journal lisible (nom et instantané figés, aucune clé étrangère)', async () => {
    const db = await freshDb();
    await insert(db, 'recipe', recipe());
    await insert(db, 'meal_entry', {
      id: uuid(71), date: '2026-11-09', time: '19:00', food_id: `recipe:${R}`, food_name: 'Poulet-riz synthétique', source: 'custom', grams: 300, kcal: 390, protein_g: 30, fat_g: 10, carb_g: 40,
      method: 'search', confidence: null, ...meta(),
    });
    await db.execute('UPDATE recipe SET deleted_at = ?, hlc = ? WHERE id = ?', [AT, h(4), R]);
    expect(await db.select('SELECT food_name, kcal FROM meal_entry WHERE id = ?', [uuid(71)])).toEqual([{ food_name: 'Poulet-riz synthétique', kcal: 390 }]);
    await db.close();
  });
});
