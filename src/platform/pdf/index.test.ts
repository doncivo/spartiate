import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PDF_IMPORT_LIMITS, PDF_IMPORT_TIMEOUT_MS } from '../../domain/training/pdfImport';
import { createPdfTextExtractor, extractPdfText, type PdfjsModule } from './index';
import { createFakePdfReader } from './testing';

/**
 * IMPORT-0303 (D-676) : la façade réelle (`pdfjs-dist` 6.5.438, build legacy) sur les PDF générés par tests/fixtures/pdf/generate.ts.
 * Sous Node, pdf.js lit dans le fil principal : le gestionnaire du worker est posé sur `globalThis.pdfjsWorker` (comme le « faux worker »
 * de pdf.js) ; dans l'app, le worker est le fichier local émis par Vite (`?url`), même origine, CSP inchangée.
 */
const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(join(import.meta.dirname, '..', '..', '..', 'tests', 'fixtures', 'pdf', name)));

beforeAll(async () => {
  (globalThis as Record<string, unknown>)['pdfjsWorker'] = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs');
});
afterEach(() => vi.restoreAllMocks());

describe('extractPdfText (pdf.js réel)', () => {
  it('Given un PDF texte de deux pages, Then les lignes de chaque page, ordre vertical puis horizontal, sans appel réseau', async () => {
    // Relecture : sous Node, pdf.js n'utilise de toute façon pas `fetch` pour des octets en mémoire ; cet espion prouve peu. La garde
    // réelle de « aucun appel réseau » est le test des options (aucune URL, `useWorkerFetch: false`) plus bas.
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await extractPdfText(fixture('texte.pdf'), PDF_IMPORT_LIMITS);
    expect(result).toEqual({
      pages: [
        ['Programme Force', 'Jour A — Haut', 'Développé couché 4×8-10 RIR 2', 'Rowing à la barre 4 x 10', 'Curl biceps 3×12'],
        ['Jour B — Bas', 'Squat à la barre : 4 séries de 6', 'Fentes 3×10'],
      ],
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Given les octets passés, Then le tampon de l’appelant reste lisible (copie transmise à pdf.js)', async () => {
    const bytes = fixture('texte.pdf');
    await extractPdfText(bytes, PDF_IMPORT_LIMITS);
    expect(bytes.byteLength).toBeGreaterThan(0);
    expect(bytes[0]).toBe(0x25);
  });

  it.each([
    ['sans-texte.pdf', 'no-text'],
    ['chiffre.pdf', 'encrypted'],
    ['21-pages.pdf', 'too-many-pages'],
    ['abime.pdf', 'invalid'],
  ] as const)('Given %s, Then refus « %s »', async (name, reason) => {
    expect(await extractPdfText(fixture(name), PDF_IMPORT_LIMITS)).toEqual({ reason });
  });

  it('Given plus de 10 Mo ou un fichier qui n’est pas un PDF, Then refus avant tout chargement de pdf.js', async () => {
    const load = vi.fn<() => Promise<PdfjsModule>>();
    const extract = createPdfTextExtractor(load);
    const big = new Uint8Array(PDF_IMPORT_LIMITS.maxBytes + 1);
    big.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
    expect(await extract(big, PDF_IMPORT_LIMITS)).toEqual({ reason: 'too-large' });
    expect(await extract(new TextEncoder().encode('bonjour'), PDF_IMPORT_LIMITS)).toEqual({ reason: 'invalid' });
    expect(load).not.toHaveBeenCalled();
  });
});

describe('createPdfTextExtractor (module pdf.js simulé)', () => {
  function stubModule(numPages: number, items: unknown[] = [], fail?: unknown) {
    const destroy = vi.fn(() => Promise.resolve());
    const options: unknown[] = [];
    const module = {
      GlobalWorkerOptions: { workerSrc: '' },
      getDocument: (opts: unknown) => {
        options.push(opts);
        return {
          promise: fail ? Promise.reject(fail) : Promise.resolve({ numPages, getPage: () => Promise.resolve({ getTextContent: () => Promise.resolve({ items }) }) }),
          destroy,
        };
      },
    } as unknown as PdfjsModule;
    return { module, destroy, options };
  }
  const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
  const line = (str: string, y: number) => ({ str, transform: [1, 0, 0, 1, 72, y], width: str.length * 6, height: 12, hasEOL: true, dir: 'ltr', fontName: 'F1' });

  it('Given une lecture, Then options sûres (aucune URL, ni police, ni wasm, ni XFA) et destroy() appelé', async () => {
    const stub = stubModule(1, [line('Squat à la barre 4×8-10 RIR 2', 700)]);
    const result = await createPdfTextExtractor(() => Promise.resolve(stub.module))(pdfBytes, PDF_IMPORT_LIMITS);
    expect(result).toEqual({ pages: [['Squat à la barre 4×8-10 RIR 2']] });
    const [opts] = stub.options as Array<Record<string, unknown>>;
    expect(opts).toMatchObject({ disableFontFace: true, useSystemFonts: false, enableXfa: false, stopAtErrors: true, useWasm: false });
    // `isEvalSupported` n'existe plus en 6.5.438 (pdf.js 6 ne fabrique plus de code par eval) : jamais transmis.
    expect(opts).not.toHaveProperty('isEvalSupported');
    for (const key of ['url', 'cMapUrl', 'standardFontDataUrl', 'wasmUrl', 'iccUrl', 'password']) expect(opts).not.toHaveProperty(key);
    expect(opts?.['data']).not.toBe(pdfBytes);
    expect(stub.destroy).toHaveBeenCalledTimes(1);
  });

  it('Given trop de pages ou un texte vide, Then refus et destroy() appelé', async () => {
    const many = stubModule(21);
    expect(await createPdfTextExtractor(() => Promise.resolve(many.module))(pdfBytes, PDF_IMPORT_LIMITS)).toEqual({ reason: 'too-many-pages' });
    expect(many.destroy).toHaveBeenCalledTimes(1);
    const empty = stubModule(1, [line('  ', 700)]);
    expect(await createPdfTextExtractor(() => Promise.resolve(empty.module))(pdfBytes, PDF_IMPORT_LIMITS)).toEqual({ reason: 'no-text' });
    expect(empty.destroy).toHaveBeenCalledTimes(1);
  });

  it('Given un mot de passe demandé, une structure invalide ou une erreur quelconque, Then encrypted, invalid, invalid ; destroy() appelé', async () => {
    const cases = [
      [Object.assign(new Error('No password given'), { name: 'PasswordException' }), 'encrypted'],
      [Object.assign(new Error('Invalid PDF structure.'), { name: 'InvalidPDFException' }), 'invalid'],
      [new Error('autre'), 'invalid'],
    ] as const;
    for (const [error, reason] of cases) {
      const stub = stubModule(1, [], error);
      expect(await createPdfTextExtractor(() => Promise.resolve(stub.module))(pdfBytes, PDF_IMPORT_LIMITS)).toEqual({ reason });
      expect(stub.destroy).toHaveBeenCalledTimes(1);
    }
  });

  it('Given une lecture qui ne rend jamais la main, Then après 20 s (horloge simulée) refus « timeout » et destroy() appelé', async () => {
    vi.useFakeTimers();
    try {
      const destroy = vi.fn(() => Promise.resolve());
      const module = {
        GlobalWorkerOptions: { workerSrc: '' },
        getDocument: () => ({ promise: new Promise(() => undefined), destroy }),
      } as unknown as PdfjsModule;
      let settled: unknown = null;
      const pending = createPdfTextExtractor(() => Promise.resolve(module))(pdfBytes, PDF_IMPORT_LIMITS).then((r) => (settled = r));
      await vi.advanceTimersByTimeAsync(PDF_IMPORT_TIMEOUT_MS - 1);
      expect(settled).toBeNull();
      await vi.advanceTimersByTimeAsync(1);
      await pending;
      expect(settled).toEqual({ reason: 'timeout' });
      expect(destroy).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('Given la bibliothèque impossible à charger, Then « unsupported » (jamais une exception)', async () => {
    expect(await createPdfTextExtractor(() => Promise.reject(new Error('bloc absent')))(pdfBytes, PDF_IMPORT_LIMITS)).toEqual({ reason: 'unsupported' });
  });
});

describe('faux lecteur (tests d’écran)', () => {
  it('rend le résultat prévu et compte les appels', async () => {
    const fake = createFakePdfReader({ reason: 'encrypted' });
    expect(await fake.extract(pdfBytes(), PDF_IMPORT_LIMITS)).toEqual({ reason: 'encrypted' });
    expect(fake.calls).toEqual([{ size: 6 }]);
  });
});

function pdfBytes(): Uint8Array {
  return new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
}
