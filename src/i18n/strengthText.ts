import type { CatalogTranslator, PlainCatalogKey } from './catalogText';
import { strengthFr } from './fr.strength';

/** Textes de Progrès › Strength Score, à part du catalogue principal ; importé seulement par l'écran chargé à la demande (STR-01). */
export type StrengthTextKey = keyof typeof strengthFr;
/** CLEAN-0297 (C-085) : clés sans paramètre `{x}` (tables de libellés passées sans paramètre). */
export type StrengthPlainKey = PlainCatalogKey<typeof strengthFr>;

function translate(key: StrengthTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = strengthFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
/** CLEAN-0297 (C-085) : paramètres typés comme par `catalogText` ; corps d'origine gardé ici (départ inchangé, import de type seul). */
export const tStrength: CatalogTranslator<typeof strengthFr> = translate;

/** Charge en kg arrondie au dixième, virgule décimale (« 81,4 », « 90 »). */
export const formatStrengthKg = (kg: number): string => String(Math.round(kg * 10) / 10).replace('.', ',');
