import type { DecisionReference, ExerciseSession, Prescription, ProgressionProfileState } from '../../domain/training/types';
import type { DeviceId, Hlc, IsoDateTime } from '../../domain/types';

/**
 * Moteur de prescription (I2-01, migration 0005) : historique d'un exercice, état recalculable par exercice (`progression_profile`) et
 * décisions d'Ali (`recommendation_decision`). Locales en 0.3.0 ; publiées depuis la 0.3.1 (migration 0006 : catalogue, captures,
 * identité naturelle du profil).
 *
 * - `history` : séances CLOSES non supprimées ayant au moins une série non supprimée de l'exercice, de la plus récente à la plus
 *   ancienne (fin, puis identifiant), au plus `limit` séances (défaut `HISTORY_SESSIONS_LOADED`) ; difficulté lue sur les séries
 *   de l'exercice (`workout_set.difficulty`, 0006), null si aucune ; `deload` vrai si la dernière décision de l'exercice dans la séance a
 *   retenu une proposition de deload (acceptée, ou charge retenue au plus celle du deload) (I2-02 : marqueur lu dans la prescription tracée, aucune colonne nouvelle).
 * - `saveProfile` : un profil par exercice, identifiant naturel `progression|<exerciseId>` (une seule ligne même écrite par deux
 *   appareils) ; écriture = remplacement des valeurs, restaure un profil supprimé.
 * - `recordDecision` : trace de l'acceptation ou de la modification d'une prescription (§ 11.2 point 9, § 11.5) ; jamais modifiée.
 * - `'invalid'` : valeur hors bornes, rien n'est écrit.
 */

export interface ProgressionProfileRecord extends ProgressionProfileState {
  readonly id: string;
  readonly exerciseId: string;
  readonly engineVersion: number;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt: IsoDateTime | null;
  readonly deviceId: DeviceId;
  readonly hlc: Hlc;
}

export interface ProgressionProfileInput extends ProgressionProfileState {
  readonly exerciseId: string;
  readonly engineVersion: number;
}

export interface RecordDecisionInput {
  /** UUID ; fabriqué si omis. */
  readonly id?: string;
  readonly exerciseId: string;
  /** Séance (et série) pour laquelle la prescription a été présentée ; références logiques. */
  readonly workoutId: string | null;
  readonly workoutSetId?: string | null;
  /** Prescription présentée (charges, reps, raisons, version, confiance). */
  readonly prescription: Prescription;
  /** Vrai : acceptée telle quelle ; faux : modifiée ou refusée. */
  readonly accepted: boolean;
  /** Valeur effective retenue par Ali (celle de la prescription si acceptée) ; refus : charge nulle et aucune répétition. */
  readonly chosenLoadKg: number | null;
  readonly chosenReps: readonly number[];
}

export interface RecommendationDecisionRecord extends DecisionReference {
  readonly id: string;
  readonly exerciseId: string;
  readonly workoutId: string | null;
  readonly workoutSetId: string | null;
  readonly engineVersion: number;
  readonly prescription: Prescription;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt: IsoDateTime | null;
  readonly deviceId: DeviceId;
  readonly hlc: Hlc;
}

export interface ProgressionRepository {
  history(exerciseId: string, limit?: number): Promise<ExerciseSession[]>;
  getProfile(exerciseId: string): Promise<ProgressionProfileRecord | null>;
  saveProfile(input: ProgressionProfileInput): Promise<ProgressionProfileRecord>;
  recordDecision(input: RecordDecisionInput): Promise<RecommendationDecisionRecord>;
  /** Dernière décision non supprimée d'une séance CLOSE non supprimée (date, puis identifiant), ou null : jamais d'une séance ouverte ou abandonnée. */
  lastDecision(exerciseId: string): Promise<RecommendationDecisionRecord | null>;
  /** Dernière décision de cet exercice dans cette séance (ouverte comprise), ou null : état affiché dans la séance en cours. */
  decisionFor(workoutId: string, exerciseId: string): Promise<RecommendationDecisionRecord | null>;
  /**
   * Après la clôture (même transaction) : recalibrage « Facile » consigné dans le profil si la charge retenue est au moins la charge recalée
   * (`recalibrationKept`). Séance absente ou supprimée : `'not-found'` ; ouverte : `'invalid'`.
   */
  applyClosedWorkout(workoutId: string): Promise<void>;
}
