import { catalogText, type PlainCatalogKey } from './catalogText';
import { nutritionQuickFr } from './fr.nutritionQuick';

/** Textes de la saisie rapide des repas (REPAS-029a) ; importé seulement par le panneau, chargé à la demande. */
export type NutritionQuickTextKey = keyof typeof nutritionQuickFr;
/** CLEAN-0296 (C-085) : clés sans paramètre `{x}`. */
export type NutritionQuickPlainKey = PlainCatalogKey<typeof nutritionQuickFr>;

export const tQuick = catalogText(nutritionQuickFr);
