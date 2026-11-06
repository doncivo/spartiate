import type { DeviceId, Hlc, IsoDateTime } from '../types';
import { REPS_MAX, RIR_MAX } from './routineRules';
import type { RoutineExerciseSpec } from './types';

/**
 * Séance active (PRD § 13.1–13.4, 13.7–13.8 ; I1-02, D-27, D-71). Module pur, sans horloge ni stockage : le temps est toujours un argument.
 *
 * Une séance ouverte est LOCALE (jamais publiée avant clôture, I1-03). Les références à la routine, au jour et à l'exercice sont logiques
 * (aucune clé étrangère) ; `exerciseName` fige le nom à l'ajout. Aucune cible de progression n'est inventée ici (I2) : les valeurs par
 * défaut de saisie ne sont que celles de la routine ou de la séance copiée.
 */

export const SET_KINDS = ['warmup', 'work', 'drop', 'partial', 'timed'] as const;
export const WORKOUT_SOURCES = ['empty', 'routine', 'copy'] as const;
export type SetKind = (typeof SET_KINDS)[number];
export type WorkoutSource = (typeof WORKOUT_SOURCES)[number];

export const LOAD_MAX_KG = 1000;
export const DURATION_MAX_SEC = 36_000;
/** Durée maximale d'un repos programmé ou prolongé (secondes). */
export const REST_TIMER_MAX_SEC = 3600;
/** Prolongation d'un repos par « +30 s ». */
export const REST_EXTEND_SEC = 30;
/**
 * Séries d'une séance, au plus (I1-03) : la séance close et toutes ses séries partent en un groupe de même hlc, qui doit tenir dans un
 * appel d’ajout au journal (1 Mio chiffré, ADR 0011) ; 200 séries en occupent moins du tiers (test de la borne).
 */
export const WORKOUT_SETS_MAX = 200;
/** Séance ouverte abandonnée (supprimée logiquement, jamais publiée) effacée physiquement au démarrage d'une séance après ce délai. */
export const ABANDONED_WORKOUT_KEEP_MS = 30 * 86_400_000;

interface RowMeta {
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt: IsoDateTime | null;
  readonly deviceId: DeviceId;
  readonly hlc: Hlc;
}

export interface Workout extends RowMeta {
  readonly id: string;
  /** Référence logique (aucune clé étrangère) ; null hors départ depuis une routine. */
  readonly routineId: string | null;
  readonly routineDayId: string | null;
  readonly name: string;
  readonly startedAt: IsoDateTime;
  /** Null tant que la séance est ouverte (clôture : I1-03). */
  readonly endedAt: IsoDateTime | null;
  readonly source: WorkoutSource;
  readonly copiedFromWorkoutId: string | null;
  /** Date de fin du repos en cours (ISO UTC) ; null sans repos. Seule source du temps restant. */
  readonly restTimerEndAt: IsoDateTime | null;
  /** Durée totale du dernier repos lancé (secondes). */
  readonly restTimerSeconds: number;
  readonly notes: string;
}

export interface WorkoutSet extends RowMeta {
  readonly id: string;
  readonly workoutId: string;
  /** Référence logique à un exercice embarqué (kebab-case) ou personnalisé (UUID) ; `exerciseName` en fige le nom (D-71). */
  readonly exerciseId: string;
  readonly exerciseName: string;
  /** Rang de la série dans la séance (0, 1, 2…, contigu, les séries d'un exercice sont voisines). */
  readonly position: number;
  readonly setKind: SetKind;
  readonly targetRepsMin: number | null;
  readonly targetRepsMax: number | null;
  readonly targetLoadKg: number | null;
  readonly targetRestSec: number | null;
  readonly reps: number | null;
  readonly loadKg: number | null;
  readonly durationSec: number | null;
  readonly rir: number | null;
  readonly done: boolean;
  readonly doneAt: IsoDateTime | null;
  /** Dernière correction d'une série d'une séance close (§ 13.8, I1-03) ; absent ou null : jamais corrigée. */
  readonly correctedAt?: IsoDateTime | null;
}

export interface WorkoutWithSets extends Workout {
  /** Séries non supprimées, par `position`. */
  readonly sets: readonly WorkoutSet[];
}

// -----------------------------------------------------------------------------------------------------------------------------------
// Saisie
// -----------------------------------------------------------------------------------------------------------------------------------

/** Valeurs saisies d'une série (null : non renseigné). */
export interface SetEntry {
  readonly reps: number | null;
  readonly loadKg: number | null;
  readonly durationSec: number | null;
  readonly rir: number | null;
}

export type SetEntryIssue = 'reps' | 'load' | 'duration' | 'rir' | 'empty';

const isInt = (n: number, min: number, max: number): boolean => Number.isInteger(n) && n >= min && n <= max;

/** Bornes de chaque valeur renseignée (sans exiger qu'une valeur le soit) : sert à corriger une série sans la valider. */
export function validateSetBounds(entry: SetEntry): SetEntryIssue[] {
  const issues: SetEntryIssue[] = [];
  if (entry.reps !== null && !isInt(entry.reps, 1, REPS_MAX)) issues.push('reps');
  if (entry.loadKg !== null && !(Number.isFinite(entry.loadKg) && entry.loadKg >= 0 && entry.loadKg <= LOAD_MAX_KG)) issues.push('load');
  if (entry.durationSec !== null && !isInt(entry.durationSec, 1, DURATION_MAX_SEC)) issues.push('duration');
  if (entry.rir !== null && !isInt(entry.rir, 0, RIR_MAX)) issues.push('rir');
  return issues;
}

/**
 * Règles de validation d'une série : bornes, et au moins des répétitions ou une durée ; une série chronométrée exige une durée. Il n'y a
 * jamais de validation implicite : une série sans saisie ne devient pas une série de travail réussie.
 */
export function validateSetEntry(entry: SetEntry, kind: SetKind): SetEntryIssue[] {
  const issues = validateSetBounds(entry);
  if (kind === 'timed') {
    if (entry.durationSec === null && !issues.includes('duration')) issues.push('duration');
  } else if (entry.reps === null && entry.durationSec === null) {
    issues.push('empty');
  }
  return issues;
}

/** Série de travail réussie : validée, hors échauffement, avec une saisie conforme. */
export function isCompletedWorkSet(set: WorkoutSet): boolean {
  return set.done && set.setKind !== 'warmup' && validateSetEntry(entryOf(set), set.setKind).length === 0;
}

/** Valeurs actuellement saisies (jamais les cibles). */
export function entryOf(set: WorkoutSet): SetEntry {
  return { reps: set.reps, loadKg: set.loadKg, durationSec: set.durationSec, rir: set.rir };
}

/**
 * Pré-remplissage de la saisie : la valeur déjà saisie, sinon la cible explicite de la routine ou de la séance copiée. Une plage de
 * répétitions n'est pas pré-remplie (choisir une borne serait inventer une cible) ; une cible unique l'est.
 */
export function defaultEntry(set: WorkoutSet): SetEntry {
  const single = set.targetRepsMin !== null && set.targetRepsMin === set.targetRepsMax ? set.targetRepsMin : null;
  const timed = set.setKind === 'timed';
  return {
    reps: set.reps ?? (timed ? null : single),
    loadKg: set.loadKg ?? set.targetLoadKg,
    durationSec: set.durationSec ?? (timed ? single : null),
    rir: set.rir,
  };
}

// -----------------------------------------------------------------------------------------------------------------------------------
// Plans de départ
// -----------------------------------------------------------------------------------------------------------------------------------

/** Série à créer au démarrage ; les identifiants et horodatages sont ajoutés par le repository. */
export interface PlannedSet {
  readonly exerciseId: string;
  readonly exerciseName: string;
  readonly setKind: SetKind;
  readonly targetRepsMin: number | null;
  readonly targetRepsMax: number | null;
  readonly targetLoadKg: number | null;
  readonly targetRestSec: number | null;
}

/** Séries d'un jour de routine : lignes par position, `sets` séries de travail chacune, cibles de la routine, aucune charge. */
export function planFromRoutineDay(lines: readonly RoutineExerciseSpec[]): PlannedSet[] {
  return [...lines]
    .sort((a, b) => a.position - b.position)
    .flatMap((line) =>
      Array.from({ length: line.sets }, (): PlannedSet => ({
        exerciseId: line.exerciseId,
        exerciseName: line.exerciseName,
        setKind: 'work',
        targetRepsMin: line.repMin,
        targetRepsMax: line.repMax,
        targetLoadKg: null,
        targetRestSec: line.restSec,
      })),
    );
}

/** Copie d'une séance passée (§ 13.8) : séries validées, dans l'ordre ; les dernières valeurs deviennent les cibles. */
export function planFromPastWorkout(past: WorkoutWithSets): PlannedSet[] {
  return [...past.sets]
    .filter((s) => s.done)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    .map((s): PlannedSet => {
      const target = s.setKind === 'timed' ? s.durationSec : s.reps;
      return {
        exerciseId: s.exerciseId,
        exerciseName: s.exerciseName,
        setKind: s.setKind,
        targetRepsMin: target,
        targetRepsMax: target,
        targetLoadKg: s.loadKg,
        targetRestSec: s.targetRestSec,
      };
    });
}

// -----------------------------------------------------------------------------------------------------------------------------------
// Lecture : blocs, résumé, repos, reprise
// -----------------------------------------------------------------------------------------------------------------------------------

export interface ExerciseBlock {
  readonly exerciseId: string;
  readonly exerciseName: string;
  readonly sets: readonly WorkoutSet[];
}

const byPosition = (a: WorkoutSet, b: WorkoutSet): number => a.position - b.position || a.id.localeCompare(b.id);

/** Séries regroupées par exercice, dans l'ordre de la première série de chacun. */
export function groupByExercise(sets: readonly WorkoutSet[]): ExerciseBlock[] {
  const blocks = new Map<string, { exerciseId: string; exerciseName: string; sets: WorkoutSet[] }>();
  for (const set of [...sets].sort(byPosition)) {
    const block = blocks.get(set.exerciseId) ?? { exerciseId: set.exerciseId, exerciseName: set.exerciseName, sets: [] };
    block.sets.push(set);
    blocks.set(set.exerciseId, block);
  }
  return [...blocks.values()];
}

export interface SetsSummary {
  /** Séries validées / prévues (échauffements compris). */
  readonly validated: number;
  readonly planned: number;
  /** Séries hors échauffement. */
  readonly validatedWork: number;
  readonly plannedWork: number;
}

export function summarizeSets(sets: readonly WorkoutSet[]): SetsSummary {
  const work = sets.filter((s) => s.setKind !== 'warmup');
  return {
    validated: sets.filter((s) => s.done).length,
    planned: sets.length,
    validatedWork: work.filter((s) => s.done).length,
    plannedWork: work.length,
  };
}

/** Temps de repos restant en ms, recalculé depuis la date de fin (jamais un compteur) ; 0 si absente, invalide ou écoulée. */
export function restRemainingMs(endAtIso: string | null, nowMs: number): number {
  if (endAtIso === null) return 0;
  const end = Date.parse(endAtIso);
  return Number.isNaN(end) ? 0 : Math.max(0, end - nowMs);
}

/** Valide une durée de repos en secondes (entier de 1 à `REST_TIMER_MAX_SEC`). */
export const isRestSeconds = (seconds: number): boolean => isInt(seconds, 1, REST_TIMER_MAX_SEC);

/** Date de fin d'un repos démarré à `nowMs`. */
export function restEndAt(nowMs: number, seconds: number): IsoDateTime {
  return new Date(nowMs + seconds * 1000).toISOString() as IsoDateTime;
}

/** Prolonge le repos : depuis l'échéance en cours si elle est future, sinon depuis maintenant. */
export function extendRestEnd(endAtIso: string | null, nowMs: number, addSec: number = REST_EXTEND_SEC): IsoDateTime {
  const end = endAtIso === null ? Number.NaN : Date.parse(endAtIso);
  const base = !Number.isNaN(end) && end > nowMs ? end : nowMs;
  return new Date(base + addSec * 1000).toISOString() as IsoDateTime;
}

export interface RestState {
  readonly endAt: IsoDateTime;
  readonly remainingMs: number;
  readonly expired: boolean;
}

export interface ResumeState {
  readonly workout: Workout;
  /** Séries par position. */
  readonly sets: readonly WorkoutSet[];
  readonly blocks: readonly ExerciseBlock[];
  readonly summary: SetsSummary;
  /** Première série non validée, dans l'ordre ; null si tout est validé. */
  readonly nextSetId: string | null;
  /** Null sans repos enregistré. */
  readonly rest: RestState | null;
}

/** État à restaurer à la réouverture de l'app (verrouillage, fermeture forcée, redémarrage) ; null sans séance ouverte. */
export function resumeState(workout: WorkoutWithSets | null, nowMs: number): ResumeState | null {
  if (workout === null) return null;
  const { sets: rawSets, ...header } = workout;
  const sets = [...rawSets].sort(byPosition);
  const remainingMs = restRemainingMs(header.restTimerEndAt, nowMs);
  return {
    workout: header,
    sets,
    blocks: groupByExercise(sets),
    summary: summarizeSets(sets),
    nextSetId: sets.find((s) => !s.done)?.id ?? null,
    rest: header.restTimerEndAt === null ? null : { endAt: header.restTimerEndAt, remainingMs, expired: remainingMs === 0 },
  };
}
