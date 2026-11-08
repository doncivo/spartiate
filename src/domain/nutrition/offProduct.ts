/**
 * Fiche Open Food Facts brute -> brouillon de fiche `off` (I4-05, PRD § 15.3–15.4). Module pur : l'instant est un paramètre.
 * Une valeur absente ou illisible est `null`, jamais 0 (§ 15.1) ; le kcal manquant n'est jamais recalculé depuis les macros.
 */

import type { IsoDateTime } from '../types';
import { normalizeBarcode } from './barcode';
import { FOOD_BRAND_MAX, FOOD_NAME_MAX, offCacheState, validateFoodDraft, type FoodDraft, type Per100g } from './food';

/** Fiche telle que la façade la remet (déjà de forme vérifiée) ; les valeurs de `nutriments` restent à lire prudemment. */
export interface OffRawProduct {
  readonly code: string;
  readonly product_name?: string | undefined;
  readonly brands?: string | undefined;
  readonly quantity?: string | undefined;
  readonly nutriments: Readonly<Record<string, unknown>>;
}

export type OffMissing = keyof Per100g;
export type OffRefusal = 'no-nutrition' | 'invalid-code' | 'no-name' | 'implausible';

export type OffConversion =
  | { readonly ok: true; readonly draft: FoodDraft; readonly missing: readonly OffMissing[] }
  | { readonly ok: false; readonly reason: OffRefusal };

const KJ_PER_KCAL = 4.184;

/** Nombre fini et positif ou nul ; tout le reste (texte, NaN, négatif, infini) : `null`. */
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);

const clean = (text: string | undefined, max: number): string => (text ?? '').replace(/\s+/g, ' ').trim().slice(0, max).trimEnd();

/** Convertit la fiche ; refuse (motif typé, traduit côté i18n) une fiche sans énergie NI macros, sans nom, à code invalide ou invraisemblable. */
export function offProductToDraft(product: OffRawProduct, now: IsoDateTime): OffConversion {
  const barcode = normalizeBarcode(product.code);
  if (barcode === null) return { ok: false, reason: 'invalid-code' };
  const firstBrand = clean((product.brands ?? '').split(',')[0], FOOD_BRAND_MAX);
  const name = clean(product.product_name, FOOD_NAME_MAX) || firstBrand;
  if (name === '') return { ok: false, reason: 'no-name' };

  const n = product.nutriments;
  const kcalDirect = num(n['energy-kcal_100g']);
  const kj = num(n['energy-kj_100g']);
  const per100g: Per100g = {
    kcal: kcalDirect ?? (kj === null ? null : Math.round(kj / KJ_PER_KCAL)),
    proteinG: num(n['proteins_100g']),
    fatG: num(n['fat_100g']),
    carbG: num(n['carbohydrates_100g']),
    fiberG: num(n['fiber_100g']),
  };
  if (per100g.kcal === null && per100g.proteinG === null && per100g.fatG === null && per100g.carbG === null) return { ok: false, reason: 'no-nutrition' };

  const draft: FoodDraft = { source: 'off', barcode: barcode.code, name, brand: firstBrand === '' ? null : firstBrand, per100g, fetchedAt: now };
  if (validateFoodDraft(draft).length > 0) return { ok: false, reason: 'implausible' };
  const missing = (['kcal', 'proteinG', 'fatG', 'carbG', 'fiberG'] as const).filter((key) => per100g[key] === null);
  return { ok: true, draft, missing };
}

export type OffCacheDecision = 'use-cache' | 'refresh';

/** Fiche en cache : valide jusqu'à 90 jours, lue sans réseau ; expirée ou à date illisible : nouvel appel. */
export function offCacheDecision(fetchedAt: string, now: IsoDateTime): OffCacheDecision {
  return offCacheState(fetchedAt, now) === 'fresh' ? 'use-cache' : 'refresh';
}
