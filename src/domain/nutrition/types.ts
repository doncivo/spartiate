import type { LocalDate, LocalTime } from '../types';

/** Entrée de journal vue par le moteur. `null` = valeur inconnue, jamais zéro (§ 15.1). */
export interface MealEntryInput {
  /** Date civile locale enregistrée avec l'entrée (D-74 point 1). */
  readonly date: LocalDate;
  readonly time: LocalTime;
  readonly kcal: number | null;
  readonly proteinG: number | null;
  readonly fatG: number | null;
  readonly carbG: number | null;
}

export type DayState = 'complete' | 'partial' | 'unknown';
export type DayDeclaration = 'complete' | 'incomplete';
export type DayOrigin = 'declared' | 'inferred' | 'none';

export type DayReason =
  | 'declared-complete'
  | 'declared-incomplete'
  | 'declared-without-entries'
  | 'inferred-complete'
  | 'too-few-entries'
  | 'span-too-short'
  | 'no-entries'
  | 'unknown-values';

export interface DayTotals {
  readonly date: LocalDate;
  readonly state: DayState;
  readonly origin: DayOrigin;
  readonly entryCount: number;
  /** Heures entre la première et la dernière entrée ; `null` sans entrée. */
  readonly spanHours: number | null;
  /** Totaux : `null` si aucune entrée ou si une entrée ignore la valeur. Jamais 0 par défaut. */
  readonly kcal: number | null;
  readonly proteinG: number | null;
  readonly fatG: number | null;
  readonly carbG: number | null;
  /** Jour complet ET énergie connue : seul cas qui alimente le TDEE. */
  readonly usableForTdee: boolean;
  readonly reasons: readonly DayReason[];
}

export interface WeighIn {
  readonly date: LocalDate;
  readonly kg: number;
}

export interface TrendPoint {
  readonly date: LocalDate;
  readonly kg: number;
  readonly trend: number;
  /** Pesée à plus de 2 % de la tendance précédente : pondérée 0,25. */
  readonly outlier: boolean;
}

export interface Coverage {
  readonly endDate: LocalDate;
  readonly windowDays: number;
  readonly completeDays: number;
  readonly weighInDays: number;
  readonly sufficient: boolean;
}

export interface Target {
  readonly kcal: number;
  readonly proteinG: number;
  readonly fatG: number;
  readonly carbG: number;
}
