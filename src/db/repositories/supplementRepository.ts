import type { Supplement, SupplementDraftInput, SupplementIntake } from '../../domain/nutrition/supplements';
import type { LocalDate, LocalTime } from '../../domain/types';

/**
 * Compléments et prises (tables `supplement` et `supplement_intake` ; I6-05, D-210, D-215). PUBLIÉS, écrits par les DEUX appareils.
 *
 * - Complément : UUID ; validation par le domaine (`validateSupplementDraft`) avant toute écriture, saisie invalide refusée (`RepositoryError`).
 * - Supprimer un complément = suppression logique ; ses prises restent (historique exporté) mais ne sont plus lues avec lui.
 * - Prise : identifiant naturel `intake|<complément>|<date>|<heure>` ; cocher crée ou rétablit la ligne, décocher la supprime logiquement.
 */
export interface SupplementRepository {
  /** Compléments vivants (actifs et en pause), triés par nom. */
  list(): Promise<readonly Supplement[]>;
  create(draft: SupplementDraftInput): Promise<Supplement>;
  /** Complément inconnu ou supprimé : `not-found` ; saisie invalide : `invalid`. Seuls les champs changés sont écrits. */
  update(id: string, draft: SupplementDraftInput): Promise<void>;
  remove(id: string): Promise<void>;
  /** Prises cochées des jours `from` à `to` compris, triées par date puis heure. */
  intakes(from: LocalDate, to: LocalDate): Promise<readonly SupplementIntake[]>;
  /** Coche ou décoche une prise ; déjà dans l'état demandé : aucune écriture. Complément inconnu ou heure illisible : refusé. */
  setTaken(supplementId: string, date: LocalDate, moment: LocalTime, taken: boolean): Promise<void>;
}
