import { addDays } from '../localDate';
import type { LocalDate } from '../types';
import type { TrendPoint } from './types';

/** ERGO-02b : règle du rythme hebdomadaire du check-in (déplacée de features/nutrition/checkIn/weekSummary, comportement identique). § 15 intouché. */
const WEEK = 7;

/** Dernier point de tendance au plus tard à `anchor` et pas plus de 7 jours avant : au-delà, la tendance ne décrit plus cette date. */
function recentPoint(trend: readonly TrendPoint[], anchor: LocalDate): TrendPoint | null {
  const floor = addDays(anchor, -WEEK);
  let found: TrendPoint | null = null;
  for (const point of trend) if (point.date <= anchor && point.date >= floor && (found === null || point.date > found.date)) found = point;
  return found;
}

/** Tendance de poids en fin de semaine (kg), `null` sans point dans les 7 jours qui précèdent. */
export function weekTrendKg(trend: readonly TrendPoint[], weekEnd: LocalDate): number | null {
  return recentPoint(trend, weekEnd)?.trend ?? null;
}

/** Variation de la tendance sur la semaine (kg / semaine), arrondie au centième ; `null` si une extrémité manque (jamais 0 par défaut). */
export function weeklyRateKg(trend: readonly TrendPoint[], weekEnd: LocalDate): number | null {
  const end = recentPoint(trend, weekEnd);
  const start = recentPoint(trend, addDays(weekEnd, -WEEK));
  if (end === null || start === null) return null;
  const rate = Math.round((end.trend - start.trend) * 100) / 100;
  return rate === 0 ? 0 : rate;
}
