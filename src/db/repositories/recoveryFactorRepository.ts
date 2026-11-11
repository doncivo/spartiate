import type { FactorCode } from '../../domain/recovery';
import type { DeviceId, Hlc, IsoDateTime, LocalDate } from '../../domain/types';

/**
 * Journal de facteurs (table `recovery_factor`, migration 0011 ; I6-01 point B, § 16.7, D-95). Publié, écrit par les DEUX appareils.
 *
 * - Une ligne par date locale (la JOURNÉE DE LA VEILLE du matin de saisie), identifiant naturel `recovery_factor|AAAA-MM-JJ`. « Non renseigné » =
 *   aucune ligne ou ligne supprimée logiquement (`clear`) : `get` rend `null`. « Rien de particulier » (`none`) est une ligne sans facteur.
 * - Les codes sont fixes (`FACTOR_CODES`), rangés dans l'ordre fixe ; un code inconnu (appareil plus récent) est ignoré à la lecture.
 * - Aucune règle métier ici : l'analyse (écart de Recovery avec / sans) est dans `src/domain/recovery/factors.ts`. Jamais envoyé à un tiers.
 */

export interface FactorEntry {
  readonly factors: readonly FactorCode[];
  /** « Rien de particulier » : vrai seulement sans facteur. */
  readonly none: boolean;
}

export interface RecoveryFactorRecord extends FactorEntry {
  /** `recovery_factor|AAAA-MM-JJ`. */
  readonly id: string;
  readonly day: LocalDate;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt: IsoDateTime | null;
  readonly deviceId: DeviceId;
  readonly hlc: Hlc;
}

export interface RecoveryFactorRepository {
  /**
   * Enregistre le jour (crée la ligne, la modifie, ou rétablit un jour effacé). Même valeur : aucune écriture. Date ou code invalide, « rien »
   * avec des facteurs, ni facteur ni « rien » : `'invalid'`, rien n'est écrit.
   */
  save(day: LocalDate, entry: FactorEntry): Promise<RecoveryFactorRecord>;
  /** Efface la saisie (suppression logique, jour « non renseigné ») ; sans effet sans ligne vivante. */
  clear(day: LocalDate): Promise<void>;
  /** Saisie vivante de ce jour, ou `null`. */
  get(day: LocalDate): Promise<RecoveryFactorRecord | null>;
  /** Saisies vivantes de `from` à `to` inclus, du plus ancien au plus récent. */
  list(from: LocalDate, to: LocalDate): Promise<readonly RecoveryFactorRecord[]>;
}
