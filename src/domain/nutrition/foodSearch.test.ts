import { describe, expect, it } from 'vitest';
import { normalizeText, searchFoods, type SearchableFood } from './foodSearch';

/** I4-02 : recherche locale (Perso / Ciqual / OFF en cache) : accents, mots, ordre de pertinence puis de provenance ; noms synthétiques. */

const none = { kcal: null, proteinG: null, fatG: null, carbG: null, fiberG: null } as const;
const food = (ref: string, provenance: SearchableFood['provenance'], name: string, over: Partial<SearchableFood> = {}): SearchableFood => ({
  ref,
  provenance,
  name,
  brand: null,
  barcode: null,
  per100g: { ...none, kcal: 100 },
  ...over,
});

describe('normalizeText', () => {
  it('minuscules, accents, ligatures, apostrophes et tirets', () => {
    expect(normalizeText('  Œufs à la Coque  ')).toBe('oeufs a la coque');
    expect(normalizeText("Pot-au-feu d’été")).toBe('pot au feu d ete');
    expect(normalizeText("L'ÉPAULE")).toBe('l epaule');
  });
});

describe('searchFoods', () => {
  const catalogue: SearchableFood[] = [
    food('ciqual:9001', 'ciqual', 'Pomme, crue'),
    food('ciqual:9002', 'ciqual', 'Compote de pommes'),
    food('6a5b4c3d-0000-4000-8000-000000000001', 'custom', 'Pomme'),
    food('6a5b4c3d-0000-4000-8000-000000000002', 'off', 'Jus de pomme', { brand: 'Marque Synthétique', barcode: '4006381333931' }),
    food('ciqual:9003', 'ciqual', 'Poire, crue'),
  ];

  it('requête vide ou d’espaces : aucun résultat (pas de catalogue entier)', () => {
    expect(searchFoods('', catalogue)).toEqual([]);
    expect(searchFoods('   ', catalogue)).toEqual([]);
  });
  it('insensible à la casse et aux accents ; pluriel non géré mais sous-chaîne trouvée', () => {
    expect(searchFoods('POMME', catalogue).map((f) => f.ref)).toContain('ciqual:9001');
    expect(searchFoods('pomme', catalogue).map((f) => f.ref)).toContain('ciqual:9002');
    expect(searchFoods('poire', catalogue).map((f) => f.ref)).toEqual(['ciqual:9003']);
  });
  it('tous les mots doivent correspondre (nom ou marque)', () => {
    expect(searchFoods('pomme crue', catalogue).map((f) => f.ref)).toEqual(['ciqual:9001']);
    expect(searchFoods('jus synthetique', catalogue).map((f) => f.ref)).toEqual(['6a5b4c3d-0000-4000-8000-000000000002']);
    expect(searchFoods('pomme poire', catalogue)).toEqual([]);
  });
  it('pertinence : nom égal, début de nom, début de mot, sous-chaîne ; à égalité Perso avant Ciqual avant OFF', () => {
    expect(searchFoods('pomme', catalogue).map((f) => f.ref)).toEqual([
      '6a5b4c3d-0000-4000-8000-000000000001', // nom égal (Perso)
      'ciqual:9001', // commence par « pomme »
      'ciqual:9002', // début de mot (« pommes »), Ciqual avant OFF
      '6a5b4c3d-0000-4000-8000-000000000002', // début de mot (« jus de pomme »)
    ]);
    // sous-chaîne seulement (« ome » au milieu d'un mot) : après les débuts de mot
    expect(searchFoods('omm', catalogue)).toHaveLength(4);
  });
  it('provenance conservée dans le résultat (affichée partout)', () => {
    expect(searchFoods('jus', catalogue)[0]?.provenance).toBe('off');
  });
  it('code-barres exact : la fiche correspondante, avant tout autre résultat', () => {
    expect(searchFoods('4006381333931', catalogue).map((f) => f.ref)).toEqual(['6a5b4c3d-0000-4000-8000-000000000002']);
  });
  it('limite et ordre déterministe', () => {
    expect(searchFoods('pomme', catalogue, { limit: 2 })).toHaveLength(2);
    expect(searchFoods('pomme', catalogue)).toEqual(searchFoods('pomme', [...catalogue].reverse()));
  });
  it("limite invalide (négative, NaN, non entière, infinie) : bornée comme recentFoods, jamais d'exception", () => {
    expect(searchFoods('pomme', catalogue, { limit: -3 })).toEqual([]);
    expect(searchFoods('pomme', catalogue, { limit: Number.NaN })).toEqual([]);
    expect(searchFoods('pomme', catalogue, { limit: 2.9 })).toHaveLength(2);
    expect(searchFoods('pomme', catalogue, { limit: Number.POSITIVE_INFINITY })).toHaveLength(4);
  });
  it('requête de caractères spéciaux : aucune erreur, aucun résultat', () => {
    expect(searchFoods('(.*', catalogue)).toEqual([]);
    expect(searchFoods('\\', catalogue)).toEqual([]);
  });
});
