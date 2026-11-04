import { exportImportFr } from './fr.exportImport';

/** Textes de « Export et import », à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type ExportImportTextKey = keyof typeof exportImportFr;

export function tExportImport(key: ExportImportTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = exportImportFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
