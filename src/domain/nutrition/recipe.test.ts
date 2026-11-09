/** Recettes (I4-07, D-80, § 15.3) : validation, totaux, par portion, poids ; inconnu = null, jamais une somme partielle ni 0. */
import { describe, expect, it } from 'vitest';

import type { IsoDateTime } from '../types';
import type { SearchableFood } from './foodSearch';
import {
  ingredientFromFood,
  recipePerServing,
  recipeTotals,
  recipeWeightG,
  validateRecipeDraft,
  type RecipeProblem,
} from './recipe';
import type { Recipe, RecipeDraft, RecipeIngredient } from './recipeTypes';

type Ing = Omit<RecipeIngredient, 'id' | 'position'>;
const pasta: Ing = { name: 'Pâtes', source: 'ciqual', foodRef: 'ciqual:9810', grams: 200, per100g: { kcal: 350, proteinG: 12, fatG: 1.5, carbG: 72, fiberG: 3 } };
const tomato: Ing = { name: 'Tomate', source: 'custom', foodRef: null, grams: 300, per100g: { kcal: 18, proteinG: 0.9, fatG: 0.2, carbG: 3.9, fiberG: 1.2 } };
const oil: Ing = { name: 'Huile', source: 'off', foodRef: null, grams: 20, per100g: { kcal: 884, proteinG: 0, fatG: 100, carbG: 0, fiberG: 0 } };

const draft = (over: Partial<RecipeDraft> = {}): RecipeDraft => ({ name: 'Pâtes tomate', servings: 4, cookedWeightG: null, ingredients: [pasta, tomato, oil], ...over });
const recipe = (over: Partial<RecipeDraft> = {}): Recipe => {
  const d = draft(over);
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: d.name,
    servings: d.servings,
    cookedWeightG: d.cookedWeightG,
    ingredients: d.ingredients.map((i, position) => ({ ...i, id: `22222222-2222-4222-8222-22222222222${position}`, position })),
    updatedAt: '2026-11-09T10:00:00.000Z' as IsoDateTime,
  };
};
const codes = (d: RecipeDraft): RecipeProblem[] => validateRecipeDraft(d);
const has = (d: RecipeDraft, code: string, index: number | null = null): boolean => codes(d).some((p) => p.code === code && p.index === index);

describe('I4-07 : validateRecipeDraft', () => {
  it('une recette correcte n\'a aucun problème', () => {
    expect(codes(draft())).toEqual([]);
    expect(codes(draft({ cookedWeightG: 900 }))).toEqual([]);
  });

  it('nom vide ou trop long (120)', () => {
    expect(has(draft({ name: '   ' }), 'name-empty')).toBe(true);
    expect(has(draft({ name: 'a'.repeat(120) }), 'name-too-long')).toBe(false);
    expect(has(draft({ name: 'a'.repeat(121) }), 'name-too-long')).toBe(true);
  });

  it('portions : entier de 1 à 100', () => {
    for (const s of [0, -1, 1.5, 101, Number.NaN]) expect(has(draft({ servings: s }), 'servings-invalid')).toBe(true);
    for (const s of [1, 100]) expect(has(draft({ servings: s }), 'servings-invalid')).toBe(false);
  });

  it('poids cuit : null ou de 0 exclu à 20 000 inclus', () => {
    expect(has(draft({ cookedWeightG: null }), 'cooked-weight-invalid')).toBe(false);
    for (const w of [0, -5, 20_001, Number.NaN]) expect(has(draft({ cookedWeightG: w }), 'cooked-weight-invalid')).toBe(true);
    expect(has(draft({ cookedWeightG: 20_000, ingredients: [{ ...pasta, grams: 10_000 }] }), 'cooked-weight-invalid')).toBe(false);
  });

  it('de 1 à 60 ingrédients', () => {
    expect(has(draft({ ingredients: [] }), 'ingredients-empty')).toBe(true);
    expect(has(draft({ ingredients: Array.from({ length: 60 }, () => oil) }), 'ingredients-too-many')).toBe(false);
    expect(has(draft({ ingredients: Array.from({ length: 61 }, () => oil) }), 'ingredients-too-many')).toBe(true);
  });

  it('grammes d\'un ingrédient : > 0 et ≤ 10 000, problème rattaché à l\'index', () => {
    for (const g of [0, -1, 10_001, Number.NaN]) expect(has(draft({ ingredients: [pasta, { ...tomato, grams: g }] }), 'ingredient-grams-invalid', 1)).toBe(true);
    expect(has(draft({ ingredients: [{ ...tomato, grams: 10_000 }] }), 'ingredient-grams-invalid', 0)).toBe(false);
  });

  it('nom d\'ingrédient vide', () => {
    expect(has(draft({ ingredients: [{ ...pasta, name: ' ' }] }), 'ingredient-name-empty', 0)).toBe(true);
  });

  it('valeurs pour 100 g dans les bornes de food (kcal 0..900, macros 0..100), null admis', () => {
    const bad = (per100g: Ing['per100g']): boolean => has(draft({ ingredients: [{ ...pasta, per100g }] }), 'ingredient-value-invalid', 0);
    const ok = pasta.per100g;
    expect(bad({ ...ok, kcal: 901 })).toBe(true);
    expect(bad({ ...ok, kcal: -1 })).toBe(true);
    expect(bad({ ...ok, proteinG: 100.5 })).toBe(true);
    expect(bad({ ...ok, fiberG: -0.1 })).toBe(true);
    expect(bad({ ...ok, carbG: Number.NaN })).toBe(true);
    expect(bad({ ...ok, kcal: 900, proteinG: 100, fatG: null, carbG: null, fiberG: null })).toBe(false);
    expect(bad({ kcal: null, proteinG: null, fatG: null, carbG: null, fiberG: null })).toBe(false);
  });

  it('source d\'ingrédient inconnue', () => {
    expect(has(draft({ ingredients: [{ ...pasta, source: 'photo' as never }] }), 'ingredient-source-invalid', 0)).toBe(true);
  });

  it('poids cuit incompatible avec les totaux (macros ou énergie supérieures à la masse)', () => {
    // 200 g de pâtes + 20 g d'huile : au moins ~ 205 g de macros ; 100 g cuits est impossible.
    expect(has(draft({ cookedWeightG: 100 }), 'cooked-weight-inconsistent')).toBe(true);
    expect(has(draft({ cookedWeightG: 900 }), 'cooked-weight-inconsistent')).toBe(false);
  });

  it('plusieurs problèmes sont tous rendus', () => {
    const list = codes(draft({ name: '', servings: 0, ingredients: [] }));
    expect(list.map((p) => p.code)).toEqual(expect.arrayContaining(['name-empty', 'servings-invalid', 'ingredients-empty']));
  });
});

describe('I4-07 : recipeTotals', () => {
  it('somme grammes/100 × valeur pour 100 g, au dixième', () => {
    expect(recipeTotals(recipe())).toEqual({ kcal: 930.8, proteinG: 26.7, fatG: 23.6, carbG: 155.7, fiberG: 9.6 });
  });

  it('un nutriment inconnu dans UN ingrédient rend CE total null, les autres restent calculés', () => {
    const r = recipe({ ingredients: [pasta, { ...tomato, per100g: { ...tomato.per100g, fiberG: null } }, oil] });
    const t = recipeTotals(r);
    expect(t.fiberG).toBeNull();
    expect(t.kcal).toBe(930.8);
    expect(t.proteinG).toBe(26.7);
  });

  it('une valeur connue à 0 reste connue (0), pas null', () => {
    const t = recipeTotals(recipe({ ingredients: [oil] }));
    expect(t.proteinG).toBe(0);
    expect(t.carbG).toBe(0);
  });

  it('tout inconnu : tout null, jamais 0', () => {
    const unknown = { kcal: null, proteinG: null, fatG: null, carbG: null, fiberG: null };
    expect(recipeTotals(recipe({ ingredients: [{ ...pasta, per100g: unknown }] }))).toEqual(unknown);
  });

  it('un arrondi ne transforme jamais un inconnu en 0 (petite valeur connue : 0, inconnue : null)', () => {
    const tiny = recipeTotals(recipe({ ingredients: [{ ...pasta, grams: 1, per100g: { ...pasta.per100g, fiberG: 0.04 } }] }));
    expect(tiny.fiberG).toBe(0);
    const unk = recipeTotals(recipe({ ingredients: [{ ...pasta, grams: 1, per100g: { ...pasta.per100g, fiberG: null } }] }));
    expect(unk.fiberG).toBeNull();
  });

  it('recette sans ingrédient : tout null', () => {
    expect(recipeTotals(recipe({ ingredients: [] }))).toEqual({ kcal: null, proteinG: null, fatG: null, carbG: null, fiberG: null });
  });
});

describe('I4-07 : recipePerServing', () => {
  it('total / portions, arrondi au dixième depuis la valeur non arrondie', () => {
    expect(recipePerServing(recipe())).toEqual({ kcal: 232.7, proteinG: 6.7, fatG: 5.9, carbG: 38.9, fiberG: 2.4 });
  });

  it('un nutriment inconnu reste null par portion', () => {
    const r = recipe({ ingredients: [{ ...pasta, per100g: { ...pasta.per100g, fatG: null } }] });
    expect(recipePerServing(r).fatG).toBeNull();
    expect(recipePerServing(r).kcal).toBe(175);
  });

  it('1 portion = le total', () => {
    expect(recipePerServing(recipe({ servings: 1 }))).toEqual(recipeTotals(recipe({ servings: 1 })));
  });
});

describe('I4-07 : recipeWeightG', () => {
  it('poids cuit si renseigné, sinon somme des grammes crus', () => {
    expect(recipeWeightG(recipe({ cookedWeightG: 850 }))).toBe(850);
    expect(recipeWeightG(recipe())).toBe(520);
  });
  it('sans ingrédient ni poids cuit : 0', () => {
    expect(recipeWeightG(recipe({ ingredients: [] }))).toBe(0);
  });
});

describe('I4-07 : ingredientFromFood', () => {
  const food = (over: Partial<SearchableFood> = {}): SearchableFood => ({
    ref: 'ciqual:20047',
    provenance: 'ciqual',
    name: 'Tomate, crue',
    brand: null,
    barcode: null,
    per100g: { kcal: 18, proteinG: 0.9, fatG: 0.2, carbG: 3.9, fiberG: null },
    ...over,
  });

  it('prend l\'instantané pour 100 g, la provenance et la référence', () => {
    expect(ingredientFromFood(food(), 150)).toEqual({
      name: 'Tomate, crue',
      source: 'ciqual',
      foodRef: 'ciqual:20047',
      grams: 150,
      per100g: { kcal: 18, proteinG: 0.9, fatG: 0.2, carbG: 3.9, fiberG: null },
    });
  });

  it('fiche perso et OFF', () => {
    expect(ingredientFromFood(food({ provenance: 'custom', ref: '33333333-3333-4333-8333-333333333333' }), 10)?.source).toBe('custom');
    expect(ingredientFromFood(food({ provenance: 'off', ref: '44444444-4444-4444-8444-444444444444' }), 10)?.source).toBe('off');
  });

  it('grammes invalides : null', () => {
    for (const g of [0, -1, 10_001, Number.NaN]) expect(ingredientFromFood(food(), g)).toBeNull();
  });

  it('l\'instantané est une copie : modifier la fiche ensuite ne change pas l\'ingrédient', () => {
    const f = food();
    const i = ingredientFromFood(f, 100);
    expect(i?.per100g).not.toBe(f.per100g);
  });
});
