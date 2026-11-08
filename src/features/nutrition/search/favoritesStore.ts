import type { SettingsRepository } from '../../../db/repositories/settingsRepository';
import { parseFavorites, serializeFavorites, type Favorite } from '../../../domain/nutrition/favorites';

/** Favoris de la recherche (I4-06 ; D-79) : réglage LOCAL `nutrition.favorites`, jamais synchronisé. Lecture tolérante, jamais d'exception. */
export async function loadFavorites(settings: Pick<SettingsRepository, 'get'>): Promise<readonly Favorite[]> {
  try {
    return parseFavorites(await settings.get('nutrition.favorites'));
  } catch {
    return [];
  }
}

export async function saveFavorites(settings: Pick<SettingsRepository, 'set'>, list: readonly Favorite[]): Promise<void> {
  await settings.set('nutrition.favorites', serializeFavorites(list));
}
