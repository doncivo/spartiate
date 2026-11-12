import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import { epochId, SYNC_TABLE_ORDER, type DeviceAck } from '../../../../src/domain/sync/format';
import { SYNC_CATALOGUE } from '../../../../src/domain/sync/syncTables';
import type { RecipeDraft } from '../../../../src/domain/nutrition/recipeTypes';
import type { SyncField, SyncOp } from '../../../../src/domain/sync/format';
import type { DeviceId, Hlc, IsoDateTime, LocalDate } from '../../../../src/domain/types';
import { applyOps, type ApplyContext } from '../../../../src/sync/apply';
import { guarded } from '../../../../src/sync/guarded';
import { createMemorySyncLogger } from '../../../../src/sync/log';
import { retryParked } from '../../../../src/sync/maintenance';
import type { SyncDeps } from '../../../../src/sync/deps';
import { migrate } from '../../../../src/db/migrator';
import { migrations } from '../../../../src/db/migrations';
import { reintegrateUnknownFields } from '../../../../src/db/repositories';
import { snapshotPages } from '../../../../src/sync/snapshot';
import { carryKindText } from '../../../../src/features/sync/carryReportText';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice, type SimSchema } from '../../../sim/syncDevice';

/**
 * I4-07 (D-26, D-80, D-81 ; § 9.1, § 20.2) : publication de `day_completeness` (identifiant naturel `day|AAAA-MM-JJ`), `recipe` et
 * `recipe_ingredient` (parent `recipe`). Périmètre de non-régression : (a) deux appareils (recette avec ingrédients, déclaration, suppression
 * = tombstone) ; (b) appareil resté en schéma 8 : aucune erreur, lignes dans `sync_unknown`, ses tables intactes, réintégration après sa mise à
 * jour ; (c) conflit sur un MÊME champ : l'HLC le plus récent gagne, journal des conflits cohérent ; (d) ingrédient reçu avant sa recette : mis
 * de côté puis rejoué ; une prise de recette (`meal_entry` ordinaire) passe aussi sur un appareil en schéma 8.
 */

const A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const R1 = '7e4d3c2b-0000-4000-8000-000000000001';
const E1 = '7e4d3c2b-0000-4000-8000-000000000003';
const DAY = '2026-11-09' as LocalDate;
const DAY2 = '2026-11-10' as LocalDate;

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
const draft = (over: Partial<RecipeDraft> = {}): RecipeDraft => ({
  name: 'Poulet-riz synthétique',
  servings: 4,
  cookedWeightG: 1200,
  ingredients: [
    { name: 'Riz synthétique', source: 'custom', foodRef: null, grams: 300, per100g: { kcal: 130, proteinG: 2.7, fatG: 0.3, carbG: 28, fiberG: null } },
    { name: 'Poulet synthétique', source: 'ciqual', foodRef: 'ciqual:1000', grams: 500, per100g: { kcal: null, proteinG: null, fatG: null, carbG: null, fiberG: null } },
  ],
  ...over,
});
const seed = (d: SimDevice) => d.data.transaction(async (repos) => (await repos.recipes()).create(draft(), { id: R1 }));
const count = async (d: SimDevice, table: string): Promise<number> => Number((await d.driver.select<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))[0]?.n);

describe('catalogue de production : recettes et journée complète (I4-07)', () => {
  it('trois tables juste avant la récupération (I5-01), recette avant ingrédient ; seul l’ingrédient a un parent ; aucune colonne locale', () => {
    expect(SYNC_TABLE_ORDER.slice(-6, -3)).toEqual(['day_completeness', 'recipe', 'recipe_ingredient']);
    for (const name of ['day_completeness', 'recipe', 'recipe_ingredient']) {
      const t = SYNC_CATALOGUE.table(name);
      if (!t) throw new Error(name);
      expect(t.local, name).toEqual([]);
    }
    expect(SYNC_CATALOGUE.table('day_completeness')?.idKind).toBe('natural');
    expect(SYNC_CATALOGUE.table('recipe')?.idKind).toBe('uuid');
    expect(SYNC_CATALOGUE.table('recipe_ingredient')?.parents).toEqual([{ column: 'recipe_id', table: 'recipe' }]);
    expect(SYNC_CATALOGUE.table('recipe')?.parents).toEqual([]);
  });
  it('identifiant naturel de la déclaration : « day|AAAA-MM-JJ » seulement, aucun repli UUID', () => {
    const t = SYNC_CATALOGUE.table('day_completeness');
    if (!t) throw new Error('day_completeness');
    expect(SYNC_CATALOGUE.isValidRowId(t, 'day|2026-11-09')).toBe(true);
    for (const bad of ['day|2026-13-09', 'day|2026-11-9', 'weight|2026-11-09|manual', R1, 'day|']) expect(SYNC_CATALOGUE.isValidRowId(t, bad), bad).toBe(false);
  });
  it('types et listes fermées', () => {
    const col = (t: string, c: string) => {
      const x = SYNC_CATALOGUE.column(t, c);
      if (!x) throw new Error(`${t}.${c}`);
      return x;
    };
    for (const ok of ['complete', 'incomplete']) expect(SYNC_CATALOGUE.isValidValue(col('day_completeness', 'state'), ok)).toBe(true);
    expect(SYNC_CATALOGUE.isValidValue(col('day_completeness', 'state'), 'partial')).toBe(false);
    expect(SYNC_CATALOGUE.isValidValue(col('day_completeness', 'state'), null)).toBe(false);
    expect(SYNC_CATALOGUE.isValidValue(col('recipe', 'cooked_weight_g'), null)).toBe(true);
    expect(SYNC_CATALOGUE.isValidValue(col('recipe', 'name'), null)).toBe(false);
    for (const ok of ['custom', 'ciqual', 'off']) expect(SYNC_CATALOGUE.isValidValue(col('recipe_ingredient', 'source'), ok)).toBe(true);
    expect(SYNC_CATALOGUE.isValidValue(col('recipe_ingredient', 'source'), 'manual')).toBe(false);
    for (const c of ['kcal_100g', 'protein_100g', 'fat_100g', 'carb_100g', 'fiber_100g', 'food_ref']) expect(SYNC_CATALOGUE.isValidValue(col('recipe_ingredient', c), null), c).toBe(true);
    expect(SYNC_CATALOGUE.isValidValue(col('recipe_ingredient', 'grams'), null)).toBe(false);
  });
});

describe('(a) deux appareils', () => {
  it('recette avec ingrédients et déclaration créées sur le PC : identiques sur l’iPhone, sans doublon, l’inconnu reste null', async () => {
    const [a, b] = await twoDevices();
    await seed(a);
    await (await a.data.repos.dayCompleteness()).declare(DAY, 'complete');
    await roundTrip();
    await roundTrip();
    const recipeB = await (await b.data.repos.recipes()).get(R1);
    expect(recipeB).toMatchObject({ id: R1, name: 'Poulet-riz synthétique', servings: 4, cookedWeightG: 1200 });
    expect(recipeB?.ingredients.map((i) => [i.position, i.name, i.source, i.foodRef, i.grams, i.per100g.kcal])).toEqual([
      [0, 'Riz synthétique', 'custom', null, 300, 130],
      [1, 'Poulet synthétique', 'ciqual', 'ciqual:1000', 500, null], // l'inconnu reste null après la synchro (jamais 0)
    ]);
    expect((await (await b.data.repos.dayCompleteness()).get(DAY))?.state).toBe('complete');
    for (const table of ['day_completeness', 'recipe', 'recipe_ingredient']) expect([table, await count(b, table)]).toEqual([table, await count(a, table)]);
    expect(await b.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
    expect(await b.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
  });

  it('modification d’une recette (ingrédient retiré, un autre ajouté) sur l’iPhone : propagée au PC', async () => {
    const [a, b] = await twoDevices();
    await seed(a);
    await roundTrip();
    const base = draft();
    const first = base.ingredients[0];
    if (!first) throw new Error('ingrédient');
    await (await b.data.repos.recipes()).update(R1, { ...base, servings: 6, ingredients: [first, { name: 'Brocoli synthétique', source: 'custom', foodRef: null, grams: 200, per100g: { kcal: 34, proteinG: 2.8, fatG: 0.4, carbG: 7, fiberG: 2.6 } }] });
    await roundTrip();
    const onA = await (await a.data.repos.recipes()).get(R1);
    expect(onA?.servings).toBe(6);
    expect(onA?.ingredients.map((i) => i.name)).toEqual(['Riz synthétique', 'Brocoli synthétique']);
  });

  it('recette supprimée sur l’iPhone : recette et ingrédients supprimés au PC (tombstone), prise de repas intacte', async () => {
    const [a, b] = await twoDevices();
    await seed(a);
    await (await a.data.repos.mealEntries()).create(
      { date: DAY, time: '12:30' as never, foodId: `recipe:${R1}`, foodName: 'Poulet-riz synthétique', source: 'custom', grams: 300, kcal: 390, proteinG: 30, fatG: 10, carbG: 40, method: 'search', confidence: null },
      { id: E1 },
    );
    await roundTrip();
    await b.data.transaction(async (repos) => (await repos.recipes()).softDelete(R1));
    await roundTrip();
    expect(await (await a.data.repos.recipes()).get(R1)).toBeNull();
    expect(await (await a.data.repos.recipes()).list()).toEqual([]);
    expect(await a.driver.select('SELECT COUNT(*) AS n FROM recipe_ingredient WHERE deleted_at IS NULL')).toEqual([{ n: 0 }]);
    expect(await a.driver.select('SELECT deleted_at IS NOT NULL AS gone FROM recipe WHERE id = ?', [R1])).toEqual([{ gone: 1 }]);
    expect((await (await a.data.repos.mealEntries()).get(E1))?.foodName).toBe('Poulet-riz synthétique');
  });

  it('déclaration effacée sur l’iPhone : propagée ; redéclarée sur le PC : revient partout (restauration « + »)', async () => {
    const [a, b] = await twoDevices();
    await (await a.data.repos.dayCompleteness()).declare(DAY, 'incomplete');
    await roundTrip();
    await (await b.data.repos.dayCompleteness()).clear(DAY);
    await roundTrip();
    expect(await (await a.data.repos.dayCompleteness()).get(DAY)).toBeNull();
    a.clock.advance(5_000);
    await (await a.data.repos.dayCompleteness()).declare(DAY, 'complete');
    await roundTrip();
    for (const d of [a, b]) expect((await (await d.data.repos.dayCompleteness()).get(DAY))?.state, d.name).toBe('complete');
  });
});

describe('instantané et appareil associé après coup', () => {
  it('les trois tables sont dans l’instantané et reçues par le nouvel appareil', async () => {
    const a = await createSimDevice(A_ID, { name: 'PC', schema: 'i0' });
    devices = [a];
    await seed(a);
    await (await a.data.repos.dayCompleteness()).declare(DAY, 'complete');
    await setupFirst(a);
    await a.cycle();
    const pages: string[] = [];
    for await (const page of snapshotPages(a.data.repos, SYNC_CATALOGUE, epochId(1, a.id), new Map<DeviceId, DeviceAck>(), 4)) pages.push(...page);
    const text = pages.join(' ');
    for (const id of [R1, 'day|2026-11-09']) expect(text, id).toContain(id);
    const b = await createSimDevice(B_ID, { name: 'iPhone', schema: 'i0', clock: createManualClock(a.clock.nowMs()) });
    devices.push(b);
    await pair(a, b);
    await b.cycle();
    expect((await (await b.data.repos.recipes()).get(R1))?.ingredients).toHaveLength(2);
    expect((await (await b.data.repos.dayCompleteness()).get(DAY))?.state).toBe('complete');
    expect(await b.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
  });
});

describe('(b) appareil resté en schéma 8 (ADR 0011 §7.2)', () => {
  it('lignes reçues : aucune erreur, gardées dans sync_unknown, ses tables intactes ; réintégrées après la migration 0009', async () => {
    const [a, b] = await twoDevices('v8');
    await seed(a);
    await (await a.data.repos.dayCompleteness()).declare(DAY, 'complete');
    // Une prise de recette est une entrée de journal ordinaire : un appareil en schéma 8 la reçoit et la lit.
    await (await a.data.repos.mealEntries()).create(
      { date: DAY, time: '12:30' as never, foodId: `recipe:${R1}`, foodName: 'Poulet-riz synthétique', source: 'custom', grams: 300, kcal: 390, proteinG: 30, fatG: 10, carbG: 40, method: 'search', confidence: null },
      { id: E1 },
    );
    const mealsBefore = await count(b, 'meal_entry');
    await roundTrip();
    const tables = (await b.driver.select<{ table_name: string }>('SELECT DISTINCT table_name FROM sync_unknown ORDER BY table_name')).map((r) => r.table_name);
    expect(tables).toEqual(['day_completeness', 'recipe', 'recipe_ingredient']);
    expect(await b.driver.select("SELECT 1 FROM sqlite_master WHERE name IN ('recipe', 'recipe_ingredient', 'day_completeness')")).toEqual([]);
    // ses propres tables : l'entrée de journal est arrivée normalement
    expect(await count(b, 'meal_entry')).toBe(mealsBefore + 1);
    expect(await b.driver.select('SELECT food_id, food_name, kcal FROM meal_entry WHERE id = ?', [E1])).toEqual([{ food_id: `recipe:${R1}`, food_name: 'Poulet-riz synthétique', kcal: 390 }]);
    expect(await b.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
    await migrate(b.driver, migrations);
    await reintegrateUnknownFields(b.driver, { catalogue: SYNC_CATALOGUE, now: new Date(b.clock.nowMs()).toISOString() as IsoDateTime });
    expect(await b.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
    expect(await b.driver.select('SELECT id, name, servings, cooked_weight_g FROM recipe')).toEqual([{ id: R1, name: 'Poulet-riz synthétique', servings: 4, cooked_weight_g: 1200 }]);
    expect(await b.driver.select('SELECT position, name, grams, kcal_100g FROM recipe_ingredient ORDER BY position')).toEqual([
      { position: 0, name: 'Riz synthétique', grams: 300, kcal_100g: 130 },
      { position: 1, name: 'Poulet synthétique', grams: 500, kcal_100g: null },
    ]);
    expect(await b.driver.select('SELECT id, date, state FROM day_completeness')).toEqual([{ id: 'day|2026-11-09', date: DAY, state: 'complete' }]);
  });
});

describe('(c) conflit sur un MÊME champ', () => {
  it('deux appareils déclarent le même jour différemment, hors ligne : la déclaration la plus récente gagne partout, journal des conflits cohérent', async () => {
    const [a, b] = await twoDevices();
    await (await a.data.repos.dayCompleteness()).declare(DAY, 'complete');
    b.clock.advance(3_000);
    await (await b.data.repos.dayCompleteness()).declare(DAY, 'incomplete');
    await roundTrip();
    await roundTrip();
    for (const d of [a, b]) {
      expect((await (await d.data.repos.dayCompleteness()).get(DAY))?.state, d.name).toBe('incomplete');
      expect(await count(d, 'day_completeness'), d.name).toBe(1);
    }
    const log = async (d: SimDevice) => d.driver.select<{ field: string; kept_value: string; discarded_value: string; kept_device: string; discarded_device: string }>(
      "SELECT field, kept_value, discarded_value, kept_device, discarded_device FROM conflict_log WHERE table_name = 'day_completeness' AND field = 'state' ORDER BY id",
    );
    const [onA, onB] = [await log(a), await log(b)];
    expect(onA).toEqual([{ field: 'state', kept_value: '"incomplete"', discarded_value: '"complete"', kept_device: B_ID, discarded_device: A_ID }]);
    expect(onB).toEqual(onA);
  });

  it('même champ d’une recette (portions) corrigé des deux côtés : le plus récent gagne, l’autre champ modifié ailleurs est gardé', async () => {
    const [a, b] = await twoDevices();
    await seed(a);
    await roundTrip();
    const base = draft();
    await (await a.data.repos.recipes()).update(R1, { ...base, servings: 2 });
    b.clock.advance(3_000);
    await (await b.data.repos.recipes()).update(R1, { ...base, servings: 8, name: 'Poulet-riz corrigé' });
    await roundTrip();
    await roundTrip();
    for (const d of [a, b]) expect(await (await d.data.repos.recipes()).get(R1), d.name).toMatchObject({ servings: 8, name: 'Poulet-riz corrigé' });
  });
});

describe('(d) ordre : ingrédient avant sa recette', () => {
  const HLC = (ms: number): Hlc => `${String(1_794_000_000_000 + ms).padStart(15, '0')}-0000-${A_ID}` as Hlc;
  const AT = '2026-11-09T08:00:00.000Z' as IsoDateTime;
  const field = (value: SyncField[0], hlc: Hlc): SyncField => [value, hlc, null];
  const recipeOp = (hlc: Hlc): SyncOp => ({
    t: 'recipe',
    id: R1,
    at: AT,
    f: new Map<string, SyncField>([['name', field('Poulet-riz reçu', hlc)], ['servings', field(4, hlc)], ['cooked_weight_g', field(null, hlc)], ['created_at', field(AT, hlc)], ['deleted_at', field(null, hlc)]]),
  });
  const ingredientOp = (id: string, position: number, name: string, hlc: Hlc): SyncOp => ({
    t: 'recipe_ingredient',
    id,
    at: AT,
    f: new Map<string, SyncField>([
      ['recipe_id', field(R1, hlc)],
      ['position', field(position, hlc)],
      ['name', field(name, hlc)],
      ['source', field('custom', hlc)],
      ['food_ref', field(null, hlc)],
      ['grams', field(200, hlc)],
      ['kcal_100g', field(100, hlc)],
      ['protein_100g', field(null, hlc)],
      ['fat_100g', field(null, hlc)],
      ['carb_100g', field(null, hlc)],
      ['fiber_100g', field(null, hlc)],
      ['created_at', field(AT, hlc)],
      ['deleted_at', field(null, hlc)],
    ]),
  });
  const I1 = '7e4d3c2b-0000-4000-8000-0000000000a1';
  const I2 = '7e4d3c2b-0000-4000-8000-0000000000a2';
  const ctx = (logger: ReturnType<typeof createMemorySyncLogger>, noPark = false): ApplyContext => ({ catalogue: SYNC_CATALOGUE, localSv: 9, remoteSv: 9, now: AT, knows: () => true, logger, ...(noPark ? { noPark } : {}) });

  it('ingrédients reçus seuls : mis de côté (missing-parent), rien d’écrit ; la recette arrive ensuite : ils sont rejoués, sync_parked vidé', async () => {
    const [, b] = await twoDevices();
    const logger = createMemorySyncLogger();
    await guarded(b.data, (repos) => applyOps(repos, [ingredientOp(I1, 0, 'Riz reçu', HLC(2)), ingredientOp(I2, 1, 'Poulet reçu', HLC(2))], ctx(logger)));
    expect(await count(b, 'recipe_ingredient')).toBe(0);
    expect((await b.driver.select<{ reason: string; table_name: string; row_id: string }>('SELECT reason, table_name, row_id FROM sync_parked ORDER BY id')).map((p) => [p.reason, p.table_name, p.row_id])).toEqual([
      ['missing-parent', 'recipe_ingredient', I1],
      ['missing-parent', 'recipe_ingredient', I2],
    ]);
    await guarded(b.data, (repos) => applyOps(repos, [recipeOp(HLC(2))], ctx(logger)));
    expect(await count(b, 'recipe')).toBe(1);
    expect(await count(b, 'recipe_ingredient')).toBe(0); // la mise de côté attend le passage de reprise du moteur
    await retryParked({ catalogue: SYNC_CATALOGUE, data: b.data, clock: b.clock, sv: 9, logger } as unknown as SyncDeps, { carryHeld: 0, released: [] });
    expect(await b.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
    expect((await (await b.data.repos.recipes()).get(R1))?.ingredients.map((i) => [i.id, i.position, i.name])).toEqual([
      [I1, 0, 'Riz reçu'],
      [I2, 1, 'Poulet reçu'],
    ]);
    // rien n'a été mis en file par l'application de ce qui vient d'un autre appareil
    expect(await b.driver.select('SELECT 1 FROM sync_outbox')).toEqual([]);
  });

  it('un ingrédient dont la recette arrive supprimée : rejoué sans erreur, la recette reste supprimée', async () => {
    const [, b] = await twoDevices();
    const logger = createMemorySyncLogger();
    await guarded(b.data, (repos) => applyOps(repos, [ingredientOp(I1, 0, 'Riz reçu', HLC(2))], ctx(logger)));
    const base = recipeOp(HLC(3));
    const gone: SyncOp = { ...base, f: new Map([...base.f, ['deleted_at', field(AT, HLC(3))]]) };
    await guarded(b.data, (repos) => applyOps(repos, [gone], ctx(logger)));
    await retryParked({ catalogue: SYNC_CATALOGUE, data: b.data, clock: b.clock, sv: 9, logger } as unknown as SyncDeps, { carryHeld: 0, released: [] });
    expect(await (await b.data.repos.recipes()).get(R1)).toBeNull();
    expect(await b.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
  });
});

describe('(e) concurrence entre appareils, sans ligne hybride (relecture sync-icloud)', () => {
  const OIL = { name: 'Huile synthétique', source: 'off', foodRef: '4006381333931', grams: 15, per100g: { kcal: 900, proteinG: 0, fatG: 100, carbG: 0, fiberG: null } } as const;
  const asDraft = (i: { id: string; name: string; source: 'custom' | 'ciqual' | 'off'; foodRef: string | null; grams: number; per100g: RecipeDraft['ingredients'][number]['per100g'] }, over: Partial<RecipeDraft['ingredients'][number]> = {}): RecipeDraft['ingredients'][number] => ({
    id: i.id, name: i.name, source: i.source, foodRef: i.foodRef, grams: i.grams, per100g: i.per100g, ...over,
  });
  const threeIngredients = (d: SimDevice) => d.data.transaction(async (repos) => (await repos.recipes()).create(draft({ ingredients: [...draft().ingredients, OIL] }), { id: R1 }));

  it('un appareil retire l’ingrédient n°1 pendant que l’autre corrige le n°2 : les deux convergent, aucune ligne hybride', async () => {
    const [a, b] = await twoDevices();
    const created = await threeIngredients(a);
    await roundTrip();
    const [first, second, third] = created.ingredients;
    if (!first || !second || !third) throw new Error('ingrédients');
    // iPhone : retire le n°1 (poulet) ; PC (hors ligne) : corrige les grammes du n°2 (huile)
    b.clock.advance(2_000);
    await (await b.data.repos.recipes()).update(R1, draft({ ingredients: [asDraft(first), asDraft(third)] }));
    await (await a.data.repos.recipes()).update(R1, draft({ ingredients: [asDraft(first), asDraft(second), asDraft(third, { grams: 40 })] }));
    await roundTrip();
    await roundTrip();
    for (const d of [a, b]) {
      const r = await (await d.data.repos.recipes()).get(R1);
      expect(r?.ingredients.map((i) => [i.id, i.position, i.name, i.foodRef, i.grams, i.per100g.kcal]), d.name).toEqual([
        [first.id, 0, 'Riz synthétique', null, 300, 130],
        [third.id, 1, 'Huile synthétique', '4006381333931', 40, 900],
      ]);
    }
  });

  it('effacement d’une journée concurrent d’une redéclaration : les deux appareils convergent sur le même état', async () => {
    const [a, b] = await twoDevices();
    await (await a.data.repos.dayCompleteness()).declare(DAY, 'complete');
    await roundTrip();
    await (await b.data.repos.dayCompleteness()).clear(DAY);
    a.clock.advance(3_000);
    await (await a.data.repos.dayCompleteness()).declare(DAY, 'incomplete');
    await roundTrip();
    await roundTrip();
    const [x, y] = await Promise.all([a, b].map(async (d) => (await d.driver.select('SELECT state, deleted_at IS NOT NULL AS gone FROM day_completeness'))));
    expect(x).toEqual(y);
    expect(await count(a, 'day_completeness')).toBe(1);
    expect(await a.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
  });

  it('recette supprimée concurrente d’un ingrédient ajouté : convergence, la recette reste supprimée des deux côtés', async () => {
    const [a, b] = await twoDevices();
    const created = await seed(a);
    await roundTrip();
    await b.data.transaction(async (repos) => (await repos.recipes()).softDelete(R1));
    a.clock.advance(3_000);
    await (await a.data.repos.recipes()).update(R1, draft({ ingredients: [...created.ingredients.map((i) => asDraft(i)), OIL] }));
    await roundTrip();
    await roundTrip();
    for (const d of [a, b]) {
      expect(await (await d.data.repos.recipes()).get(R1), d.name).toBeNull();
      expect(await (await d.data.repos.recipes()).list(), d.name).toEqual([]);
    }
    expect(await count(a, 'recipe_ingredient')).toBe(await count(b, 'recipe_ingredient'));
    expect(await b.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
  });

  it('appareil en schéma 8 associé après coup (instantané du PC) : recettes et déclarations gardées dans sync_unknown, réintégrées après la mise à jour', async () => {
    const a = await createSimDevice(A_ID, { name: 'PC', schema: 'i0' });
    devices = [a];
    await seed(a);
    await (await a.data.repos.dayCompleteness()).declare(DAY, 'complete');
    await setupFirst(a);
    await a.cycle();
    const b = await createSimDevice(B_ID, { name: 'iPhone', schema: 'v8', clock: createManualClock(a.clock.nowMs()) });
    devices.push(b);
    await pair(a, b);
    await b.cycle();
    expect((await b.driver.select<{ table_name: string }>('SELECT DISTINCT table_name FROM sync_unknown ORDER BY table_name')).map((r) => r.table_name)).toEqual(['day_completeness', 'recipe', 'recipe_ingredient']);
    await migrate(b.driver, migrations);
    await reintegrateUnknownFields(b.driver, { catalogue: SYNC_CATALOGUE, now: new Date(b.clock.nowMs()).toISOString() as IsoDateTime });
    expect(await b.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
    expect(await count(b, 'recipe')).toBe(1);
    expect(await count(b, 'recipe_ingredient')).toBe(2);
    expect(await count(b, 'day_completeness')).toBe(1);
  });
});

describe('libellés de synchro', () => {
  it('report d’époque : un libellé par table', () => {
    expect(carryKindText('day_completeness')).toBe('Journée déclarée complète ou incomplète');
    expect(carryKindText('recipe')).toBe('Recette');
    expect(carryKindText('recipe_ingredient')).toBe('Ingrédient de recette');
  });
  it('jour distinct : deux déclarations distinctes ne se confondent pas', async () => {
    const [a, b] = await twoDevices();
    await (await a.data.repos.dayCompleteness()).declare(DAY, 'complete');
    await (await b.data.repos.dayCompleteness()).declare(DAY2, 'incomplete');
    await roundTrip();
    await roundTrip();
    for (const d of [a, b]) {
      const map = await (await d.data.repos.dayCompleteness()).listBetween(DAY, DAY2);
      expect([...map.entries()], d.name).toEqual([
        [DAY, 'complete'],
        [DAY2, 'incomplete'],
      ]);
    }
  });
});
