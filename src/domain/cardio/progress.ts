import { addDays, weekdayOf } from '../localDate';
import { utcToLocal } from '../timeZone';
import type { LocalDate } from '../types';

/** I6-06 (D-223) : Progrès › Cardio. Totaux par semaine (du lundi), sur les dernières semaines, la plus récente d'abord. Pur. */

export interface CardioWeekSession {
  readonly startedAt: string;
  readonly durationSec: number;
  readonly distanceM: number | null;
}

export interface CardioWeek {
  /** Lundi de la semaine, `yyyy-MM-dd`. */
  readonly weekStart: string;
  readonly count: number;
  readonly durationSec: number;
  /** Somme des distances connues ; null si aucune séance de la semaine n'a de distance (inconnu ≠ 0). */
  readonly distanceM: number | null;
  /** Séances de la semaine sans distance (dit à l'écran : le total est partiel). */
  readonly sessionsWithoutDistance: number;
}

/** Semaines affichées par défaut. */
export const CARDIO_PROGRESS_WEEKS = 4;

/** Jour local du début d'une séance dans le fuseau de l'appareil. */
export function sessionLocalDay(startedAt: string, timeZone: string): string {
  return utcToLocal(startedAt, timeZone).date;
}

const mondayOf = (day: LocalDate): LocalDate => addDays(day, 1 - weekdayOf(day));

export function cardioWeeks(sessions: readonly CardioWeekSession[], today: string, timeZone: string, weeks: number = CARDIO_PROGRESS_WEEKS): CardioWeek[] {
  const first = mondayOf(today as LocalDate);
  const starts = Array.from({ length: weeks }, (_, i) => addDays(first, -7 * i));
  const acc = new Map(starts.map((w) => [w as string, { count: 0, durationSec: 0, distanceM: null as number | null, sessionsWithoutDistance: 0 }]));
  for (const s of sessions) {
    if (!Number.isFinite(Date.parse(s.startedAt))) continue;
    const day = sessionLocalDay(s.startedAt, timeZone) as LocalDate;
    if (day > today) continue;
    const w = acc.get(mondayOf(day));
    if (!w) continue;
    w.count += 1;
    w.durationSec += s.durationSec;
    if (s.distanceM === null) w.sessionsWithoutDistance += 1;
    else w.distanceM = (w.distanceM ?? 0) + s.distanceM;
  }
  return starts.map((w) => ({ weekStart: w, ...(acc.get(w) as Omit<CardioWeek, 'weekStart'>) }));
}
