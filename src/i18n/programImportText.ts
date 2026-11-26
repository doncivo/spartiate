import { catalogText, type PlainCatalogKey } from './catalogText';
import { programImportFr } from './fr.programImport';

/** Textes de l'import de programme (IMPORT-029) ; importé seulement par le bloc à la demande `ProgramImportView`. */
export type ProgramImportTextKey = keyof typeof programImportFr;
/** CLEAN-0296 (C-085) : clés sans paramètre `{x}`. */
export type ProgramImportPlainKey = PlainCatalogKey<typeof programImportFr>;

export const tImport = catalogText(programImportFr);
