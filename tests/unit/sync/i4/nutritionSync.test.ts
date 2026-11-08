import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import { epochId, SYNC_TABLE_ORDER, type DeviceAck } from '../../../../src/domain/sync/format';
import { SYNC_CATALOGUE } from '../../../../src/domain/sync/syncTables';
import type { FoodDraft } from '../../../../src/domain/nutrition/food';
import type { MealEntryDraft } from '../../../../src/domain/nutrition/mealEntry';
import type { DeviceId, IsoDateTime, LocalDate, LocalTime } from '../../../../src/domain/types';
import { migrate } from '../../../../src/db/migrator';
import { migrations } from '../../../../src/db/migrations';
import { reintegrateUnknownFields } from '../../../../src/db/repositories';
import { snapshotPages } from '../../../../src/sync/snapshot';
import { carryKindText } from '../../../../src/features/sync/carryReportText';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice, type SimSchema } from '../../../sim/syncDevice';

/**
 * I4-02 (D-26 ; § 9.1, § 20.2) : publication de `food`, `food_portion`, `meal_entry` et `nutrition_target` (UUID). `food_portion` a pour
 * parent `food` ; `meal_entry.food_id` est une référence LOGIQUE (Ciqual `ciqual:<code>` ou fiche), hors de `parents`. Deux bases simulées,
 * entrées synthétiques, convergence sans doublon, suppression propagée, conflit par champ, instantané, appareil resté en schéma 7. Seules
 * les tables prévues au § 9.1 sont émises : `ai_call` et toute préférence locale (favoris) n'existent pas dans le catalogue.
 */

const A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const F1 = '7a4d3c2b-0000-4000-8000-000000000001';
const P1 = '7a4d3c2b-0000-4000-8000-000000000002';
const E1 = '7a4d3c2b-0000-4000-8000-000000000003';
const E2 = '7a4d3c2b-0000-4000-8000-000000000004';
const T1 = '7a4d3c2b-0000-4000-8000-000000000005';
const DAY = '2026-11-08' as LocalDate;

let devices: SimDevice[] = [];
afterEach(async () => {
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});

async function twoDevices(schemaB: SimSchema = 'i0'): Promise<[SimDevice, SimDevice]> {
  const a = await createSimDevice(A_ID, { name: 'PC', schema: 'i0' });
  const b = await createSimDevice(B_ID, { name: 'iPhone', schema: schemaB, clock: createManualClock(a.clock.nowMs()) });
  devices = [a, b];
  await setupFirst(a);
  await a.cycle();
  await pair(a, b);
  await b.cycle();
  syncFolders(devices);
  await a.cycle();
  return [a, b];
}
async function roundTrip(list: readonly SimDevice[] = devices): Promise<void> {
  for (let i = 0; i < 2; i += 1) {
    for (const d of list) {
      d.clock.advance(1_000);
      await d.cycle();
    }
    syncFolders(list);
  }
}
const foodDraft = (): FoodDraft => ({ source: 'custom', barcode: '4006381333931', name: 'Fiche synthétique', brand: null, per100g: { kcal: 120, proteinG: 10, fatG: 5, carbG: 8, fiberG: null }, fetchedAt: null });
const entryDraft = (over: Partial<MealEntryDraft> = {}): MealEntryDraft => ({
  date: DAY, time: '12:30' as LocalTime, foodId: F1, foodName: 'Fiche synthétique', source: 'custom', grams: 150, kcal: 180, proteinG: 15, fatG: 7.5, carbG: 12, method: 'search', confidence: null, ...over,
});
const seed = async (d: SimDevice): Promise<void> => {
  await d.data.transaction(async (repos) => {
    const foods = await repos.foods();
    await foods.create(foodDraft(), { id: F1 });
    await foods.addPortion(F1, { label: '1 tranche', grams: 30 }, { id: P1 });
    const entries = await repos.mealEntries();
    await entries.create(entryDraft(), { id: E1 });
    await entries.create(entryDraft({ time: '08:00' as LocalTime, foodId: 'ciqual:1000', source: 'ciqual', foodName: 'Pastis', grams: 100, kcal: 274, proteinG: null, fatG: null, carbG: null }), { id: E2 });
    await (await repos.nutritionTargets()).record({ weekStart: '2026-11-02' as LocalDate, target: { kcal: 2400, proteinG: 150, fatG: 70, carbG: 290 }, source: 'auto', accepted: true, engineVersion: 1, lowFloorConfirmed: false }, { id: T1 });
  });
};

describe('catalogue de production : tables de nutrition (I4-02)', () => {
  it('quatre tables à la fin de l’ordre, UUID ; seule food_portion a un parent ; aucune colonne locale', () => {
    expect(SYNC_TABLE_ORDER.slice(-4)).toEqual(['food', 'food_portion', 'meal_entry', 'nutrition_target']);
    for (const name of ['food', 'food_portion', 'meal_entry', 'nutrition_target']) {
      const t = SYNC_CATALOGUE.table(name);
      if (!t) throw new Error(name);
      expect(t.idKind, name).toBe('uuid');
      expect(t.local, name).toEqual([]);
    }
    expect(SYNC_CATALOGUE.table('food_portion')?.parents).toEqual([{ column: 'food_id', table: 'food' }]);
    expect(SYNC_CATALOGUE.table('meal_entry')?.parents).toEqual([]);
  });
  it('tables non publiées : ai_call, préférences locales', () => {
    for (const name of ['ai_call', 'food_favorite', 'nutrition_pref']) expect(SYNC_CATALOGUE.table(name)).toBeUndefined();
  });
  it('types et listes fermées : provenance, méthode, source de la cible', () => {
    const col = (t: string, c: string) => {
      const x = SYNC_CATALOGUE.column(t, c);
      if (!x) throw new Error(`${t}.${c}`);
      return x;
    };
    for (const ok of ['custom', 'off']) expect(SYNC_CATALOGUE.isValidValue(col('food', 'source'), ok)).toBe(true);
    expect(SYNC_CATALOGUE.isValidValue(col('food', 'source'), 'ciqual')).toBe(false);
    for (const ok of ['custom', 'ciqual', 'off', 'estimate', 'manual']) expect(SYNC_CATALOGUE.isValidValue(col('meal_entry', 'source'), ok)).toBe(true);
    for (const ok of ['search', 'scan', 'photo', 'quickadd']) expect(SYNC_CATALOGUE.isValidValue(col('meal_entry', 'method'), ok)).toBe(true);
    expect(SYNC_CATALOGUE.isValidValue(col('meal_entry', 'method'), 'dictée')).toBe(false);
    expect(SYNC_CATALOGUE.isValidValue(col('meal_entry', 'date'), '2026-11-08')).toBe(true);
    expect(SYNC_CATALOGUE.isValidValue(col('meal_entry', 'time'), '12:30')).toBe(true);
    expect(SYNC_CATALOGUE.isValidValue(col('meal_entry', 'time'), '24:00')).toBe(false);
    expect(SYNC_CATALOGUE.isValidValue(col('meal_entry', 'kcal'), null)).toBe(true);
    expect(SYNC_CATALOGUE.isValidValue(col('meal_entry', 'food_id'), 'ciqual:1000')).toBe(true);
    expect(SYNC_CATALOGUE.isValidValue(col('meal_entry', 'grams'), null)).toBe(true);
    expect(SYNC_CATALOGUE.isValidValue(col('meal_entry', 'food_name'), null)).toBe(false);
    expect(SYNC_CATALOGUE.isValidValue(col('nutrition_target', 'kcal'), null)).toBe(false);
    for (const ok of ['auto', 'manual']) expect(SYNC_CATALOGUE.isValidValue(col('nutrition_target', 'source'), ok)).toBe(true);
    expect(SYNC_CATALOGUE.isValidValue(col('food', 'fetched_at'), null)).toBe(true);
  });
});

describe('deux appareils', () => {
  it('fiche, portion, entrées et cible créées sur le PC : identiques sur l’iPhone, sans doublon', async () => {
    const [a, b] = await twoDevices();
    await seed(a);
    await roundTrip();
    await roundTrip();
    const foodsB = await b.data.repos.foods();
    expect((await foodsB.list()).map((f) => f.id)).toEqual([F1]);
    expect((await foodsB.listPortions(F1)).map((p) => [p.id, p.label, p.grams])).toEqual([[P1, '1 tranche', 30]]);
    const entriesB = await (await b.data.repos.mealEntries()).listByDate(DAY);
    expect(entriesB.map((e) => [e.id, e.foodId, e.kcal, e.proteinG])).toEqual([
      [E2, 'ciqual:1000', 274, null], // l'inconnu reste null après la synchro (jamais 0)
      [E1, F1, 180, 15],
    ]);
    expect((await (await b.data.repos.nutritionTargets()).effective(DAY))?.id).toBe(T1);
    for (const table of ['food', 'food_portion', 'meal_entry', 'nutrition_target']) {
      const [x] = await a.driver.select<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
      const [y] = await b.driver.select<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
      expect([table, y?.n]).toEqual([table, x?.n]);
    }
    expect(await b.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
  });

  it('suppression d’une entrée sur l’iPhone : propagée au PC ; une fiche supprimée emporte ses portions', async () => {
    const [a, b] = await twoDevices();
    await seed(a);
    await roundTrip();
    await (await b.data.repos.mealEntries()).softDelete(E1);
    await b.data.transaction(async (repos) => (await repos.foods()).softDelete(F1));
    await roundTrip();
    expect((await (await a.data.repos.mealEntries()).listByDate(DAY)).map((e) => e.id)).toEqual([E2]);
    expect(await (await a.data.repos.foods()).get(F1)).toBeNull();
    expect(await (await a.data.repos.foods()).listPortions(F1)).toEqual([]);
  });

  it('conflit par champ : grammes corrigés sur le PC, nom sur l’iPhone, hors ligne : les deux gardés partout', async () => {
    const [a, b] = await twoDevices();
    await seed(a);
    await roundTrip();
    await (await a.data.repos.mealEntries()).update(E1, { grams: 120, kcal: 144 });
    b.clock.advance(2_000);
    await (await b.data.repos.mealEntries()).update(E1, { foodName: 'Fiche corrigée' });
    await roundTrip();
    for (const d of [a, b]) expect(await (await d.data.repos.mealEntries()).get(E1), d.name).toMatchObject({ grams: 120, kcal: 144, foodName: 'Fiche corrigée' });
  });

  it('cible : une modification d’Ali est une nouvelle ligne, les deux appareils voient la même cible en vigueur', async () => {
    const [a, b] = await twoDevices();
    await seed(a);
    await roundTrip();
    await (await b.data.repos.nutritionTargets()).record({ weekStart: '2026-11-02' as LocalDate, target: { kcal: 2350, proteinG: 160, fatG: 70, carbG: 270 }, source: 'manual', accepted: true, engineVersion: null, lowFloorConfirmed: false });
    await roundTrip();
    const [x, y] = await Promise.all([a, b].map(async (d) => (await (await d.data.repos.nutritionTargets()).effective(DAY))?.target.kcal));
    expect([x, y]).toEqual([2350, 2350]);
  });
});

describe('instantané et appareil associé après coup', () => {
  it('les quatre tables sont dans l’instantané et reçues par le nouvel appareil', async () => {
    const a = await createSimDevice(A_ID, { name: 'PC', schema: 'i0' });
    devices = [a];
    await seed(a);
    await setupFirst(a);
    await a.cycle();
    const pages: string[] = [];
    for await (const page of snapshotPages(a.data.repos, SYNC_CATALOGUE, epochId(1, a.id), new Map<DeviceId, DeviceAck>(), 4)) pages.push(...page);
    const text = pages.join(' ');
    for (const id of [F1, P1, E1, E2, T1]) expect(text, id).toContain(id);
    const b = await createSimDevice(B_ID, { name: 'iPhone', schema: 'i0', clock: createManualClock(a.clock.nowMs()) });
    devices.push(b);
    await pair(a, b);
    await b.cycle();
    expect((await (await b.data.repos.mealEntries()).get(E1))?.foodName).toBe('Fiche synthétique');
    expect(await b.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
  });
});

describe('appareil resté en schéma 7 (ADR 0011 §7.2)', () => {
  it('lignes reçues : gardées dans sync_unknown ; réintégrées après la migration 0008', async () => {
    const [a, b] = await twoDevices('v7');
    await seed(a);
    await roundTrip();
    const tables = (await b.driver.select<{ table_name: string }>('SELECT DISTINCT table_name FROM sync_unknown ORDER BY table_name')).map((r) => r.table_name);
    expect(tables).toEqual(['food', 'food_portion', 'meal_entry', 'nutrition_target']);
    await migrate(b.driver, migrations);
    await reintegrateUnknownFields(b.driver, { catalogue: SYNC_CATALOGUE, now: new Date(b.clock.nowMs()).toISOString() as IsoDateTime });
    expect(await b.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
    expect(await b.driver.select('SELECT id, food_name, kcal FROM meal_entry ORDER BY id')).toEqual([
      { id: E1, food_name: 'Fiche synthétique', kcal: 180 },
      { id: E2, food_name: 'Pastis', kcal: 274 },
    ]);
    expect(await b.driver.select('SELECT id, name FROM food')).toEqual([{ id: F1, name: 'Fiche synthétique' }]);
  });
});

describe('libellés de synchro', () => {
  it('report d’époque : un libellé par table', () => {
    expect(carryKindText('food')).toBe('Fiche alimentaire');
    expect(carryKindText('food_portion')).toBe('Portion d’une fiche');
    expect(carryKindText('meal_entry')).toBe('Entrée du journal');
    expect(carryKindText('nutrition_target')).toBe('Cible nutritionnelle');
  });
});
