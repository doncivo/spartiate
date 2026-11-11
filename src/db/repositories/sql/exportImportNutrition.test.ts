import { afterEach, describe, expect, it } from 'vitest';
import { buildExportArchive, canonicalHash, EXPORT_SV, parseExportArchive, TRAINING_EXPORT_TABLES, type ExportData } from '../../../domain/exportImport/archive';
import { planImport } from '../../../domain/exportImport/plan';
import type { DeviceId, LocalDate, LocalTime } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/** I4-02 : l'export / import (D-57) porte fiches, portions, journal et cibles ; une archive de schéma 7 (sans nutrition) reste importable. */

const A = '60000000-0000-4000-8000-0000000000aa' as DeviceId;
const B = '60000000-0000-4000-8000-0000000000bb' as DeviceId;
const F = '7b5e4d3c-0000-4000-8000-000000000001';
const P = '7b5e4d3c-0000-4000-8000-000000000002';
const E = '7b5e4d3c-0000-4000-8000-000000000003';
const T = '7b5e4d3c-0000-4000-8000-000000000004';

const opened: TestDb[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.close()));
});
const open = async (device: DeviceId): Promise<TestDb> => {
  const db = await openBaseDb(device);
  opened.push(db);
  return db;
};
const read = async (db: TestDb): Promise<ExportData> => (await db.data.repos.exportImport()).readExportData();

describe('export / import de la nutrition (I4-02)', () => {
  it('quatre tables exportées après le mésocycle, parents d’abord ; schéma 8 (puis 9 avec les recettes, I4-07)', () => {
    expect(TRAINING_EXPORT_TABLES.slice(-10, -6)).toEqual(['food', 'food_portion', 'meal_entry', 'nutrition_target']);
    expect(EXPORT_SV).toBe(11);
  });

  it('aller-retour : mêmes données (hash canonique), valeurs inconnues conservées nulles, publiées comme toute écriture', async () => {
    const db = await open(A);
    await db.data.transaction(async (repos) => {
      const foods = await repos.foods();
      await foods.create({ source: 'custom', barcode: null, name: 'Fiche synthétique', brand: null, per100g: { kcal: 120, proteinG: null, fatG: 5, carbG: 8, fiberG: null }, fetchedAt: null }, { id: F });
      await foods.addPortion(F, { label: '1 tranche', grams: 30 }, { id: P });
      await (await repos.mealEntries()).create({ date: '2026-11-08' as LocalDate, time: '12:30' as LocalTime, foodId: F, foodName: 'Fiche synthétique', source: 'custom', grams: 150, kcal: 180, proteinG: null, fatG: 7.5, carbG: 12, method: 'search', confidence: null }, { id: E });
      await (await repos.nutritionTargets()).record({ weekStart: '2026-11-02' as LocalDate, target: { kcal: 2400, proteinG: 150, fatG: 70, carbG: 290 }, source: 'auto', accepted: true, engineVersion: 1, lowFloorConfirmed: false }, { id: T });
    });
    const source = await read(db);
    expect(source.training?.meal_entry?.map((r) => [r.id, r.values['kcal'], r.values['protein_g']])).toEqual([[E, 180, null]]);
    const archive = await buildExportArchive(source, { date: '2026-11-08T10:00:00.000Z', sv: 8 });
    const parsed = await parseExportArchive(archive.bytes, { currentSv: 8, currentYear: 2026 });
    const target = await open(B);
    await target.data.transaction(async (repos) => {
      const repo = await repos.exportImport();
      await repo.applyImport(planImport(await repo.readExportData(), parsed.data, 'merge'), 2026);
    });
    expect(await canonicalHash(await read(target))).toBe(await canonicalHash(source));
    expect(await (await target.data.repos.mealEntries()).get(E)).toMatchObject({ proteinG: null, kcal: 180, foodId: F });
    expect(await target.driver.select("SELECT table_name FROM sync_outbox WHERE field = '*' AND table_name IN ('food', 'food_portion', 'meal_entry', 'nutrition_target') ORDER BY table_name")).toEqual([
      { table_name: 'food' },
      { table_name: 'food_portion' },
      { table_name: 'meal_entry' },
      { table_name: 'nutrition_target' },
    ]);
  });

  it('archive de schéma 7 (sans nutrition) : importée, aucune ligne de nutrition', async () => {
    const db = await open(A);
    const source = await read(db);
    const archive = await buildExportArchive({ ...source, training: {} }, { date: '2026-11-08T10:00:00.000Z', sv: 7 });
    const parsed = await parseExportArchive(archive.bytes, { currentSv: 8, currentYear: 2026 });
    expect(parsed.data.training?.meal_entry).toBeUndefined();
  });
});
