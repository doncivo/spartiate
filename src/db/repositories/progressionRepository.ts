import type { DecisionReference, ExerciseSession, Prescription, ProgressionProfileState } from '../../domain/training/types';
import type { DeviceId, Hlc, IsoDateTime } from '../../domain/types';

/**
 * Moteur de prescription (I2-01, migration 0005) : historique d'un exercice, état recalculable par exercice (`progression_profile`) et
 * décisions d'Ali (`recommendation_decision`). Tables LOCALES en 0.3.0 (aucune capture de synchro, absentes du catalogue) : leur
 * publication arrive avec l'affichage (PR 2/2), quand elles sont réellement écrites.
 *
 * - `history` : séances CLOSES non supprimées ayant au moins une série non supprimée de l'exercice, de la plus récente à la plus
 *   ancienne (fin, puis identifiant), au plus `limit` séances (défaut `HISTORY_SESSIONS_LOADED`) ; la difficulté n'est pas encore
 *   stockée (null).
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
  /** Valeur effective retenue par Ali (celle de la prescription si acceptée). */
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
  /** Dernière décision non supprimée (date de décision, puis identifiant), ou null. */
  lastDecision(exerciseId: string): Promise<RecommendationDecisionRecord | null>;
}
