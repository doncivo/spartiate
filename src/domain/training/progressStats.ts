import { addDays, weekdayOf } from '../localDate';
import type { LocalDate } from '../types';
import type { FirstWeekday } from '../week';
import { DEFAULT_PROGRESS_CONFIG, type ProgressConfig } from './config';
import type { MesocyclePause } from './mesocycle';
import { routineTrainingDays, type ProgramDayLike } from './programDay';
import type { SetKind } from './session';
import type { MuscleWeight } from './types';

/**
 * Progrès › Entraînement (PROGRES, § 17.1). Règles pures, sans horloge : la date locale du jour et le début de semaine sont fournis ; les
 * entrées ne sont jamais modifiées. Les séances données sont des séances CLOSES (l'appelant lit le repository), rattachées au jour local
 * de leur début.
 */

export interface ProgressSet {
  readonly exerciseId: string;
  readonly setKind: SetKind;
  readonly done: boolean;
}

export interface ProgressWorkout {
  /** Jour local du début de la séance. */
  readonly day: LocalDate;
  readonly sets: readonly ProgressSet[];
}

export interface MuscleVolume {
  readonly muscleId: string;
  /** Séries pondérées par semaine, de la plus ancienne à la semaine en cours (au dixième). */
  readonly perWeek: readonly number[];
  readonly total: number;
}

export interface WeeklyVolume {
  /** Premier jour de chaque semaine, du plus ancien au plus récent. */
  readonly weekStarts: readonly LocalDate[];
  /** Muscles ayant au moins une série dans la fenêtre, par total décroissant puis identifiant. */
  readonly muscles: readonly MuscleVolume[];
  /** Séries comptables d'exercices introuvables (supprimés du contenu), non attribuées. */
  readonly unknownSets: number;
}

export interface VolumeInput {
  readonly workouts: readonly ProgressWorkout[];
  /** Muscles et poids (§ 14.1) d'un exercice ; `null` : exercice introuvable. */
  readonly musclesOf: (exerciseId: string) => readonly MuscleWeight[] | null;
  readonly today: LocalDate;
  readonly firstWeekday?: FirstWeekday;
  readonly weeks?: number;
  readonly config?: ProgressConfig;
}

/*
 * Début de semaine calculé ici (règle de week.ts recopiée, localDate importé directement) : importer week.ts depuis ce bloc à la demande
 * scindait des blocs du départ (week.ts hors du bloc format, localDate hors du bloc d'entrée ; même piège qu'ERGO-02b, mesure du bundle).
 */
const DEFAULT_FIRST_WEEKDAY: FirstWeekday = 'monday';
const FIRST_ISO: Readonly<Record<FirstWeekday, number>> = { monday: 1, saturday: 6, sunday: 7 };
const daysFromWeekStart = (weekday: number, first: FirstWeekday): number => (weekday - FIRST_ISO[first] + 7) % 7;
const weekStartOf = (date: LocalDate, first: FirstWeekday): LocalDate => addDays(date, -daysFromWeekStart(weekdayOf(date), first));
const addWeeks = (weekStart: LocalDate, count: number): LocalDate => addDays(weekStart, count * 7);
const daysSinceWeekStart = (date: LocalDate, first: FirstWeekday): number => daysFromWeekStart(weekdayOf(date), first);

/**
 * Le jour est-il dans une pause (`from` compris, `to` exclu ou pause en cours) ? Règle d'`isPausedOn` (programPause.ts) recopiée : l'importer
 * sortait programPause dans un bloc partagé listé au préchargement du départ (mesure du bundle). Équivalence gardée par progressStats.qa.test.ts.
 */
export const pausedOn = (pauses: readonly MesocyclePause[], date: LocalDate): boolean => pauses.some((p) => p.from <= date && (p.to === null || date < p.to));

const tenth = (n: number): number => Math.round(n * 10) / 10;

/** Index de la semaine (0 = la plus ancienne) de `day`, ou -1 hors fenêtre. Dates ISO comparées comme chaînes. */
function weekIndex(weekStarts: readonly LocalDate[], day: LocalDate, first: FirstWeekday): number {
  return weekStarts.indexOf(weekStartOf(day, first));
}

/** Semaines glissantes se terminant par celle de `today`. */
export function trailingWeeks(today: LocalDate, count: number, first: FirstWeekday = DEFAULT_FIRST_WEEKDAY): LocalDate[] {
  const current = weekStartOf(today, first);
  return Array.from({ length: count }, (_, i) => addWeeks(current, i - count + 1));
}

/**
 * Volume par muscle et par semaine (§ 17.1) : séries validées des types comptés (`volumeSetKinds`) ; chaque série apporte à chaque muscle
 * de l'exercice son poids du contenu (§ 14.1 : principal 1, secondaire selon sa part). Sommes en centièmes entiers puis arrondies au dixième.
 */
export function weeklyMuscleVolume(input: VolumeInput): WeeklyVolume {
  const config = input.config ?? DEFAULT_PROGRESS_CONFIG;
  const first = input.firstWeekday ?? DEFAULT_FIRST_WEEKDAY;
  const weekStarts = trailingWeeks(input.today, input.weeks ?? config.volumeWeeks, first);
  const hundredths = new Map<string, number[]>();
  let unknownSets = 0;
  for (const workout of input.workouts) {
    const index = weekIndex(weekStarts, workout.day, first);
    if (index < 0) continue;
    for (const set of workout.sets) {
      if (!set.done || !config.volumeSetKinds.includes(set.setKind)) continue;
      const muscles = input.musclesOf(set.exerciseId);
      if (muscles === null) {
        unknownSets += 1;
        continue;
      }
      for (const m of muscles) {
        const row = hundredths.get(m.id) ?? weekStarts.map(() => 0);
        row[index] = (row[index] ?? 0) + Math.round(m.weight * 100);
        hundredths.set(m.id, row);
      }
    }
  }
  const muscles = [...hundredths.entries()]
    .map(([muscleId, row]): MuscleVolume => ({ muscleId, perWeek: row.map((h) => tenth(h / 100)), total: tenth(row.reduce((a, b) => a + b, 0) / 100) }))
    .filter((m) => m.total > 0)
    .sort((a, b) => b.total - a.total || (a.muscleId < b.muscleId ? -1 : a.muscleId > b.muscleId ? 1 : 0));
  return { weekStarts, muscles, unknownSets };
}

// --- Constance (PROGRES-b, § 17.1, § 12.6) ---------------------------------------------------------------------------------------------

/** Objectif hebdomadaire du programme suivi, à partir de la semaine de `since` (début du cycle). */
export interface WeeklyTarget {
  readonly perWeek: number;
  readonly since: LocalDate;
}

/**
 * Séances prévues par semaine d'une routine suivie : jours de la semaine rattachés (PROG-04), sinon jours garnis ; `null` si aucun jour
 * garni (aucun objectif).
 */
export function programWeeklyTarget(days: readonly ProgramDayLike[]): number | null {
  const weekdays = routineTrainingDays(days);
  if (weekdays !== null) return weekdays.length;
  const filled = days.filter((d) => d.exercises.length > 0).length;
  return filled === 0 ? null : filled;
}

export interface ConstancyInput {
  /** Jour local du début de chaque séance close (une entrée par séance). */
  readonly days: readonly LocalDate[];
  readonly today: LocalDate;
  /** `null` : aucun programme suivi. */
  readonly target: WeeklyTarget | null;
  /** Pauses du programme suivi (§ 12.6). */
  readonly pauses: readonly MesocyclePause[];
  readonly firstWeekday?: FirstWeekday;
  readonly config?: ProgressConfig;
}

export interface Constancy {
  /** Semaines consécutives atteignant l'objectif (semaine en cours comprise si déjà atteinte). */
  readonly streakWeeks: number;
  readonly thisWeek: { readonly done: number; readonly target: number };
}

/** Objectif de la semaine commençant à `weekStart` : celui du programme dès la semaine de son début, sinon l'objectif par défaut. */
export function weeklyTargetFor(weekStart: LocalDate, target: WeeklyTarget | null, first: FirstWeekday, config: ProgressConfig = DEFAULT_PROGRESS_CONFIG): number {
  return target !== null && weekStart >= weekStartOf(target.since, first) ? target.perWeek : config.defaultWeeklyTarget;
}

const weekHasPause = (weekStart: LocalDate, pauses: readonly MesocyclePause[]): boolean => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).some((day) => pausedOn(pauses, day));

function countByWeek(days: readonly LocalDate[], first: FirstWeekday): Map<LocalDate, number> {
  const counts = new Map<LocalDate, number>();
  for (const day of days) {
    const start = weekStartOf(day, first);
    counts.set(start, (counts.get(start) ?? 0) + 1);
  }
  return counts;
}

/**
 * Streak (§ 17.1) en semaines, en remontant depuis la semaine passée : une semaine atteint l'objectif → comptée ; non atteinte avec un jour
 * de pause → gelée (ni comptée ni cassante, § 12.6) ; sinon la série s'arrête. La semaine en cours s'ajoute si l'objectif est déjà atteint
 * et ne casse jamais la série.
 */
export function constancy(input: ConstancyInput): Constancy {
  const config = input.config ?? DEFAULT_PROGRESS_CONFIG;
  const first = input.firstWeekday ?? DEFAULT_FIRST_WEEKDAY;
  const counts = countByWeek(input.days, first);
  const current = weekStartOf(input.today, first);
  const thisWeek = { done: counts.get(current) ?? 0, target: weeklyTargetFor(current, input.target, first, config) };
  const starts = [...input.days, ...input.pauses.map((p) => p.from)].map((day) => weekStartOf(day, first));
  const earliest = starts.reduce<LocalDate | null>((min, w) => (min === null || w < min ? w : min), null);
  let streak = thisWeek.done >= thisWeek.target ? 1 : 0;
  for (let week = addWeeks(current, -1); earliest !== null && week >= earliest; week = addWeeks(week, -1)) {
    if ((counts.get(week) ?? 0) >= weeklyTargetFor(week, input.target, first, config)) streak += 1;
    else if (!weekHasPause(week, input.pauses)) break;
  }
  return { streakWeeks: streak, thisWeek };
}

export interface CalendarDay {
  readonly date: LocalDate;
  readonly sessions: number;
  readonly paused: boolean;
  readonly today: boolean;
}

export interface MonthCalendar {
  /** `AAAA-MM`. */
  readonly month: string;
  /** Cases de la grille, semaine par semaine ; `null` : case vide avant le 1er. */
  readonly cells: readonly (CalendarDay | null)[];
}

/** Calendrier du mois de `today` (§ 17.1) : séances par jour, jours en pause, jour courant ; grille au début de semaine réglé. */
export function monthCalendar(input: { readonly today: LocalDate; readonly days: readonly LocalDate[]; readonly pauses: readonly MesocyclePause[]; readonly firstWeekday?: FirstWeekday }): MonthCalendar {
  const [year, month] = input.today.split('-').map(Number) as [number, number];
  // Premier du mois et nombre de jours sans parseLocalDate, daysInMonth ni makeLocalDate : importés ici, ils entraient dans le bloc d'entrée (mesure du bundle).
  const firstDay = `${input.today.slice(0, 7)}-01` as LocalDate;
  const monthDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = daysSinceWeekStart(firstDay, input.firstWeekday ?? DEFAULT_FIRST_WEEKDAY);
  const perDay = new Map<LocalDate, number>();
  for (const day of input.days) perDay.set(day, (perDay.get(day) ?? 0) + 1);
  const cells: (CalendarDay | null)[] = Array.from({ length: lead }, () => null);
  for (let i = 0; i < monthDays; i += 1) {
    const date = addDays(firstDay, i);
    cells.push({ date, sessions: perDay.get(date) ?? 0, paused: pausedOn(input.pauses, date), today: date === input.today });
  }
  return { month: firstDay.slice(0, 7), cells };
}

// --- Adhérence (PROGRES-d, I2 § 8) -----------------------------------------------------------------------------------------------------

export interface Adherence {
  /** Pourcentage entier des séances prévues faites. */
  readonly percent: number;
  readonly done: number;
  readonly planned: number;
  /** Semaines comptées (sur `adherenceWeeks`). */
  readonly weeks: number;
}

/**
 * Adhérence (I2) : part des séances prévues faites sur les `adherenceWeeks` dernières semaines COMPLÈTES (la semaine en cours exclue). Prévues
 * = objectif du programme suivi ; faites = séances closes de la semaine plafonnées à l'objectif (une séance en plus ne compense pas une autre
 * semaine). Semaine antérieure au début du programme ou contenant un jour de pause : non comptée. Sans programme, ou aucune semaine
 * comptée : `null`.
 */
export function adherence(input: ConstancyInput): Adherence | null {
  const config = input.config ?? DEFAULT_PROGRESS_CONFIG;
  const first = input.firstWeekday ?? DEFAULT_FIRST_WEEKDAY;
  const target = input.target;
  if (target === null || target.perWeek <= 0) return null;
  const counts = countByWeek(input.days, first);
  const since = weekStartOf(target.since, first);
  const current = weekStartOf(input.today, first);
  let done = 0;
  let planned = 0;
  let weeks = 0;
  for (let i = 1; i <= config.adherenceWeeks; i += 1) {
    const week = addWeeks(current, -i);
    if (week < since || weekHasPause(week, input.pauses)) continue;
    weeks += 1;
    planned += target.perWeek;
    done += Math.min(counts.get(week) ?? 0, target.perWeek);
  }
  return weeks === 0 ? null : { percent: Math.round((done / planned) * 100), done, planned, weeks };
}
