import type { InjuriesValue, Injury } from '../../domain/training/injuries';

/**
 * Gênes déclarées (§ 10.2) : table PUBLIÉE `injury` (migration 0021 ; SYNC-0291, BL-120, D-447, D-464), écrite par les DEUX appareils, identifiant UUID.
 * Donnée de santé : jamais journalisée (codes seulement), jamais au journal des conflits. Aucune règle métier ici (validation : `parseInjury` du domaine).
 */
export interface InjuryRepository {
  /** Gênes vivantes, dans l'ordre de déclaration ; une ligne illisible (version future) est écartée de la lecture, jamais effacée. */
  read(): Promise<InjuriesValue>;
  /**
   * Insère la gêne, ou n'écrit que les champs que l'écran a changés depuis `before` (la valeur qu'il a montrée ; absente : la ligne en base) ; les
   * réponses au check-in sont fusionnées avec celles reçues entre-temps (D-468, `injuryUpdate`). Rien de changé : rien. Invalide : `'invalid'`.
   */
  save(injury: Injury, before?: Injury): Promise<void>;
  /**
   * Reprise UNIQUE des gênes locales d'avant le schéma 21 (réglage `training.injuries`, D-402) : chaque gêne lisible sans ligne est insérée, dans l'ordre ;
   * un ancien identifiant non UUID reçoit un UUID DÉTERMINISTE (`legacyInjuryId`). Une ligne existante n'est jamais touchée ; deux reprises
   * concurrentes ne se gênent pas (insertion sans effet sur une clé présente). Échec isolé par gêne. Rend les insertions et les échecs ; idempotente.
   */
  importLocal(items: readonly Injury[]): Promise<{ readonly inserted: number; readonly failed: number; readonly failedIds: readonly string[] }>;
}
