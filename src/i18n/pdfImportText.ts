import { catalogText, type PlainCatalogKey } from './catalogText';
import { pdfImportFr } from './fr.pdfImport';

/** Textes de la lecture d'un PDF (IMPORT-0303) ; importé seulement par le bloc à la demande `PdfReader`. */
export type PdfImportPlainKey = PlainCatalogKey<typeof pdfImportFr>;

export const tPdfImport = catalogText(pdfImportFr);
