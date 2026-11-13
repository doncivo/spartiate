import type { DataResetCounts } from '../../domain/dataReset';
import type { Hlc } from '../../domain/types';

/**
 * RESET-01 (D-180 à D-186) : remises à zéro des données (table publiée `data_reset`, migration 0016) et effacement local. Aucune règle métier ici
 * (sort des tables et des réglages : `src/domain/dataReset.ts` ; enchaînement et synchro : `src/sync/dataReset.ts`).
 */
export interface DataResetRepository {
  /** Plus grand hlc de remise à zéro présent dans la table (lignes reçues ou posées ici), ou null. */
  horizon(): Promise<Hlc | null>;
  /** Une séance est-elle en cours (ouverte, non supprimée) ? Une remise à zéro locale est alors refusée (D-184). */
  hasOpenWorkout(): Promise<boolean>;
  /**
   * Pose une remise à zéro : une ligne `data_reset` horodatée (tampon neuf, donc postérieur à tout hlc de la base) et capturée par la file d'envoi
   * (appel HORS garde). Rend l'horizon.
   */
  record(): Promise<Hlc>;
  /**
   * Efface tout ce qui a été créé avant l'horizon (horloge de `created_at` inférieure ou égale), dans toutes les tables publiées sauf `data_reset`,
   * avec leurs enfants, leurs horloges, leurs entrées de file, mises de côté, traces et champs inconnus ; vide les tables locales de données ; retire
   * les fichiers de photos sans fiche ; remet les réglages effacés à leur défaut. À appeler SOUS GARDE (`sync_guard`), dans une transaction.
   */
  wipe(horizon: Hlc): Promise<DataResetCounts>;
}
