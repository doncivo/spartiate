/** Entrée de journal issue d'une recette et recherche de recettes (I4-07, D-80) : instantané, jamais 0 pour un inconnu. */
import { describe, expect, it } from 'vitest';

import type { LocalDate, LocalTime } from '../types';
import { validateMealEntry } from './mealEntry';
import { parseRecipeFoodId, recipeFoodId } from './food';
import { entryFromRecipe, recipeAsSearchable, searchRecipes } from './recipe';
import type { Recipe, RecipeIngredient } from './recipeTypes';

const ID = '11111111-1111-4111-8111-111111111111';
const at = { date: '2026-11-09' as LocalDate, time: '12:30' as LocalTime };
const ing = (position: number, name: string, grams: number, per100g: RecipeIngredient['per100g']): RecipeIngredient => ({
  id: `22222222-2222-4222-8222-22222222222${position}`,
  position,
  name,
  source: 'custom',
  foodRef: null,
  grams,
  per100g,
});
const pasta = ing(0, 'Pâtes', 200, { kcal: 350, proteinG: 12, fatG: 1.5, carbG: 72, fiberG: 3 });
const tomato = ing(1, 'Tomate', 300, { kcal: 18, proteinG: 0.9, fatG: 0.2, carbG: 3.9, fiberG: 1.2 });
const oil = ing(2, 'Huile', 20, { kcal: 884, proteinG: 0, fatG: 100, carbG: 0, fiberG: 0 });
const recipe = (over: Partial<Recipe> = {}): Recipe => ({
  id: ID,
  name: 'Pâtes tomate',
  servings: 4,
  cookedWeightG: null,
  ingredients: [pasta, tomato, oil],
  updatedAt: '2026-11-09T10:00:00.000Z' as Recipe['updatedAt'],
  ...over,
});

describe('I4-07 : identifiant de recette dans le journal', () => {
  it('recipe:<id> et son analyse', () => {
    expect(recipeFoodId(ID)).toBe(`recipe:${ID}`);
    expect(parseRecipeFoodId(`recipe:${ID}`)).toBe(ID);
    expect(parseRecipeFoodId(ID)).toBeNull();
    expect(parseRecipeFoodId('recipe:pomme')).toBeNull();
    expect(parseRecipeFoodId('ciqual:1000')).toBeNull();
  });

  it('validateMealEntry accepte recipe:<uuid> avec la provenance custom, refuse les autres', () => {
    const d = entryFromRecipe(recipe(), { kind: 'servings', n: 1 }, at);
    expect(d).not.toBeNull();
    if (d === null) return;
    expect(validateMealEntry(d)).toEqual([]);
    expect(validateMealEntry({ ...d, source: 'ciqual' })).toContain('source-food-mismatch');
    expect(validateMealEntry({ ...d, foodId: 'recipe:pomme' })).toContain('food-id-invalid');
  });
});

describe('I4-07 : entryFromRecipe', () => {
  it('une portion : instantané des valeurs, grammes = poids / portions', () => {
    expect(entryFromRecipe(recipe(), { kind: 'servings', n: 1 }, at)).toEqual({
      date: at.date,
      time: at.time,
      foodId: `recipe:${ID}`,
      foodName: 'Pâtes tomate',
      source: 'custom',
      grams: 130,
      kcal: 232.7,
      proteinG: 6.7,
      fatG: 5.9,
      carbG: 38.9,
      method: 'search',
      confidence: null,
    });
  });

  it('plusieurs portions et portion fractionnaire', () => {
    const two = entryFromRecipe(recipe(), { kind: 'servings', n: 2 }, at);
    expect(two?.grams).toBe(260);
    expect(two?.kcal).toBe(465.4);
    expect(two?.fatG).toBe(11.8);
    const half = entryFromRecipe(recipe(), { kind: 'servings', n: 0.5 }, at);
    expect(half?.grams).toBe(65);
    expect(half?.kcal).toBeCloseTo(116.35, 0);
  });

  it('par grammes : part du poids de la recette', () => {
    const e = entryFromRecipe(recipe(), { kind: 'grams', g: 200 }, at);
    expect(e?.grams).toBe(200);
    expect(e?.kcal).toBe(358);
    expect(e?.fatG).toBe(9.1);
  });

  it('le poids cuit sert de référence quand il est renseigné', () => {
    const r = recipe({ cookedWeightG: 400 });
    expect(entryFromRecipe(r, { kind: 'servings', n: 1 }, at)?.grams).toBe(100);
    expect(entryFromRecipe(r, { kind: 'grams', g: 200 }, at)?.kcal).toBe(465.4);
  });

  it('un nutriment inconnu dans un ingrédient reste null dans l\'entrée, les autres sont calculés', () => {
    const r = recipe({ ingredients: [pasta, { ...tomato, per100g: { ...tomato.per100g, fatG: null } }, oil] });
    const e = entryFromRecipe(r, { kind: 'servings', n: 1 }, at);
    expect(e?.fatG).toBeNull();
    expect(e?.kcal).toBe(232.7);
    expect(e === null ? [] : validateMealEntry(e)).toEqual([]);
  });

  it('nom tronqué à 200 caractères', () => {
    expect(entryFromRecipe(recipe({ name: 'x'.repeat(300) }), { kind: 'servings', n: 1 }, at)?.foodName).toHaveLength(200);
  });

  it('quantité invalide, recette sans poids : null', () => {
    for (const n of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) expect(entryFromRecipe(recipe(), { kind: 'servings', n }, at)).toBeNull();
    for (const g of [0, -5, Number.NaN, 10_001]) expect(entryFromRecipe(recipe(), { kind: 'grams', g }, at)).toBeNull();
    expect(entryFromRecipe(recipe({ ingredients: [] }), { kind: 'servings', n: 1 }, at)).toBeNull();
    expect(entryFromRecipe(recipe({ servings: 100, cookedWeightG: 20_000 }), { kind: 'servings', n: 100 }, at)).toBeNull();
  });

  it('l\'instantané est figé : changer la recette ensuite ne modifie pas l\'entrée déjà produite', () => {
    const e = entryFromRecipe(recipe(), { kind: 'servings', n: 1 }, at);
    entryFromRecipe(recipe({ ingredients: [pasta] }), { kind: 'servings', n: 1 }, at);
    expect(e?.kcal).toBe(232.7);
  });
});

describe('I4-07 : recettes dans la recherche', () => {
  it('recipeAsSearchable : nom, provenance « recipe », kcal par portion, portions', () => {
    expect(recipeAsSearchable(recipe())).toEqual({
      ref: `recipe:${ID}`,
      provenance: 'recipe',
      name: 'Pâtes tomate',
      kcalPerServing: 232.7,
      servings: 4,
      servingGrams: 130,
    });
  });

  it('kcal par portion null si un ingrédient ignore l\'énergie', () => {
    const r = recipe({ ingredients: [{ ...pasta, per100g: { ...pasta.per100g, kcal: null } }] });
    expect(recipeAsSearchable(r).kcalPerServing).toBeNull();
  });

  it('searchRecipes : accents et casse ignorés, début de nom d\'abord, plafonné', () => {
    const list = [
      recipeAsSearchable(recipe({ name: 'Gratin de pâtes' })),
      recipeAsSearchable(recipe({ id: '33333333-3333-4333-8333-333333333333', name: 'Pates carbo' })),
      recipeAsSearchable(recipe({ id: '44444444-4444-4444-8444-444444444444', name: 'Salade' })),
    ];
    expect(searchRecipes('PATES', list).map((r) => r.name)).toEqual(['Pates carbo', 'Gratin de pâtes']);
    expect(searchRecipes('pâtes', list, { limit: 1 })).toHaveLength(1);
    expect(searchRecipes('   ', list)).toEqual([]);
  });
});
