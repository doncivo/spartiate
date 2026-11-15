import { t } from '../../i18n';

/**
 * Types d'éléments d'un échec de réintégration (Y-07, section VERSION de Réglages › Synchronisation › Détails), sortis de `syncText.ts`
 * (SYNC-01) : seul l'écran Détails, chargé à la demande, les nomme ; la table des clés n'est plus dans le bundle de départ.
 */
const KIND_KEYS = {
  space: 'sync.version.kinds.space',
  project: 'sync.version.kinds.project',
  recurrence: 'sync.version.kinds.recurrence',
  goal: 'sync.version.kinds.goal',
  task: 'sync.version.kinds.task',
  routine: 'sync.version.kinds.routine',
  routine_log: 'sync.version.kinds.routineLog',
  routine_pause: 'sync.version.kinds.routinePause',
  reminder: 'sync.version.kinds.reminder',
  event: 'sync.version.kinds.event',
  checklist: 'sync.version.kinds.checklist',
  checklist_item: 'sync.version.kinds.checklistItem',
  focus_session: 'sync.version.kinds.focusSession',
  calendar_account: 'sync.version.kinds.calendarAccount',
  holiday: 'sync.version.kinds.holiday',
  settings: 'sync.version.kinds.settings',
  profile: 'sync.version.kinds.profile',
  body_weight: 'sync.version.kinds.bodyWeight',
  exercise: 'sync.version.kinds.exercise',
  equipment_profile: 'sync.version.kinds.equipmentProfile',
  routine_day: 'sync.version.kinds.routineDay',
  routine_exercise: 'sync.version.kinds.routineExercise',
  workout: 'sync.version.kinds.workout',
  workout_set: 'sync.version.kinds.workoutSet',
  progression_profile: 'sync.version.kinds.progressionProfile',
  recommendation_decision: 'sync.version.kinds.recommendationDecision',
  mesocycle: 'sync.version.kinds.mesocycle',
  food: 'sync.version.kinds.food',
  food_portion: 'sync.version.kinds.foodPortion',
  meal_entry: 'sync.version.kinds.mealEntry',
  nutrition_target: 'sync.version.kinds.nutritionTarget',
  day_completeness: 'sync.version.kinds.dayCompleteness',
  recipe: 'sync.version.kinds.recipe',
  recipe_ingredient: 'sync.version.kinds.recipeIngredient',
  recovery_day: 'sync.version.kinds.recoveryDay',
  muscle_recovery: 'sync.version.kinds.muscleRecovery',
  recovery_factor: 'sync.version.kinds.recoveryFactor',
  measurement: 'sync.version.kinds.measurement',
  progress_photo: 'sync.version.kinds.progressPhoto',
  food_favorite: 'sync.version.kinds.foodFavorite',
  data_reset: 'sync.version.kinds.dataReset',
  supplement: 'sync.version.kinds.supplement',
  supplement_intake: 'sync.version.kinds.supplementIntake',
  cardio_session: 'sync.version.kinds.cardioSession',
} as const;

/** Types d'éléments d'un échec (« tâches, événements »), d'après les tables du catalogue. */
export function failureKinds(tables: readonly string[]): string {
  const labels = tables.map((table) => (Object.prototype.hasOwnProperty.call(KIND_KEYS, table) ? t(KIND_KEYS[table as keyof typeof KIND_KEYS]) : t('sync.version.kinds.other')));
  return [...new Set(labels)].join(', ');
}
