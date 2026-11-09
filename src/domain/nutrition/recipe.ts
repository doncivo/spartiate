/**
 * Recettes (PRD § 15.3 ; I4-07, D-80). Module pur : aucune horloge, aucun import Tauri ni React. Une recette porte l'instantané des valeurs
 * pour 100 g de chaque ingrédient. Un nutriment inconnu (`null`) dans UN ingrédient rend le total de CE nutriment `null` : jamais une somme
 * partielle présentée comme complète, jamais 0 par défaut (§ 15.1). Les valeurs rendues sont arrondies au dixième ; l'arrondi part de la
 * valeur non arrondie et ne touche pas à un inconnu.
 */

import { ENTRY_NAME_MAX, KCAL_PER_100G_MAX, type Per100g } from './food';
import type { SearchableFood } from './foodSearch';
import {
  RECIPE_COOKED_WEIGHT_MAX_G,
  RECIPE_INGREDIENT_GRAMS_MAX,
  RECIPE_INGREDIENT_MAX,
  RECIPE_NAME_MAX,
  RECIPE_SERVINGS_MAX,
  type IngredientSource,
  type Recipe,
  type RecipeDraft,
  type RecipeIngredient,
} from './recipeTypes';

export type RecipeProblemCode =
  | 'name-empty'
  | 'name-too-long'
  | 'servings-invalid'
  | 'cooked-weight-invalid'
  | 'cooked-weight-inconsistent'
  | 'ingredients-empty'
  | 'ingredients-too-many'
  | 'ingredient-name-empty'
  | 'ingredient-source-invalid'
  | 'ingredient-grams-invalid'
  | 'ingredient-value-invalid';

/** `index` : rang de l'ingrédient concerné, `null` pour un problème de la recette entière. */
export interface RecipeProblem {
  readonly code: RecipeProblemCode;
  readonly index: number | null;
}

export type DraftIngredient = Omit<RecipeIngredient, 'id' | 'position'>;

const INGREDIENT_SOURCES: readonly IngredientSource[] = ['custom', 'ciqual', 'off'];

const isNum = (v: number | null): v is number => v !== null && Number.isFinite(v);
const tenth = (v: number): number => Math.round(v * 10) / 10;

function valuesInvalid(p: Per100g): boolean {
  const all = [p.kcal, p.proteinG, p.fatG, p.carbG, p.fiberG];
  if (all.some((v) => v !== null && (!Number.isFinite(v) || v < 0))) return true;
  if (p.kcal !== null && p.kcal > KCAL_PER_100G_MAX) return true;
  return [p.proteinG, p.fatG, p.carbG, p.fiberG].some((v) => v !== null && v > 100);
}

/** Totaux bruts (non arrondis) ; `null` par nutriment dès qu'un ingrédient l'ignore ou que la recette est vide. */
function rawTotals(ingredients: readonly DraftIngredient[]): Record<keyof Per100g, number | null> {
  const sum = (pick: (p: Per100g) => number | null): number | null => {
    if (ingredients.length === 0) return null;
    let total = 0;
    for (const i of ingredients) {
      const v = pick(i.per100g);
      if (!isNum(v) || !Number.isFinite(i.grams)) return null;
      total += (i.grams / 100) * v;
    }
    return total;
  };
  return {
    kcal: sum((p) => p.kcal),
    proteinG: sum((p) => p.proteinG),
    fatG: sum((p) => p.fatG),
    carbG: sum((p) => p.carbG),
    fiberG: sum((p) => p.fiberG),
  };
}

/** Problèmes d'un brouillon de recette ; liste vide si valide. */
export function validateRecipeDraft(draft: RecipeDraft): RecipeProblem[] {
  const out: RecipeProblem[] = [];
  const add = (code: RecipeProblemCode, index: number | null = null): void => {
    out.push({ code, index });
  };
  const name = draft.name.trim();
  if (name.length === 0) add('name-empty');
  else if (name.length > RECIPE_NAME_MAX) add('name-too-long');
  if (!Number.isInteger(draft.servings) || draft.servings < 1 || draft.servings > RECIPE_SERVINGS_MAX) add('servings-invalid');
  const cooked = draft.cookedWeightG;
  if (cooked !== null && (!Number.isFinite(cooked) || cooked <= 0 || cooked > RECIPE_COOKED_WEIGHT_MAX_G)) add('cooked-weight-invalid');

  if (draft.ingredients.length === 0) add('ingredients-empty');
  else if (draft.ingredients.length > RECIPE_INGREDIENT_MAX) add('ingredients-too-many');
  draft.ingredients.forEach((ing, index) => {
    if (ing.name.trim().length === 0) add('ingredient-name-empty', index);
    if (!INGREDIENT_SOURCES.includes(ing.source)) add('ingredient-source-invalid', index);
    if (!Number.isFinite(ing.grams) || ing.grams <= 0 || ing.grams > RECIPE_INGREDIENT_GRAMS_MAX) add('ingredient-grams-invalid', index);
    if (valuesInvalid(ing.per100g)) add('ingredient-value-invalid', index);
  });

  // Le poids cuit doit pouvoir porter les totaux : sinon une portion « par grammes » échouerait à la validation de l'entrée de journal.
  if (cooked !== null && Number.isFinite(cooked) && cooked > 0 && !out.some((p) => p.index !== null)) {
    const t = rawTotals(draft.ingredients);
    const macros = [t.proteinG, t.fatG, t.carbG];
    if (macros.every((v) => v !== null) && macros.reduce<number>((a, b) => a + (b ?? 0), 0) > cooked * 1.005 + 0.1) add('cooked-weight-inconsistent');
    else if (t.kcal !== null && t.kcal > (KCAL_PER_100G_MAX * cooked) / 100 + 0.5) add('cooked-weight-inconsistent');
  }
  return out;
}

export interface RecipeTotals {
  readonly kcal: number | null;
  readonly proteinG: number | null;
  readonly fatG: number | null;
  readonly carbG: number | null;
  readonly fiberG: number | null;
}

const rounded = (t: Record<keyof Per100g, number | null>, divisor: number): RecipeTotals => {
  const of = (v: number | null): number | null => (v === null ? null : tenth(v / divisor));
  return { kcal: of(t.kcal), proteinG: of(t.proteinG), fatG: of(t.fatG), carbG: of(t.carbG), fiberG: of(t.fiberG) };
};

/** Totaux de la recette entière, au dixième ; `null` par nutriment inconnu dans au moins un ingrédient. */
export function recipeTotals(recipe: Pick<Recipe, 'ingredients'>): RecipeTotals {
  return rounded(rawTotals(recipe.ingredients), 1);
}

/** Valeurs d'une portion : total non arrondi / portions, puis arrondi au dixième. */
export function recipePerServing(recipe: Pick<Recipe, 'ingredients' | 'servings'>): RecipeTotals {
  return rounded(rawTotals(recipe.ingredients), recipe.servings);
}

/** Poids de la recette en grammes : poids cuit si renseigné, sinon somme des grammes crus. */
export function recipeWeightG(recipe: Pick<Recipe, 'ingredients' | 'cookedWeightG'>): number {
  if (recipe.cookedWeightG !== null) return recipe.cookedWeightG;
  return tenth(recipe.ingredients.reduce((a, i) => a + i.grams, 0));
}

/**
 * Ingrédient copié depuis un aliment du catalogue (Perso, Ciqual ou OFF) : instantané des valeurs pour 100 g, provenance et référence
 * d'origine. `null` si les grammes sont invalides.
 */
export function ingredientFromFood(food: SearchableFood, grams: number): DraftIngredient | null {
  if (!Number.isFinite(grams) || grams <= 0 || grams > RECIPE_INGREDIENT_GRAMS_MAX) return null;
  return {
    name: food.name.slice(0, ENTRY_NAME_MAX),
    source: food.provenance,
    foodRef: food.ref,
    grams,
    per100g: { ...food.per100g },
  };
}
