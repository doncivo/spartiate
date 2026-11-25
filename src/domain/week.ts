import { addDays, parseLocalDate, weekdayOf } from './localDate';
import type { LocalDate, Weekday } from './types';

/**
 * Semaine (M3, S-01) : du lundi au dimanche, numérotation ISO 8601. Calculs sur des dates civiles en UTC : aucun effet de
 * fuseau ni de changement d'heure (la semaine du passage à l'heure d'été compte bien 7 jours).
 */

/** P-03 : premier jour de la semaine affichée (lundi par défaut ; samedi ou dimanche au choix). */
export type FirstWeekday = 'monday' | 'saturday' | 'sunday';
export const FIRST_WEEKDAYS: readonly FirstWeekday[] = ['monday', 'saturday', 'sunday'];
export const DEFAULT_FIRST_WEEKDAY: FirstWeekday = 'monday';

const FIRST_WEEKDAY_ISO: Readonly<Record<FirstWeekday, Weekday>> = { monday: 1, saturday: 6, sunday: 7 };

/** Jour ISO (1 = lundi … 7 = dimanche) du premier jour de semaine. */
export function firstWeekdayIso(first: FirstWeekday): Weekday {
  return FIRST_WEEKDAY_ISO[first];
}

/**
 * Nombre de jours entre le premier jour de la semaine et un jour ISO (0 à 6). ERGO-02b : sans `localDate`, pour un écran à la demande
 * (un import de `daysSinceWeekStart` y sortait `localDate` du bloc d'entrée, soit un bloc de plus au départ).
 */
export function daysFromWeekStart(weekday: Weekday, first: FirstWeekday = DEFAULT_FIRST_WEEKDAY): number {
  return (weekday - FIRST_WEEKDAY_ISO[first] + 7) % 7;
}

/** Nombre de jours entre le premier jour de la semaine et `date` (0 à 6). */
export function daysSinceWeekStart(date: LocalDate, first: FirstWeekday = DEFAULT_FIRST_WEEKDAY): number {
  return daysFromWeekStart(weekdayOf(date), first);
}

/** Jours ISO dans l'ordre d'affichage d'une semaine commençant par `first` (lundi : 1…7 ; dimanche : 7, 1…6). */
export function weekdayOrder(first: FirstWeekday = DEFAULT_FIRST_WEEKDAY): Weekday[] {
  const start = FIRST_WEEKDAY_ISO[first];
  return Array.from({ length: 7 }, (_, i) => (((start - 1 + i) % 7) + 1) as Weekday);
}

/**
 * Premier jour (lundi par défaut) de la semaine qui contient `date`. Les objectifs, le rapport et la règle « toutes les N semaines »
 * restent sur le lundi (P-03 D2) : ils appellent sans second argument.
 */
export function weekStartOf(date: LocalDate, first: FirstWeekday = DEFAULT_FIRST_WEEKDAY): LocalDate {
  return addDays(date, -daysSinceWeekStart(date, first));
}

/** Les sept jours de la semaine commençant le lundi `weekStart`. */
export function weekDays(weekStart: LocalDate): LocalDate[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

/** Lundi de la semaine décalée de `count` semaines (négatif : avant). */
export function addWeeks(weekStart: LocalDate, count: number): LocalDate {
  return addDays(weekStart, count * 7);
}

export interface IsoWeek {
  /** Année ISO : celle du jeudi de la semaine (le 1er janvier peut appartenir à la semaine 52 ou 53 de l'année précédente). */
  readonly year: number;
  readonly week: number;
}

/** Numéro de semaine ISO 8601 de `date` (semaine 1 : celle du premier jeudi de l'année). */
export function isoWeekOf(date: LocalDate): IsoWeek {
  const thursday = addDays(date, 4 - weekdayOf(date));
  const { year } = parseLocalDate(thursday);
  const jan1 = Date.UTC(year, 0, 1);
  const { month, day } = parseLocalDate(thursday);
  const dayOfYear = Math.round((Date.UTC(year, month - 1, day) - jan1) / 86_400_000);
  return { year, week: Math.floor(dayOfYear / 7) + 1 };
}
