import { describe, expect, it } from 'vitest';

import { completeDay } from '../../../tests/fixtures/nutrition/dayKit';
import { addDays } from '../localDate';
import type { LocalDate } from '../types';
import { proposeCheckIn, type CheckInInput } from './checkIn';

/** NUTRI-0292 (C-125) : un objectif de perte ou de gain sans rythme exploitable n'écrit jamais une cible « maintien » sans le dire. */
const d0 = '2026-09-07' as LocalDate;
const input = (goal: unknown): CheckInInput => ({
  style: 'guided',
  weekEnd: addDays(d0, 13),
  days: Array.from({ length: 14 }, (_, i) => completeDay(addDays(d0, i), 2400)),
  weighIns: [1, 5, 8, 12].map((i) => ({ date: addDays(d0, i), kg: 80 })),
  tdee: 2600,
  weightKg: 80,
  goal: goal as CheckInInput['goal'],
  currentTarget: { kcal: 2500, proteinG: 140, fatG: 70, carbG: 328 },
  lowFloorConfirmed: false,
});

describe('C-125 : objectif à rythme sans rythme', () => {
  it.each([[{ kind: 'loss', weeklyRateKg: Number.NaN }], [{ kind: 'gain', weeklyRateKg: 0 }], [{ kind: 'loss', weeklyRateKg: -0.3 }], [{ kind: 'loss' }]])('%j : suspendu, raison dite, aucune cible', (goal) => {
    const r = proposeCheckIn(input(goal));
    expect(r.status).toBe('suspended');
    expect(r.proposal).toBeNull();
    expect(r.reasons).toContain('no-goal-rate');
  });

  it('maintien explicite et rythme valide : inchangés', () => {
    expect(proposeCheckIn(input({ kind: 'maintain' })).status).toBe('proposal');
    expect(proposeCheckIn(input({ kind: 'loss', weeklyRateKg: 0.3 })).proposal?.target.kcal).toBeLessThan(2500);
  });
});
