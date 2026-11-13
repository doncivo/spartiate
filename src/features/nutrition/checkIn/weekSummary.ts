import { addDays } from '../../../domain/localDate';
import type { DayTotals, TrendPoint } from '../../../domain/nutrition';
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

/** Dernier point de tendance au plus tard à `anchor` et pas plus de 7 jours avant : au-delà, la tendance ne décrit plus cette date. */
function trendAt(trend: readonly TrendPoint[], anchor: LocalDate): TrendPoint | null {
  const floor = addDays(anchor, -WEEK);
  let found: TrendPoint | null = null;
  for (const point of trend) if (point.date <= anchor && point.date >= floor && (found === null || point.date > found.date)) found = point;
  return found;
}

export function weekSummary({ trend, days, weekEnd }: { readonly trend: readonly TrendPoint[]; readonly days: readonly DayTotals[]; readonly weekEnd: LocalDate }): WeekSummary {
  const end = trendAt(trend, weekEnd);
  const start = trendAt(trend, addDays(weekEnd, -WEEK));
  const from = addDays(weekEnd, -(WEEK - 1));
  const kcal = days.filter((d) => d.usableForTdee && d.kcal !== null && d.date >= from && d.date <= weekEnd).map((d) => d.kcal as number);
  const rate = end !== null && start !== null ? Math.round((end.trend - start.trend) * 100) / 100 : null;
  return {
    trendKg: end === null ? null : end.trend,
    weeklyRateKg: rate === 0 ? 0 : rate,
    keptKcal: kcal.length === 0 ? null : Math.round(kcal.reduce((a, b) => a + b, 0) / kcal.length),
  };
}
