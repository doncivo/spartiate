import { parseRecipeFoodId, recipeAsSearchable, searchRecipes, type Recipe, type RecipeSearchable } from '../../../domain/nutrition';
import type { DataAccess } from '../../../db/repositories/dataAccess';

/**
 * Recettes vues par la recherche du Journal (I4-07). Module chargé À LA DEMANDE par `FoodSearchPanel` (import dynamique), sans texte :
 * le panneau n'embarque ni les recettes ni leur catalogue tant qu'une recherche de recette n'est pas utile.
 */

const LIMIT = 50;

/** Recettes dont le nom contient tous les mots de la saisie ; sans saisie, toutes (par nom) : filtre « Mes recettes ». */
export async function findRecipes(data: DataAccess, query: string): Promise<RecipeSearchable[]> {
  const all = (await (await data.repos.recipes()).list()).map(recipeAsSearchable);
  if (query.trim() === '') return [...all].sort((a, b) => a.name.localeCompare(b.name, 'fr')).slice(0, LIMIT);
  return searchRecipes(query, all, { limit: LIMIT });
}

/** Recette citée par une référence de journal `recipe:<id>` ; `null` si la référence n'en est pas une ou si la recette n'existe plus. */
export async function loadRecipeByRef(data: DataAccess, ref: string): Promise<Recipe | null> {
  const id = parseRecipeFoodId(ref);
  if (id === null) return null;
  return (await data.repos.recipes()).get(id);
}
