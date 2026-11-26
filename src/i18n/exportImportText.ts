import { catalogText, type PlainCatalogKey } from './catalogText';
import { exportImportFr } from './fr.exportImport';

/** Textes de « Export et import », à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type ExportImportTextKey = keyof typeof exportImportFr;
/** CLEAN-0296 (C-085) : clés sans paramètre `{x}`. */
export type ExportImportPlainKey = PlainCatalogKey<typeof exportImportFr>;

export const tExportImport = catalogText(exportImportFr);
