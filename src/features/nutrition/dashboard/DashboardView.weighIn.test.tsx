import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { addDays } from '../../../domain/localDate';
import { aggregateDays } from '../../../domain/nutrition/dayTotals';
import { DEFAULT_NUTRITION_PREFS } from '../../../domain/nutrition/prefs';
import { estimateTdee } from '../../../domain/nutrition/tdee';
import type { MealEntryInput, WeighIn } from '../../../domain/nutrition/types';
import { computeTrend } from '../../../domain/nutrition/weightTrend';
import type { LocalDate } from '../../../domain/types';
import type { NutritionSnapshot } from '../useCases';
import { DashboardView } from './DashboardView';

/** I4-08 point 7 : sans pesée récente, la dépense mesurée n'est pas affichée ; le message dit quoi faire. */
const TODAY = '2026-11-09' as LocalDate;
const d = (n: number): LocalDate => addDays(TODAY, n);
const MESSAGE = 'Pèse-toi pour que la dépense mesurée reprenne.';

function snapshot(lastWeighIn: number, withProfile: boolean): NutritionSnapshot {
  const entries: MealEntryInput[] = [];
  for (let i = -59; i <= -1; i += 1) for (const time of ['07:00', '13:00', '19:00']) entries.push({ date: d(i), time, kcal: 800, proteinG: 50, fatG: 25, carbG: 100 } as MealEntryInput);
  const days = aggregateDays(d(-59), TODAY, entries, {});
  const weighIns: WeighIn[] = [];
  for (let i = -59; i <= lastWeighIn; i += 2) weighIns.push({ date: d(i), kg: 80 });
  const tdee = estimateTdee({
    endDate: d(-1),
    days,
    weighIns,
    profile: withProfile ? { sex: 'male', birthYear: 1990, heightCm: 180 } : null,
    activity: withProfile ? 'moderate' : null,
    previousSmoothed: null,
  });
  return { today: TODAY, reference: d(-1), days, weighIns, trend: computeTrend(weighIns), tdee, prefs: DEFAULT_NUTRITION_PREFS, profile: null, target: null, targets: [] };
}

afterEach(cleanup);

describe('I4-08 point 7 : Dashboard sans pesée récente', () => {
  it('trois semaines sans pesée : message, formule, confiance basse', () => {
    render(<DashboardView snapshot={snapshot(-25, true)} />);
    expect(screen.getByText(MESSAGE)).toBeTruthy();
    expect(screen.getByText(/Estimation par formule/)).toBeTruthy();
  });
  it('sans formule : dépense non estimée et message', () => {
    render(<DashboardView snapshot={snapshot(-25, false)} />);
    expect(screen.getByText(MESSAGE)).toBeTruthy();
    expect(screen.getByText(/Dépense non estimée/)).toBeTruthy();
  });
  it('pesée récente : pas de message', () => {
    render(<DashboardView snapshot={snapshot(-1, true)} />);
    expect(screen.queryByText(MESSAGE)).toBeNull();
  });
});
