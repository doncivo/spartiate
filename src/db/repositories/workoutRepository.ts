import type { RoutineDiff, SetEntry, SetKind, Workout, WorkoutSet, WorkoutSource, WorkoutSummary, WorkoutWithSets } from '../../domain/training';

/**
 * Séance locale puis close (tables `workout` et `workout_set`, I1-02 / I1-03 ; D-27 : une séance ouverte n'est jamais publiée ; la
 * clôture la rend publiable avec toutes ses séries, d'un bloc).
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
  /** Séances closes (`ended_at` non nul, non supprimées), de la plus récente à la plus ancienne : sources proposées pour une copie (§ 13.8). */
  listClosed(limit?: number): Promise<readonly Workout[]>;
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

  // --- I1-03 : clôture, journal, correction, suppression (D-27, § 13.5, § 13.8) -------------------------------------------------------

  /**
   * Clôt la séance, tout ou rien (hors transaction elle ouvre la sienne ; dans `DataAccess.transaction` elle s’y inscrit). Les séries supprimées pendant la séance (jamais publiées) sont
   * effacées, chaque série restante reçoit le tampon de la clôture, puis `ended_at` est posé avec ce même tampon : le déclencheur met la
   * séance et toutes ses séries en file ensemble (un seul hlc, publication atomique). Repos en cours effacé. Déjà close : rien n'est écrit
   * (`alreadyClosed`, rejeu idempotent). Absente ou supprimée : `'not-found'` ; aucune série validée : `'invalid'` (abandonner la séance).
   */
  close(workoutId: string): Promise<ClosedWorkout>;
  /** Séance close non supprimée, séries dans l'ordre ; `null` sinon (ouverte, supprimée, absente). */
  getClosed(id: string): Promise<WorkoutWithSets | null>;
  /** Résumé § 13.5 (durée, séries, tonnage hors échauffement / drop / partielles / chrono, records contre les séances closes antérieures). */
  summary(workoutId: string): Promise<WorkoutSummary>;
  /**
   * Corrige une série d'une séance close (charge, répétitions, durée, RIR, type) : écriture champ par champ (déclencheurs : une entrée de
   * file et une horloge par champ modifié), `corrected_at` daté (correction tracée, § 13.8). Rien de modifié : rien n'est écrit. Séance
   * ouverte : `'invalid'` (utiliser `updateSet`) ; saisie hors règles : `'invalid'`. Aucune autre table n'est touchée (une future
   * `recommendation_decision` reste en place).
   */
  correctSet(setId: string, patch: SetCorrection): Promise<WorkoutSet>;
  /** Suppression logique d'une séance close et de ses séries, même tampon, tout ou rien (transaction propre si appelée hors transaction). Ouverte : `'invalid'`. */
  deleteClosed(id: string): Promise<void>;
  /**
   * « Mettre à jour la routine ? » → « Oui » (§ 13.8) : applique au jour de routine d'origine les écarts de `routineDiff` (lignes retirées
   * supprimées logiquement, nombre de séries mis à jour, exercices ajoutés en fin de jour). Jamais appelé automatiquement ; « Cette fois
   * seulement » n'appelle rien. Séance close seulement (`'invalid'` sinon) ; routine ou jour disparu : aucun écart, rien n'est écrit. Tout ou rien :
   * hors transaction, il ouvre la sienne. Renvoie les écarts appliqués.
   */
  applyRoutineUpdate(workoutId: string): Promise<RoutineDiff>;
  /** Écarts de la séance avec son jour de routine (lecture seule, pour poser la question). */
  routineChanges(workoutId: string): Promise<RoutineDiff>;
}

/** Correction d'une série d'une séance close ; les champs omis gardent leur valeur. */
export interface SetCorrection extends SetEntryInput {
  readonly setKind?: SetKind;
}

export interface ClosedWorkout {
  readonly workout: WorkoutWithSets;
  readonly summary: WorkoutSummary;
  /** Écarts avec la routine d'origine (`hasChanges` : poser « Mettre à jour la routine ? »). */
  readonly routineDiff: RoutineDiff;
  /** Vrai si la séance était déjà close (rejeu : rien n'a été écrit). */
  readonly alreadyClosed: boolean;
}
