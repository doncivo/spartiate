import type { BodyWeight, ManualWeightInput, Profile, ProfileInput, WeightSource } from '../../domain/bodyProfile';
import type { IsoDateTime, LocalDate } from '../../domain/types';

/**
 * Profil et poids (D-65). Aucune règle métier ici (règle commune n°6) : les bornes et énumérations sont dans `domain/bodyProfile.ts`,
 * appliquées à l'écriture (`RepositoryError('invalid')`, rien n'est écrit).
 */
export interface ProfileRepository {
  /** La ligne `profile|singleton`, ou `null` tant que rien n'a été enregistré (jamais de ligne vide au démarrage). */
  get(): Promise<Profile | null>;
  /**
   * Enregistre le profil : crée la ligne à la première fois, puis met à jour. Une valeur omise est gardée, `null` l'efface (NULL, jamais
   * zéro). `currentYear` borne l'année de naissance.
   */
  save(input: ProfileInput, currentYear: number): Promise<Profile>;
}

export interface BodyWeightRepository {
  /**
   * Pesée manuelle d'un jour : crée `weight|date|manual` ou remplace la valeur existante (y compris supprimée, qui est rétablie).
   * `today` borne la date (pas de pesée future). L'écriture des pesées Santé (`health`) appartient à l'iPhone seul (D-65 point 3) et
   * arrive avec le plugin healthkit.
   */
  saveManual(input: ManualWeightInput & { readonly timezone: string }, today: LocalDate): Promise<BodyWeight>;
  /** Dernière pesée Santé du jour : conserve l'identité naturelle `weight|date|health` et l'identité de l'échantillon. */
  saveHealth(input: { readonly kg: number; readonly measuredAt: IsoDateTime; readonly timezone: string; readonly healthUuid: string }, today: LocalDate, options?: { readonly fromImport?: boolean }): Promise<BodyWeight>;
  softDelete(date: LocalDate, source: WeightSource): Promise<void>;
  /** Pesées non supprimées, du jour le plus récent au plus ancien (à date égale : `measured_at` décroissant, puis origine). */
  listRecent(limit: number): Promise<BodyWeight[]>;
}
