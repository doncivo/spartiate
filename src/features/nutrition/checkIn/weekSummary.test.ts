import { describe, expect, it } from 'vitest';
import type { DayTotals, TrendPoint } from '../../../domain/nutrition';
import type { LocalDate } from '../../../domain/types';
import { weekSummary } from './weekSummary';

const d = (s: string): LocalDate => s as LocalDate;
const tp = (date: string, trend: number): TrendPoint => ({ date: d(date), kg: trend, trend, outlier: false });
const day = (date: string, kcal: number | null, usable: boolean): DayTotals => ({ date: d(date), kcal, usableForTdee: usable }) as unknown as DayTotals;

/** ERGO-02 (C1) : chiffres du résumé de semaine du check-in, lus dans les données existantes (aucune formule nouvelle, § 15 intouché). */
describe('weekSummary', () => {
  const weekEnd = d('2026-11-08');

  it('variation de la tendance sur 7 jours, tendance de fin de semaine, apports moyens des jours complets', () => {
    const s = weekSummary({
      trend: [tp('2026-10-30', 82), tp('2026-11-01', 81.8), tp('2026-11-07', 81.4), tp('2026-11-08', 81.4)],
      days: [day('2026-11-02', 2500, true), day('2026-11-03', 2460, true), day('2026-11-04', 1200, false), day('2026-11-05', null, true)],
      weekEnd,
    });
    expect(s.trendKg).toBe(81.4);
    expect(s.weeklyRateKg).toBe(-0.4);
    expect(s.keptKcal).toBe(2480);
  });

  it('sans pesée dans les 7 jours qui précèdent chaque point : variation inconnue (null), jamais 0', () => {
    expect(weekSummary({ trend: [tp('2026-10-01', 82), tp('2026-11-08', 81)], days: [], weekEnd }).weeklyRateKg).toBeNull();
    expect(weekSummary({ trend: [], days: [], weekEnd })).toEqual({ trendKg: null, weeklyRateKg: null, keptKcal: null });
  });

  it('aucun jour complet avec calories : apports inconnus (null), jamais 0', () => {
    expect(weekSummary({ trend: [], days: [day('2026-11-04', null, true), day('2026-11-05', 900, false)], weekEnd }).keptKcal).toBeNull();
  });

  it('ignore les jours hors de la semaine analysée', () => {
    expect(weekSummary({ trend: [], days: [day('2026-11-01', 3000, true), day('2026-11-09', 3000, true), day('2026-11-08', 2000, true)], weekEnd }).keptKcal).toBe(2000);
  });
});
