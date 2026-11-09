import { recipesFr } from './fr.recipes';

/** Textes des recettes de Nutrition (I4-07) ; importé seulement par les écrans de recettes, chargés à la demande. */
export type RecipesTextKey = keyof typeof recipesFr;

export function tRecipes(key: RecipesTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = recipesFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
