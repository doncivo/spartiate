import { afterEach, describe, expect, it } from 'vitest';
import { renphoDayDraft } from '../../../domain/nutrition/renphoDay';
import type { MealEntryDraft } from '../../../domain/nutrition/mealEntry';
import type { DeviceId, LocalDate, LocalTime } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * I6-04 (D-113) : « le journal Spartiate fait foi » : toute entrée saisie pour un jour REMPLACE (supprime) l'entrée « Renpho — total du jour » de ce jour,
 * quelle que soit la voie de saisie. Fixtures synthétiques.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000fa' as DeviceId;
const D8 = '2026-11-08' as LocalDate;
const D9 = '2026-11-09' as LocalDate;
let db: TestDb;
afterEach(async () => db.close());
const repo = async () => db.data.repos.mealEntries();
const totals = { kcal: 2300, proteinG: 150, fatG: 70, carbG: 260, fiberG: 28 };
const meal = (over: Partial<MealEntryDraft> = {}): MealEntryDraft => ({
  date: D8, time: '12:30' as LocalTime, foodId: null, foodName: 'Déjeuner', source: 'manual', grams: null, kcal: 700, proteinG: 40, fatG: 20, carbG: 80, method: 'quickadd', confidence: null, ...over,
});

describe('MealEntryRepository : entrée Renpho remplacée par le journal', () => {
  it('une saisie du jour supprime l’entrée Renpho de ce jour seulement', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    const renpho8 = await r.create(renphoDayDraft(D8, totals));
    const renpho9 = await r.create(renphoDayDraft(D9, totals));
    expect((await r.listByDate(D8)).map((e) => e.id)).toEqual([renpho8.id]);
    const own = await r.create(meal());
    expect((await r.listByDate(D8)).map((e) => e.id)).toEqual([own.id]);
    expect((await r.get(renpho8.id))).toBeNull();
    expect((await r.get(renpho8.id, { includeDeleted: true }))?.deletedAt).not.toBeNull();
    expect((await r.listByDate(D9)).map((e) => e.id)).toEqual([renpho9.id]);
  });

  it('créer une entrée Renpho n’en supprime aucune autre ; pas de repas, l’entrée reste', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await r.create(renphoDayDraft(D8, totals));
    expect(await r.listByDate(D8)).toHaveLength(1);
  });

  it('createMany et update (changement de date) appliquent la même règle', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await r.create(renphoDayDraft(D8, totals));
    await r.createMany([meal({ foodName: 'A' }), meal({ foodName: 'B', time: '19:00' as LocalTime })]);
    expect((await r.listByDate(D8)).map((e) => e.foodName)).toEqual(['A', 'B']);
    await r.create(renphoDayDraft(D9, totals));
    const own = await r.create(meal({ date: D8, foodName: 'C' }));
    await r.update(own.id, { date: D9 });
    expect((await r.listByDate(D9)).map((e) => e.foodName)).toEqual(['C']);
  });

  it('listBetween avec les entrées supprimées : la suppression par le journal est visible', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    const renpho = await r.create(renphoDayDraft(D8, totals));
    await r.create(meal());
    const all = await r.listBetween(D8, D8, { includeDeleted: true });
    expect(all.find((e) => e.id === renpho.id)?.deletedAt).not.toBeNull();
    expect((await r.listBetween(D8, D8)).map((e) => e.id)).not.toContain(renpho.id);
  });
});
