/**
 * Tendance de poids : EMA de demi-vie 14 jours (PRD § 15.1). Une pesée à plus de 2 % de la tendance précédente pèse 0,25 dans la mise à
 * jour (D-74 point 3) ; elle n'est pas exclue. Les jours sans pesée ne produisent aucun point (aucune imputation).
 */

import { NUTRITION_CONFIG } from './config';
import type { LocalDate } from '../types';
import type { TrendPoint, WeighIn } from './types';

const DAY_MS = 86_400_000;
const dayNumber = (d: LocalDate): number => Date.parse(`${d}T00:00:00Z`) / DAY_MS;

/** Un point par jour de pesée, triés par date ; dernière pesée du jour retenue ; valeurs non positives ou non finies ignorées. */
export function computeTrend(weighIns: readonly WeighIn[]): TrendPoint[] {
  const lastPerDate = new Map<LocalDate, number>();
  for (const w of weighIns) {
    if (Number.isFinite(w.kg) && w.kg > 0) lastPerDate.set(w.date, w.kg);
  }
  const dates = [...lastPerDate.keys()].sort();
  const points: TrendPoint[] = [];
  let trend: number | null = null;
  let prevDate: LocalDate | null = null;
  for (const date of dates) {
    const kg = lastPerDate.get(date) ?? 0;
    if (trend === null || prevDate === null) {
      trend = kg;
      points.push({ date, kg, trend, outlier: false });
    } else {
      const outlier: boolean = Math.abs(kg - trend) / trend > NUTRITION_CONFIG.outlierRelativeGap;
      const alpha: number = 1 - 2 ** (-(dayNumber(date) - dayNumber(prevDate)) / NUTRITION_CONFIG.trendHalfLifeDays);
      const weight: number = outlier ? NUTRITION_CONFIG.outlierWeight : 1;
      trend = trend + alpha * weight * (kg - trend);
      points.push({ date, kg, trend, outlier });
    }
    prevDate = date;
  }
  return points;
}

/** Dernière tendance connue à la date (report), `null` avant la première pesée. */
export function trendAt(points: readonly TrendPoint[], date: LocalDate): number | null {
  let value: number | null = null;
  for (const p of points) {
    if (p.date > date) break;
    value = p.trend;
  }
  return value;
}
