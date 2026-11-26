import type { CatalogTranslator, PlainCatalogKey } from './catalogText';
import { recoveryFr } from './fr.recovery';

/** Textes des cadrans de récupération, à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type RecoveryTextKey = keyof typeof recoveryFr;
/** CLEAN-0297 (C-085) : clés sans paramètre `{x}` (tables de libellés passées sans paramètre). */
export type RecoveryPlainKey = PlainCatalogKey<typeof recoveryFr>;

function translate(key: RecoveryTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = recoveryFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
/** CLEAN-0297 (C-085) : paramètres typés comme par `catalogText` ; corps d'origine gardé ici (départ inchangé, import de type seul). */
export const tRecovery: CatalogTranslator<typeof recoveryFr> = translate;
