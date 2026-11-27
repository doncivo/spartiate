import { describe, expect, it } from 'vitest';
import {
  PDF_IMPORT_LIMITS,
  PDF_IMPORT_MIN_USEFUL_CHARS,
  pdfBytesRefusal,
  pdfLinesFromItems,
  pdfPagesRefusal,
  pdfPagesToImportText,
  pdfSizeRefusal,
  pdfTextRefusal,
  usefulCharCount,
  type PdfTextItem,
} from './pdfImport';
import { parseProgramText } from './programImport';

/** IMPORT-0303 (D-676) : règles pures de l'import d'un PDF (limites, reconstruction des lignes, PDF scanné). */

const item = (str: string, x: number, y: number, extra: Partial<PdfTextItem> = {}): PdfTextItem => ({ str, x, y, width: str.length * 6, height: 12, ...extra });
const header = (rest: number[] = []): Uint8Array => new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, ...rest]);

describe('limites (avant tout appel à la bibliothèque)', () => {
  it('Given les limites par défaut, Then 10 Mo et 20 pages, 20 caractères utiles', () => {
    expect(PDF_IMPORT_LIMITS).toEqual({ maxBytes: 10 * 1024 * 1024, maxPages: 20 });
    expect(PDF_IMPORT_MIN_USEFUL_CHARS).toBe(20);
  });

  it('Given une taille au-delà de 10 Mo, Then « too-large » ; à la limite, accepté', () => {
    expect(pdfSizeRefusal(10 * 1024 * 1024 + 1, PDF_IMPORT_LIMITS)).toBe('too-large');
    expect(pdfSizeRefusal(10 * 1024 * 1024, PDF_IMPORT_LIMITS)).toBeNull();
    expect(pdfSizeRefusal(0, PDF_IMPORT_LIMITS)).toBe('invalid');
  });

  it('Given des octets sans en-tête %PDF-, Then « invalid » ; avec l’en-tête, accepté ; trop lourds, « too-large » d’abord', () => {
    expect(pdfBytesRefusal(new TextEncoder().encode('pas un pdf'), PDF_IMPORT_LIMITS)).toBe('invalid');
    expect(pdfBytesRefusal(new Uint8Array(), PDF_IMPORT_LIMITS)).toBe('invalid');
    expect(pdfBytesRefusal(header([0x31]), PDF_IMPORT_LIMITS)).toBeNull();
    // En-tête précédé d'octets parasites (tolérance des lecteurs : 1 024 premiers octets).
    expect(pdfBytesRefusal(new Uint8Array([0x0a, 0x0a, ...header()]), PDF_IMPORT_LIMITS)).toBeNull();
    expect(pdfBytesRefusal(header(), { maxBytes: 3, maxPages: 20 })).toBe('too-large');
  });

  it('Given 21 pages, Then « too-many-pages » ; 20, accepté ; 0, « invalid »', () => {
    expect(pdfPagesRefusal(21, PDF_IMPORT_LIMITS)).toBe('too-many-pages');
    expect(pdfPagesRefusal(20, PDF_IMPORT_LIMITS)).toBeNull();
    expect(pdfPagesRefusal(0, PDF_IMPORT_LIMITS)).toBe('invalid');
  });
});

describe('reconstruction des lignes depuis les éléments de texte', () => {
  it('Given des éléments dans le désordre, Then ordre vertical (haut en bas) puis horizontal', () => {
    const lines = pdfLinesFromItems([item('Squat', 72, 700), item('Jour A', 72, 760), item('4×8-10', 200, 700), item('Rowing 4 x 10', 72, 680)]);
    expect(lines).toEqual(['Jour A', 'Squat 4×8-10', 'Rowing 4 x 10']);
  });

  it('Given une même ligne légèrement décalée en hauteur (exposant, police), Then une seule ligne', () => {
    expect(pdfLinesFromItems([item('Curl', 72, 700), item('3×12', 200, 702.5)])).toEqual(['Curl 3×12']);
  });

  it('Given des morceaux de mot collés (crénage), Then aucun espace ajouté ; un écart réel donne un espace', () => {
    expect(pdfLinesFromItems([item('Dévelop', 72, 700, { width: 42 }), item('pé', 114, 700, { width: 12 }), item('couché', 130, 700)])).toEqual(['Développé couché']);
  });

  it('Given des éléments vides, des espaces et une ligne sans texte, Then ignorés ; espaces multiples réduits', () => {
    expect(pdfLinesFromItems([item('', 72, 760), item('   ', 72, 740), item('Fentes  ', 72, 720), item(' 3×10', 120, 720)])).toEqual(['Fentes 3×10']);
    expect(pdfLinesFromItems([])).toEqual([]);
  });

  it('Given des coordonnées non finies, Then l’élément est ignoré (jamais d’exception)', () => {
    expect(pdfLinesFromItems([item('A', Number.NaN, 700), item('Squat 4×8', 72, 700)])).toEqual(['Squat 4×8']);
  });
});

describe('PDF scanné (sans texte utile)', () => {
  it('compte lettres et chiffres seulement', () => {
    expect(usefulCharCount('— 4 × 8 —')).toBe(2);
    expect(usefulCharCount('Développé')).toBe(9);
  });

  it('Given moins de 20 caractères utiles sur toutes les pages, Then « no-text » ; 20, accepté', () => {
    expect(pdfTextRefusal([])).toBe('no-text');
    expect(pdfTextRefusal([[], ['· · ·', '12']])).toBe('no-text');
    expect(pdfTextRefusal([['abcdefghij'], ['klmnopqrs']])).toBe('no-text');
    expect(pdfTextRefusal([['abcdefghij'], ['klmnopqrst']])).toBeNull();
  });
});

describe('texte transmis à l’analyseur existant (comme un collage)', () => {
  it('Given deux pages, Then une ligne par ligne lue, pages à la suite, analysées par parseProgramText', () => {
    const text = pdfPagesToImportText([
      ['Jour A — Haut', 'Développé couché 4×8-10 RIR 2'],
      ['Jour B — Bas', 'Squat 4×6'],
    ]);
    expect(text).toBe('Jour A — Haut\nDéveloppé couché 4×8-10 RIR 2\nJour B — Bas\nSquat 4×6');
    const parsed = parseProgramText(text);
    expect(parsed.sessions.map((s) => s.exercises.length)).toEqual([1, 1]);
  });
});
