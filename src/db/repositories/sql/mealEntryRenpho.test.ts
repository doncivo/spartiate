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

/** FIX-0173 (constat 9 de la relecture du 12/11) : les fibres Renpho du jour partent avec le total Renpho, dans la même transaction. */
describe('MealEntryRepository : fibres Renpho retirées avec le total', () => {
  const fibers = async () => (await db.data.repos.measurements()).list('health_fiber_g');

  it('une saisie Spartiate qui remplace le total retire les fibres de ce jour seulement', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    const m = await db.data.repos.measurements();
    await r.create(renphoDayDraft(D8, totals));
    await r.create(renphoDayDraft(D9, totals));
    await m.save(D8, 'health_fiber_g', 28);
    await m.save(D9, 'health_fiber_g', 31);
    await r.create(meal());
    expect((await fibers()).map((f) => [f.day, f.value])).toEqual([[D9, 31]]);
  });

  it('createMany et update (changement de date) retirent aussi les fibres du jour remplacé', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    const m = await db.data.repos.measurements();
    await r.create(renphoDayDraft(D8, totals));
    await m.save(D8, 'health_fiber_g', 28);
    await r.createMany([meal({ foodName: 'A' })]);
    expect(await fibers()).toEqual([]);
    await r.create(renphoDayDraft(D9, totals));
    await m.save(D9, 'health_fiber_g', 31);
    const own = await r.create(meal({ date: D8, foodName: 'C' }));
    await r.update(own.id, { date: D9 });
    expect(await fibers()).toEqual([]);
  });

  it('supprimer l’entrée Renpho retire ses fibres ; supprimer un autre repas n’y touche pas', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    const m = await db.data.repos.measurements();
    const renpho = await r.create(renphoDayDraft(D8, totals));
    await m.save(D8, 'health_fiber_g', 28);
    const other = await r.create(meal({ date: D9 }));
    await m.save(D9, 'health_fiber_g', 31);
    await r.softDelete(other.id);
    expect((await fibers()).map((f) => f.day)).toEqual([D8, D9]);
    await r.softDelete(renpho.id);
    expect((await fibers()).map((f) => f.day)).toEqual([D9]);
  });

  it('même transaction : un échec du retrait des fibres annule la saisie du repas', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    const m = await db.data.repos.measurements();
    await r.create(renphoDayDraft(D8, totals));
    await m.save(D8, 'health_fiber_g', 28);
    await db.driver.execute("CREATE TRIGGER fix0173_fail BEFORE UPDATE ON measurement BEGIN SELECT RAISE(ABORT, 'boom'); END");
    await expect(r.create(meal())).rejects.toThrow();
    expect((await r.listByDate(D8)).map((e) => e.foodName)).toEqual(['Renpho — total du jour']);
    expect((await fibers()).map((f) => f.value)).toEqual([28]);
  });
});
