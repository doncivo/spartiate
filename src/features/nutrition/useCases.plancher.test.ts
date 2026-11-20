import { afterEach, describe, expect, it } from 'vitest';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import type { DeviceId, LocalDate } from '../../domain/types';
import { saveManualTarget, saveRestPlan } from './useCases';

/** FIX-PLANCHER (C-086, C-087) : valeurs synthétiques. */
const DEVICE = '60000000-0000-4000-8000-0000000000f2' as DeviceId;
const TODAY = '2026-11-09' as LocalDate;
const T = (kcal: number) => ({ kcal, proteinG: 120, fatG: 50, carbG: 100 });
const plan = (kcal: number) => ({ rest: T(kcal), trainingDays: [1, 2, 4, 5, 6] as never });
let db: TestDb;
afterEach(async () => db.close());

describe('saveManualTarget avec cible de repos (C-086)', () => {
  it('repos à 1 100 sous un entraînement à 1 300 : confirmation demandée, puis écriture avec la case', async () => {
    db = await openBaseDb(DEVICE, '2026-11-09T10:00:00.000Z');
    expect(await saveManualTarget(db.data, { weekStart: TODAY, target: T(1300), lowFloorConfirmed: false, restPlan: plan(1100) })).toBe('confirmation-required');
    expect(await saveManualTarget(db.data, { weekStart: TODAY, target: T(1300), lowFloorConfirmed: true, restPlan: plan(1100) })).toMatchObject({ accepted: true });
  });
});

describe('saveRestPlan (C-087)', () => {
  const seed = async (target: number, rest: number | null) => {
    const repo = await db.data.repos.nutritionTargets();
    return repo.record({ weekStart: TODAY, target: T(target), source: 'manual', accepted: true, engineVersion: null, lowFloorConfirmed: true, ...(rest === null ? {} : { restPlan: plan(rest) }) });
  };
  it('retirer la cible de repos d’une cible confirmée à 1 100 : écrit sans nouvelle case', async () => {
    db = await openBaseDb(DEVICE, '2026-11-09T10:00:00.000Z');
    const current = await seed(1100, 1050);
    expect(await saveRestPlan(db.data, { today: TODAY, current, restPlan: null })).toBe('saved');
  });
  it('ajouter une cible de repos qui ne descend pas plus bas que la confirmation : écrit', async () => {
    db = await openBaseDb(DEVICE, '2026-11-09T10:00:00.000Z');
    const current = await seed(1100, null);
    expect(await saveRestPlan(db.data, { today: TODAY, current, restPlan: plan(1100) })).toBe('saved');
  });
  it('descendre plus bas que la confirmation redemande la case ; avec la case, écrit', async () => {
    db = await openBaseDb(DEVICE, '2026-11-09T10:00:00.000Z');
    const current = await seed(1100, null);
    expect(await saveRestPlan(db.data, { today: TODAY, current, restPlan: plan(1000) })).toBe('confirmation-required');
    expect(await saveRestPlan(db.data, { today: TODAY, current, restPlan: plan(1000), lowFloorConfirmed: true } as never)).toBe('saved');
  });
});
