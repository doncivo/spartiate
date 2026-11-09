/**
 * Constantes du moteur de nutrition adaptative (PRD § 15.1–15.2 ; I4-01 ; D-74). Module pur : aucune horloge, aucun import Tauri ni React.
 * Toute modification d'une valeur qui change un résultat incrémente `NUTRITION_ENGINE_VERSION` (jointe à chaque trace).
 */

import type { Weekday } from '../types';

export const NUTRITION_ENGINE_VERSION = 1;

/** Niveaux d'activité DÉCLARÉS par Ali (D-74 a) ; jamais déduits des pas. */
export const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active'] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const ACTIVITY_FACTOR_SEDENTARY = 1.2;
export const ACTIVITY_FACTOR_LIGHT = 1.375;
export const ACTIVITY_FACTOR_MODERATE = 1.55;
export const ACTIVITY_FACTOR_ACTIVE = 1.725;

export const ACTIVITY_FACTORS: Readonly<Record<ActivityLevel, number>> = {
  sedentary: ACTIVITY_FACTOR_SEDENTARY,
  light: ACTIVITY_FACTOR_LIGHT,
  moderate: ACTIVITY_FACTOR_MODERATE,
  active: ACTIVITY_FACTOR_ACTIVE,
};

export const NUTRITION_CONFIG = {
  /** § 15.2 : jours complets minimum par fenêtre de 7 jours. */
  minLoggedDays: 4,
  /** § 15.2 : pesées minimum (jours distincts) par fenêtre de 7 jours. */
  minWeighIns: 2,
  /** § 15.2 : fenêtres de 7 jours consécutives qui doivent toutes être suffisantes pour un ajustement. */
  requiredWeeks: 2,
  windowDays: 7,
  /** § 15.2 : variation hebdomadaire maximale de la cible, en kcal. */
  maxWeeklyDelta: 150,
  /** Jour de check-in par défaut : lundi (ISO 1), D-74 point 5 ; Ali peut le changer. */
  checkInWeekday: 1 as Weekday,
  /** § 15.1 : demi-vies des EMA, en jours. */
  trendHalfLifeDays: 14,
  tdeeHalfLifeDays: 7,
  /** § 15.1 : écart relatif à la tendance au-delà duquel une pesée est pondérée. */
  outlierRelativeGap: 0.02,
  outlierWeight: 0.25,
  /** § 15.1 : fenêtre de la dépense mesurée et énergie d'un kilogramme de poids. */
  tdeeWindowDays: 21,
  kcalPerKg: 7700,
  /** Jours complets minimum dans la fenêtre de 21 jours : minLoggedDays / 7 de la fenêtre (12). */
  minCompleteDaysInTdeeWindow: 12,
  /** D-82 : âge maximal (jours entre la dernière pesée et chaque bout de la fenêtre) pour que la dépense mesurée soit calculée. */
  maxWeighInAgeDays: 7,
  /** § 15.1 : durée de la transition formule → mesure ; D-74 point 4 : pondération linéaire. */
  blendDays: 28,
  /** § 15.2 : jour complet inféré. */
  inferredMinEntries: 3,
  inferredMinSpanHours: 8,
  /** § 15.2 : macros. */
  proteinMinPerKg: 1.6,
  proteinMaxPerKg: 2.2,
  proteinStepG: 2,
  fatMinPerKg: 0.6,
  /** D-74 point 5 : valeurs initiales quand aucune cible n'existe. */
  initialProteinPerKg: 1.9,
  initialFatPerKg: 0.8,
  /** § 15.2 : bornes. */
  floorKcal: 1200,
  confirmedFloorKcal: 800,
  maxLossPerWeekFraction: 0.01,
  alertTdeeFraction: 0.25,
  /** Jours hauts / bas désactivés par défaut (D-74 c). */
  highLowDaysEnabled: false,
} as const;

/** Énergie par gramme de macronutriment (Atwater) ; protéines et glucides 4, lipides 9. */
export const KCAL_PER_G = { protein: 4, carb: 4, fat: 9 } as const;
