import { describe, expect, it } from 'vitest';
import { SYNC_CATALOGUE, publishedColumns } from '../../domain/sync/syncTables';
import type { SqlDriver } from '../driver';
import { openSqliteWasmDriver } from '../drivers/sqliteWasm';
import { migrate } from '../migrator';
import { CAPTURE_TABLES_V8, migration0008Nutrition } from './0008_nutrition';
import { migrations } from './index';

/**
 * I4-02 : migration 0008 — `food`, `food_portion`, `meal_entry`, `nutrition_target` (§ 20.2, publiées, UUID). Valeur inconnue = NULL
 * (jamais 0) ; CHECK sur les listes fermées et les bornes ; clé étrangère parent-enfant (portion → fiche) ; références logiques
 * (`meal_entry.food_id`) sans clé étrangère ; déclencheurs de capture sur le modèle de la 0002. Aucune migration publiée modifiée.
 */

const DEV = '0f8fad5b-d9cb-469f-a165-70867728950e';
const h = (ms: number): string => `${String(ms).padStart(15, '0')}-0000-${DEV}`;
const AT = '2026-11-08T08:00:00.000Z';
const F = '7c2b1d3e-0000-4000-8000-000000000001';
const P = '7c2b1d3e-0000-4000-8000-000000000002';
const E = '7c2b1d3e-0000-4000-8000-000000000003';
const T = '7c2b1d3e-0000-4000-8000-000000000004';

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
const food = (over: Row = {}): Row => ({
  id: F, source: 'custom', barcode: null, name: 'Fiche synthétique', brand: null, kcal: 120, protein_g: 10, fat_g: 5, carb_g: 8, fiber_g: 2, fetched_at: null, ...meta(), ...over,
});
const portion = (over: Row = {}): Row => ({ id: P, food_id: F, label: '1 tranche', grams: 30, position: 0, ...meta(), ...over });
const entry = (over: Row = {}): Row => ({
  id: E, date: '2026-11-08', time: '12:30', food_id: F, food_name: 'Fiche synthétique', source: 'custom', grams: 150, kcal: 180, protein_g: 15, fat_g: 7.5, carb_g: 12,
  method: 'search', confidence: null, ...meta(), ...over,
});
const target = (over: Row = {}): Row => ({ id: T, week_start: '2026-11-09', kcal: 2400, protein_g: 150, fat_g: 70, carb_g: 290, source: 'auto', accepted: 1, engine_version: 1, ...meta(), ...over });
const outbox = (db: SqlDriver) => db.select<{ table_name: string; row_id: string; field: string }>('SELECT table_name, row_id, field FROM sync_outbox ORDER BY seq');
const uuid = (n: number): string => `7c2b1d3e-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`;

describe('migration 0008 : nutrition (I4-02)', () => {
  it('registre : 0001 à 0008 ; version 8, nom nutrition', () => {
    expect(migrations.map((m) => m.version)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(migrations.at(-1)).toBe(migration0008Nutrition);
    expect(migration0008Nutrition.name).toBe('nutrition');
  });

  it('base vide → 0008 : quatre tables créées vides, rien mis en file, tables locales d’IA non créées', async () => {
    const db = await openSqliteWasmDriver();
    await migrate(db, migrations.slice(0, 7));
    await db.execute('DELETE FROM sync_outbox');
    await migrate(db, migrations);
    const tables = (await db.select<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")).map((t) => t.name);
    for (const t of ['food', 'food_portion', 'meal_entry', 'nutrition_target']) {
      expect(tables).toContain(t);
      expect(await db.select(`SELECT * FROM ${t}`)).toEqual([]);
    }
    expect(tables).not.toContain('ai_call');
    expect(await outbox(db)).toEqual([]);
    await db.close();
  });

  it('index : barcode, portion, journal par date, cible par semaine — requête du jour sur l’index', async () => {
    const db = await freshDb();
    const names = (await db.select<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'")).map((i) => i.name);
    for (const n of ['idx_food_barcode', 'idx_food_portion_food', 'idx_meal_entry_date', 'idx_nutrition_target_week']) expect(names).toContain(n);
    const plan = await db.select<{ detail: string }>("EXPLAIN QUERY PLAN SELECT * FROM meal_entry WHERE date = '2026-11-08' AND deleted_at IS NULL ORDER BY time");
    expect(plan.map((p) => p.detail).join(' ')).toContain('idx_meal_entry_date');
    await db.close();
  });

  it('food : CHECK source, nom, code-barres, bornes, cohérence de provenance', async () => {
    const db = await freshDb();
    const bad: Row[] = [
      { source: 'ciqual' },
      { name: '' },
      { name: 'x'.repeat(121) },
      { barcode: '123' },
      { barcode: 'abcdefgh' },
      { kcal: -1 },
      { kcal: 901 },
      { protein_g: 101 },
      { fat_g: -0.1 },
      { carb_g: 100.5 },
      { fiber_g: -1 },
      { source: 'off', barcode: null, fetched_at: AT },
      { source: 'off', barcode: '4006381333931', fetched_at: null },
    ];
    for (const [i, over] of bad.entries()) await expect(insert(db, 'food', food({ id: uuid(i), ...over })), JSON.stringify(over)).rejects.toThrow();
    await insert(db, 'food', food({ id: uuid(50), kcal: null, protein_g: null, fat_g: null, carb_g: null, fiber_g: null }));
    await insert(db, 'food', food({ id: uuid(51), source: 'off', barcode: '4006381333931', fetched_at: AT }));
    await db.close();
  });

  it('food_portion : clé étrangère vers la fiche, grammes > 0, libellé et position bornés', async () => {
    const db = await freshDb();
    await expect(insert(db, 'food_portion', portion())).rejects.toThrow(); // fiche absente
    await insert(db, 'food', food());
    for (const [i, over] of ([{ grams: 0 }, { grams: -1 }, { grams: 5001 }, { label: '' }, { label: 'x'.repeat(81) }, { position: -1 }] as Row[]).entries())
      await expect(insert(db, 'food_portion', portion({ id: uuid(i), ...over })), JSON.stringify(over)).rejects.toThrow();
    await insert(db, 'food_portion', portion());
    await db.close();
  });

  it('meal_entry : listes fermées, bornes, heure et date au bon format ; aliment = référence logique sans clé étrangère', async () => {
    const db = await freshDb();
    const bad: Row[] = [
      { method: 'dictée' },
      { source: 'ia' },
      { grams: 0 },
      { grams: -1 },
      { kcal: -1 },
      { protein_g: -1 },
      { fat_g: -1 },
      { carb_g: -1 },
      { confidence: 1.1 },
      { confidence: -0.1 },
      { time: '24:00' },
      { time: '7:05' },
      { date: '2026-11-8' },
      { food_name: '' },
      { food_name: 'x'.repeat(201) },
    ];
    for (const [i, over] of bad.entries()) await expect(insert(db, 'meal_entry', entry({ id: uuid(i), ...over })), JSON.stringify(over)).rejects.toThrow();
    await insert(db, 'meal_entry', entry({ food_id: 'ciqual:1000', source: 'ciqual' })); // aucune fiche stockée requise
    await insert(db, 'meal_entry', entry({ id: uuid(60), method: 'quickadd', source: 'manual', food_id: null, grams: null, protein_g: null, fat_g: null, carb_g: null, kcal: 400 }));
    await insert(db, 'meal_entry', entry({ id: uuid(61), method: 'photo', source: 'estimate', food_id: null, confidence: 0.6 }));
    await db.close();
  });

  it('nutrition_target : source, accepté booléen, valeurs positives, version du moteur', async () => {
    const db = await freshDb();
    const bad: Row[] = [{ source: 'ia' }, { accepted: 2 }, { kcal: 0 }, { kcal: -5 }, { protein_g: -1 }, { fat_g: -1 }, { carb_g: -1 }, { engine_version: 0 }, { week_start: 'lundi' }];
    for (const [i, over] of bad.entries()) await expect(insert(db, 'nutrition_target', target({ id: uuid(i), ...over })), JSON.stringify(over)).rejects.toThrow();
    await insert(db, 'nutrition_target', target());
    await insert(db, 'nutrition_target', target({ id: uuid(70), source: 'manual', engine_version: null, accepted: 0 }));
    await db.close();
  });

  it('copie figée = catalogue pour chaque table', () => {
    expect(CAPTURE_TABLES_V8.map(([name]) => name)).toEqual(['food', 'food_portion', 'meal_entry', 'nutrition_target']);
    for (const [name, columns] of CAPTURE_TABLES_V8) {
      const table = SYNC_CATALOGUE.table(name);
      if (!table) throw new Error(`${name} absent du catalogue`);
      expect([...columns], name).toEqual([...publishedColumns(table)]);
    }
  });

  it.each([
    ['food', 'name', 'Autre nom', () => food()],
    ['meal_entry', 'grams', 200, () => entry()],
    ['nutrition_target', 'kcal', 2300, () => target()],
  ] as const)('capture de %s : insertion en ligne entière, modification champ par champ avec base_hlc, restauration « + »', async (table, column, value, make) => {
    const db = await freshDb();
    const row = make();
    const id = String(row['id']);
    if (table !== 'food') await insert(db, 'food', food());
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

  it('food_portion : capture de l’insertion et de la modification de la position', async () => {
    const db = await freshDb();
    await insert(db, 'food', food());
    await db.execute('DELETE FROM sync_outbox');
    await insert(db, 'food_portion', portion());
    expect(await outbox(db)).toEqual([{ table_name: 'food_portion', row_id: P, field: '*' }]);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('UPDATE food_portion SET grams = 45, hlc = ? WHERE id = ?', [h(3), P]);
    expect((await outbox(db)).map((o) => o.field)).toEqual(['grams']);
    await db.close();
  });

  it('sous sync_guard : aucune capture ; relance sans effet', async () => {
    const db = await freshDb();
    await db.execute('INSERT INTO sync_guard (id) VALUES (1)');
    await insert(db, 'food', food());
    await insert(db, 'food_portion', portion());
    await insert(db, 'meal_entry', entry());
    await insert(db, 'nutrition_target', target());
    await db.execute('UPDATE meal_entry SET grams = 99, hlc = ? WHERE id = ?', [h(2), E]);
    expect(await outbox(db)).toEqual([]);
    expect(await db.select('SELECT * FROM sync_field_clock')).toEqual([]);
    expect((await migrate(db, migrations)).applied).toEqual([]);
    await db.close();
  });

  it('une fiche supprimée laisse l’entrée de journal lisible (nom figé, aucune clé étrangère)', async () => {
    const db = await freshDb();
    await insert(db, 'food', food());
    await insert(db, 'meal_entry', entry());
    await db.execute('UPDATE food SET deleted_at = ?, hlc = ? WHERE id = ?', [AT, h(4), F]);
    expect(await db.select('SELECT food_name, kcal FROM meal_entry WHERE id = ?', [E])).toEqual([{ food_name: 'Fiche synthétique', kcal: 180 }]);
    await db.close();
  });
});
