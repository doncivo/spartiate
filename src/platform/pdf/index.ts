import type * as Pdfjs from 'pdfjs-dist';
import { PDF_IMPORT_TIMEOUT_MS, pdfBytesRefusal, pdfLinesFromItems, pdfPagesRefusal, pdfTextRefusal, type PdfTextItem } from '../../domain/training/pdfImport';
import type { FakePdfHook } from './testing';
import type { ExtractPdfText, PdfImportLimits, PdfTextResult } from './types';

export type { ExtractPdfText, PdfImportLimits, PdfRefusal, PdfTextResult } from './types';

/**
 * Façade de lecture du texte d'un PDF (IMPORT-0303, D-676). SEUL fichier qui importe `pdfjs-dist` (règle eslint), et seulement par
 * `import()` : la bibliothèque (build legacy, 6.5.438 épinglée) et son worker ne quittent jamais le bloc à la demande.
 *
 * - Worker : fichier local émis par Vite (`?url`), même origine que l'app ; CSP inchangée (`worker-src 'self'`, D-650). Aucune URL de
 *   document, de CMap, de police standard, d'ICC ni de wasm : rien n'est demandé au réseau.
 * - Options : polices jamais converties ni cherchées sur le système, XFA ignoré, wasm coupé, arrêt à la première erreur de structure.
 * - Limites du domaine (`PDF_IMPORT_LIMITS`) vérifiées avant tout chargement ; `destroy()` de la tâche après chaque lecture, réussie ou non.
 * - Délai maximal `PDF_IMPORT_TIMEOUT_MS` (20 s) : au-delà, tâche détruite et refus « timeout » (relecture).
 * - Ne rejette jamais : tout échec est un refus nommé que l'écran affiche.
 */

export type PdfjsModule = Pick<typeof Pdfjs, 'getDocument' | 'GlobalWorkerOptions'>;

let loaded: Promise<PdfjsModule> | null = null;

function loadPdfjs(): Promise<PdfjsModule> {
  loaded ??= Promise.all([import('pdfjs-dist/legacy/build/pdf.min.mjs'), import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  });
  // Un échec de chargement (bloc absent, réseau local coupé en développement) n'est pas mis en cache : l'essai suivant recharge.
  loaded.catch(() => {
    loaded = null;
  });
  return loaded;
}

/** Erreurs de pdf.js reconnues par leur nom (`PasswordException`, `InvalidPDFException`…). */
function refusalOf(error: unknown): 'encrypted' | 'invalid' {
  return error instanceof Error && error.name === 'PasswordException' ? 'encrypted' : 'invalid';
}

function textItems(items: readonly unknown[]): PdfTextItem[] {
  const out: PdfTextItem[] = [];
  for (const raw of items) {
    if (typeof raw !== 'object' || raw === null || !('str' in raw)) continue;
    const item = raw as { str: unknown; transform?: unknown; width?: unknown; height?: unknown };
    const transform = Array.isArray(item.transform) ? (item.transform as unknown[]) : [];
    out.push({
      str: typeof item.str === 'string' ? item.str : '',
      x: Number(transform[4]),
      y: Number(transform[5]),
      width: Number(item.width),
      height: Number(item.height),
    });
  }
  return out;
}

/** Lecteur sur un module pdf.js donné (injecté par les tests ; `extractPdfText` charge le vrai). */
export function createPdfTextExtractor(load: () => Promise<PdfjsModule>, timeoutMs: number = PDF_IMPORT_TIMEOUT_MS): ExtractPdfText {
  return async (bytes: Uint8Array, limits: PdfImportLimits): Promise<PdfTextResult> => {
    const early = pdfBytesRefusal(bytes, limits);
    if (early !== null) return { reason: early };
    let pdfjs: PdfjsModule;
    try {
      pdfjs = await load();
    } catch {
      return { reason: 'unsupported' };
    }
    let task: ReturnType<PdfjsModule['getDocument']>;
    try {
      task = pdfjs.getDocument({
        // Copie : pdf.js transfère le tampon au worker ; celui de l'appelant reste intact, aucun des deux n'est conservé.
        data: bytes.slice(),
        disableFontFace: true,
        useSystemFonts: false,
        useWorkerFetch: false,
        useWasm: false,
        enableXfa: false,
        stopAtErrors: true,
        verbosity: 0,
      });
    } catch {
      return { reason: 'invalid' };
    }
    const reading = (async (): Promise<PdfTextResult> => {
      try {
        const pdf = await task.promise;
        const pages = pdfPagesRefusal(pdf.numPages, limits);
        if (pages !== null) return { reason: pages };
        const lines: string[][] = [];
        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n);
          const content = await page.getTextContent();
          lines.push(pdfLinesFromItems(textItems(content.items)));
        }
        const scanned = pdfTextRefusal(lines);
        return scanned !== null ? { reason: scanned } : { pages: lines };
      } catch (error) {
        return { reason: refusalOf(error) };
      }
    })();
    // Relecture IMPORT-0303 : délai maximal ; au-delà, la tâche est détruite (worker arrêté) et la lecture refusée « timeout ».
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expired = new Promise<PdfTextResult>((resolve) => {
      timer = setTimeout(() => resolve({ reason: 'timeout' }), timeoutMs);
    });
    try {
      return await Promise.race([reading, expired]);
    } finally {
      clearTimeout(timer);
      await task.destroy().catch(() => undefined);
    }
  };
}

const extractWithPdfjs = createPdfTextExtractor(loadPdfjs);

/**
 * Lit le texte de chaque page d'un PDF. En développement et en test seulement, `globalThis.__CT_FAKE_PDF__` remplace pdf.js par un
 * résultat prévu (comme `__CT_FAKE_OCR__`), après les mêmes contrôles de taille et d'en-tête.
 */
export const extractPdfText: ExtractPdfText = async (bytes, limits) => {
  if (import.meta.env.DEV) {
    const hook = (globalThis as Record<string, unknown>)['__CT_FAKE_PDF__'] as FakePdfHook | undefined;
    if (hook) {
      const early = pdfBytesRefusal(bytes, limits);
      if (early !== null) return { reason: early };
      hook.calls.push({ size: bytes.byteLength });
      return hook.result;
    }
  }
  return extractWithPdfjs(bytes, limits);
};
