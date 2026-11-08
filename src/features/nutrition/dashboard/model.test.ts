import { describe, expect, it } from 'vitest';
import { addDays } from '../../../domain/localDate';
import { aggregateDays } from '../../../domain/nutrition/dayTotals';
import { estimateTdee } from '../../../domain/nutrition/tdee';
import { DEFAULT_NUTRITION_PREFS } from '../../../domain/nutrition/prefs';
import type { MealEntryInput, WeighIn } from '../../../domain/nutrition/types';
import { computeTrend } from '../../../domain/nutrition/weightTrend';
import type { LocalDate } from '../../../domain/types';
import type { NutritionSnapshot } from '../useCases';
import { dashboardModel } from './model';

/** I4-03 critère 5 : modèle du dashboard, pur ; les graphiques tiennent dans le budget de 300 ms. */
const TODAY = '2026-11-09' as LocalDate;
const d = (n: number): LocalDate => addDays(TODAY, n);

function snapshot(daysLogged: number, weighEvery = 2): NutritionSnapshot {
  const entries: MealEntryInput[] = [];
  for (let i = -daysLogged; i <= -1; i += 1) for (const time of ['07:00', '13:00', '19:00']) entries.push({ date: d(i), time, kcal: 800, proteinG: 50, fatG: 25, carbG: 100 } as MealEntryInput);
  const days = aggregateDays(d(-59), TODAY, entries, {});
  const weighIns: WeighIn[] = [];
  for (let i = -59; i <= -1; i += weighEvery) weighIns.push({ date: d(i), kg: 80 });
  const tdee = estimateTdee({ endDate: d(-1), days, weighIns, profile: { sex: 'male', birthYear: 1990, heightCm: 180 }, activity: 'moderate', previousSmoothed: null });
  return {
    today: TODAY,
    reference: d(-1),
    days,
    weighIns,
    trend: computeTrend(weighIns),
    tdee,
    prefs: DEFAULT_NUTRITION_PREFS,
    profile: null,
    target: null,
    targets: [],
  };
}

describe('I4-03 : dashboardModel', () => {
  it('7 barres, dont les jours non complets ne portent pas de valeur chiffrée « complète »', () => {
    const m = dashboardModel(snapshot(4));
    expect(m.bars).toHaveLength(7);
    expect(m.bars.filter((b) => b.state === 'complete')).toHaveLength(4);
    expect(m.bars.filter((b) => b.state === 'unknown').every((b) => b.kcal === null)).toBe(true);
    expect(m.balance.completeDays).toBe(4);
  });

  it('tendance sur 28 jours : points datés, jamais interpolés sur les jours sans pesée', () => {
    const m = dashboardModel(snapshot(28, 2));
    expect(m.trendPoints.length).toBeLessThanOrEqual(14);
    expect(m.trendPoints.every((p) => p.date >= d(-28) && p.date <= d(-1))).toBe(true);
  });

  it('sans aucune donnée : tout est null, rien à zéro', () => {
    const m = dashboardModel(snapshot(0, 1000));
    expect(m.balance).toMatchObject({ completeDays: 0, averageKcal: null, deltaKcal: null });
    expect(m.trendPoints).toEqual([]);
    expect(m.slope).toBeNull();
  });

  it('budget < 300 ms pour 60 jours de données (modèle des graphiques)', () => {
    const s = snapshot(59, 1);
    const start = performance.now();
    for (let i = 0; i < 20; i += 1) dashboardModel(s);
    expect((performance.now() - start) / 20).toBeLessThan(300);
  });
});
