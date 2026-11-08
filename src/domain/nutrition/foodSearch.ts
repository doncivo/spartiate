/**
 * Recherche locale dans le catalogue (Perso / Ciqual / Open Food Facts en cache ; PRD § 15.3). Module pur : le texte est normalisé
 * (casse, accents, ligatures, ponctuation), tous les mots de la requête doivent correspondre ; l'ordre est déterministe.
 */

import type { Per100g } from './food';

export type SearchProvenance = 'custom' | 'ciqual' | 'off';

export interface SearchableFood {
  /** Identifiant de journal : `ciqual:<code>` ou UUID de fiche. */
  readonly ref: string;
  readonly provenance: SearchProvenance;
  readonly name: string;
  readonly brand: string | null;
  readonly barcode: string | null;
  readonly per100g: Per100g;
}

/** Minuscules, accents retirés, œ/æ développés, apostrophes et tirets en espaces, espaces compactés. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const PROVENANCE_RANK: Readonly<Record<SearchProvenance, number>> = { custom: 0, ciqual: 1, off: 2 };

/** 0 nom égal ou code-barres exact, 1 début de nom, 2 début de mot, 3 sous-chaîne, null sinon. */
function score(food: SearchableFood, query: string, words: readonly string[]): number | null {
  const name = normalizeText(food.name);
  const haystack = food.brand === null ? name : `${name} ${normalizeText(food.brand)}`;
  if (food.barcode !== null && query === food.barcode) return 0;
  if (!words.every((w) => haystack.includes(w))) return null;
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  const tokens = haystack.split(' ');
  if (words.every((w) => tokens.some((t) => t.startsWith(w)))) return 2;
  return 3;
}

export function searchFoods(query: string, foods: readonly SearchableFood[], options: { readonly limit?: number } = {}): SearchableFood[] {
  const q = normalizeText(query);
  if (q.length === 0) return [];
  const words = q.split(' ');
  const hits: { readonly food: SearchableFood; readonly score: number; readonly name: string }[] = [];
  for (const food of foods) {
    const s = score(food, q, words);
    if (s !== null) hits.push({ food, score: s, name: normalizeText(food.name) });
  }
  hits.sort(
    (a, b) =>
      a.score - b.score ||
      PROVENANCE_RANK[a.food.provenance] - PROVENANCE_RANK[b.food.provenance] ||
      a.name.length - b.name.length ||
      (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) ||
      (a.food.ref < b.food.ref ? -1 : a.food.ref > b.food.ref ? 1 : 0),
  );
  return hits.slice(0, options.limit ?? 50).map((h) => h.food);
}
