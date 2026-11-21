import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { addDays } from '../../../domain/localDate';
import { aggregateDays } from '../../../domain/nutrition/dayTotals';
import { DEFAULT_NUTRITION_PREFS } from '../../../domain/nutrition/prefs';
import { estimateTdee } from '../../../domain/nutrition/tdee';
import type { WeighIn } from '../../../domain/nutrition/types';
import { computeTrend } from '../../../domain/nutrition/weightTrend';
import type { StepsDay } from '../../../domain/nutrition/stepsAdjustment';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb } from '../../../db/repositories/sql/testSetup';
import { tNutrition } from '../../../i18n/nutritionText';
import { loadNutritionSnapshot, type NutritionSnapshot } from '../useCases';
import { DashboardView } from './DashboardView';

/** REPAS-029b : dépense ajustée aux pas, affichage seul, avec sa source ; raisons dites ; jamais comptée deux fois (C-9, C-10). */
const TODAY = '2026-11-09' as LocalDate;
const d = (n: number): LocalDate => addDays(TODAY, n);
const DEVICE = '60000000-0000-4000-8000-0000000000ea' as DeviceId;

function snapshot(stepsDays: readonly StepsDay[] | null, weightMeasured?: number): NutritionSnapshot {
  const days = aggregateDays(d(-59), TODAY, [], {});
  const weighIns: WeighIn[] = [{ date: d(-2), kg: 80 }];
  const tdee = estimateTdee({ endDate: d(-1), days, weighIns, profile: { sex: 'male', birthYear: 1990, heightCm: 180 }, activity: 'moderate', previousSmoothed: null });
  const shown = weightMeasured === undefined ? tdee : { ...tdee, weightMeasured };
  return { today: TODAY, reference: d(-1), days, weighIns, trend: computeTrend(weighIns), tdee: shown, prefs: DEFAULT_NUTRITION_PREFS, profile: null, target: null, targets: [], stepsDays };
}
const base = (steps: number): StepsDay[] => Array.from({ length: 28 }, (_, i) => ({ day: d(-2 - i), steps }));
const norm = (t: string): string => t.replace(/\s+/g, ' ');

afterEach(cleanup);

describe('Dashboard : dépense ajustée aux pas', () => {
  it('pas d\'hier au-dessus de la base : ajustement signé, source affichée', () => {
    render(<DashboardView snapshot={snapshot([...base(8000), { day: d(-1), steps: 12000 }])} />);
    expect(screen.getByText(/\+160 kcal sur la part formule \(100 %\)/)).toBeTruthy();
    expect(screen.getByText(norm(tNutrition('stepsAdjSource')))).toBeTruthy();
  });
  it('aucun pas importé : la raison, jamais un ajustement à 0', () => {
    render(<DashboardView snapshot={snapshot([])} />);
    expect(screen.getByText(tNutrition('stepsAdjNoSteps'))).toBeTruthy();
    expect(screen.queryByText(/sur la part formule/)).toBeNull();
  });
  it('lecture impossible : la raison', () => {
    render(<DashboardView snapshot={snapshot(null)} />);
    expect(screen.getByText(tNutrition('stepsAdjUnreadable'))).toBeTruthy();
  });
  it('dépense mesurée seule : déjà comprise, aucun ajustement', () => {
    render(<DashboardView snapshot={snapshot([...base(8000), { day: d(-1), steps: 12000 }], 1)} />);
    expect(screen.getByText(tNutrition('stepsAdjMeasuredOnly'))).toBeTruthy();
  });
});

describe('REPAS-029b C-9 : la dépense du moteur (check-in) ignore les pas', () => {
  it('l\'instantané garde la même dépense avec ou sans pas importés', async () => {
    const db = await openBaseDb(DEVICE, '2026-11-09T11:00:00.000Z');
    try {
      const without = await loadNutritionSnapshot(db.data, TODAY);
      const samples = await db.data.repos.recoverySamples();
      const rows = Array.from({ length: 29 }, (_, i) => ({ type: 'pas' as const, startAt: `${d(-1 - i)}T12:00:00.000Z`, endAt: `${d(-1 - i)}T12:00:00.000Z`, value: 20_000 + i, stage: null, source: 'pas.csv' }));
      await samples.upsertTotals(rows, '2026-11-09T11:00:00.000Z');
      const withSteps = await loadNutritionSnapshot(db.data, TODAY);
      expect(withSteps.tdee).toEqual(without.tdee);
      expect(withSteps.stepsDays?.length).toBe(29);
      expect(without.stepsDays).toEqual([]);
    } finally {
      await db.close();
    }
  });
});
