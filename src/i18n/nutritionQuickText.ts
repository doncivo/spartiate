import { nutritionQuickFr } from './fr.nutritionQuick';

/** Textes de la saisie rapide des repas (REPAS-029a) ; importé seulement par le panneau, chargé à la demande. */
export type NutritionQuickTextKey = keyof typeof nutritionQuickFr;

export function tQuick(key: NutritionQuickTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = nutritionQuickFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
