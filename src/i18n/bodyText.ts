import type { CatalogTranslator, PlainCatalogKey } from './catalogText';
import { bodyFr } from './fr.body';

/** Textes de « Profil et poids », à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type BodyTextKey = keyof typeof bodyFr;
/** CLEAN-0296 (C-085) : clés sans paramètre `{x}`. */
export type BodyPlainKey = PlainCatalogKey<typeof bodyFr>;

function translate(key: BodyTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = bodyFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
/** CLEAN-0296 (C-085, D-644) : paramètres typés comme par `catalogText` ; corps gardé ici, l'écran ne précharge aucun bloc de plus. */
export const tBody: CatalogTranslator<typeof bodyFr> = translate;

/** Nombre affiché avec la virgule française : 82.4 → « 82,4 ». */
export const formatKg = (kg: number): string => String(kg).replace('.', ',');
