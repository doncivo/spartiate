/**
 * Fiches alimentaires, portions, totaux d'une prise et cache Open Food Facts (PRD § 15.3–15.4 ; I4-02). Module pur : aucune horloge
 * (l'instant est un paramètre), aucun import Tauri ni React. Une valeur inconnue est `null`, jamais zéro (§ 15.1).
 */

import { isId, isIsoDateTime, type IsoDateTime } from '../types';

/** Sources STOCKÉES (table `food`) : Ciqual n'a aucune ligne (contenu embarqué, comme les exercices du JSON). */
export const FOOD_SOURCES = ['custom', 'off'] as const;
export type FoodSource = (typeof FOOD_SOURCES)[number];

/** Provenance affichée d'une ligne de journal : fiche perso, Ciqual, Open Food Facts, estimation (photo), saisie manuelle (Quick Add). */
export const ENTRY_SOURCES = ['custom', 'ciqual', 'off', 'estimate', 'manual'] as const;
export type EntrySource = (typeof ENTRY_SOURCES)[number];

export const FOOD_NAME_MAX = 120;
/** Nom figé d'une entrée de journal : 200 caractères (23 noms Ciqual dépassent 120, le plus long en compte 191). */
export const ENTRY_NAME_MAX = 200;
export const FOOD_BRAND_MAX = 120;
export const PORTION_LABEL_MAX = 80;
/** Plafond d'une prise et d'une portion, en grammes. */
export const FOOD_GRAMS_MAX = 10_000;
export const PORTION_GRAMS_MAX = 5_000;
/** Énergie maximale plausible pour 100 g (lipide pur ≈ 900 kcal). */
export const KCAL_PER_100G_MAX = 900;
/** Durée de validité du cache Open Food Facts (H-12). */
export const OFF_CACHE_DAYS = 90;
/** Dérive d'horloge tolérée entre appareils pour une date de récupération dans le futur. */
const CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;

/** Valeurs pour 100 g ; `null` = inconnue. */
export interface Per100g {
  readonly kcal: number | null;
  readonly proteinG: number | null;
  readonly fatG: number | null;
  readonly carbG: number | null;
  readonly fiberG: number | null;
}

export interface FoodDraft {
  readonly source: FoodSource;
  /** EAN-8, UPC-A, EAN-13 ou GTIN-14, clé de contrôle valide ; `null` sans code. */
  readonly barcode: string | null;
  readonly name: string;
  readonly brand: string | null;
  readonly per100g: Per100g;
  /** Date de récupération du produit Open Food Facts (cache) ; `null` pour une fiche personnelle. */
  readonly fetchedAt: IsoDateTime | null;
}

export type FoodIssue =
  | 'source-invalid'
  | 'name-empty'
  | 'name-too-long'
  | 'brand-too-long'
  | 'barcode-invalid'
  | 'value-invalid'
  | 'energy-too-high'
  | 'macros-exceed-100g'
  | 'no-nutrient'
  | 'off-needs-barcode'
  | 'off-needs-fetched-at'
  | 'custom-has-fetched-at';

/** Code-barres GS1 : 8, 12, 13 ou 14 chiffres, clé de contrôle (poids 3 et 1 en partant de la droite) valide. */
export function isValidBarcode(code: string): boolean {
  if (!/^[0-9]+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return false;
  const digits = [...code].map(Number);
  const check = digits.pop() ?? 0;
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) sum += (digits[digits.length - 1 - i] ?? 0) * (i % 2 === 0 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === check;
}

const isNumber = (v: number | null): v is number => v !== null && Number.isFinite(v);

/** Valide une fiche avant écriture ; liste vide si valide. Les valeurs inconnues (`null`) sont admises, la fiche doit en avoir au moins une. */
export function validateFoodDraft(draft: FoodDraft): FoodIssue[] {
  const issues: FoodIssue[] = [];
  if (!(FOOD_SOURCES as readonly string[]).includes(draft.source)) issues.push('source-invalid');
  const name = draft.name.trim();
  if (name.length === 0) issues.push('name-empty');
  else if (name.length > FOOD_NAME_MAX) issues.push('name-too-long');
  if (draft.brand !== null && draft.brand.trim().length > FOOD_BRAND_MAX) issues.push('brand-too-long');
  if (draft.barcode !== null && !isValidBarcode(draft.barcode)) issues.push('barcode-invalid');

  const p = draft.per100g;
  const values = [p.kcal, p.proteinG, p.fatG, p.carbG, p.fiberG];
  if (values.some((v) => v !== null && (!Number.isFinite(v) || v < 0))) issues.push('value-invalid');
  else {
    if ([p.proteinG, p.fatG, p.carbG, p.fiberG].some((v) => v !== null && v > 100)) issues.push('value-invalid');
    if (p.kcal !== null && p.kcal > KCAL_PER_100G_MAX) issues.push('energy-too-high');
    if (isNumber(p.proteinG) && isNumber(p.fatG) && isNumber(p.carbG) && p.proteinG + p.fatG + p.carbG > 100.5) issues.push('macros-exceed-100g');
    if (values.every((v) => v === null)) issues.push('no-nutrient');
  }

  if (draft.source === 'off') {
    if (draft.barcode === null) issues.push('off-needs-barcode');
    if (draft.fetchedAt === null) issues.push('off-needs-fetched-at');
  } else if (draft.source === 'custom' && draft.fetchedAt !== null) issues.push('custom-has-fetched-at');
  return issues;
}

/**
 * Avertissement (jamais une erreur) : l'énergie annoncée s'écarte de 4P + 4G + 9L de plus de 30 % (et 40 kcal). L'alcool, les polyols et
 * les fibres expliquent des écarts légitimes. Inconnu : jamais signalé.
 */
export function energyMismatch(p: Per100g): boolean {
  if (!isNumber(p.kcal) || !isNumber(p.proteinG) || !isNumber(p.fatG) || !isNumber(p.carbG)) return false;
  const estimate = 4 * p.proteinG + 4 * p.carbG + 9 * p.fatG;
  return Math.abs(p.kcal - estimate) > Math.max(40, 0.3 * estimate);
}

export interface PortionDraft {
  readonly label: string;
  readonly grams: number;
  readonly position: number;
}
export type PortionIssue = 'label-empty' | 'label-too-long' | 'grams-invalid' | 'position-invalid';

export function validatePortion(portion: PortionDraft): PortionIssue[] {
  const issues: PortionIssue[] = [];
  const label = portion.label.trim();
  if (label.length === 0) issues.push('label-empty');
  else if (label.length > PORTION_LABEL_MAX) issues.push('label-too-long');
  if (!Number.isFinite(portion.grams) || portion.grams <= 0 || portion.grams > PORTION_GRAMS_MAX) issues.push('grams-invalid');
  if (!Number.isInteger(portion.position) || portion.position < 0) issues.push('position-invalid');
  return issues;
}

export interface Totals {
  readonly kcal: number | null;
  readonly proteinG: number | null;
  readonly fatG: number | null;
  readonly carbG: number | null;
}

const tenth = (valuePer100g: number, grams: number): number => Math.round((valuePer100g * grams) / 10) / 10;

/** Totaux d'une prise (valeurs pour 100 g × grammes, au dixième) ; une valeur inconnue reste `null`, des grammes invalides : `null`. */
export function computeTotals(p: Per100g, grams: number): Totals | null {
  if (!Number.isFinite(grams) || grams <= 0 || grams > FOOD_GRAMS_MAX) return null;
  const of = (v: number | null): number | null => (v === null ? null : tenth(v, grams));
  return { kcal: of(p.kcal), proteinG: of(p.proteinG), fatG: of(p.fatG), carbG: of(p.carbG) };
}

/** Référence d'un aliment dans le journal : Ciqual (`ciqual:<code>`) ou fiche stockée (UUID). */
export type FoodRef = { readonly kind: 'ciqual'; readonly code: string } | { readonly kind: 'stored'; readonly id: string };

export const foodRefToId = (ref: FoodRef): string => (ref.kind === 'ciqual' ? `ciqual:${ref.code}` : ref.id);

export function parseFoodId(id: string): FoodRef | null {
  const ciqual = /^ciqual:([0-9]{1,8})$/.exec(id);
  if (ciqual) return { kind: 'ciqual', code: ciqual[1] ?? '' };
  return isId(id) ? { kind: 'stored', id } : null;
}

/**
 * I4-07 (D-80) : référence d'une recette dans le journal, `recipe:<UUID>` (43 caractères, la colonne admet 128). Distincte de `FoodRef` : `parseFoodId`
 * ne la lit pas (les écrans existants la traitent comme un aliment inconnu, sans exception).
 */
export const RECIPE_FOOD_PREFIX = 'recipe:';

export const recipeFoodId = (recipeId: string): string => `${RECIPE_FOOD_PREFIX}${recipeId}`;

/** Identifiant de la recette citée, ou `null` si ce n'est pas exactement `recipe:` suivi d'un UUID. */
export function parseRecipeFoodId(id: string): string | null {
  if (!id.startsWith(RECIPE_FOOD_PREFIX)) return null;
  const rest = id.slice(RECIPE_FOOD_PREFIX.length);
  return isId(rest) ? rest : null;
}

export type OffCacheState = 'fresh' | 'expired' | 'invalid';

/**
 * État du cache d'un produit OFF : valide jusqu'à 90 jours inclus, expiré au-delà ; une date illisible ou à plus de 24 h dans le futur est
 * invalide (jamais prise pour valide).
 */
export function offCacheState(fetchedAt: string, now: IsoDateTime): OffCacheState {
  if (!isIsoDateTime(fetchedAt)) return 'invalid';
  const fetched = Date.parse(fetchedAt);
  const current = Date.parse(now);
  if (Number.isNaN(fetched) || Number.isNaN(current)) return 'invalid';
  if (fetched - current > CLOCK_SKEW_MS) return 'invalid';
  return current - fetched > OFF_CACHE_DAYS * 24 * 60 * 60 * 1000 ? 'expired' : 'fresh';
}
