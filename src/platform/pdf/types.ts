/**
 * Contrat de la lecture du texte d'un PDF (IMPORT-0303, D-676). Une seule implémentation réelle : pdf.js (`pdfjs-dist`, build legacy),
 * chargé à la demande par `index.ts`, seul fichier qui l'importe ; un faux pour Vitest (`testing.ts`, crochet `__CT_FAKE_PDF__`).
 * Texte extrait localement, aucun appel réseau ; les octets passent en mémoire et ne sont jamais enregistrés.
 */
export type { PdfImportLimits, PdfRefusal, PdfTextResult } from '../../domain/training/pdfImport';
import type { PdfImportLimits, PdfTextResult } from '../../domain/training/pdfImport';

/** Lit le texte de chaque page ; ne rejette jamais (tout échec est un refus nommé). */
export type ExtractPdfText = (bytes: Uint8Array, limits: PdfImportLimits) => Promise<PdfTextResult>;
