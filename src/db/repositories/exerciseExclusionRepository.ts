/**
 * Exercices écartés (« Retirer, ne plus proposer », § 13.2) : table PUBLIÉE `exercise_exclusion` (migration 0021 ; SYNC-0291, BL-109, D-447, D-463),
 * écrite par les DEUX appareils.
 *
 * - Un écarté par exercice, identifiant naturel `exclusion|<exercice>` (même ligne sur les deux appareils).
 * - Écarter = ligne vivante (insertion, ou rétablissement d'une ligne supprimée) ; remettre = suppression logique. Un geste écrit UNE ligne, jamais la
 *   liste entière (l'autre appareil peut avoir écrit entre-temps). Fusion champ par champ par HLC : dernière écriture gagne.
 * - Aucune règle métier ici (forme de l'identifiant : `isExclusionExerciseId` du domaine).
 */
export interface ExerciseExclusionRepository {
  /** Identifiants des exercices écartés (lignes vivantes), triés. */
  list(): Promise<readonly string[]>;
  /** Écarte ou remet un exercice ; sans effet si déjà dans cet état. Identifiant invalide : `'invalid'`. */
  setExcluded(exerciseId: string, excluded: boolean): Promise<void>;
  /**
   * Reprise UNIQUE des écartés locaux d'avant le schéma 21 (réglage `training.excludedExercises`, D-377) : chaque identifiant valide sans ligne est
   * inséré ; une ligne existante, vivante ou supprimée (par exemple remise ailleurs), n'est jamais touchée ; deux reprises concurrentes ne se gênent
   * pas. Échec isolé par identifiant (invalide ou refusé). Rend les insertions et les échecs ; idempotente.
   */
  importLocal(exerciseIds: readonly string[]): Promise<{ readonly inserted: number; readonly failed: number; readonly failedIds: readonly string[] }>;
}
