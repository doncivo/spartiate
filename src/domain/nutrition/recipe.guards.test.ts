import { describe, expect, it } from 'vitest';

import type { IsoDateTime, LocalDate, LocalTime } from '../types';
import { entryFromRecipe, recipeAsSearchable, recipePerServing } from './recipe';
import type { Recipe } from './recipeTypes';

/** NUTRI-0292 (C-044) : recette à 0 portion ou vide, jamais Infinity ni entrée toute nulle. Valeurs inventées. */
const base: Recipe = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Riz',
  servings: 2,
  cookedWeightG: null,
  ingredients: [{ id: '22222222-2222-4222-8222-222222222220', position: 0, name: 'Riz', source: 'custom', foodRef: null, grams: 200, per100g: { kcal: 350, proteinG: 7, fatG: 1, carbG: 78, fiberG: 1 } }],
  updatedAt: '2026-11-09T10:00:00.000Z' as IsoDateTime,
};
const at = { date: '2026-11-10' as LocalDate, time: '12:00' as LocalTime };

describe('C-044 : recettes dégénérées', () => {
  it('0 portion : valeurs par portion inconnues (jamais Infinity), poids de portion inconnu', () => {
    const zero = { ...base, servings: 0 };
    expect(recipePerServing(zero)).toEqual({ kcal: null, proteinG: null, fatG: null, carbG: null, fiberG: null });
    expect(recipeAsSearchable(zero).servingGrams).toBeNull();
    expect(recipeAsSearchable(zero).kcalPerServing).toBeNull();
  });

  it('recette sans ingrédient, même avec un poids cuit : aucune entrée de journal', () => {
    expect(entryFromRecipe({ ...base, ingredients: [], cookedWeightG: 500 }, { kind: 'grams', g: 100 }, at)).toBeNull();
  });

  it('recette normale inchangée', () => {
    expect(recipeAsSearchable(base).servingGrams).toBe(100);
    expect(entryFromRecipe(base, { kind: 'servings', n: 1 }, at)?.kcal).toBe(350);
  });
});
