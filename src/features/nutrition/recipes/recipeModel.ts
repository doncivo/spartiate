import { recipePerServing, recipeTotals, type Per100g, type Recipe, type RecipeProblem, type RecipeProblemCode, type RecipeTotals } from '../../../domain/nutrition';
import { formatTenth } from '../../../i18n/nutritionText';
import { tRecipes, type RecipesTextKey } from '../../../i18n/recipesText';

/**
 * Mise en forme des recettes (I4-07). Les calculs sont ceux du domaine (`recipeTotals`, `recipePerServing`) ; ici seulement l'affichage :
 * un nutriment inconnu dans un ingrédient s'écrit « — » avec sa cause, jamais une somme partielle, jamais 0.
 */

const PROBLEM_KEY: Readonly<Record<RecipeProblemCode, RecipesTextKey>> = {
  'name-empty': 'problemNameEmpty',
  'name-too-long': 'problemNameTooLong',
  'servings-invalid': 'problemServings',
  'cooked-weight-invalid': 'problemCooked',
  'cooked-weight-inconsistent': 'problemCookedInconsistent',
  'ingredients-empty': 'problemIngredientsEmpty',
  'ingredients-too-many': 'problemIngredientsMany',
  'ingredient-name-empty': 'problemIngredientName',
  'ingredient-source-invalid': 'problemIngredientSource',
  'ingredient-grams-invalid': 'problemIngredientGrams',
  'ingredient-value-invalid': 'problemIngredientValue',
};

/** Message français d'un problème de validation ; un problème d'ingrédient cite son nom (ou son rang s'il n'en a pas). */
export function problemMessage(problem: RecipeProblem, ingredientNames: readonly string[]): string {
  const index = problem.index;
  const name = index === null ? '' : (ingredientNames[index] ?? '').trim() || tRecipes('ingredientRank', { n: index + 1 });
  return tRecipes(PROBLEM_KEY[problem.code], { name });
}

export type NutrientKey = keyof Per100g;

/** Noms des ingrédients qui ignorent ce nutriment, dans l'ordre de la recette. */
export function unknownIngredients(ingredients: readonly { readonly name: string; readonly per100g: Per100g }[], key: NutrientKey): string[] {
  return ingredients.filter((i) => i.per100g[key] === null).map((i) => i.name);
}

export interface TotalsRow {
  readonly key: NutrientKey;
  readonly label: string;
  readonly total: string;
  readonly perServing: string;
  /** « inconnu dans : Riz, Sauce » quand le nutriment manque dans au moins un ingrédient ; `null` sinon. */
  readonly unknownIn: string | null;
}

const ROWS: readonly (readonly [NutrientKey, RecipesTextKey])[] = [
  ['kcal', 'rowKcal'],
  ['proteinG', 'rowProtein'],
  ['carbG', 'rowCarb'],
  ['fatG', 'rowFat'],
  ['fiberG', 'rowFiber'],
];

const show = (value: number | null): string => (value === null ? tRecipes('unknown') : formatTenth(value));

/** Lignes du tableau des valeurs : recette entière et par portion. */
export function totalsRows(recipe: Pick<Recipe, 'ingredients' | 'servings'>): TotalsRow[] {
  const total: RecipeTotals = recipeTotals(recipe);
  const serving: RecipeTotals = recipePerServing(recipe);
  return ROWS.map(([key, label]) => {
    const unknown = unknownIngredients(recipe.ingredients, key);
    return {
      key,
      label: tRecipes(label),
      total: show(total[key]),
      perServing: show(serving[key]),
      unknownIn: unknown.length === 0 ? null : tRecipes('unknownIn', { list: unknown.join(', ') }),
    };
  });
}
