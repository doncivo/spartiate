import { DEFAULT_PROGRESSION_CONFIG } from './config';
import type { DecisionReference, Exercise, ExerciseSession, PrescribeInput, ProgressionEquipment, ProgressionProfileState, RecoverySnapshot, RepTarget, RoutineExerciseSpec } from './types';
import type { IsoDateTime } from '../types';

/**
 * Entrée du moteur de prescription d'un exercice (FIX-0223, D-260) : construite au même endroit pour la séance active (`ExerciseProgression`)
 * et pour l'aperçu de la carte « Séance du jour », afin que la charge annoncée sur la carte soit celle que la séance proposera. Pur.
 */

/** Ce que la base dit de l'exercice (lu par la couche features). */
export interface PrescriptionContext {
  readonly history: readonly ExerciseSession[];
  /** Dernière décision d'une séance close ; une décision sans charge retenue (refus) ne fixe rien. */
  readonly reference: DecisionReference | null;
  readonly profile: ProgressionProfileState | null;
  readonly lastPositionRank: number | null;
  readonly bodyweightKg: number | null;
}

export interface PrescriptionInputArgs {
  readonly exerciseId: string;
  readonly exercise: Exercise | undefined;
  readonly context: PrescriptionContext;
  readonly equipment: ProgressionEquipment | null;
  readonly target: RepTarget;
  readonly now: IsoDateTime;
  readonly recovery: RecoverySnapshot | null;
  readonly deload: boolean;
  /** PROG-01 : décharge d'un cycle de 4 ou 6 semaines (`WeekPlan.deloadSets`, `deloadLoad`). */
  readonly deloadSets?: number;
  readonly deloadLoad?: number;
  readonly positionRank: number;
}

export function prescriptionInputOf(a: PrescriptionInputArgs): PrescribeInput {
  const d = a.context.reference;
  // Référence du moteur : décision d'une séance close avec une valeur retenue (un refus ne fixe rien).
  const lastDecision: DecisionReference | null = d !== null && d.loadKg !== null ? { decidedAt: d.decidedAt, accepted: d.accepted, loadKg: d.loadKg, reps: d.reps } : null;
  const { exercise } = a;
  return {
    exercise: {
      id: a.exerciseId,
      metric: exercise?.metric ?? 'load-reps',
      equipment: exercise?.equipment ?? [],
      ...(exercise === undefined ? {} : { kind: exercise.kind, bodyweightFraction: exercise.bodyweightFraction }),
      ...(exercise?.equipment.includes('assisted-pull-up-machine') === true ? { assisted: true } : {}),
    },
    history: a.context.history,
    lastDecision,
    profile: a.context.profile,
    equipment: a.equipment,
    target: a.target,
    config: DEFAULT_PROGRESSION_CONFIG,
    now: a.now,
    recovery: a.recovery,
    deload: a.deload,
    ...(a.deload && a.deloadSets !== undefined ? { deloadSets: a.deloadSets } : {}),
    ...(a.deload && a.deloadLoad !== undefined ? { deloadLoad: a.deloadLoad } : {}),
    // REV-01 constat 6 : décote de position (§ 11.3) ; rang de référence inconnu → aucun effet.
    positionRank: a.positionRank,
    ...(a.context.lastPositionRank === null ? {} : { lastPositionRank: a.context.lastPositionRank }),
    bodyweightKg: a.context.bodyweightKg,
  };
}

/**
 * Cible d'une ligne de routine telle que la séance la créera (une série de travail par série prévue, plage de la ligne) ; même forme que la
 * cible lue sur les séries de la séance active.
 */
export function routineLineTarget(line: Pick<RoutineExerciseSpec, 'sets' | 'repMin' | 'repMax'>, rir: number | null): RepTarget {
  return { sets: Math.max(1, line.sets), repMin: line.repMin, repMax: Math.max(line.repMin, line.repMax), rir };
}
