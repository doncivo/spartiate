import { DEFAULT_GENERATION_CONFIG } from '../../../domain/training/config';
import {
  type Exercise,
  type ExercisePattern,
  type GeneratedSession,
  type GenerateSessionInput,
  type RoutineDaySpec,
  type SetStyle,
  type SplitKind,
  type VarietyLevel,
  type WorkoutWithSets,
} from '../../../domain/training';
import type { IsoDateTime } from '../../../domain/types';
import type { DataAccess } from '../../../db/repositories/dataAccess';
import type { TrainingContent } from '../content';
import type { AnyProfile } from '../trainingState';

/**
 * Pont entre l'écran « Séance proposée » et `generateSession` (I3-01). Les réglages sont éphémères (état de l'écran) : rien n'est enregistré
 * avant « Commencer cette séance », la routine source n'est jamais écrite.
 */

export interface GenerationSettings {
  readonly mode: 'guide' | 'libre' | 'maison';
  readonly split: SplitKind;
  /** Split personnalisé : groupes cochés pour le jour affiché (affectation explicite d'Ali, D-73 point 2). */
  readonly customGroups: readonly string[];
  readonly variety: VarietyLevel;
  readonly style: SetStyle;
  readonly priorities: readonly string[];
  readonly painfulPatterns: readonly ExercisePattern[];
  readonly budgetMin: number | null;
}

/** Split par défaut d'après le nombre de jours de la routine (bornes du § 12.1) ; Ali peut le changer. */
export function defaultSplitFor(dayCount: number): SplitKind {
  if (dayCount <= 3) return 'full-body';
  if (dayCount === 4) return 'upper-lower';
  if (dayCount <= 6) return 'ppl';
  return 'custom';
}

/** Réglages par défaut prudents : Guidé, aucune rotation (Constante), séries droites, sans budget, ni douleur ni priorité. */
export function defaultGenerationSettings(dayCount: number): GenerationSettings {
  return { mode: 'guide', split: defaultSplitFor(dayCount), customGroups: [], variety: 'consistent', style: 'straight', priorities: [], painfulPatterns: [], budgetMin: null };
}

export interface GenerationSource {
  readonly days: readonly RoutineDaySpec[];
  /** Origine des rotations : création de la routine. */
  readonly startedAt: IsoDateTime;
}

export interface GenerationData {
  readonly exercises: readonly Exercise[];
  readonly active: Pick<AnyProfile, 'kind' | 'inventory'>;
  readonly content: Pick<TrainingContent, 'groupOfMuscle'>;
}

export function buildGenerationInput(data: GenerationData, source: GenerationSource, dayIndex: number, settings: GenerationSettings, now: IsoDateTime): GenerateSessionInput {
  return {
    day: dayIndex,
    program: {
      mode: settings.mode,
      libreVariant: null,
      split: settings.split,
      customDays: source.days.map((_, i) => (i === dayIndex ? settings.customGroups : [])),
      variety: settings.variety,
      style: settings.style,
      priorities: settings.priorities,
      painfulPatterns: settings.painfulPatterns,
      days: source.days,
      startedAt: source.startedAt,
    },
    library: { exercises: data.exercises, groupOfMuscle: data.content.groupOfMuscle },
    equipment: { kind: data.active.kind, inventory: data.active.inventory },
    profile: null,
    recovery: null,
    timeBudgetMin: settings.budgetMin,
    week: null,
    mesocycleIndex: null,
    config: DEFAULT_GENERATION_CONFIG,
    now,
  };
}

/**
 * Confirmation : une séance libre nommée comme le jour, avec les exercices, séries, plages et repos proposés, dans UNE transaction (échec :
 * rien n'est écrit). Séance non liée à la routine : celle-ci n'est ni lue ni modifiée à la clôture. Un exercice présent deux fois dans la
 * routine reçoit ses séries supplémentaires à la suite (le repository refuse un second ajout du même exercice).
 */
export async function startGeneratedSession(access: DataAccess, session: GeneratedSession): Promise<WorkoutWithSets> {
  return access.transaction(async (repos) => {
    const workouts = await repos.workouts();
    const workout = await workouts.start({ source: 'empty', name: session.dayName });
    const added = new Set<string>();
    for (const e of session.exercises) {
      if (added.has(e.exerciseId)) {
        for (let i = 0; i < e.sets; i++) await workouts.addSet(workout.id, e.exerciseId);
        continue;
      }
      added.add(e.exerciseId);
      await workouts.addExercise(workout.id, { exerciseId: e.exerciseId, exerciseName: e.exerciseName, sets: e.sets, targetRepsMin: e.repMin, targetRepsMax: e.repMax, targetRestSec: e.restSec });
    }
    const full = await workouts.get(workout.id);
    if (full === null) throw new Error('séance créée introuvable');
    return full;
  });
}
