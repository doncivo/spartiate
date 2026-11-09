import { describe, expect, it } from 'vitest';
import type { SearchableFood } from './foodSearch';
import { ingredientFromFood, validateRecipeDraft } from './recipe';
import { RECIPE_INGREDIENT_NAME_MAX, type RecipeDraft } from './recipeTypes';

/** REV-01 constat 7 : une seule borne pour l'instantané d'ingrédient, la validation du domaine et le repository. */
const food = (name: string): SearchableFood => ({ ref: 'ciqual:20047', provenance: 'ciqual', name, brand: null, barcode: null, per100g: { kcal: 18, proteinG: 0.9, fatG: 0.2, carbG: 3.9, fiberG: null } });
const draftWith = (name: string): RecipeDraft => ({ name: 'Recette', servings: 2, cookedWeightG: null, ingredients: [{ name, source: 'custom', foodRef: null, grams: 100, per100g: food('x').per100g }] });

describe('REV-01 constat 7 : borne du nom d’ingrédient', () => {
  it('la borne est unique et vaut 120 (CHECK de la table recipe_ingredient, sans migration)', () => {
    expect(RECIPE_INGREDIENT_NAME_MAX).toBe(120);
  });

  it('l’instantané d’un aliment au nom de 150 ou 200 caractères est rogné à la borne et valide', () => {
    for (const length of [150, 200, 300]) {
      const ingredient = ingredientFromFood(food('x'.repeat(length)), 100);
      expect(ingredient?.name).toHaveLength(RECIPE_INGREDIENT_NAME_MAX);
      expect(validateRecipeDraft({ ...draftWith('a'), ingredients: ingredient ? [ingredient] : [] })).toEqual([]);
    }
  });

  it('limite exacte : 120 caractères acceptés, 121 refusés par le domaine avec un problème nommé', () => {
    expect(validateRecipeDraft(draftWith('x'.repeat(120)))).toEqual([]);
    expect(validateRecipeDraft(draftWith('x'.repeat(121)))).toEqual([{ code: 'ingredient-name-too-long', index: 0 }]);
  });
});
