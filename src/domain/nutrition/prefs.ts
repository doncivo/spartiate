/**
 * Préférences de nutrition d'Ali (I4-03 ; D-74) : style du check-in, objectif, niveau d'activité DÉCLARÉ, jour du check-in. Module pur.
 * Lecture stricte d'une valeur non fiable : un champ illisible retombe sur sa valeur par défaut sans effacer les autres.
 * Défauts : maintien (Q-7), lundi, activité non déclarée (jamais déduite des pas), style collaboratif (le moteur propose, Ali choisit).
 */

import { addDays, weekdayOf } from '../localDate';
import { isWeekday, type LocalDate, type Weekday } from '../types';
import { ACTIVITY_LEVELS, NUTRITION_CONFIG, type ActivityLevel } from './config';
import type { CheckInStyle, Goal } from './checkIn';

export interface NutritionPrefs {
  readonly activity: ActivityLevel | null;
  readonly style: CheckInStyle;
  readonly goal: Goal;
  readonly checkInWeekday: Weekday;
}

export const CHECK_IN_STYLES: readonly CheckInStyle[] = ['guided', 'collaborative', 'manual'];
/** Vitesse hebdomadaire maximale acceptée à la saisie (le moteur borne encore à 1 % du poids par semaine). */
export const GOAL_RATE_MAX_KG = 1;

export const DEFAULT_NUTRITION_PREFS: NutritionPrefs = {
  activity: null,
  style: 'collaborative',
  goal: { kind: 'maintain' },
  checkInWeekday: NUTRITION_CONFIG.checkInWeekday,
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function parseGoal(raw: unknown): Goal {
  if (!isObject(raw)) return DEFAULT_NUTRITION_PREFS.goal;
  const kind = raw['kind'];
  const rate = raw['weeklyRateKg'];
  if ((kind === 'loss' || kind === 'gain') && typeof rate === 'number' && Number.isFinite(rate) && rate > 0 && rate <= GOAL_RATE_MAX_KG) return { kind, weeklyRateKg: rate };
  return DEFAULT_NUTRITION_PREFS.goal;
}

export function parseNutritionPrefs(raw: unknown): NutritionPrefs {
  if (!isObject(raw)) return DEFAULT_NUTRITION_PREFS;
  const activity = raw['activity'];
  const style = raw['style'];
  const weekday = raw['checkInWeekday'];
  return {
    activity: typeof activity === 'string' && (ACTIVITY_LEVELS as readonly string[]).includes(activity) ? (activity as ActivityLevel) : null,
    style: typeof style === 'string' && (CHECK_IN_STYLES as readonly string[]).includes(style) ? (style as CheckInStyle) : DEFAULT_NUTRITION_PREFS.style,
    goal: parseGoal(raw['goal']),
    checkInWeekday: typeof weekday === 'number' && Number.isInteger(weekday) && isWeekday(weekday) ? weekday : DEFAULT_NUTRITION_PREFS.checkInWeekday,
  };
}

export interface CheckInPeriod {
  /** Dernier jour de check-in écoulé (aujourd'hui compris) : la cible décidée s'applique à partir de ce jour. */
  readonly checkInDate: LocalDate;
  /** Veille du jour de check-in : fin de la semaine analysée (le jour du check-in n'est pas encore complet). */
  readonly weekEnd: LocalDate;
}

export function checkInPeriod(today: LocalDate, weekday: Weekday): CheckInPeriod {
  const offset = (weekdayOf(today) - weekday + 7) % 7;
  const checkInDate = addDays(today, -offset);
  return { checkInDate, weekEnd: addDays(checkInDate, -1) };
}
