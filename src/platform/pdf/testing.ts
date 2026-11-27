import type { PdfImportLimits, PdfTextResult } from './types';

/**
 * Faux lecteur de PDF (IMPORT-0303) pour Vitest : résultat prévu, appels comptés (taille des octets seulement, jamais leur contenu).
 * `FakePdfHook` est la forme du crochet `globalThis.__CT_FAKE_PDF__`, lu par la façade en développement et en test seulement.
 */
export interface FakePdfHook {
  readonly result: PdfTextResult;
  readonly calls: Array<{ readonly size: number }>;
}

export interface FakePdfReader {
  result: PdfTextResult;
  readonly calls: Array<{ readonly size: number }>;
  extract(bytes: Uint8Array, limits: PdfImportLimits): Promise<PdfTextResult>;
}

export function createFakePdfReader(result: PdfTextResult): FakePdfReader {
  const fake: FakePdfReader = {
    result,
    calls: [],
    extract: (bytes) => {
      fake.calls.push({ size: bytes.byteLength });
      return Promise.resolve(fake.result);
    },
  };
  return fake;
}
