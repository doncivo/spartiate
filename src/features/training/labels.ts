import type { EquipmentProfileKind, ExerciseKind, ExerciseMetric, ExercisePattern } from '../../domain/training';
import { tTraining, type TrainingTextKey } from '../../i18n/trainingText';

/** Libellés français des listes fermées de l'entraînement. */

export const PATTERN_KEY = {
  'push-horizontal': 'patternPushHorizontal',
  'push-vertical': 'patternPushVertical',
  'pull-horizontal': 'patternPullHorizontal',
  'pull-vertical': 'patternPullVertical',
  hinge: 'patternHinge',
  squat: 'patternSquat',
  lunge: 'patternLunge',
  carry: 'patternCarry',
  core: 'patternCore',
  isolation: 'patternIsolation',
} as const satisfies Record<ExercisePattern, TrainingTextKey>;

export const KIND_KEY = { compound: 'kindCompound', isolation: 'kindIsolation' } as const satisfies Record<ExerciseKind, TrainingTextKey>;

export const METRIC_KEY = {
  'load-reps': 'metricLoadReps',
  'bodyweight-reps': 'metricBodyweightReps',
  time: 'metricTime',
  distance: 'metricDistance',
} as const satisfies Record<ExerciseMetric, TrainingTextKey>;

export const PROFILE_KIND_KEY = { salle: 'kindSalle', maison: 'kindMaison', voyage: 'kindVoyage' } as const satisfies Record<EquipmentProfileKind, TrainingTextKey>;

const GROUP_KEY: Readonly<Record<string, TrainingTextKey>> = {
  chest: 'groupChest',
  back: 'groupBack',
  shoulders: 'groupShoulders',
  biceps: 'groupBiceps',
  triceps: 'groupTriceps',
  quadriceps: 'groupQuadriceps',
  hamstrings: 'groupHamstrings',
  glutes: 'groupGlutes',
  calves: 'groupCalves',
  abs: 'groupAbs',
  forearms: 'groupForearms',
};

/** Groupe d'affichage : libellé français, sinon l'identifiant (groupe ajouté par une version plus récente du contenu). */
export const groupLabel = (group: string): string => {
  const key = GROUP_KEY[group];
  return key ? tTraining(key) : group;
};
