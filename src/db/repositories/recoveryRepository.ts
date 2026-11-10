import type { MuscleRecoveryRow, RecoveryDayOutput, RecoveryDaySummary } from '../../domain/recovery';
import type { DeviceId, Hlc, IsoDateTime, LocalDate } from '../../domain/types';

/**
 * Récupération (tables `recovery_day` et `muscle_recovery`, migration 0010 ; I5-01 point 1.5, § 16.4, § 20.2). Publiées : l'iPhone écrit, le PC lit
 * et affiche sans recalculer. Aucune règle métier ici : le résumé vient de `summarizeRecoveryDay` (domaine).
 *
 * - Une ligne par date locale (`recovery|AAAA-MM-JJ`) et une par date et muscle (`muscle|AAAA-MM-JJ|<muscle>`) : les deux appareils écrivent la
 *   même ligne ; « pas de ligne » = jour non calculé (jamais une valeur par défaut). Un muscle absent d'un jour n'a pas de ligne.
 * - `saveDay` est IDEMPOTENT : rejouer un résumé identique n'écrit rien (ni file de synchro, ni nouvel horodatage) ; l'instant de calcul
 *   (`computedAt`) seul ne compte pas comme un changement (un recalcul à chaque ouverture ne doit pas republier). Les muscles du jour sont
 *   REMPLACÉS : les lignes non reprises sont supprimées logiquement, une ligne revenue est restaurée.
 * - Version du moteur : `RECOVERY_ENGINE_VERSION`, écrite avec chaque résumé.
 * - Entrée invalide (date, niveau, valeur sans raison d'abstention, muscle d'un autre jour ou répété, pourcentage non entier, instant hors
 *   ISO 8601) : `RepositoryError('invalid')`, rien n'est écrit. JSON illisible en base : `'invalid'` à la lecture.
 * - « L'iPhone écrit, le PC lit » (§ 9.1, sync-icloud) : sur un appareil LECTEUR (`RepositoryOptions.recoveryWriter` absent ou faux), `saveDay`
 *   rend `null` et `deleteDay` ne fait rien ; aucune ligne, aucune file de synchro, un événement fixe `recovery-write-ignored` (sans valeur).
 *   Une entrée invalide reste refusée. Les lignes REÇUES de l'iPhone sont écrites par le moteur de synchro, hors de ce dépôt.
 */

/** Version du moteur de récupération écrite avec chaque résumé (`config.ts`, § 16.3) ; à incrémenter quand une formule change. */
export const RECOVERY_ENGINE_VERSION = 1;

export interface RecoveryDayRecord {
  /** `recovery|AAAA-MM-JJ`. */
  readonly id: string;
  readonly summary: RecoveryDaySummary;
  readonly engineVersion: number;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt: IsoDateTime | null;
  readonly deviceId: DeviceId;
  readonly hlc: Hlc;
}

export interface MuscleRecoveryRecord extends MuscleRecoveryRow {
  /** `muscle|AAAA-MM-JJ|<muscle>`. */
  readonly id: string;
  readonly day: LocalDate;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt: IsoDateTime | null;
  readonly deviceId: DeviceId;
  readonly hlc: Hlc;
}

export interface SavedRecoveryDay {
  readonly day: RecoveryDayRecord;
  readonly muscles: readonly MuscleRecoveryRecord[];
}

export interface RecoveryRepository {
  /** Écrit (ou met à jour) le résumé du jour et remplace ses muscles, en une transaction. Idempotent. `null` : appareil lecteur, rien écrit. */
  saveDay(output: RecoveryDayOutput): Promise<SavedRecoveryDay | null>;
  /** Résumé vivant du jour, ou `null`. */
  getDay(date: LocalDate): Promise<RecoveryDayRecord | null>;
  /** Résumés vivants de la plage (bornes incluses), du plus ancien au plus récent. */
  listDays(from: LocalDate, to: LocalDate): Promise<readonly RecoveryDayRecord[]>;
  /** Résumé vivant le plus récent, sans borne basse ; `null` : aucune ligne. */
  latestDay(): Promise<RecoveryDayRecord | null>;
  /** Muscles vivants du jour, par identifiant de muscle. */
  listMuscles(date: LocalDate): Promise<readonly MuscleRecoveryRecord[]>;
  /** Suppression logique du résumé du jour et de ses muscles. Jour sans ligne vivante, ou appareil lecteur : aucune écriture. */
  deleteDay(date: LocalDate): Promise<void>;
}
