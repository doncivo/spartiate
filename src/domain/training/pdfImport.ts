/**
 * Import d'un programme depuis un PDF (IMPORT-0303, D-676) : règles pures appliquées avant et après la lecture par la façade
 * `src/platform/pdf` (pdf.js). Limites vérifiées avant tout appel à la bibliothèque, lignes reconstruites depuis les éléments de texte
 * (ordre vertical puis horizontal), PDF scanné reconnu par l'absence de texte utile. Le texte obtenu passe ensuite par `parseProgramText`
 * comme un collage. Module pur et déterministe ; les octets du PDF ne sont jamais conservés.
 */

export interface PdfImportLimits {
  /** Taille maximale du fichier, en octets. */
  readonly maxBytes: number;
  /** Nombre maximal de pages lues. */
  readonly maxPages: number;
}

/** 10 Mo et 20 pages : un programme tient en quelques pages ; au-delà, le fichier n'est pas lu. */
export const PDF_IMPORT_LIMITS: PdfImportLimits = { maxBytes: 10 * 1024 * 1024, maxPages: 20 };
/** En dessous de 20 lettres ou chiffres sur l'ensemble des pages, le PDF est tenu pour scanné (aucun texte à lire). */
export const PDF_IMPORT_MIN_USEFUL_CHARS = 20;

/** Raisons de refus, toutes dites à l'écran. `unsupported` : la bibliothèque n'a pas pu se charger sur l'appareil ; `timeout` : lecture trop longue. */
export type PdfRefusal = 'too-large' | 'too-many-pages' | 'encrypted' | 'invalid' | 'no-text' | 'unsupported' | 'timeout';
export const PDF_REFUSALS: readonly PdfRefusal[] = ['too-large', 'too-many-pages', 'encrypted', 'invalid', 'no-text', 'unsupported', 'timeout'];
/** Relecture IMPORT-0303 : au-delà de 20 s, la lecture du document est arrêtée (`destroy()`) et refusée « timeout ». */
export const PDF_IMPORT_TIMEOUT_MS = 20_000;

/** Résultat de la lecture : lignes de chaque page, ou refus. */
export type PdfTextResult = { readonly pages: readonly (readonly string[])[] } | { readonly reason: PdfRefusal };

/** Taille du fichier (avant d'en lire les octets). */
export function pdfSizeRefusal(size: number, limits: PdfImportLimits): PdfRefusal | null {
  if (!Number.isFinite(size) || size <= 0) return 'invalid';
  return size > limits.maxBytes ? 'too-large' : null;
}

/** Les lecteurs tolèrent des octets avant l'en-tête : il est cherché dans les 1 024 premiers octets. */
const HEADER_WINDOW = 1024;
const HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d]; // « %PDF- »

/** Octets lus : taille, puis en-tête « %PDF- ». */
export function pdfBytesRefusal(bytes: Uint8Array, limits: PdfImportLimits): PdfRefusal | null {
  const size = pdfSizeRefusal(bytes.byteLength, limits);
  if (size !== null) return size;
  const end = Math.min(bytes.byteLength, HEADER_WINDOW) - HEADER.length;
  for (let start = 0; start <= end; start++) {
    if (HEADER.every((b, i) => bytes[start + i] === b)) return null;
  }
  return 'invalid';
}

/** Nombre de pages annoncé par le document. */
export function pdfPagesRefusal(numPages: number, limits: PdfImportLimits): PdfRefusal | null {
  if (!Number.isInteger(numPages) || numPages <= 0) return 'invalid';
  return numPages > limits.maxPages ? 'too-many-pages' : null;
}

/** Élément de texte d'une page (coordonnées PDF : origine en bas à gauche, `y` croît vers le haut). */
export interface PdfTextItem {
  readonly str: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Deux éléments sont sur la même ligne si leurs bases diffèrent de moins de la moitié de la hauteur du texte (1 point au moins). */
const SAME_LINE_RATIO = 0.5;
/** Écart horizontal au-delà duquel deux morceaux sont séparés par une espace (fraction de la hauteur du texte). */
const SPACE_RATIO = 0.15;

/** Lignes d'une page : éléments regroupés par hauteur (haut en bas), puis triés de gauche à droite ; espaces réduites. */
export function pdfLinesFromItems(items: readonly PdfTextItem[]): string[] {
  const usable = items.filter((it) => it.str.trim() !== '' && Number.isFinite(it.x) && Number.isFinite(it.y));
  const sorted = [...usable].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: PdfTextItem[][] = [];
  for (const it of sorted) {
    const row = rows[rows.length - 1];
    const head = row?.[0];
    const tolerance = Math.max(1, SAME_LINE_RATIO * Math.max(Number.isFinite(it.height) ? it.height : 0, Number.isFinite(head?.height) ? (head?.height ?? 0) : 0));
    if (row && head && Math.abs(head.y - it.y) <= tolerance) row.push(it);
    else rows.push([it]);
  }
  const lines: string[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    let text = '';
    let end: number | null = null;
    for (const it of row) {
      const gap = end === null ? 0 : it.x - end;
      const space = end !== null && gap > SPACE_RATIO * (Number.isFinite(it.height) && it.height > 0 ? it.height : 10);
      text += space ? ` ${it.str}` : it.str;
      end = it.x + (Number.isFinite(it.width) ? it.width : 0);
    }
    const line = text.replace(/\s+/g, ' ').trim();
    if (line !== '') lines.push(line);
  }
  return lines;
}

/** Lettres et chiffres (toutes écritures). */
export function usefulCharCount(text: string): number {
  return text.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
}

/** PDF scanné : moins de `PDF_IMPORT_MIN_USEFUL_CHARS` caractères utiles sur l'ensemble des pages. */
export function pdfTextRefusal(pages: readonly (readonly string[])[]): PdfRefusal | null {
  let count = 0;
  for (const page of pages) for (const line of page) count += usefulCharCount(line);
  return count < PDF_IMPORT_MIN_USEFUL_CHARS ? 'no-text' : null;
}

/** Texte remis à l'analyseur : une ligne par ligne lue, les pages à la suite (un saut de page ne coupe pas une séance). */
export function pdfPagesToImportText(pages: readonly (readonly string[])[]): string {
  return pages.flatMap((page) => page).join('\n');
}
