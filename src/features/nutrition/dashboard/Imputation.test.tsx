import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { addDays } from '../../../domain/localDate';
import { aggregateDays } from '../../../domain/nutrition/dayTotals';
import { DEFAULT_NUTRITION_PREFS } from '../../../domain/nutrition/prefs';
import { estimateTdee } from '../../../domain/nutrition/tdee';
import type { MealEntryInput, WeighIn } from '../../../domain/nutrition/types';
import { computeTrend } from '../../../domain/nutrition/weightTrend';
import type { LocalDate } from '../../../domain/types';
import { formatInt, formatTenth, tNutrition } from '../../../i18n/nutritionText';
import type { NutritionSnapshot } from '../useCases';
import { DashboardView } from './DashboardView';
import { dashboardModel } from './model';

/** NUTRI-b (C-194) : le dashboard dit en toutes lettres quels jours sont estimés, avec l'incertitude ; rien n'est écrit comme une mesure. */
const TODAY = '2026-11-09' as LocalDate;
const d = (n: number): LocalDate => addDays(TODAY, n);

function snapshot(unlogged: readonly number[], loggedFrom = -59): NutritionSnapshot {
  const entries: MealEntryInput[] = [];
  for (let i = loggedFrom; i <= -1; i += 1) {
    if (unlogged.includes(i)) continue;
    for (const time of ['07:00', '13:00', '19:00']) entries.push({ date: d(i), time, kcal: 800, proteinG: 50, fatG: 25, carbG: 100 } as MealEntryInput);
  }
  const days = aggregateDays(d(-59), TODAY, entries, {});
  const weighIns: WeighIn[] = [];
  for (let i = -59; i <= -2; i += 3) weighIns.push({ date: d(i), kg: 80 });
  const tdee = estimateTdee({ endDate: d(-1), days, weighIns, profile: null, activity: null, previousSmoothed: null });
  return { today: TODAY, reference: d(-1), days, weighIns, trend: computeTrend(weighIns), tdee, prefs: DEFAULT_NUTRITION_PREFS, profile: null, target: null, targets: [] };
}

afterEach(cleanup);

describe('NUTRI-b : modèle du dashboard', () => {
  it('deux jours non loggés de la semaine : imputés à 2 400 kcal ± 120, marqués imputés', () => {
    const model = dashboardModel(snapshot([-3, -2]));
    expect(model.imputedKcal.reason).toBeNull();
    expect(model.imputedKcal.days.map((x) => x.date)).toEqual([d(-3), d(-2)]);
    expect(model.imputedKcal.days.every((x) => x.kcal === 2400 && x.spread === 120 && x.basis === 'imputed')).toBe(true);
  });
  it('les barres chiffrées restent celles du journal : un jour non logué garde kcal null', () => {
    const model = dashboardModel(snapshot([-3]));
    expect(model.bars.find((b) => b.date === d(-3))?.kcal).toBeNull();
  });
  it('aujourd’hui sans pesée : poids estimé par la tendance avec incertitude', () => {
    const model = dashboardModel(snapshot([]));
    expect(model.imputedWeightToday).toMatchObject({ date: TODAY, kg: 80, spread: 0.3, basis: 'imputed' });
  });
});

describe('NUTRI-b : écran', () => {
  it('dit les jours estimés, la valeur et l’incertitude en texte', () => {
    render(<DashboardView snapshot={snapshot([-3, -2])} />);
    expect(screen.getByText(tNutrition('imputedKcalLine', { n: 2, kcal: formatInt(2400), spread: formatInt(120) }))).toBeTruthy();
  });
  it('dit le poids estimé du jour sans pesée', () => {
    render(<DashboardView snapshot={snapshot([])} />);
    expect(screen.getByText(tNutrition('imputedWeightLine', { kg: formatTenth(80), spread: formatTenth(0.3) }))).toBeTruthy();
  });
  it('la liste textuelle de la barre d’un jour estimé nomme « estimé »', () => {
    render(<DashboardView snapshot={snapshot([-3])} />);
    expect(screen.getAllByText(new RegExp(tNutrition('barImputed'))).length).toBeGreaterThan(0);
  });
  it('trop peu de jours complets : pas d’estimation, la raison est dite', () => {
    render(<DashboardView snapshot={snapshot([], -3)} />);
    expect(screen.getByText(tNutrition('imputedKcalNone'))).toBeTruthy();
    expect(screen.queryByText(/estimés, non mesurés/)).toBeNull();
  });
});
