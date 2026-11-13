import type { Repositories } from '../../../db/repositories/dataAccess';
import { parseFavorites, type Favorite } from '../../../domain/nutrition/favorites';

/** Lecture typée : un échec de lecture n'est jamais une liste vide (D-79 point 3), sinon une écriture suivante partirait d'une liste fausse. */
export type FavoritesRead = { readonly ok: true; readonly list: readonly Favorite[] } | { readonly ok: false };

type FavoritesDeps = Pick<Repositories, 'settings' | 'foodFavorites'>;

/**
 * Favoris de la recherche (I4-06 ; FIX-0181, D-171 : D-79 révisée par Ali le 12/11) : table PUBLIÉE `food_favorite`. Reprise UNIQUE de l'ancien réglage
 * LOCAL `nutrition.favorites` à la première lecture : ses favoris sont insérés (jamais au-dessus d'une ligne existante), PUIS le réglage est vidé ; une
 * reprise interrompue se rejoue sans doublon (idempotente). Réglage illisible ou écriture en échec : `ok: false`, rien n'est perdu.
 */
export async function loadFavorites(repos: FavoritesDeps): Promise<FavoritesRead> {
  try {
    const favorites = await repos.foodFavorites();
    const legacy = await repos.settings.get('nutrition.favorites');
    if (legacy !== null && legacy !== undefined) {
      await favorites.importLocal(parseFavorites(legacy));
      await repos.settings.set('nutrition.favorites', null);
    }
    return { ok: true, list: await favorites.list() };
  } catch {
    return { ok: false };
  }
}

/** Met en favori ou retire, un seul favori à la fois (jamais la liste entière : l'autre appareil peut avoir écrit entre-temps). */
export async function writeFavorite(repos: Pick<Repositories, 'foodFavorites'>, item: Favorite, favorite: boolean): Promise<void> {
  const favorites = await repos.foodFavorites();
  if (favorite) await favorites.add(item);
  else await favorites.remove(item.ref);
}
