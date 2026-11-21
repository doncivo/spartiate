import { addDays } from '../localDate';
import type { LocalDate } from '../types';

/**
 * SUIVIS-029c : notes du matin, fatigue et qualité du sommeil de 1 à 10 (entiers), une par jour et par note, modifiables le jour même. Stockées comme
 * genres de la table publiée `measurement` (`note_fatigue`, `note_sleep`, unité « score » ; précédent D-113, aucune migration). Repère déclaratif :
 * AUCUN effet sur la récupération (le moteur de `src/domain/recovery` ne les lit pas ; choix prudent proposé en décision). Module pur, sans
 * dépendance vers `bodyProgress` (c'est lui qui importe ces genres).
 */

export const RATING_KINDS = ['note_fatigue', 'note_sleep'] as const;
export type RatingKind = (typeof RATING_KINDS)[number];

export const RATING_MIN = 1;
export const RATING_MAX = 10;

export const isRatingKind = (value: string): value is RatingKind => (RATING_KINDS as readonly string[]).includes(value);
export const isRatingValue = (value: number): boolean => Number.isInteger(value) && value >= RATING_MIN && value <= RATING_MAX;

/** Une note ne se saisit ou ne se modifie que pour le jour même (jamais un jour passé ni futur depuis Aujourd'hui). */
export const canEditRating = (day: string, today: string): boolean => day === today;

export interface RatingPoint {
  readonly day: string;
  readonly value: number;
}

export interface RatingSeries {
  /** Une valeur par jour, du plus ancien au plus récent ; null : jour sans note (jamais 0). */
  readonly points: readonly (number | null)[];
  /** Moyenne des jours notés, au dixième ; null sans note. */
  readonly average: number | null;
  readonly days: number;
}

export const RATING_SERIES_DAYS = 30;

export function ratingSeries(points: readonly RatingPoint[], today: string, days: number = RATING_SERIES_DAYS): RatingSeries {
  const byDay = new Map<string, number>();
  for (const p of points) if (isRatingValue(p.value)) byDay.set(p.day, p.value);
  const out = Array.from({ length: days }, (_, i) => byDay.get(addDays(today as LocalDate, i - (days - 1))) ?? null);
  const known = out.filter((v): v is number => v !== null);
  return { points: out, average: known.length === 0 ? null : Math.round((known.reduce((a, b) => a + b, 0) / known.length) * 10) / 10, days: known.length };
}
