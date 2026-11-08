import type { FoodRecord, FoodRepository } from '../../../db/repositories/foodRepository';
import { normalizeBarcode } from '../../../domain/nutrition/barcode';
import type { FoodDraft } from '../../../domain/nutrition/food';
import { missingNutrients, offCacheDecision, offProductToDraft, type OffMissing, type OffRefusal } from '../../../domain/nutrition/offProduct';
import type { IsoDateTime } from '../../../domain/types';
import type { OffClient, OffErrorKind } from '../../../platform/off';

/**
 * Open Food Facts côté cas d'usage (I4-05, § 15.3–15.4, H-12) : lecture par code-barres (cache de 90 jours d'abord, réseau ensuite),
 * recherche en ligne sur appel explicite, dépôt de la fiche choisie dans `food`. Aucun appel au montage ni à la frappe : seul l'appelant
 * (un geste d'Ali) déclenche ces fonctions. Toute défaillance est rendue (jamais silencieuse).
 */

/** Le client est résolu à la demande (import dynamique) ; `null` : aucun client (navigateur). */
export interface OffDeps {
  readonly foods: FoodRepository;
  readonly client: () => Promise<OffClient | null>;
  readonly now: IsoDateTime;
}

export interface OffFailure {
  readonly kind: OffErrorKind | 'unavailable' | 'write-failed';
  readonly status?: number;
  readonly retryAfterSeconds?: number;
}

export type BarcodeResolution =
  | { readonly kind: 'invalid-code' }
  | {
      readonly kind: 'found';
      readonly food: FoodRecord;
      /** custom : fiche perso ; cache : fiche de moins de 90 jours ; network : récupérée à l'instant ; stale : périmée, réseau en échec. */
      readonly via: 'custom' | 'cache' | 'network' | 'stale';
      readonly missing: readonly OffMissing[];
      readonly refreshFailure?: OffFailure;
    }
  | { readonly kind: 'not-found'; readonly code: string }
  | { readonly kind: 'refused'; readonly code: string; readonly reason: OffRefusal }
  | { readonly kind: 'failed'; readonly code: string; readonly failure: OffFailure };

/** Échec quelconque -> nature dite ; aucun texte d'erreur n'est repris. */
function failureOf(error: unknown): OffFailure {
  if (typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'OffError') {
    const e = error as { kind: OffErrorKind; status?: number; retryAfterSeconds?: number };
    return { kind: e.kind, ...(e.status === undefined ? {} : { status: e.status }), ...(e.retryAfterSeconds === undefined ? {} : { retryAfterSeconds: e.retryAfterSeconds }) };
  }
  return { kind: 'bad-response' };
}

/**
 * Code saisi ou scanné -> fiche. Une fiche perso du code prime ; une fiche OFF de moins de 90 jours est lue sans réseau ; au-delà (ou
 * sans fiche) : un appel, la fiche valide est déposée dans le cache. Réseau en échec avec une fiche périmée : elle est proposée, marquée.
 */
export async function resolveBarcode(deps: OffDeps, input: string): Promise<BarcodeResolution> {
  const barcode = normalizeBarcode(input);
  if (barcode === null) return { kind: 'invalid-code' };
  const code = barcode.code;
  const existing = (await deps.foods.findByBarcode(code)) ?? (input.trim() !== code ? await deps.foods.findByBarcode(input.trim()) : null);
  if (existing?.source === 'custom') return { kind: 'found', food: existing, via: 'custom', missing: [] };
  if (existing && offCacheDecision(existing.fetchedAt ?? '', deps.now) === 'use-cache') {
    return { kind: 'found', food: existing, via: 'cache', missing: missingNutrients(existing.per100g) };
  }

  const staleOrFail = (failure: OffFailure): BarcodeResolution =>
    existing ? { kind: 'found', food: existing, via: 'stale', missing: missingNutrients(existing.per100g), refreshFailure: failure } : { kind: 'failed', code, failure };

  let client: OffClient | null;
  try {
    client = await deps.client();
  } catch {
    return staleOrFail({ kind: 'unavailable' });
  }
  if (client === null) return staleOrFail({ kind: 'unavailable' });
  let response;
  try {
    response = await client.product(code);
  } catch (error) {
    return staleOrFail(failureOf(error));
  }
  const raw = response.found ? response.products.find((p) => normalizeBarcode(p.code)?.code === code) : undefined;
  if (raw === undefined) return { kind: 'not-found', code };
  const converted = offProductToDraft(raw, deps.now);
  if (!converted.ok) return { kind: 'refused', code, reason: converted.reason };
  try {
    const food = await deps.foods.cacheOff(converted.draft);
    return { kind: 'found', food, via: 'network', missing: converted.missing };
  } catch {
    return staleOrFail({ kind: 'write-failed' });
  }
}

export interface OnlineItem {
  readonly draft: FoodDraft;
  readonly missing: readonly OffMissing[];
}

export type OnlineSearch =
  | { readonly kind: 'ok'; readonly items: readonly OnlineItem[]; readonly refused: number }
  | { readonly kind: 'invalid-query' }
  | { readonly kind: 'failed'; readonly failure: OffFailure };

export const ONLINE_RESULTS_MAX = 20;

/** Recherche par texte, sur appel explicite : n'écrit rien (la fiche choisie est déposée par `chooseOnline`). */
export async function searchOnline(deps: OffDeps, query: string): Promise<OnlineSearch> {
  if (query.replace(/\s+/g, ' ').trim().length < 2) return { kind: 'invalid-query' };
  let client: OffClient | null;
  try {
    client = await deps.client();
  } catch {
    return { kind: 'failed', failure: { kind: 'unavailable' } };
  }
  if (client === null) return { kind: 'failed', failure: { kind: 'unavailable' } };
  let response;
  try {
    response = await client.search(query);
  } catch (error) {
    const failure = failureOf(error);
    return failure.kind === 'invalid-input' ? { kind: 'invalid-query' } : { kind: 'failed', failure };
  }
  const items: OnlineItem[] = [];
  let refused = response.skipped ?? 0;
  for (const raw of response.products) {
    const converted = offProductToDraft(raw, deps.now);
    if (!converted.ok) refused += 1;
    else if (items.length < ONLINE_RESULTS_MAX) items.push({ draft: converted.draft, missing: converted.missing });
  }
  return { kind: 'ok', items, refused };
}

/** Dépose (ou rafraîchit en place) la fiche choisie dans le cache `food` (source off, code, date de récupération). */
export function chooseOnline(foods: FoodRepository, draft: FoodDraft): Promise<FoodRecord> {
  return foods.cacheOff(draft);
}
