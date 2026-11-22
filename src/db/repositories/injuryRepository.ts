import type { InjuriesValue, Injury } from '../../domain/training/injuries';

/**
 * Gênes déclarées (§ 10.2) : table PUBLIÉE `injury` (migration 0021 ; SYNC-0291, BL-120, D-447, D-464), écrite par les DEUX appareils, identifiant UUID.
 * Donnée de santé : jamais journalisée (codes seulement), jamais au journal des conflits. Aucune règle métier ici (validation : `parseInjury` du domaine).
 */
export interface InjuryRepository {
  /** Gênes vivantes, dans l'ordre de déclaration ; une ligne illisible (version future) est écartée de la lecture, jamais effacée. */
  read(): Promise<InjuriesValue>;
  /** Insère la gêne, ou n'écrit que ses champs changés (une réponse au check-in : `checkins`) ; inchangée : rien. Invalide : `'invalid'`. */
  save(injury: Injury): Promise<void>;
  /**
   * Reprise UNIQUE des gênes locales d'avant le schéma 21 (réglage `training.injuries`, D-402) : chaque gêne lisible sans ligne est insérée, dans l'ordre ;
   * un ancien identifiant non UUID reçoit un UUID neuf (une reprise rejouée la reconnaît à son contenu). Une ligne existante n'est jamais touchée.
   * Rend le nombre d'insertions ; idempotente.
   */
  importLocal(items: readonly Injury[]): Promise<number>;
}
