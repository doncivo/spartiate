import { isWeekday, type LocalDate, type Weekday } from '../types';
import { KCAL_PER_G } from './config';
import type { Target } from './types';

/**
 * PROG-01 : cible des jours de repos (D-270 à D-272). Module pur, sans horloge.
 *
 * - La cible enregistrée (`kcal`, …) est celle des jours d'entraînement ; la cible de repos (facultative) garde protéines et lipides, l'écart
 *   passe par les glucides, jamais négatifs (D-271).
 * - Type de jour : jour ISO prévu (`trainingDays`), ou séance de musculation close ce jour-là ; sinon repos (D-270). Sans cible de repos : aucun
 *   type de jour, la cible unique vaut tous les jours (comportement d'avant PROG-01).
 * - Moyenne hebdomadaire : (n × entraînement + (7 − n) × repos) ÷ 7, arrondie au kcal et au gramme.
 */

export type DayType = 'training' | 'rest';

export interface RestPlan {
  readonly rest: Target;
  /** Jours ISO (1 = lundi) d'entraînement prévus, triés, sans doublon. */
  readonly trainingDays: readonly Weekday[];
}

export const DEFAULT_REST_GAP_KCAL = -200;
export const DEFAULT_TRAINING_DAYS: readonly Weekday[] = Object.freeze([1, 2, 4, 5, 6] as Weekday[]);

const carbFor = (kcal: number, proteinG: number, fatG: number): number =>
  Math.max(0, Math.round((kcal - KCAL_PER_G.protein * proteinG - KCAL_PER_G.fat * fatG) / KCAL_PER_G.carb));

/** Cible de repos par un écart en kcal (négatif : moins de glucides). */
export function restTargetFromGap(training: Target, gapKcal: number): Target {
  const kcal = Math.round(training.kcal + gapKcal);
  return { kcal, proteinG: training.proteinG, fatG: training.fatG, carbG: Math.max(0, Math.floor(training.carbG + gapKcal / KCAL_PER_G.carb + 1e-9)) };
}

/** Cible de repos saisie en kcal : même règle que l'écart. */
export const restTargetFromKcal = (training: Target, restKcal: number): Target => restTargetFromGap(training, restKcal - training.kcal);

/** Cible de même écart en kcal, glucides recalculés (check-in, D-272). */
export function shiftTarget(target: Target, deltaKcal: number, proteinG = target.proteinG, fatG = target.fatG): Target {
  const kcal = target.kcal + deltaKcal;
  return { kcal, proteinG, fatG, carbG: carbFor(kcal, proteinG, fatG) };
}

export function parseTrainingDays(raw: string | null | undefined): Weekday[] | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const parts = raw.split(',').map((p) => Number(p));
  if (parts.some((n) => !Number.isInteger(n) || !isWeekday(n))) return null;
  return [...new Set(parts as Weekday[])].sort((a, b) => a - b);
}

export const formatTrainingDays = (days: readonly number[]): string => [...new Set(days)].filter((d) => isWeekday(d)).sort((a, b) => a - b).join(',');

/** Jour ISO d'une date locale (1 = lundi). */
export function isoWeekdayOf(date: LocalDate): Weekday {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return (js === 0 ? 7 : js) as Weekday;
}

/** Type du jour ; `null` sans cible de repos. `strengthDays` : dates des séances de musculation closes. */
export function dayTypeOf(date: LocalDate, plan: RestPlan | null, strengthDays: ReadonlySet<LocalDate>): DayType | null {
  if (plan === null) return null;
  return plan.trainingDays.includes(isoWeekdayOf(date)) || strengthDays.has(date) ? 'training' : 'rest';
}

export function dayTargetFor(training: Target, plan: RestPlan | null, date: LocalDate, strengthDays: ReadonlySet<LocalDate>): { type: DayType | null; target: Target } {
  const type = dayTypeOf(date, plan, strengthDays);
  return { type, target: type === 'rest' && plan !== null ? plan.rest : training };
}

export function weeklyAverageTarget(training: Target, plan: RestPlan | null): Target {
  if (plan === null) return training;
  const n = plan.trainingDays.length;
  const avg = (a: number, b: number): number => Math.round((n * a + (7 - n) * b) / 7);
  return { kcal: avg(training.kcal, plan.rest.kcal), proteinG: avg(training.proteinG, plan.rest.proteinG), fatG: avg(training.fatG, plan.rest.fatG), carbG: avg(training.carbG, plan.rest.carbG) };
}

/** Plan de repos lu d'une ligne `nutrition_target` (colonnes nulles ou illisibles : aucun plan, comportement d'avant). */
export function restPlanOf(training: Target, row: { readonly restKcal: number | null; readonly restCarbG: number | null; readonly trainingDays: string | null }): RestPlan | null {
  const days = parseTrainingDays(row.trainingDays);
  if (row.restKcal === null || !(row.restKcal > 0) || row.restCarbG === null || !(row.restCarbG >= 0) || days === null) return null;
  return { rest: { kcal: row.restKcal, proteinG: training.proteinG, fatG: training.fatG, carbG: row.restCarbG }, trainingDays: days };
}
