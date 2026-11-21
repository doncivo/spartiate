/**
 * Imputation À L'AFFICHAGE des jours non loggés (PRD § 15.1 : « jamais 0 ; imputés à l'affichage avec incertitude », C-194). Module pur.
 * Une valeur imputée est une ESTIMATION : elle porte `basis: 'imputed'` et son incertitude, n'entre jamais dans la dépense mesurée, la
 * couverture ni la base de données. Sans base suffisante, rien n'est imputé (jamais 0, jamais une valeur inventée).
 */

import { addDays } from '../localDate';
import type { LocalDate } from '../types';
import { NUTRITION_CONFIG } from './config';
import type { DayTotals, WeighIn } from './types';
import { computeTrend } from './weightTrend';

/** Incertitude minimale des kcal imputées, en part de la moyenne : jamais « ± 0 ». */
export const IMPUTED_KCAL_MIN_SPREAD_RATIO = 0.05;
/** Incertitude minimale du poids imputé, en kg. */
export const IMPUTED_WEIGHT_MIN_SPREAD_KG = 0.3;
/** Fenêtre des pesées qui mesurent la dispersion autour de la tendance. */
export const IMPUTED_WEIGHT_SPREAD_WINDOW_DAYS = 28;

export interface ImputedKcalDay {
  readonly date: LocalDate;
  readonly kcal: number;
  /** Incertitude (±) en kcal. */
  readonly spread: number;
  /** Jours complets qui fondent l'estimation. */
  readonly sampleDays: number;
  /** Énergie déjà loguée ce jour-là (jour partiel), `null` sans entrée. */
  readonly loggedKcal: number | null;
  readonly basis: 'imputed';
}

export interface KcalImputation {
  readonly days: readonly ImputedKcalDay[];
  readonly reason: 'too-few-complete-days' | null;
}

export function imputeKcalDays(input: {
  readonly days: readonly DayTotals[];
  readonly startDate: LocalDate;
  readonly endDate: LocalDate;
  /** Fin de la fenêtre de référence de 21 jours (par défaut `endDate`). */
  readonly referenceEnd?: LocalDate;
}): KcalImputation {
  const refEnd = input.referenceEnd ?? input.endDate;
  const refStart = addDays(refEnd, -(NUTRITION_CONFIG.tdeeWindowDays - 1));
  const byDate = new Map<LocalDate, DayTotals>();
  for (const d of input.days) byDate.set(d.date, d);
  const sample: number[] = [];
  for (const d of input.days) if (d.usableForTdee && d.kcal !== null && d.date >= refStart && d.date <= refEnd) sample.push(d.kcal);
  if (sample.length < NUTRITION_CONFIG.minLoggedDays) return { days: [], reason: 'too-few-complete-days' };
  const mean = sample.reduce((a, b) => a + b, 0) / sample.length;
  const sd = Math.sqrt(sample.reduce((a, b) => a + (b - mean) ** 2, 0) / (sample.length - 1));
  const spread = Math.round(Math.max(sd, mean * IMPUTED_KCAL_MIN_SPREAD_RATIO));
  const out: ImputedKcalDay[] = [];
  for (let date = input.startDate; date <= input.endDate; date = addDays(date, 1)) {
    const day = byDate.get(date);
    if (day?.usableForTdee === true && day.kcal !== null) continue;
    const logged = day?.kcal ?? null;
    out.push({ date, kcal: Math.round(logged === null ? mean : Math.max(mean, logged)), spread, sampleDays: sample.length, loggedKcal: logged, basis: 'imputed' });
  }
  return { days: out, reason: null };
}

export interface ImputedWeightDay {
  readonly date: LocalDate;
  readonly kg: number;
  /** Incertitude (±) en kg. */
  readonly spread: number;
  readonly basis: 'imputed';
}

const tenth = (n: number): number => Math.round(n * 10) / 10;

/** Poids des jours sans pesée : la tendance reportée, à ± la dispersion des pesées récentes autour d'elle. Rien avant la 1re pesée ni si la dernière a plus de 7 jours. */
export function imputeWeightDays(input: { readonly weighIns: readonly WeighIn[]; readonly startDate: LocalDate; readonly endDate: LocalDate }): { readonly days: readonly ImputedWeightDay[] } {
  const trend = computeTrend(input.weighIns);
  if (trend.length === 0) return { days: [] };
  const from = addDays(input.endDate, -(IMPUTED_WEIGHT_SPREAD_WINDOW_DAYS - 1));
  const residuals = trend.filter((p) => p.date >= from && p.date <= input.endDate).map((p) => p.kg - p.trend);
  const rms = residuals.length === 0 ? 0 : Math.sqrt(residuals.reduce((a, b) => a + b * b, 0) / residuals.length);
  const spread = tenth(Math.max(IMPUTED_WEIGHT_MIN_SPREAD_KG, rms));
  const weighed = new Set(trend.map((p) => p.date));
  const out: ImputedWeightDay[] = [];
  for (let date = input.startDate; date <= input.endDate; date = addDays(date, 1)) {
    if (weighed.has(date)) continue;
    let last: (typeof trend)[number] | null = null;
    for (const p of trend) {
      if (p.date > date) break;
      last = p;
    }
    if (last === null) continue;
    const age = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${last.date}T00:00:00Z`)) / 86_400_000);
    if (age > NUTRITION_CONFIG.maxWeighInAgeDays) continue;
    out.push({ date, kg: tenth(last.trend), spread, basis: 'imputed' });
  }
  return { days: out };
}
