/**
 * Favoris de la recherche d'aliments (I4-06 ; D-79, révisée par Ali le 12/11 : FIX-0181, D-171). Depuis le schéma 15 : table PUBLIÉE `food_favorite`,
 * écrite par les deux appareils (dépôt `FoodFavoriteRepository`) ; l'ancien réglage LOCAL `nutrition.favorites` n'est plus lu que pour la reprise unique.
 * `ref` est la référence d'aliment du journal : `ciqual:<code>` ou UUID d'une fiche (perso ou cache Open Food Facts).
 * Lecture stricte d'une valeur non fiable : jamais d'exception, une valeur illisible donne une liste vide.
 */

import { parseFoodId } from './food';
import type { SearchProvenance } from './foodSearch';

export const FAVORITES_MAX = 200;
const SOURCES: readonly SearchProvenance[] = ['custom', 'ciqual', 'off'];

export interface Favorite {
  readonly source: SearchProvenance;
  readonly ref: string;
}

export interface FavoritesValue {
  readonly v: 1;
  readonly items: readonly Favorite[];
}

/** Favori valide de ces valeurs (provenance connue, référence lisible et cohérente avec la provenance), ou null ; jamais d'exception. */
export function toFavorite(source: unknown, ref: unknown): Favorite | null {
  if (typeof source !== 'string' || typeof ref !== 'string' || !(SOURCES as readonly string[]).includes(source)) return null;
  const parsed = parseFoodId(ref);
  if (parsed === null) return null;
  // Une référence Ciqual n'est jamais perso ni OFF, et inversement.
  if ((parsed.kind === 'ciqual') !== (source === 'ciqual')) return null;
  return { source: source as SearchProvenance, ref };
}

function parseItem(raw: unknown): Favorite | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  return toFavorite((raw as Record<string, unknown>)['source'], (raw as Record<string, unknown>)['ref']);
}

/** Dédoublonne par référence (la première occurrence gagne) et borne à 200. */
function normalize(items: readonly Favorite[]): readonly Favorite[] {
  const seen = new Set<string>();
  const out: Favorite[] = [];
  for (const item of items) {
    if (seen.has(item.ref)) continue;
    seen.add(item.ref);
    out.push(item);
    if (out.length === FAVORITES_MAX) break;
  }
  return out;
}

export function parseFavorites(raw: unknown): readonly Favorite[] {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return [];
  const value = raw as Record<string, unknown>;
  if (value['v'] !== 1 || !Array.isArray(value['items'])) return [];
  const items: Favorite[] = [];
  for (const entry of value['items'] as unknown[]) {
    const item = parseItem(entry);
    if (item !== null) items.push(item);
  }
  return normalize(items);
}

export function serializeFavorites(list: readonly Favorite[]): FavoritesValue {
  return { v: 1, items: normalize(list) };
}

export const isFavorite = (list: readonly Favorite[], ref: string): boolean => list.some((f) => f.ref === ref);

export const removeFavorite = (list: readonly Favorite[], ref: string): readonly Favorite[] => list.filter((f) => f.ref !== ref);

/** Ajoute en tête (le plus récent d'abord) ; au-delà de 200, le plus ancien sort. */
export const addFavorite = (list: readonly Favorite[], item: Favorite): readonly Favorite[] => normalize([item, ...removeFavorite(list, item.ref)]);

export const toggleFavorite = (list: readonly Favorite[], item: Favorite): readonly Favorite[] =>
  isFavorite(list, item.ref) ? removeFavorite(list, item.ref) : addFavorite(list, item);

export interface ResolvedFavorites<F> {
  /** Aliments retrouvés, dans l'ordre de la liste. */
  readonly foods: readonly F[];
  /** Liste à conserver à la prochaine écriture : sans les aliments disparus ; un échec de lecture ne retire rien. */
  readonly kept: readonly Favorite[];
  /** Références des aliments disparus (absents, pas en échec de lecture). */
  readonly gone: readonly string[];
}

/** Retrouve les aliments des favoris ; un aliment disparu (résolu à `null`) sort sans erreur, une résolution en échec n'efface pas le favori. */
export async function resolveFavorites<F>(list: readonly Favorite[], resolve: (ref: string) => Promise<F | null>): Promise<ResolvedFavorites<F>> {
  const foods: F[] = [];
  const kept: Favorite[] = [];
  const gone: string[] = [];
  for (const item of list) {
    try {
      const food = await resolve(item.ref);
      if (food === null) {
        gone.push(item.ref);
        continue;
      }
      foods.push(food);
      kept.push(item);
    } catch {
      kept.push(item);
    }
  }
  return { foods, kept, gone };
}
