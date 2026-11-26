import type { CatalogTranslator, PlainCatalogKey } from './catalogText';
import { appleIntelligenceFr } from './fr.appleIntelligence';

/** Textes de l'essai Apple Intelligence, à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type AppleIntelligenceTextKey = keyof typeof appleIntelligenceFr;
/** CLEAN-0296 (C-085) : clés sans paramètre `{x}`. */
export type AppleIntelligencePlainKey = PlainCatalogKey<typeof appleIntelligenceFr>;

function translate(key: AppleIntelligenceTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = appleIntelligenceFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
/** CLEAN-0296 (C-085, D-644) : paramètres typés comme par `catalogText` ; corps gardé ici, l'écran ne précharge aucun bloc de plus. */
export const tAppleIntelligence: CatalogTranslator<typeof appleIntelligenceFr> = translate;
