/**
 * Types des recettes (I4-07, D-80). Une recette porte son propre instantané des valeurs pour 100 g de chaque ingrédient : elle ne dépend
 * ni de la présence d'une fiche `food` ni de la table Ciqual à la lecture, et un ingrédient modifié plus tard ne change pas la recette.
 * Valeur inconnue = `null`, jamais 0 (§ 15.1).
 */

import type { IsoDateTime } from '../types';
import type { Per100g } from './food';

export const RECIPE_NAME_MAX = 120;
export const RECIPE_SERVINGS_MAX = 100;
export const RECIPE_COOKED_WEIGHT_MAX_G = 20_000;
export const RECIPE_INGREDIENT_MAX = 60;
export const RECIPE_INGREDIENT_GRAMS_MAX = 10_000;

/** Origine de l'ingrédient copié : fiche perso, Ciqual ou Open Food Facts. */
export type IngredientSource = 'custom' | 'ciqual' | 'off';

export interface RecipeIngredient {
  readonly id: string;
  /** Rang dans la recette, à partir de 0. */
  readonly position: number;
  readonly name: string;
  readonly source: IngredientSource;
  /** Référence d'origine (id de fiche `food` ou code Ciqual), pour information ; `null` si inconnue. */
  readonly foodRef: string | null;
  readonly grams: number;
  /** Instantané pour 100 g, pris à l'ajout de l'ingrédient. */
  readonly per100g: Per100g;
}

export interface Recipe {
  readonly id: string;
  readonly name: string;
  /** Nombre de portions, entier de 1 à 100. */
  readonly servings: number;
  /** Poids cuit total en grammes (facultatif) : sert aux ajouts « par grammes » ; sinon le poids cru des ingrédients. */
  readonly cookedWeightG: number | null;
  readonly ingredients: readonly RecipeIngredient[];
  readonly updatedAt: IsoDateTime;
}

/** Recette en cours de saisie, avant enregistrement (identifiants posés par le dépôt). */
export interface RecipeDraft {
  readonly name: string;
  readonly servings: number;
  readonly cookedWeightG: number | null;
  readonly ingredients: readonly Omit<RecipeIngredient, 'id' | 'position'>[];
}
