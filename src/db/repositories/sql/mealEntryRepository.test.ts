import { afterEach, describe, expect, it } from 'vitest';
import type { MealEntryDraft } from '../../../domain/nutrition/mealEntry';
import { aggregateDay } from '../../../domain/nutrition/dayTotals';
import { toMealEntryInput } from '../../../domain/nutrition/mealEntry';
import type { DeviceId, LocalDate, LocalTime } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * I4-02 : `MealEntryRepository` (table `meal_entry`, migration 0008) : création, modification, suppression validées ; l'inconnu reste NULL ;
 * ligne d'estimation corrigeable ; journée lue sans jamais compter zéro ; récents. Fixtures synthétiques (aucune saisie réelle).
 */

const DEVICE = '60000000-0000-4000-8000-0000000000f9' as DeviceId;
const FOOD = '7e3c2b1a-0000-4000-8000-0000000000f1';
const E = (n: number): string => `7e3c2b1a-0000-4000-8000-0000000000e${n}`;
const DAY = '2026-11-08' as LocalDate;
let db: TestDb;
afterEach(async () => db.close());

const draft = (over: Partial<MealEntryDraft> = {}): MealEntryDraft => ({
  date: DAY,
  time: '12:30' as LocalTime,
  foodId: FOOD,
  foodName: 'Fiche synthétique',
  source: 'custom',
  grams: 150,
  kcal: 180,
  proteinG: 15,
  fatG: 7.5,
  carbG: 12,
  method: 'search',
  confidence: null,
  ...over,
});
const repo = async () => db.data.repos.mealEntries();
const outbox = () => db.driver.select<{ row_id: string; field: string }>("SELECT row_id, field FROM sync_outbox WHERE table_name = 'meal_entry' ORDER BY seq");

describe('MealEntryRepository : création', () => {
  it('create : entrée relue telle quelle, mise en file en ligne entière ; macros inconnues restent null', async () => {
    db = await openBaseDb(DEVICE);
    const created = await (await repo()).create(draft({ proteinG: null, fatG: null, carbG: null }), { id: E(1) });
    expect(created).toMatchObject({ id: E(1), date: DAY, time: '12:30', foodId: FOOD, foodName: 'Fiche synthétique', source: 'custom', grams: 150, kcal: 180, proteinG: null, fatG: null, carbG: null, method: 'search', confidence: null, deletedAt: null, deviceId: DEVICE });
    expect(await (await repo()).get(E(1))).toEqual(created);
    expect(await outbox()).toEqual([{ row_id: E(1), field: '*' }]);
  });

  it('Quick Add : énergie seule, sans aliment ni grammes', async () => {
    db = await openBaseDb(DEVICE);
    const q = await (await repo()).create(draft({ method: 'quickadd', source: 'manual', foodId: null, foodName: 'Ajout rapide', grams: null, kcal: 400, proteinG: null, fatG: null, carbG: null }), { id: E(1) });
    expect(q).toMatchObject({ method: 'quickadd', source: 'manual', foodId: null, grams: null, kcal: 400, proteinG: null });
  });

  it('entrée invalide refusée sans rien écrire ; identifiant déjà pris refusé', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    for (const bad of [draft({ grams: 0 }), draft({ foodId: null }), draft({ kcal: -1 }), draft({ time: '25:00' as LocalTime }), draft({ method: 'photo', source: 'estimate', foodId: null })])
      await expect(r.create(bad, { id: E(1) })).rejects.toMatchObject({ code: 'invalid' });
    expect(await db.driver.select('SELECT * FROM meal_entry')).toEqual([]);
    expect(await outbox()).toEqual([]);
    await r.create(draft(), { id: E(1) });
    await expect(r.create(draft(), { id: E(1) })).rejects.toMatchObject({ code: 'conflict' });
    await expect(r.create(draft(), { id: 'pas-un-uuid' })).rejects.toMatchObject({ code: 'invalid' });
  });

  it('createMany : tout ou rien (une entrée invalide n’en écrit aucune)', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await expect(r.createMany([draft(), draft({ grams: -1 })])).rejects.toMatchObject({ code: 'invalid' });
    expect(await db.driver.select('SELECT * FROM meal_entry')).toEqual([]);
    const rows = await db.data.transaction(async (repos) => (await repos.mealEntries()).createMany([draft(), draft({ time: '19:00' as LocalTime })]));
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((x) => x.id)).size).toBe(2);
  });

  it('transaction annulée : ni ligne ni file d’envoi', async () => {
    db = await openBaseDb(DEVICE);
    await expect(
      db.data.transaction(async (repos) => {
        await (await repos.mealEntries()).create(draft(), { id: E(1) });
        throw new Error('annulé');
      }),
    ).rejects.toThrow('annulé');
    expect(await db.driver.select('SELECT * FROM meal_entry')).toEqual([]);
    expect(await outbox()).toEqual([]);
  });
});

describe('MealEntryRepository : modification et suppression', () => {
  it('update : une estimation de photo est corrigée (grammes, nom, valeurs) ; validée ensemble, publiée champ par champ', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await r.create(draft({ method: 'photo', source: 'estimate', foodId: null, foodName: 'Pâtes (estimation)', confidence: 0.6, grams: 300, kcal: 420 }), { id: E(1) });
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(1_000);
    const fixed = await r.update(E(1), { grams: 250, kcal: 350, foodName: 'Pâtes complètes' });
    expect(fixed).toMatchObject({ grams: 250, kcal: 350, foodName: 'Pâtes complètes', method: 'photo', source: 'estimate', confidence: 0.6 });
    expect((await outbox()).map((o) => o.field).sort()).toEqual(['food_name', 'grams', 'kcal']);
    await expect(r.update(E(1), { grams: 0 })).rejects.toMatchObject({ code: 'invalid' });
    await expect(r.update(E(1), { source: 'custom' })).rejects.toMatchObject({ code: 'invalid' });
    await expect(r.update(E(2), { grams: 10 })).rejects.toMatchObject({ code: 'not-found' });
    expect((await r.get(E(1)))?.grams).toBe(250);
  });

  it('softDelete : masquée, tombstone publiée ; deuxième suppression : not-found', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await r.create(draft(), { id: E(1) });
    await r.softDelete(E(1));
    expect(await r.get(E(1))).toBeNull();
    expect((await r.get(E(1), { includeDeleted: true }))?.deletedAt).not.toBeNull();
    expect(await r.listByDate(DAY)).toEqual([]);
    await expect(r.softDelete(E(1))).rejects.toMatchObject({ code: 'not-found' });
  });
});

describe('MealEntryRepository : lecture du journal', () => {
  it('listByDate : une date, par heure puis création ; listBetween : bornes incluses', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await r.create(draft({ time: '19:00' as LocalTime }), { id: E(1) });
    await r.create(draft({ time: '08:00' as LocalTime }), { id: E(2) });
    await r.create(draft({ date: '2026-11-07' as LocalDate }), { id: E(3) });
    await r.create(draft({ date: '2026-11-09' as LocalDate }), { id: E(4) });
    expect((await r.listByDate(DAY)).map((e) => e.id)).toEqual([E(2), E(1)]);
    expect((await r.listBetween('2026-11-07' as LocalDate, DAY)).map((e) => e.id)).toEqual([E(3), E(2), E(1)]);
  });

  it('jour sans entrée : liste vide (jamais une ligne à zéro) ; journée à énergie inconnue : total inconnu', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    expect(await r.listByDate(DAY)).toEqual([]);
    await r.create(draft({ time: '08:00' as LocalTime, kcal: null }), { id: E(1) });
    await r.create(draft({ time: '13:00' as LocalTime }), { id: E(2) });
    await r.create(draft({ time: '19:00' as LocalTime }), { id: E(3) });
    const totals = aggregateDay(DAY, (await r.listByDate(DAY)).map(toMealEntryInput));
    expect(totals.kcal).toBeNull();
    expect(totals.state).toBe('complete'); // 3 entrées sur 11 h : l'état n'est pas le total
  });

  it('recentFoods : aliments distincts, du plus récent au plus ancien, quick add et supprimées exclues', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    const OTHER = 'ciqual:1000';
    await r.create(draft({ date: '2026-11-05' as LocalDate }), { id: E(1) });
    await r.create(draft({ date: '2026-11-06' as LocalDate, foodId: OTHER, source: 'ciqual', foodName: 'Pastis', grams: 100, kcal: 274 }), { id: E(2) });
    await r.create(draft({ date: '2026-11-07' as LocalDate, grams: 200, kcal: 240 }), { id: E(3) });
    await r.create(draft({ method: 'quickadd', source: 'manual', foodId: null, foodName: 'Ajout rapide', grams: null, proteinG: null, fatG: null, carbG: null }), { id: E(4) });
    await r.create(draft({ date: '2026-11-04' as LocalDate, foodId: '7e3c2b1a-0000-4000-8000-0000000000f2', foodName: 'Supprimée' }), { id: E(5) });
    await r.softDelete(E(5));
    const recent = await r.recentFoods(10);
    expect(recent.map((x) => [x.foodId, x.lastGrams, x.source])).toEqual([
      [FOOD, 200, 'custom'], // dernière prise (E3) ; la quick add du jour est exclue
      [OTHER, 100, 'ciqual'],
    ]);
    expect(await r.recentFoods(1)).toHaveLength(1);
  });
});
