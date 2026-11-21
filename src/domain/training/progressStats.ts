import type { LocalDate } from '../types';
import { addWeeks, weekStartOf, DEFAULT_FIRST_WEEKDAY, type FirstWeekday } from '../week';
import { DEFAULT_PROGRESS_CONFIG, type ProgressConfig } from './config';
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
