import { addDays } from '../../../domain/localDate';
import { weeklyRateKg, weekTrendKg, type DayTotals, type TrendPoint } from '../../../domain/nutrition';
import type { LocalDate } from '../../../domain/types';

/**
 * ERGO-02 (CheckIn-apres) : chiffres du résumé de la semaine, LUS dans les données existantes (tendance de poids, jours complets). Aucune formule
 * nouvelle : la dépense, la couverture et la proposition viennent du moteur (§ 15), inchangé. Une valeur qui manque est `null`, jamais 0.
 */
export interface WeekSummary {
  /** Tendance de poids en fin de semaine (kg). */
  readonly trendKg: number | null;
  /** Variation de la tendance sur les 7 jours de la semaine (kg / semaine), arrondie au centième. */
  readonly weeklyRateKg: number | null;
  /** Moyenne des calories des jours complets de la semaine. */
  readonly keptKcal: number | null;
}

const WEEK = 7;

export function weekSummary({ trend, days, weekEnd }: { readonly trend: readonly TrendPoint[]; readonly days: readonly DayTotals[]; readonly weekEnd: LocalDate }): WeekSummary {
  const from = addDays(weekEnd, -(WEEK - 1));
  const kcal = days.filter((d) => d.usableForTdee && d.kcal !== null && d.date >= from && d.date <= weekEnd).map((d) => d.kcal as number);
  return {
    trendKg: weekTrendKg(trend, weekEnd),
    weeklyRateKg: weeklyRateKg(trend, weekEnd),
    keptKcal: kcal.length === 0 ? null : Math.round(kcal.reduce((a, b) => a + b, 0) / kcal.length),
  };
}
