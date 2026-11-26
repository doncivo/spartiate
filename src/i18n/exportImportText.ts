import type { CatalogTranslator, PlainCatalogKey } from './catalogText';
import { exportImportFr } from './fr.exportImport';

/** Textes de « Export et import », à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type ExportImportTextKey = keyof typeof exportImportFr;
/** CLEAN-0296 (C-085) : clés sans paramètre `{x}`. */
export type ExportImportPlainKey = PlainCatalogKey<typeof exportImportFr>;

function translate(key: ExportImportTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = exportImportFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
/** CLEAN-0296 (C-085, D-644) : paramètres typés comme par `catalogText` ; corps gardé ici, l'écran ne précharge aucun bloc de plus. */
export const tExportImport: CatalogTranslator<typeof exportImportFr> = translate;
