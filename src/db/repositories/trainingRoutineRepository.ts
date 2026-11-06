import type { Routine, RoutineDay, RoutineDayInput, RoutineExercise, RoutineExerciseInput, RoutineInput, RoutineMode, RoutineTree } from '../../domain/training';

/**
 * Routines d'entraînement (tables `routine`, `routine_day`, `routine_exercise`, I1-01). Distinct de `routineRepository.ts`, qui sert
 * l'ancien modèle de routines de calendrier (banc legacy D-67).
 *
 * `exerciseId` d'une ligne est une référence logique (P-09) : identifiant embarqué, UUID personnalisé ou inconnu, jamais vérifié contre
 * une table. `exerciseName` en fige le nom (D-71). Les écritures validées par `validateRoutine*` du domaine (`'invalid'`, rien n'est
 * écrit) ; collision d'identifiant `'conflict'` ; parent absent ou supprimé `'not-found'`. Les écritures multiples (`create` d'un arbre,
 * `removeDay`, `softDelete`) doivent être appelées dans `DataAccess.transaction` pour être atomiques.
 */
export interface TrainingRoutineRepository {
  /** Arbre complet (routine, jours, lignes) ; identifiants fournis par l'appelant. */
  create(input: RoutineInput): Promise<RoutineTree>;
  /** Arbre sans suppression, jours par `day_order`, lignes par `position` ; `null` si absente ou supprimée. */
  get(id: string): Promise<RoutineTree | null>;
  /** En-têtes des routines actives, triés par nom. */
  list(): Promise<Routine[]>;
  update(id: string, patch: { readonly name?: string; readonly mode?: RoutineMode }): Promise<Routine>;
  /** Suppression logique de la routine, de ses jours et de leurs lignes. */
  softDelete(id: string): Promise<void>;
  addDay(routineId: string, day: RoutineDayInput): Promise<RoutineDay>;
  updateDay(id: string, patch: { readonly name?: string; readonly dayOrder?: number }): Promise<RoutineDay>;
  /** Suppression logique du jour et de ses lignes. */
  removeDay(id: string): Promise<void>;
  addExercise(dayId: string, line: RoutineExerciseInput): Promise<RoutineExercise>;
  updateExercise(id: string, patch: Partial<Omit<RoutineExerciseInput, 'id'>>): Promise<RoutineExercise>;
  removeExercise(id: string): Promise<void>;
}
