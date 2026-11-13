import type { Favorite } from '../../domain/nutrition/favorites';

/**
 * Favoris de la recherche d'aliments (table `food_favorite`, migration 0015 ; FIX-0181, D-171 : D-79 révisée par Ali le 12 novembre 2026). PUBLIÉS,
 * écrits par les DEUX appareils.
 *
 * - Un favori par aliment, identifiant naturel `favorite|<ref>` (même ligne sur les deux appareils) ; `ref` = `ciqual:<code>` ou UUID d'une fiche.
 * - Liste vivante la plus récente d'abord (`added_at`, publié), bornée à `FAVORITES_MAX` (200) : au-delà, le plus ancien sort (suppression logique,
 *   publiée). Une ligne illisible (provenance inconnue d'une version plus récente) est écartée à la lecture, jamais effacée.
 * - Retirer = suppression logique (`deleted_at`) ; remettre en favori rétablit la ligne, en tête. Fusion champ par champ par HLC : dernière écriture gagne.
 * - Aucune règle métier ici (validation : `toFavorite` du domaine).
 */
export interface FoodFavoriteRepository {
  /** Favoris vivants, le plus récent d'abord, au plus 200. */
  list(): Promise<readonly Favorite[]>;
  /** Met en favori (crée la ligne, ou rétablit une ligne supprimée, en tête) ; déjà favori : aucune écriture. Provenance ou référence invalide : `'invalid'`. */
  add(item: Favorite): Promise<void>;
  /** Retire le favori (suppression logique) ; sans effet s'il n'est pas favori. */
  remove(ref: string): Promise<void>;
  /**
   * Reprise UNIQUE des favoris locaux d'avant le schéma 15 (réglage `nutrition.favorites`, D-79), du plus récent au plus ancien : chaque favori sans
   * ligne est inséré (ordre gardé) ; une ligne existante, vivante ou supprimée (par exemple ailleurs), n'est jamais touchée. Rend le nombre de
   * favoris insérés ; idempotente.
   */
  importLocal(items: readonly Favorite[]): Promise<number>;
}
