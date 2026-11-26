import type { CatalogTranslator, PlainCatalogKey } from './catalogText';
import { bodyProgressFr } from './fr.bodyProgress';

/** Textes de Progrès › Corps, à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type BodyProgressTextKey = keyof typeof bodyProgressFr;
/** CLEAN-0297 (C-085) : clés sans paramètre `{x}` (tables de libellés passées sans paramètre). */
export type BodyProgressPlainKey = PlainCatalogKey<typeof bodyProgressFr>;

function translate(key: BodyProgressTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = bodyProgressFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
/** CLEAN-0297 (C-085) : paramètres typés comme par `catalogText` ; corps d'origine gardé ici (départ inchangé, import de type seul). */
export const tBodyProgress: CatalogTranslator<typeof bodyProgressFr> = translate;

/** Nombre à virgule décimale française (« 82,5 »). */
export const formatCm = (value: number): string => String(value).replace('.', ',');
