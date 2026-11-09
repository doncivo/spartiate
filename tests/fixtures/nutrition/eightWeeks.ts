/**
 * Vecteurs synthétiques déterministes sur 8 semaines (PRD § 15.6 ; I4-01). Aucune donnée réelle, aucune horloge, aucun aléa.
 * Jour 0 = lundi 2026-09-07 ; 56 jours (8 semaines pleines).
 */

import { addDays } from '../../../src/domain/localDate';
import type { LocalDate, LocalTime } from '../../../src/domain/types';
import type { MealEntryInput, WeighIn } from '../../../src/domain/nutrition/types';

export const START: LocalDate = '2026-09-07' as LocalDate;
export const DAYS = 56;

export const date = (index: number): LocalDate => addDays(START, index);

/** Trois repas à 08:00, 12:30 et 19:00 (11 h d'amplitude) dont la somme vaut `kcal`. */
export function threeMeals(day: LocalDate, kcal: number): MealEntryInput[] {
  const parts: [string, number][] = [
    ['08:00', 0.3],
    ['12:30', 0.4],
    ['19:00', 0.3],
  ];
  return parts.map(([time, share]) => ({
    date: day,
    time: time as LocalTime,
    kcal: kcal * share,
    proteinG: 30,
    fatG: 20,
    carbG: 60,
  }));
}

/** Deux repas rapprochés : jamais « complet » par inférence (moins de 3 entrées). */
export function twoMeals(day: LocalDate, kcal: number): MealEntryInput[] {
  return threeMeals(day, kcal).slice(0, 2);
}

export interface Scenario {
  readonly name: string;
  readonly entries: MealEntryInput[];
  readonly weighIns: WeighIn[];
}

interface Options {
  readonly name: string;
  /** Jours (0–55) loggés complets ; les autres n'ont aucune entrée. */
  readonly logged: (index: number) => boolean;
  readonly kcal: (index: number) => number;
  readonly weight: (index: number) => number | null;
}

function build(o: Options): Scenario {
  const entries: MealEntryInput[] = [];
  const weighIns: WeighIn[] = [];
  for (let i = 0; i < DAYS; i += 1) {
    if (o.logged(i)) entries.push(...threeMeals(date(i), o.kcal(i)));
    const kg = o.weight(i);
    if (kg !== null) weighIns.push({ date: date(i), kg });
  }
  return { name: o.name, entries, weighIns };
}

/** Couverture complète : 2 400 kcal chaque jour, 3 pesées par semaine, perte régulière de 0,07 kg/j. */
export const completeCoverage = (): Scenario =>
  build({
    name: 'couverture complète',
    logged: () => true,
    kcal: () => 2400,
    weight: (i) => (i % 7 === 0 || i % 7 === 2 || i % 7 === 4 ? Math.round((80 - 0.07 * i) * 100) / 100 : null),
  });

/** Couverture partielle : 3 jours complets par semaine seulement, donc jamais d'ajustement. */
export const partialCoverage = (): Scenario =>
  build({
    name: 'couverture partielle',
    logged: (i) => i % 7 < 3,
    kcal: () => 2400,
    weight: (i) => (i % 7 === 0 || i % 7 === 3 ? 80 : null),
  });

/** Pesée aberrante : +3 kg isolé au jour 30, poids stable à 80 kg sinon. */
export const outlierWeighIn = (): Scenario =>
  build({
    name: 'pesée aberrante',
    logged: () => true,
    kcal: () => 2500,
    weight: (i) => (i % 2 === 0 ? (i === 30 ? 83 : 80) : null),
  });

/** Changement d'objectif : les mêmes données ; l'objectif (perte puis prise) est fixé par le test. */
export const goalChange = (): Scenario =>
  build({
    name: "changement d'objectif",
    logged: () => true,
    kcal: () => 2600,
    weight: (i) => (i % 2 === 0 ? 80 : null),
  });

/** Plancher : dépense mesurée basse (1 500 kcal, poids stable), perte demandée. */
export const floorCase = (): Scenario =>
  build({
    name: 'plancher',
    logged: () => true,
    kcal: () => 1500,
    weight: (i) => (i % 2 === 0 ? 60 : null),
  });

/**
 * Trois semaines sans pesée (I4-08 point 7) : tous les jours loggés complets à 2 400 kcal, une pesée un jour sur deux jusqu'au jour 34
 * (poids stable à 80 kg), puis plus aucune : à la fin du jour 55, la dernière pesée a 21 jours.
 */
export const threeWeeksWithoutWeighIn = (): Scenario =>
  build({
    name: 'trois semaines sans pesée',
    logged: () => true,
    kcal: () => 2400,
    weight: (i) => (i <= 34 && i % 2 === 0 ? 80 : null),
  });

/**
 * Saisie en deux fois (I4-07) : petit-déjeuner et déjeuner saisis à 13:00, dîner à 20:30 (7,5 h d'amplitude) chaque jour. Déduit « partiel »
 * (moins de 8 h) ; devient complet quand Ali déclare la journée complète.
 */
export const twoSittings = (): Scenario => {
  const entries: MealEntryInput[] = [];
  const weighIns: WeighIn[] = [];
  const parts: [string, number][] = [
    ['13:00', 0.25],
    ['13:00', 0.4],
    ['20:30', 0.35],
  ];
  for (let i = 0; i < DAYS; i += 1) {
    for (const [time, share] of parts) {
      entries.push({ date: date(i), time: time as LocalTime, kcal: 2400 * share, proteinG: 30, fatG: 20, carbG: 60 });
    }
    if (i % 7 === 0 || i % 7 === 2 || i % 7 === 4) weighIns.push({ date: date(i), kg: Math.round((80 - 0.07 * i) * 100) / 100 });
  }
  return { name: 'saisie en deux fois', entries, weighIns };
};
