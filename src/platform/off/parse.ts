import { normalizeBarcode } from '../../domain/nutrition/barcode';
import type { OffRawProduct } from '../../domain/nutrition/offProduct';

/**
 * Contrat du client Open Food Facts (commandes Rust `off_product` et `off_search`, I4-05). La réponse et l'erreur de Rust sont validées
 * à la main : aucune confiance dans la forme reçue, aucun texte libre de l'erreur n'est propagé.
 */

export const OFF_ERROR_KINDS = ['offline', 'timeout', 'rate-limited', 'http', 'bad-response', 'tls', 'invalid-input'] as const;
export type OffErrorKind = (typeof OFF_ERROR_KINDS)[number];

export class OffError extends Error {
  readonly kind: OffErrorKind;
  readonly status?: number;
  readonly retryAfterSeconds?: number;
  constructor(kind: OffErrorKind, details: { readonly status?: number; readonly retryAfterSeconds?: number } = {}) {
    super(`Open Food Facts : ${kind}`);
    this.name = 'OffError';
    this.kind = kind;
    if (details.status !== undefined) this.status = details.status;
    if (details.retryAfterSeconds !== undefined) this.retryAfterSeconds = details.retryAfterSeconds;
  }
}

export interface OffResponse {
  readonly found: boolean;
  readonly products: readonly OffRawProduct[];
  /** Produits écartés par la façade (code illisible) ; absent = 0. */
  readonly skipped?: number;
}

export interface OffClient {
  /** Un produit par code-barres (EAN-13, EAN-8, UPC-A, UPC-E). Rejette `OffError`. */
  product(barcode: string): Promise<OffResponse>;
  /** Recherche par texte, sur appel explicite. Rejette `OffError`. */
  search(query: string): Promise<OffResponse>;
}

const NUTRIMENT_KEYS = [
  'energy-kcal_100g',
  'energy-kj_100g',
  'proteins_100g',
  'fat_100g',
  'saturated-fat_100g',
  'carbohydrates_100g',
  'sugars_100g',
  'fiber_100g',
  'salt_100g',
  'sodium_100g',
] as const;

const TEXT_MAX = 500;
const PRODUCTS_MAX = 100;
const QUERY_MIN = 2;
const QUERY_MAX = 100;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): string | undefined => (typeof v === 'string' ? v.slice(0, TEXT_MAX) : undefined);
const bad = (): OffError => new OffError('bad-response');

/** Réponse de Rust -> `OffResponse` ; toute autre forme : `OffError('bad-response')`. */
export function parseOffResponse(raw: unknown): OffResponse {
  if (!isRecord(raw) || typeof raw['found'] !== 'boolean' || !Array.isArray(raw['products'])) throw bad();
  if (raw['products'].length > PRODUCTS_MAX) throw bad();
  const products: OffRawProduct[] = [];
  let skipped = 0;
  for (const item of raw['products'] as unknown[]) {
    if (!isRecord(item) || typeof item['code'] !== 'string' || !isRecord(item['nutriments'])) throw bad();
    // Un code hors 6 à 14 chiffres écarte ce seul produit (compté), jamais toute la réponse.
    if (!/^[0-9]{6,14}$/.test(item['code'])) {
      skipped += 1;
      continue;
    }
    const nutriments: Record<string, number> = {};
    for (const key of NUTRIMENT_KEYS) {
      const value = item['nutriments'][key];
      if (typeof value === 'number' && Number.isFinite(value)) nutriments[key] = value;
    }
    products.push({ code: item['code'], product_name: text(item['product_name']), brands: text(item['brands']), quantity: text(item['quantity']), nutriments });
  }
  return { found: raw['found'], products, skipped };
}

/** Rejet de `invoke` -> `OffError` ; une forme inconnue devient `bad-response`, sans reprendre de texte. */
export function parseOffError(raw: unknown): OffError {
  if (raw instanceof OffError) return raw;
  if (!isRecord(raw) || typeof raw['kind'] !== 'string' || !(OFF_ERROR_KINDS as readonly string[]).includes(raw['kind'])) return bad();
  const status = raw['status'];
  const wait = raw['retryAfterSeconds'];
  return new OffError(raw['kind'] as OffErrorKind, {
    ...(typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599 ? { status } : {}),
    ...(typeof wait === 'number' && Number.isFinite(wait) && wait > 0 && wait <= 86_400 ? { retryAfterSeconds: Math.ceil(wait) } : {}),
  });
}

/** Texte de recherche propre (espaces compactés, 2 à 100 caractères, aucun caractère de contrôle) ou `null`. */
export function queryInput(query: string): string | null {
  if (/[\p{Cc}]/u.test(query.replace(/\s/g, ' '))) return null;
  const clean = query.replace(/\s+/g, ' ').trim();
  return clean.length >= QUERY_MIN && [...clean].length <= QUERY_MAX ? clean : null;
}

/** Code propre sur 13 chiffres (ou 8, 14) pour Rust, ou `null`. */
export function barcodeInput(barcode: string): string | null {
  return normalizeBarcode(barcode)?.code ?? null;
}
