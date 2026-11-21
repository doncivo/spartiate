import { addDays, weekdayOf } from '../localDate';
import { utcToLocal } from '../timeZone';
import type { LocalDate } from '../types';

/**
 * SUIVIS-029b : cardio en zone 2 (choix prudents proposés en décision, docs/SUIVIS-029.md). FC max : la valeur saisie prime, sinon 220 − âge (âge =
 * année courante − année de naissance du profil) ; zone 2 = [60 % ; 70 %] de la FC max, arrondis au battement, bornes incluses. Une séance cardio
 * dont la FC MOYENNE est dans la zone compte pour toute sa durée ; hors zone : 0 ; sans FC moyenne : jamais comptée, et dite. Repère d'entraînement,
 * pas une mesure médicale. Module pur.
 */

export const ZONE2_RULE = { base: 220, lowPct: 60, highPct: 70 } as const;
/** Âges admis pour la formule (au-delà : année de naissance non plausible, aucune FC max). */
const AGE_MIN = 10;
const AGE_MAX = 110;

export interface HrMax {
  readonly value: number;
  readonly source: 'entered' | 'age';
  /** Âge utilisé par la formule ; null pour une valeur saisie. */
  readonly age: number | null;
}

export function hrMaxOf(input: { readonly entered: number | null; readonly birthYear: number | null; readonly currentYear: number }): HrMax | null {
  if (input.entered !== null) return { value: input.entered, source: 'entered', age: null };
  if (input.birthYear === null) return null;
  const age = input.currentYear - input.birthYear;
  if (!Number.isInteger(age) || age < AGE_MIN || age > AGE_MAX) return null;
  return { value: ZONE2_RULE.base - age, source: 'age', age };
}

export interface Zone2Range {
  readonly low: number;
  readonly high: number;
}

export function zone2Range(hrMax: number): Zone2Range {
  return { low: Math.round((hrMax * ZONE2_RULE.lowPct) / 100), high: Math.round((hrMax * ZONE2_RULE.highPct) / 100) };
}

export interface Zone2Session {
  readonly startedAt: string;
  readonly durationSec: number;
  readonly avgHr: number | null;
}

export interface Zone2Week {
  /** Lundi de la semaine. */
  readonly weekStart: string;
  /** Minutes en zone 2 (arrondies). */
  readonly minutes: number;
  readonly sessions: number;
  readonly sessionsInZone: number;
  readonly sessionsWithoutHr: number;
}

export const ZONE2_WEEKS = 4;

const mondayOf = (day: LocalDate): LocalDate => addDays(day, 1 - weekdayOf(day));

/** Semaines du lundi, la plus récente d'abord ; séances futures ou illisibles ignorées ; jour local du début dans le fuseau de l'appareil. */
export function zone2Weeks(sessions: readonly Zone2Session[], range: Zone2Range, today: string, timeZone: string, weeks: number = ZONE2_WEEKS): Zone2Week[] {
  const first = mondayOf(today as LocalDate);
  const starts = Array.from({ length: weeks }, (_, i) => addDays(first, -7 * i) as string);
  const acc = new Map(starts.map((w) => [w, { seconds: 0, sessions: 0, sessionsInZone: 0, sessionsWithoutHr: 0 }]));
  for (const s of sessions) {
    if (!Number.isFinite(Date.parse(s.startedAt))) continue;
    const day = utcToLocal(s.startedAt, timeZone).date as LocalDate;
    if (day > today) continue;
    const w = acc.get(mondayOf(day));
    if (!w) continue;
    w.sessions += 1;
    if (s.avgHr === null) w.sessionsWithoutHr += 1;
    else if (s.avgHr >= range.low && s.avgHr <= range.high) {
      w.sessionsInZone += 1;
      w.seconds += s.durationSec;
    }
  }
  return starts.map((weekStart) => {
    const w = acc.get(weekStart) ?? { seconds: 0, sessions: 0, sessionsInZone: 0, sessionsWithoutHr: 0 };
    return { weekStart, minutes: Math.round(w.seconds / 60), sessions: w.sessions, sessionsInZone: w.sessionsInZone, sessionsWithoutHr: w.sessionsWithoutHr };
  });
}
