import { parseCiqualCatalogue, type CiqualCatalogue } from '../../../domain/nutrition/ciqual';

/**
 * Catalogue Ciqual embarqué (`content/food/ciqual.json`, I4-02), chargé à la première demande par import dynamique : jamais dans le paquet
 * de départ. Le JSON est validé à la main (`parseCiqualCatalogue`) ; un contenu illisible lève une erreur DITE par l'appelant (la recherche
 * personnelle et le cache restent utilisables), jamais un catalogue vide silencieux.
 */

export class CiqualUnavailableError extends Error {
  override readonly name = 'CiqualUnavailableError';
  constructor() {
    super('catalogue Ciqual illisible');
  }
}

let cached: Promise<CiqualCatalogue> | null = null;

async function load(): Promise<CiqualCatalogue> {
  const module = await import('../../../../content/food/ciqual.json');
  const catalogue = parseCiqualCatalogue(module.default as unknown);
  if (catalogue === null) throw new CiqualUnavailableError();
  return catalogue;
}

/** Chargé une fois puis gardé en mémoire ; un échec n'est pas mis en cache (nouvelle tentative possible). */
export function loadCiqual(): Promise<CiqualCatalogue> {
  if (!cached) {
    cached = load();
    cached.catch(() => {
      cached = null;
    });
  }
  return cached;
}
