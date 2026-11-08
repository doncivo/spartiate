import type { LocalDate } from '../../../src/domain/types';
import type { DayTotals, TrendPoint } from '../../../src/domain/nutrition/types';

/** Jour déjà agrégé, pour tester les couches hautes indépendamment de l'agrégation. */
export function completeDay(date: LocalDate, kcal: number): DayTotals {
  return {
    date,
    state: 'complete',
    origin: 'inferred',
    entryCount: 3,
    spanHours: 10,
    kcal,
    proteinG: 100,
    fatG: 60,
    carbG: 250,
    usableForTdee: true,
    reasons: ['inferred-complete'],
  };
}

export function partialDay(date: LocalDate, kcal: number): DayTotals {
  return { ...completeDay(date, kcal), state: 'partial', usableForTdee: false, reasons: ['span-too-short'], spanHours: 3 };
}

export function unknownDay(date: LocalDate): DayTotals {
  return {
    date,
    state: 'unknown',
    origin: 'none',
    entryCount: 0,
    spanHours: null,
    kcal: null,
    proteinG: null,
    fatG: null,
    carbG: null,
    usableForTdee: false,
    reasons: ['no-entries'],
  };
}

export function point(date: LocalDate, trend: number): TrendPoint {
  return { date, kg: trend, trend, outlier: false };
}
