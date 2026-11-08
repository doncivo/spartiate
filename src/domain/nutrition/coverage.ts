/**
 * Couverture (PRD § 15.2) : ≥ 4 jours complets et ≥ 2 pesées (jours distincts) par fenêtre de 7 jours, sur 2 semaines consécutives
 * pour un ajustement. Un jour absent de la liste n'est pas complet (jamais compté comme zéro).
 */

import { addDays } from '../localDate';
import type { LocalDate } from '../types';
import { NUTRITION_CONFIG } from './config';
import type { Coverage, DayTotals, WeighIn } from './types';

export function coverageOfWindow(
  days: readonly DayTotals[],
  weighIns: readonly WeighIn[],
  endDate: LocalDate,
  windowDays: number = NUTRITION_CONFIG.windowDays,
): Coverage {
  const start = addDays(endDate, -(windowDays - 1));
  const inWindow = (d: LocalDate): boolean => d >= start && d <= endDate;
  const completeDays = new Set(days.filter((d) => d.usableForTdee && inWindow(d.date)).map((d) => d.date)).size;
  const weighInDays = new Set(weighIns.filter((w) => Number.isFinite(w.kg) && w.kg > 0 && inWindow(w.date)).map((w) => w.date)).size;
  return {
    endDate,
    windowDays,
    completeDays,
    weighInDays,
    sufficient: completeDays >= NUTRITION_CONFIG.minLoggedDays && weighInDays >= NUTRITION_CONFIG.minWeighIns,
  };
}

export interface TwoWeekCoverage {
  readonly weeks: readonly Coverage[];
  readonly sufficient: boolean;
}

/** Les `requiredWeeks` fenêtres de 7 jours consécutives qui se terminent à `endDate` (la plus récente en dernier). */
export function twoWeekCoverage(days: readonly DayTotals[], weighIns: readonly WeighIn[], endDate: LocalDate): TwoWeekCoverage {
  const weeks: Coverage[] = [];
  for (let w = NUTRITION_CONFIG.requiredWeeks - 1; w >= 0; w -= 1) {
    weeks.push(coverageOfWindow(days, weighIns, addDays(endDate, -w * NUTRITION_CONFIG.windowDays)));
  }
  return { weeks, sufficient: weeks.every((c) => c.sufficient) };
}

/** Jours de `startDate` à `endDate` dont la fenêtre de 7 jours est suffisante (D-74 point 4). */
export function sufficientDataDays(
  days: readonly DayTotals[],
  weighIns: readonly WeighIn[],
  startDate: LocalDate,
  endDate: LocalDate,
): number {
  let count = 0;
  for (let d = startDate; d <= endDate; d = addDays(d, 1)) {
    if (coverageOfWindow(days, weighIns, d).sufficient) count += 1;
  }
  return count;
}
