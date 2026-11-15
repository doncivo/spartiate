import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../types';
import { weeklyRateKg, weekTrendKg } from './weeklyRate';
import type { TrendPoint } from './types';

const d = (s: string): LocalDate => s as LocalDate;
const tp = (date: string, trend: number): TrendPoint => ({ date: d(date), kg: trend, trend, outlier: false });
const weekEnd = d('2026-11-08');

/** ERGO-02b (critère 2) : rythme hebdomadaire du check-in, règle de domaine pure (déplacée de weekSummary, comportement identique). */
describe('weeklyRateKg', () => {
  it('variation de la tendance sur 7 jours, arrondie au centième', () => {
    expect(weeklyRateKg([tp('2026-11-01', 81.8), tp('2026-11-08', 81.4)], weekEnd)).toBe(-0.4);
    expect(weeklyRateKg([tp('2026-11-01', 80), tp('2026-11-08', 80.333)], weekEnd)).toBe(0.33);
  });

  it('prend le dernier point au plus tard à la date, pas plus de 7 jours avant', () => {
    expect(weeklyRateKg([tp('2026-10-30', 82), tp('2026-11-01', 81.8), tp('2026-11-07', 81.4)], weekEnd)).toBe(-0.4);
  });

  it('sans point récent à chaque extrémité : null, jamais 0', () => {
    expect(weeklyRateKg([tp('2026-10-01', 82), tp('2026-11-08', 81)], weekEnd)).toBeNull();
    expect(weeklyRateKg([], weekEnd)).toBeNull();
  });

  it('tendance stable : 0 (jamais -0)', () => {
    expect(Object.is(weeklyRateKg([tp('2026-11-01', 81), tp('2026-11-08', 81)], weekEnd), 0)).toBe(true);
    expect(Object.is(weeklyRateKg([tp('2026-11-01', 81.001), tp('2026-11-08', 81)], weekEnd), 0)).toBe(true);
  });

  it('weekTrendKg : tendance de fin de semaine ou null', () => {
    expect(weekTrendKg([tp('2026-11-07', 81.4)], weekEnd)).toBe(81.4);
    expect(weekTrendKg([tp('2026-10-01', 81.4)], weekEnd)).toBeNull();
  });
});
