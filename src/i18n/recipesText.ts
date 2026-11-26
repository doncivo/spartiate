import type { CatalogTranslator, PlainCatalogKey } from './catalogText';
import { recipesFr } from './fr.recipes';

/** Textes des recettes de Nutrition (I4-07) ; importé seulement par les écrans de recettes, chargés à la demande. */
export type RecipesTextKey = keyof typeof recipesFr;
/** CLEAN-0297 (C-085) : clés sans paramètre `{x}` (tables de libellés passées sans paramètre). */
export type RecipesPlainKey = PlainCatalogKey<typeof recipesFr>;

function translate(key: RecipesTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = recipesFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
/** CLEAN-0297 (C-085) : paramètres typés comme par `catalogText` ; corps d'origine gardé ici (départ inchangé, import de type seul). */
export const tRecipes: CatalogTranslator<typeof recipesFr> = translate;
