import { weekdayOf } from '../localDate';
import type { LocalDate, Weekday } from '../types';

/**
 * ERGO-01b P1 (D-238, D-243) : jour du programme désigné pour la séance du jour. Règle pure, sans date : le jour qui suit, dans l'ordre des
 * jours de la routine du programme, le dernier jour fait (séance close issue de cette routine) ; en boucle ; les jours sans exercice sont
 * sautés. Sans séance du programme : le premier jour. Une séance libre, d'une autre routine ou d'un jour disparu ne compte pas.
 */

export interface ProgramDayLike {
  readonly id: string;
  readonly dayOrder: number;
  /** PROG-04 : jour de la semaine ISO, facultatif. */
  readonly weekday?: number | null;
  readonly exercises: readonly unknown[];
}

export interface ClosedWorkoutLike {
  readonly routineId: string | null;
  readonly routineDayId: string | null;
  /** FIX-PROGRAMME (C-063) : date locale du début de la séance ; absente : la séance ne compte pas comme « faite aujourd'hui ». */
  readonly day?: LocalDate | null;
}

/** `recentClosed` : séances closes, les plus récentes d'abord. Rend l'identifiant du jour, ou null si aucun jour n'a d'exercice. */
export function nextProgramDay(days: readonly ProgramDayLike[], recentClosed: readonly ClosedWorkoutLike[], routineId: string): string | null {
  const ordered = days.filter((d) => d.exercises.length > 0).sort((a, b) => a.dayOrder - b.dayOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (ordered.length === 0) return null;
  for (const w of recentClosed) {
    if (w.routineId !== routineId || w.routineDayId === null) continue;
    const index = ordered.findIndex((d) => d.id === w.routineDayId);
    if (index < 0) continue;
    return (ordered[(index + 1) % ordered.length] as ProgramDayLike).id;
  }
  return (ordered[0] as ProgramDayLike).id;
}

/** PROG-04 (D-316) : séance du jour désignée, ou repos (avec le prochain jour prévu). */
export type ProgramDayChoice =
  | { readonly kind: 'day'; readonly dayId: string }
  | { readonly kind: 'rest'; readonly nextDayId: string; readonly nextWeekday: Weekday }
  /** FIX-PROGRAMME (C-063) : la séance du jour est déjà faite aujourd'hui ; le prochain jour prévu est donné (au plus tôt demain). */
  | { readonly kind: 'done'; readonly dayId: string; readonly nextDayId: string; readonly nextWeekday: Weekday };

const hasWeekday = (d: ProgramDayLike): d is ProgramDayLike & { readonly weekday: number } => typeof d.weekday === 'number' && d.weekday >= 1 && d.weekday <= 7;

/**
 * PROG-04 (D-316) : si au moins un jour garni de la routine porte un jour de la semaine, la séance du jour est celle du jour de la semaine de
 * `today` ; un jour sans séance prévue est un jour de repos (le prochain jour prévu est donné) ; une séance manquée est sautée, jamais
 * décalée. FIX-PROGRAMME (C-063) : la séance du jour déjà close aujourd'hui (même routine, même jour, date du début = `today`) n'est pas
 * reproposée : « faite », avec le prochain jour prévu après aujourd'hui. Sans aucun jour rattaché : rotation d'avant (`nextProgramDay`), qui
 * passe déjà au jour suivant. `null` si aucun jour n'a d'exercice.
 */
export function programDayFor(days: readonly ProgramDayLike[], recentClosed: readonly ClosedWorkoutLike[], routineId: string, today: LocalDate): ProgramDayChoice | null {
  const garnished = days.filter((d) => d.exercises.length > 0);
  // Deux jours au même jour de la semaine (fusion de deux appareils) : le premier dans l'ordre de la routine.
  const dated = garnished.filter(hasWeekday).sort((x, y) => x.dayOrder - y.dayOrder || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  if (dated.length === 0) {
    const id = nextProgramDay(days, recentClosed, routineId);
    return id === null ? null : { kind: 'day', dayId: id };
  }
  const wd = weekdayOf(today);
  const todays = dated.find((d) => d.weekday === wd);
  // Jours d'écart (1 à 7) jusqu'au prochain jour prévu APRÈS aujourd'hui ; tri stable : le premier dans l'ordre de la routine à égalité.
  const ahead = (d: { readonly weekday: number }): number => ((d.weekday - wd + 6) % 7) + 1;
  const next = [...dated].sort((a, b) => ahead(a) - ahead(b))[0] as ProgramDayLike & { readonly weekday: number };
  if (todays !== undefined) {
    const doneToday = recentClosed.some((w) => w.routineId === routineId && w.routineDayId === todays.id && w.day === today);
    return doneToday ? { kind: 'done', dayId: todays.id, nextDayId: next.id, nextWeekday: next.weekday as Weekday } : { kind: 'day', dayId: todays.id };
  }
  return { kind: 'rest', nextDayId: next.id, nextWeekday: next.weekday as Weekday };
}

const WEEKDAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;

/** PROG-04 (D-317) : jour de la semaine d'un nom de jour qui COMMENCE par « Lundi », « Mardi »… (mot entier, casse indifférente) ; sinon `null`. */
export function weekdayFromDayName(name: string): Weekday | null {
  const word = /^\s*([a-zA-Z]+)(?![a-zA-ZÀ-ɏ])/.exec(name)?.[1]?.toLowerCase();
  const index = word === undefined ? -1 : (WEEKDAY_NAMES as readonly string[]).indexOf(word);
  return index < 0 ? null : ((index + 1) as Weekday);
}

/** PROG-04 (D-316) : jours d'entraînement déduits des jours garnis rattachés à un jour de la semaine, triés ; `null` sans aucun. */
export function routineTrainingDays(days: readonly ProgramDayLike[]): Weekday[] | null {
  const set = [...new Set(days.filter((d) => d.exercises.length > 0).filter(hasWeekday).map((d) => d.weekday as Weekday))].sort((a, b) => a - b);
  return set.length === 0 ? null : set;
}
