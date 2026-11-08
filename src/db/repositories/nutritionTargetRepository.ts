import type { TargetRecord, TargetRecordDraft } from '../../domain/nutrition/targetRecord';
import type { DeviceId, Hlc, IsoDateTime, LocalDate } from '../../domain/types';

/**
 * Cibles nutritionnelles (table `nutrition_target`, migration 0008 ; I4-02, § 15.2, § 20.2, D-74). Publiées (UUID).
 *
 * - UNE LIGNE PAR DÉCISION, jamais modifiée ni supprimée : la modification d'Ali est une nouvelle ligne `manual`, une proposition refusée
 *   est conservée (`accepted` faux). Aucune méthode `update` ni `softDelete` : l'historique est la trace (« chaque valeur traçable »).
 * - Les valeurs sont validées par le domaine (`validateTargetRecord`, plancher compris) : refus `'invalid'`, rien n'est écrit.
 * - La cible en vigueur n'a aucune valeur par défaut : sans ligne acceptée, `effective` rend `null`.
 */

export interface NutritionTargetRecord extends TargetRecord {
  readonly engineVersion: number | null;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt: IsoDateTime | null;
  readonly deviceId: DeviceId;
  readonly hlc: Hlc;
}

export interface NutritionTargetRepository {
  record(draft: TargetRecordDraft, options?: { readonly id?: string }): Promise<NutritionTargetRecord>;
  get(id: string): Promise<NutritionTargetRecord | null>;
  /** Toutes les décisions, de la plus récente à la plus ancienne (semaine, création, identifiant). */
  list(): Promise<readonly NutritionTargetRecord[]>;
  /** Dernière cible acceptée dont la semaine a commencé le `date` ou avant. */
  effective(date: LocalDate): Promise<NutritionTargetRecord | null>;
}
