/**
 * Dépense de départ et rythme de l'objectif (PRD § 10.0 étape 2, § 10.1 écrans 1 et 2, § 15.1). Pur : aucune horloge, la date du jour est fournie.
 * La formule est celle du moteur de nutrition (`mifflinStJeor`, `formulaTdee`, facteurs d'activité DÉCLARÉS, D-74) : ce module ne fait que
 * l'enrober pour l'onboarding (arrondi d'affichage à 10 kcal, rythme en kg). L'estimation est un point de départ, recalculé après deux
 * semaines de données (§ 15.1) : jamais un faux zéro, une donnée manquante donne `null` et sa cause.
 */

import type { Sex } from '../bodyProfile';
import type { ActivityLevel } from '../nutrition/config';
import { formulaTdee, mifflinStJeor, type TdeeReason } from '../nutrition/tdee';
import type { LocalDate } from '../types';

/** § 10.1 écran 2 : rythme en % du poids par semaine, borné de −1 % (perte) à +0,5 % (prise). */
export const GOAL_RATE_MIN_PCT = -1;
export const GOAL_RATE_MAX_PCT = 0.5;

export interface StartingExpenditureInput {
  readonly sex: Sex | null;
  readonly birthYear: number | null;
  readonly heightCm: number | null;
  readonly weightKg: number | null;
  readonly activity: ActivityLevel | null;
  readonly onDate: LocalDate;
}

export interface StartingExpenditure {
  /** Métabolisme de repos (Mifflin-St Jeor), valeur exacte ; `null` si une donnée manque. */
  readonly bmr: number | null;
  /** Dépense estimée par jour, arrondie à 10 kcal (affichage) ; `null` si une donnée manque. */
  readonly kcal: number | null;
  readonly reasons: readonly TdeeReason[];
}

export function startingExpenditure(input: StartingExpenditureInput): StartingExpenditure {
  const formula = formulaTdee({
    profile: { sex: input.sex, birthYear: input.birthYear, heightCm: input.heightCm },
    activity: input.activity,
    weightKg: input.weightKg,
    onDate: input.onDate,
  });
  if (formula.value === null || input.sex === null || input.birthYear === null || input.heightCm === null || input.weightKg === null) {
    return { bmr: null, kcal: null, reasons: formula.reasons };
  }
  const age = Number(input.onDate.slice(0, 4)) - input.birthYear;
  const bmr = mifflinStJeor({ sex: input.sex, weightKg: input.weightKg, heightCm: input.heightCm, age });
  return { bmr, kcal: Math.round(formula.value / 10) * 10, reasons: [] };
}

/** Rythme hebdomadaire en kg (signe conservé, arrondi au centième) ; `null` hors bornes ou sans poids. */
export function weeklyRateKg(weightKg: number | null, ratePct: number): number | null {
  if (weightKg === null || !Number.isFinite(weightKg) || !(weightKg > 0)) return null;
  if (!Number.isFinite(ratePct) || ratePct < GOAL_RATE_MIN_PCT || ratePct > GOAL_RATE_MAX_PCT) return null;
  const hundredths = weightKg * ratePct;
  if (hundredths === 0) return 0;
  return (Math.sign(hundredths) * Math.round(Math.abs(hundredths))) / 100;
}
