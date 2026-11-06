import type { SetEntry, SetKind, WorkoutSet, WorkoutSource, WorkoutWithSets } from '../../domain/training';

/**
 * Séance active locale (tables `workout` et `workout_set`, I1-02 ; D-27 : jamais publiée avant clôture, I1-03).
 *
 * - Une seule séance ouverte (`ended_at` nul, non supprimée) : `start` en présence d'une autre lève `'conflict'`.
 * - Références logiques (aucune clé étrangère) : routine, jour, exercice (`exerciseName` fige le nom, D-71).
 * - `'invalid'` : saisie refusée par les règles du domaine ou séance close (rien n'est écrit) ; `'not-found'` : séance, série, routine,
 *   jour ou source de copie absent ou supprimé ; `'conflict'` : séance déjà ouverte, identifiant ou exercice déjà présent.
 * - Les écritures multiples (`start`, `addExercise`, `addSet`, `removeSet`, `removeExercise`, `discard`) doivent être appelées dans
 *   `DataAccess.transaction` pour être atomiques ; `validateSet`, `updateSet`, les fonctions de repos écrivent une seule ligne.
 * - Les identifiants omis sont fabriqués par un `IdGenerator` (UUID) injecté dans la fabrique ; les dates viennent du `WriteStamper`.
 * - Aucune valeur de progression n'est calculée (I2) : les cibles sont celles de la routine ou de la séance copiée.
 */

export interface StartWorkoutInput {
  readonly source: WorkoutSource;
  /** Identifiant de la séance (UUID) ; fabriqué si omis. */
  readonly id?: string;
  /** Libellé ; par défaut le nom du jour (routine), de la séance copiée, ou vide (séance libre, libellé laissé à l'interface). */
  readonly name?: string;
  /** `routine` : routine et jour obligatoires. */
  readonly routineId?: string;
  readonly dayId?: string;
  /** `copy` : séance passée à copier (obligatoire). */
  readonly copyFromId?: string;
}

export interface AddExerciseInput {
  readonly exerciseId: string;
  readonly exerciseName: string;
  /** Nombre de séries de travail créées (défaut 1, de 1 à 20). */
  readonly sets?: number;
  readonly targetRepsMin?: number | null;
  readonly targetRepsMax?: number | null;
  readonly targetLoadKg?: number | null;
  readonly targetRestSec?: number | null;
}

export interface AddSetOptions {
  readonly id?: string;
  /** Défaut `work`. Les cibles sont celles de la dernière série de l'exercice. */
  readonly setKind?: SetKind;
}

/** Saisie fournie à la validation : les champs omis gardent leur valeur actuelle (jamais la cible). */
export type SetEntryInput = Partial<SetEntry>;

export interface SetPatch extends SetEntryInput {
  readonly setKind?: SetKind;
  readonly targetRepsMin?: number | null;
  readonly targetRepsMax?: number | null;
  readonly targetLoadKg?: number | null;
}

/** Repos en cours de la séance ouverte : seule `endAt` fait foi (temps restant : `restRemainingMs(endAt, maintenant)`). */
export interface RestTimer {
  readonly workoutId: string;
  /** Date de fin, ISO UTC. */
  readonly endAt: string;
  /** Durée totale lancée, prolongations comprises. */
  readonly seconds: number;
}

export interface WorkoutRepository {
  start(input: StartWorkoutInput): Promise<WorkoutWithSets>;
  /** Séance inachevée (la plus récente), séries dans l'ordre ; `null` si aucune. */
  getOpen(): Promise<WorkoutWithSets | null>;
  get(id: string): Promise<WorkoutWithSets | null>;
  /** Ajoute un exercice en fin de séance ; déjà présent : `'conflict'`. Retourne la séance. */
  addExercise(workoutId: string, input: AddExerciseInput): Promise<WorkoutWithSets>;
  /** Supprime (logiquement) toutes les séries de l'exercice ; positions renumérotées. Retourne la séance. */
  removeExercise(workoutId: string, exerciseId: string): Promise<WorkoutWithSets>;
  /** Ajoute une série après la dernière de l'exercice (qui doit déjà figurer dans la séance). */
  addSet(workoutId: string, exerciseId: string, options?: AddSetOptions): Promise<WorkoutSet>;
  /** Corrige la saisie ou le type d'une série sans changer `done`. */
  updateSet(setId: string, patch: SetPatch): Promise<WorkoutSet>;
  /** Valide la série : écrit `done = 1` et `done_at` avec la saisie fusionnée ; refusée (`'invalid'`) si la saisie ne passe pas `validateSetEntry`. */
  validateSet(setId: string, entry?: SetEntryInput): Promise<WorkoutSet>;
  /** Remet la série à faire (saisie conservée). */
  unvalidateSet(setId: string): Promise<WorkoutSet>;
  removeSet(setId: string): Promise<void>;
  /** Démarre un repos de la séance ouverte (`seconds` entier de 1 à 3600) : persiste la date de fin. */
  startRest(input: { readonly seconds: number }): Promise<RestTimer>;
  /** Prolonge le repos (défaut +30 s), depuis l'échéance si elle est future, sinon depuis maintenant. */
  extendRest(addSeconds?: number): Promise<RestTimer>;
  /** Efface l'échéance. Sans effet si aucun repos. */
  skipRest(): Promise<void>;
  getRest(): Promise<RestTimer | null>;
  /** Abandon d'une séance ouverte : suppression logique de la séance et de ses séries. Séance close : `'invalid'`. */
  discard(id: string): Promise<void>;
}
