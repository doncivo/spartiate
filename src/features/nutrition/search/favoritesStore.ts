import type { SettingsRepository } from '../../../db/repositories/settingsRepository';
import { parseFavorites, serializeFavorites, type Favorite } from '../../../domain/nutrition/favorites';

/** Lecture typée : un échec de lecture n'est jamais une liste vide (D-79 point 3), sinon l'écriture suivante effacerait les favoris. */
export type FavoritesRead = { readonly ok: true; readonly list: readonly Favorite[] } | { readonly ok: false };

/** Favoris de la recherche (I4-06 ; D-79) : réglage LOCAL `nutrition.favorites`, jamais synchronisé. Valeur absente ou corrompue = liste vide. */
export async function loadFavorites(settings: Pick<SettingsRepository, 'get'>): Promise<FavoritesRead> {
  try {
    return { ok: true, list: parseFavorites(await settings.get('nutrition.favorites')) };
  } catch {
    return { ok: false };
  }
}

export async function saveFavorites(settings: Pick<SettingsRepository, 'set'>, list: readonly Favorite[]): Promise<void> {
  await settings.set('nutrition.favorites', serializeFavorites(list));
}
