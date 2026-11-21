import { describe, expect, it } from 'vitest';
import vectors from '../../../tests/fixtures/nutrition/steps-adjustment.json';
import { addDays } from '../localDate';
import type { LocalDate } from '../types';
import { STEPS_ADJUSTMENT } from './config';
import { adjustForSteps, type StepsDay } from './stepsAdjustment';

const DATE = vectors.date as LocalDate;

function build(base: { days: number; steps: number }, today: number | null): StepsDay[] {
  const days: StepsDay[] = [];
  for (let i = 1; i <= base.days; i += 1) days.push({ day: addDays(DATE, -i), steps: base.steps });
  // Hors fenêtre et jour à 0 : ignorés dans la base.
  days.push({ day: addDays(DATE, -29), steps: 99_999 }, { day: addDays(DATE, -30), steps: 99_999 });
  if (today !== null) days.push({ day: DATE, steps: today });
  return days;
}

describe('adjustForSteps : vecteurs (C-8)', () => {
  for (const c of vectors.cases) {
    it(c.name, () => {
      const result = adjustForSteps({ date: DATE, steps: build(c.base, c.today), estimate: { value: c.value, weightMeasured: c.weightMeasured } });
      expect(result).toMatchObject(c.expect);
    });
  }
});

describe('adjustForSteps : sources et bornes', () => {
  const estimate = { value: 2500, weightMeasured: 0 };
  it('aucun pas importé (fichier absent) : raison no-steps, jamais un ajustement 0', () => {
    expect(adjustForSteps({ date: DATE, steps: [], estimate })).toEqual({ status: 'none', reason: 'no-steps' });
  });
  it('lecture impossible : raison unreadable', () => {
    expect(adjustForSteps({ date: DATE, steps: null, estimate })).toEqual({ status: 'none', reason: 'unreadable' });
  });
  it('jours de base à 0 ou invalides ignorés', () => {
    const days = build({ days: 14, steps: 8000 }, 9000).concat([{ day: addDays(DATE, -15), steps: 0 }, { day: addDays(DATE, -16), steps: Number.NaN }]);
    expect(adjustForSteps({ date: DATE, steps: days, estimate })).toMatchObject({ status: 'adjusted', baselineDays: 14, baseline: 8000 });
  });
  it('constantes proposées', () => {
    expect(STEPS_ADJUSTMENT).toEqual({ kcalPerStep: 0.04, baselineWindowDays: 28, minBaselineDays: 14, maxAdjustKcal: 300 });
  });
  it('l\'ajustement ne dépasse jamais la borne, quelle que soit la part de formule', () => {
    for (const w of [0, 0.25, 0.5, 0.99]) {
      const r = adjustForSteps({ date: DATE, steps: build({ days: 28, steps: 100 }, 90_000), estimate: { value: 2500, weightMeasured: w } });
      expect(r.status === 'adjusted' && Math.abs(r.appliedKcal) <= STEPS_ADJUSTMENT.maxAdjustKcal).toBe(true);
    }
  });
});
