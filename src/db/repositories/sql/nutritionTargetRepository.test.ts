import { afterEach, describe, expect, it } from 'vitest';
import type { TargetRecordDraft } from '../../../domain/nutrition/targetRecord';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * I4-02 : `NutritionTargetRepository` (table `nutrition_target`, migration 0008) : une ligne par décision, jamais modifiée ; la cible en
 * vigueur est la dernière acceptée ; la modification d'Ali est conservée et tracée (`source manual`, `accepted`). Valeurs synthétiques.
 */

const DEVICE = '60000000-0000-4000-8000-0000000000fa' as DeviceId;
const T = (n: number): string => `7f3c2b1a-0000-4000-8000-0000000000b${n}`;
let db: TestDb;
afterEach(async () => db.close());

const draft = (over: Partial<TargetRecordDraft> = {}): TargetRecordDraft => ({
  weekStart: '2026-11-02' as LocalDate,
  target: { kcal: 2400, proteinG: 150, fatG: 70, carbG: 290 },
  source: 'auto',
  accepted: true,
  engineVersion: 1,
  lowFloorConfirmed: false,
  ...over,
});
const repo = async () => db.data.repos.nutritionTargets();

describe('NutritionTargetRepository', () => {
  it('record : cible relue telle quelle et mise en file en ligne entière', async () => {
    db = await openBaseDb(DEVICE);
    const saved = await (await repo()).record(draft(), { id: T(1) });
    expect(saved).toMatchObject({ id: T(1), weekStart: '2026-11-02', target: { kcal: 2400, proteinG: 150, fatG: 70, carbG: 290 }, source: 'auto', accepted: true, engineVersion: 1, deviceId: DEVICE });
    expect(await db.driver.select("SELECT row_id, field FROM sync_outbox WHERE table_name = 'nutrition_target'")).toEqual([{ row_id: T(1), field: '*' }]);
  });

  it('la confirmation sous 1 200 kcal n’est pas stockée (c’est une condition d’écriture)', async () => {
    db = await openBaseDb(DEVICE);
    const saved = await (await repo()).record(draft({ target: { kcal: 1100, proteinG: 100, fatG: 50, carbG: 100 }, lowFloorConfirmed: true, source: 'manual', engineVersion: null }), { id: T(1) });
    expect(saved.target.kcal).toBe(1100);
    expect(Object.keys(saved)).not.toContain('lowFloorConfirmed');
  });

  it('refus : sous 800 kcal, sous 1 200 kcal sans confirmation, valeurs nulles ou négatives, semaine invalide ; rien n’est écrit', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    const low = (kcal: number, confirmed = false) => draft({ target: { kcal, proteinG: 100, fatG: 50, carbG: 100 }, lowFloorConfirmed: confirmed });
    await expect(r.record(low(700, true))).rejects.toMatchObject({ code: 'invalid' });
    await expect(r.record(low(1000))).rejects.toMatchObject({ code: 'invalid' });
    await expect(r.record(draft({ target: { kcal: 0, proteinG: 1, fatG: 1, carbG: 1 } }))).rejects.toMatchObject({ code: 'invalid' });
    await expect(r.record(draft({ weekStart: '2026-13-01' as LocalDate }))).rejects.toMatchObject({ code: 'invalid' });
    expect(await db.driver.select('SELECT * FROM nutrition_target')).toEqual([]);
  });

  it('modification d’Ali : une nouvelle ligne « manual » acceptée, l’ancienne reste (trace)', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await r.record(draft(), { id: T(1) });
    db.clock.advance(1_000);
    await r.record(draft({ source: 'manual', engineVersion: null, target: { kcal: 2350, proteinG: 160, fatG: 70, carbG: 270 } }), { id: T(2) });
    const all = await r.list();
    expect(all.map((t) => [t.id, t.source, t.accepted])).toEqual([
      [T(2), 'manual', true],
      [T(1), 'auto', true],
    ]);
    expect((await r.effective('2026-11-08' as LocalDate))?.id).toBe(T(2));
  });

  it('proposition refusée : conservée, sans effet sur la cible en vigueur', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await r.record(draft(), { id: T(1) });
    db.clock.advance(1_000);
    await r.record(draft({ weekStart: '2026-11-09' as LocalDate, accepted: false, target: { kcal: 2250, proteinG: 150, fatG: 70, carbG: 250 } }), { id: T(2) });
    expect((await r.list()).map((t) => t.id)).toEqual([T(2), T(1)]);
    expect((await r.effective('2026-11-12' as LocalDate))?.id).toBe(T(1));
  });

  it('effective : aucune cible avant la première semaine (null, pas de valeur par défaut) ; semaine à venir ignorée', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    expect(await r.effective('2026-11-08' as LocalDate)).toBeNull();
    await r.record(draft({ weekStart: '2026-11-16' as LocalDate }), { id: T(1) });
    expect(await r.effective('2026-11-08' as LocalDate)).toBeNull();
    expect((await r.effective('2026-11-16' as LocalDate))?.id).toBe(T(1));
  });

  it('identifiant non UUID ou déjà pris : refusé', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await r.record(draft(), { id: T(1) });
    await expect(r.record(draft(), { id: T(1) })).rejects.toMatchObject({ code: 'conflict' });
    await expect(r.record(draft(), { id: 'x' })).rejects.toMatchObject({ code: 'invalid' });
  });

  it('aucune API de modification ni de suppression : l’historique est conservé', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    expect(Object.keys(r).sort()).toEqual(['effective', 'get', 'list', 'record']);
  });
});

describe('NutritionTargetRepository : cible des jours de repos (PROG-01, D-271)', () => {
  it('sans cible de repos : colonnes nulles, restPlan nul', async () => {
    db = await openBaseDb(DEVICE);
    const saved = await (await repo()).record(draft(), { id: T(1) });
    expect(saved.restPlan).toBeNull();
    expect(await db.driver.select('SELECT rest_kcal, rest_carb_g, training_days FROM nutrition_target')).toEqual([{ rest_kcal: null, rest_carb_g: null, training_days: null }]);
  });

  it('avec cible de repos : écrite et relue (protéines et lipides de la cible d’entraînement)', async () => {
    db = await openBaseDb(DEVICE);
    const restPlan = { rest: { kcal: 2200, proteinG: 150, fatG: 70, carbG: 240 }, trainingDays: [1, 2, 4, 5, 6] as const };
    const saved = await (await repo()).record(draft({ restPlan: { rest: restPlan.rest, trainingDays: [...restPlan.trainingDays] } }), { id: T(1) });
    expect(saved.restPlan).toEqual({ rest: restPlan.rest, trainingDays: [1, 2, 4, 5, 6] });
    expect(await db.driver.select('SELECT rest_kcal, rest_carb_g, training_days FROM nutrition_target')).toEqual([{ rest_kcal: 2200, rest_carb_g: 240, training_days: '1,2,4,5,6' }]);
  });

  it('cible de repos invalide (aucun jour d’entraînement, kcal nulle) : refusée', async () => {
    db = await openBaseDb(DEVICE);
    await expect((await repo()).record(draft({ restPlan: { rest: { kcal: 2200, proteinG: 150, fatG: 70, carbG: 240 }, trainingDays: [] } }), { id: T(1) })).rejects.toThrow();
    await expect((await repo()).record(draft({ restPlan: { rest: { kcal: 0, proteinG: 150, fatG: 70, carbG: 240 }, trainingDays: [1] } }), { id: T(2) })).rejects.toThrow();
  });
});
