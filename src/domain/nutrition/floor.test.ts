import { describe, expect, it } from 'vitest';
import { proposeCheckIn } from './checkIn';
import { confirmationCarriedOver, floorVerdict, lowestKcal } from './floor';
import { validateTargetRecord } from './targetRecord';
import type { RestPlan } from './restDay';
import type { Target } from './types';

/** FIX-PLANCHER (C-031, C-086, C-087) : le plancher se contrôle sur la plus basse des deux cibles. Valeurs synthétiques. */
const T = (kcal: number): Target => ({ kcal, proteinG: 120, fatG: 50, carbG: 100 });
const plan = (restKcal: number): RestPlan => ({ rest: T(restKcal), trainingDays: [1, 2, 4, 5, 6] });

describe('floorVerdict / lowestKcal', () => {
  it('la plus basse des deux cibles décide', () => {
    expect(lowestKcal(T(1300), plan(1100))).toBe(1100);
    expect(lowestKcal(T(1300), null)).toBe(1300);
    expect(floorVerdict(T(1300), plan(1100))).toBe('confirm');
    expect(floorVerdict(T(1300), plan(1200))).toBe('ok');
    expect(floorVerdict(T(1300), plan(799))).toBe('rejected');
    expect(floorVerdict(T(1150), null)).toBe('confirm');
  });
});

describe('confirmationCarriedOver (C-087)', () => {
  it('reprise si la plus basse ne descend pas plus bas qu’une confirmation en vigueur', () => {
    expect(confirmationCarriedOver({ target: T(1100), plan: plan(1050) }, { target: T(1100), plan: null })).toBe(true);
    expect(confirmationCarriedOver({ target: T(1100), plan: null }, { target: T(1100), plan: plan(1100) })).toBe(true);
    expect(confirmationCarriedOver({ target: T(1100), plan: null }, { target: T(1100), plan: plan(1000) })).toBe(false);
    expect(confirmationCarriedOver({ target: T(1300), plan: null }, { target: T(1300), plan: plan(1100) })).toBe(false);
    expect(confirmationCarriedOver(null, { target: T(1100), plan: null })).toBe(false);
  });
});

describe('check-in à deux cibles (C-031)', () => {
  const day = (date: string) => ({ date, state: 'complete', origin: 'declared', entryCount: 3, spanHours: 10, kcal: 1200, proteinG: 100, fatG: 40, carbG: 100, usableForTdee: true, reasons: [] }) as never;
  const days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'].map(day);
  const weighIns = ['2026-11-03', '2026-11-05', '2026-11-10', '2026-11-12'].map((date) => ({ date, kg: 70 })) as never;
  const run = (over: Record<string, unknown> = {}) =>
    proposeCheckIn({ style: 'guided', weekEnd: '2026-11-15', days, weighIns, tdee: 1100, weightKg: 70, goal: { kind: 'maintain' }, currentTarget: T(1300), lowFloorConfirmed: false, restPlan: plan(1250), ...over } as never);

  it('la cible de repos proposée n’est jamais sous 1 200 sans confirmation, et « Accepter » est valide', () => {
    const p = run().proposal;
    expect(p?.restTarget?.kcal).toBeGreaterThanOrEqual(1200);
    expect(p?.clampedBy).toContain('floor');
    expect(p?.belowStandardFloor).toBe(false);
    const issues = validateTargetRecord({ weekStart: '2026-11-16' as never, target: p!.target, source: 'auto', accepted: true, engineVersion: 1, lowFloorConfirmed: false, restPlan: { rest: p!.restTarget!, trainingDays: [1, 2, 4, 5, 6] } });
    expect(issues).toEqual([]);
  });
  it('plancher confirmé : la cible de repos sous 1 200 lève belowStandardFloor', () => {
    const p = run({ lowFloorConfirmed: true, currentTarget: T(1150), restPlan: plan(1100) }).proposal;
    expect(p?.restTarget?.kcal).toBeLessThan(1200);
    expect(p?.belowStandardFloor).toBe(true);
  });
});
