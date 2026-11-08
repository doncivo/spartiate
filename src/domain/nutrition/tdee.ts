/**
 * Dépense énergétique (PRD § 15.1 ; D-74). Estimation initiale Mifflin-St Jeor × niveau d'activité DÉCLARÉ ; dépense mesurée
 * `moyenne(kcal des jours complets) − (ΔT / N) × 7 700` sur N = 21 jours, lissée par EMA de demi-vie 7 jours ; transition linéaire de
 * la formule vers la mesure sur 28 jours de données suffisantes. Chaque terme est exposé : rien n'est opaque, rien n'est zéro par défaut.
 */

import { addDays } from '../localDate';
import type { Sex } from '../bodyProfile';
import type { LocalDate } from '../types';
import { coverageOfWindow, sufficientDataDays } from './coverage';
import { ACTIVITY_FACTORS, NUTRITION_CONFIG, NUTRITION_ENGINE_VERSION, type ActivityLevel } from './config';
import type { Coverage, DayTotals, WeighIn } from './types';
import { computeTrend, trendAt } from './weightTrend';
import type { TrendPoint } from './types';

export interface TdeeProfile {
  readonly sex: Sex | null;
  readonly birthYear: number | null;
  readonly heightCm: number | null;
}

export type TdeeReason =
  | 'profile-incomplete'
  | 'activity-not-declared'
  | 'no-weight'
  | 'insufficient-complete-days'
  | 'no-trend-at-start'
  | 'no-trend-at-end';

export function mifflinStJeor(p: { sex: Sex; weightKg: number; heightCm: number; age: number }): number {
  return 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
}

export interface FormulaTdee {
  readonly value: number | null;
  readonly reasons: readonly TdeeReason[];
}

export function formulaTdee(input: {
  readonly profile: TdeeProfile | null;
  readonly activity: ActivityLevel | null;
  readonly weightKg: number | null;
  readonly onDate: LocalDate;
}): FormulaTdee {
  const reasons: TdeeReason[] = [];
  const { profile } = input;
  if (profile === null || profile.sex === null || profile.birthYear === null || profile.heightCm === null) {
    reasons.push('profile-incomplete');
  }
  if (input.activity === null) reasons.push('activity-not-declared');
  if (input.weightKg === null || !(input.weightKg > 0)) reasons.push('no-weight');
  if (reasons.length > 0 || profile === null || profile.sex === null || profile.birthYear === null || profile.heightCm === null || input.activity === null || input.weightKg === null) {
    return { value: null, reasons };
  }
  const age = Number(input.onDate.slice(0, 4)) - profile.birthYear;
  const bmr = mifflinStJeor({ sex: profile.sex, weightKg: input.weightKg, heightCm: profile.heightCm, age });
  return { value: bmr * ACTIVITY_FACTORS[input.activity], reasons };
}

export interface MeasuredTdee {
  readonly value: number | null;
  readonly meanKcal: number | null;
  readonly completeDays: number;
  readonly deltaKg: number | null;
  readonly reasons: readonly TdeeReason[];
}

/** Dépense brute sur les 21 jours qui se terminent à `endDate`. Exclue (null) si la couverture ou la tendance manque. */
export function measuredTdee(input: {
  readonly days: readonly DayTotals[];
  readonly trend: readonly TrendPoint[];
  readonly endDate: LocalDate;
}): MeasuredTdee {
  const n = NUTRITION_CONFIG.tdeeWindowDays;
  const first = addDays(input.endDate, -(n - 1));
  const startDate = addDays(input.endDate, -n);
  const used = new Map<LocalDate, number>();
  for (const d of input.days) {
    if (d.usableForTdee && d.kcal !== null && d.date >= first && d.date <= input.endDate) used.set(d.date, d.kcal);
  }
  const completeDays = used.size;
  const meanKcal = completeDays === 0 ? null : [...used.values()].reduce((a, b) => a + b, 0) / completeDays;
  const tStart = trendAt(input.trend, startDate);
  const tEnd = trendAt(input.trend, input.endDate);
  const reasons: TdeeReason[] = [];
  if (completeDays < NUTRITION_CONFIG.minCompleteDaysInTdeeWindow) reasons.push('insufficient-complete-days');
  if (tStart === null) reasons.push('no-trend-at-start');
  if (tEnd === null) reasons.push('no-trend-at-end');
  if (reasons.length > 0 || meanKcal === null || tStart === null || tEnd === null) {
    return { value: null, meanKcal, completeDays, deltaKg: tStart !== null && tEnd !== null ? tEnd - tStart : null, reasons };
  }
  const deltaKg = tEnd - tStart;
  return { value: meanKcal - (deltaKg / n) * NUTRITION_CONFIG.kcalPerKg, meanKcal, completeDays, deltaKg, reasons };
}

/** EMA de demi-vie 7 j : `α = 1 − 2^(−pas/7)`. Sans valeur précédente, le brut ; pas nul, la valeur précédente. */
export function smoothTdee(input: { previous: number | null; raw: number; stepDays: number }): number {
  if (input.previous === null) return input.raw;
  if (!(input.stepDays > 0)) return input.previous;
  const alpha = 1 - 2 ** (-input.stepDays / NUTRITION_CONFIG.tdeeHalfLifeDays);
  return input.previous + alpha * (input.raw - input.previous);
}

/** Poids de la mesure dans la dépense : linéaire de 0 à 1 sur 28 jours de données suffisantes (D-74 point 4). */
export function measuredWeight(sufficientDays: number): number {
  if (!(sufficientDays > 0)) return 0;
  return Math.min(1, sufficientDays / NUTRITION_CONFIG.blendDays);
}

export type TdeeBasis = 'formula' | 'blend' | 'measured' | 'none';

export function blendTdee(input: {
  readonly formula: number | null;
  readonly measured: number | null;
  readonly sufficientDays: number;
}): { value: number | null; basis: TdeeBasis; weightMeasured: number } {
  const { formula, measured } = input;
  if (formula === null && measured === null) return { value: null, basis: 'none', weightMeasured: 0 };
  if (measured === null) return { value: formula, basis: 'formula', weightMeasured: 0 };
  if (formula === null) return { value: measured, basis: 'measured', weightMeasured: 1 };
  const w = measuredWeight(input.sufficientDays);
  if (w === 0) return { value: formula, basis: 'formula', weightMeasured: 0 };
  if (w === 1) return { value: measured, basis: 'measured', weightMeasured: 1 };
  return { value: (1 - w) * formula + w * measured, basis: 'blend', weightMeasured: w };
}

export interface TdeeEstimate {
  readonly engineVersion: number;
  readonly endDate: LocalDate;
  /** Dépense retenue ; `null` si ni formule ni mesure (jamais 0). */
  readonly value: number | null;
  readonly basis: TdeeBasis;
  readonly weightMeasured: number;
  readonly formula: number | null;
  readonly measuredRaw: number | null;
  readonly measuredSmoothed: number | null;
  readonly sufficientDays: number;
  readonly weightKg: number | null;
  readonly meanKcal: number | null;
  readonly completeDaysInWindow: number;
  readonly deltaKg: number | null;
  /** Couverture des 7 derniers jours (affichée avec la confiance). */
  readonly coverage: Coverage;
  readonly reasons: readonly TdeeReason[];
}

const dayCount = (a: LocalDate, b: LocalDate): number => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export function estimateTdee(input: {
  readonly endDate: LocalDate;
  readonly days: readonly DayTotals[];
  readonly weighIns: readonly WeighIn[];
  readonly profile: TdeeProfile | null;
  readonly activity: ActivityLevel | null;
  /** Dernière dépense mesurée lissée et sa date (pour le pas de l'EMA). */
  readonly previousSmoothed: { readonly date: LocalDate; readonly value: number } | null;
}): TdeeEstimate {
  const trend = computeTrend(input.weighIns);
  const weightKg = trendAt(trend, input.endDate);
  const formula = formulaTdee({ profile: input.profile, activity: input.activity, weightKg, onDate: input.endDate });
  const measured = measuredTdee({ days: input.days, trend, endDate: input.endDate });

  let measuredSmoothed: number | null = null;
  if (measured.value !== null) {
    measuredSmoothed = smoothTdee({
      previous: input.previousSmoothed?.value ?? null,
      raw: measured.value,
      stepDays: input.previousSmoothed ? dayCount(input.previousSmoothed.date, input.endDate) : 0,
    });
  }

  const dates = [...input.days.map((d) => d.date), ...input.weighIns.map((w) => w.date)].sort();
  const firstDate = dates[0];
  const sufficientDays = firstDate === undefined ? 0 : sufficientDataDays(input.days, input.weighIns, firstDate, input.endDate);
  const blend = blendTdee({ formula: formula.value, measured: measuredSmoothed, sufficientDays });

  return {
    engineVersion: NUTRITION_ENGINE_VERSION,
    endDate: input.endDate,
    value: blend.value,
    basis: blend.basis,
    weightMeasured: blend.weightMeasured,
    formula: formula.value,
    measuredRaw: measured.value,
    measuredSmoothed,
    sufficientDays,
    weightKg,
    meanKcal: measured.meanKcal,
    completeDaysInWindow: measured.completeDays,
    deltaKg: measured.deltaKg,
    coverage: coverageOfWindow(input.days, input.weighIns, input.endDate),
    reasons: [...formula.reasons, ...measured.reasons],
  };
}
