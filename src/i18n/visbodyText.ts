import type { CatalogTranslator, PlainCatalogKey } from './catalogText';
import { visbodyFr } from './fr.visbody';

/** SUIVIS-029d : textes des bilans VISBODY, à part du catalogue principal ; importé seulement par le bloc Corps, chargé à la demande. */
export type VisbodyTextKey = keyof typeof visbodyFr;
/** CLEAN-0297 (C-085) : clés sans paramètre `{x}` (tables de libellés passées sans paramètre). */
export type VisbodyPlainKey = PlainCatalogKey<typeof visbodyFr>;

function translate(key: VisbodyTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = visbodyFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
/** CLEAN-0297 (C-085) : paramètres typés comme par `catalogText` ; corps d'origine gardé ici (départ inchangé, import de type seul). */
export const tVisbody: CatalogTranslator<typeof visbodyFr> = translate;
