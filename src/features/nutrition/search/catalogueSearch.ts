import type { FoodRepository, FoodRecord } from '../../../db/repositories/foodRepository';
import { ciqualSearchable, type CiqualCatalogue } from '../../../domain/nutrition/ciqual';
import { isValidBarcode, offCacheState, type OffCacheState } from '../../../domain/nutrition/food';
import { normalizeText, searchFoods, type SearchableFood } from '../../../domain/nutrition/foodSearch';
import type { IsoDateTime } from '../../../domain/types';
import { loadCiqual } from '../catalogue/ciqualCatalogue';

/**
 * Recherche locale dans le catalogue (I4-02, § 15.3) : fiches personnelles, produits Open Food Facts en cache et Ciqual embarqué, avec la
 * provenance de chaque ligne. Aucun réseau. Cas d'usage sans interface : l'écran du journal (I4-03) l'appelle.
 *
 * - Ciqual illisible : DIT (`ciqual: 'unavailable'`), la recherche personnelle et le cache restent utilisables.
 * - Produit OFF de plus de 90 jours : encore proposé hors ligne, signalé périmé (`staleOff`), jamais présenté comme à jour.
 * - Code-barres inconnu : `not-found` avec recours manuel ; aucun repas n'est créé par la recherche.
 */

export interface CatalogueSearchOptions {
  readonly now: IsoDateTime;
  readonly limit?: number;
  /** Injectable pour les tests ; le contenu embarqué par défaut. */
  readonly loadCiqual?: () => Promise<CiqualCatalogue>;
}

export interface CatalogueSearchResult {
  readonly hits: readonly SearchableFood[];
  readonly ciqual: 'ok' | 'unavailable';
  /** Identifiants des produits OFF proposés mais périmés ou à date illisible. */
  readonly staleOff: readonly string[];
}

const toSearchable = (food: FoodRecord): SearchableFood => ({
  ref: food.id,
  provenance: food.source === 'off' ? 'off' : 'custom',
  name: food.name,
  brand: food.brand,
  barcode: food.barcode,
  per100g: food.per100g,
});

export async function searchCatalogue(foods: FoodRepository, query: string, options: CatalogueSearchOptions): Promise<CatalogueSearchResult> {
  if (normalizeText(query).length === 0) return { hits: [], ciqual: 'ok', staleOff: [] };
  const stored = await foods.list();
  const staleOff = stored.filter((f) => f.source === 'off' && offCacheState(f.fetchedAt ?? '', options.now) !== 'fresh').map((f) => f.id);
  const ciqual: CiqualCatalogue | null = await (options.loadCiqual ?? loadCiqual)().catch(() => null);
  const universe = [...stored.map(toSearchable), ...(ciqual === null ? [] : ciqualSearchable(ciqual))];
  return { hits: searchFoods(query, universe, options.limit === undefined ? {} : { limit: options.limit }), ciqual: ciqual === null ? 'unavailable' : 'ok', staleOff };
}

export type BarcodeLookup =
  | { readonly kind: 'found'; readonly food: FoodRecord; readonly origin: 'custom' | 'off'; readonly cache: OffCacheState | null }
  | { readonly kind: 'not-found'; readonly manual: true }
  | { readonly kind: 'invalid-code' };

/** Fiche personnelle du code, sinon produit en cache (état dit), sinon « non trouvé » avec la saisie manuelle comme recours. */
export async function lookupBarcode(foods: FoodRepository, barcode: string, now: IsoDateTime): Promise<BarcodeLookup> {
  if (!isValidBarcode(barcode)) return { kind: 'invalid-code' };
  const food = await foods.findByBarcode(barcode);
  if (food === null) return { kind: 'not-found', manual: true };
  if (food.source === 'custom') return { kind: 'found', food, origin: 'custom', cache: null };
  return { kind: 'found', food, origin: 'off', cache: offCacheState(food.fetchedAt ?? '', now) };
}
