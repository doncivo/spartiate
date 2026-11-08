/**
 * Catalogue Ciqual embarqué (`content/food/ciqual.json`, I4-02 ; licence Etalab 2.0, H-11). Le JSON est une entrée non fiable : lecture
 * stricte à la main (ADR 0008), refus du moindre écart. Une valeur absente reste `null`, jamais zéro.
 */

import type { Per100g } from './food';
import type { SearchableFood } from './foodSearch';

export interface CiqualSource {
  readonly name: string;
  readonly publisher: string;
  readonly version: string;
  readonly doi: string;
  readonly licence: string;
  readonly url: string;
  readonly attribution: string;
}

export interface CiqualFood {
  readonly code: string;
  readonly nameFr: string;
  /** Code de groupe, ou `null` pour un « aliment moyen » (code 00, absent de la table des groupes). */
  readonly group: string | null;
  readonly per100g: Per100g;
}

export interface CiqualCatalogue {
  readonly source: CiqualSource;
  readonly groups: readonly { readonly code: string; readonly nameFr: string }[];
  readonly foods: readonly CiqualFood[];
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const SOURCE_KEYS = ['name', 'publisher', 'version', 'doi', 'licence', 'url', 'attribution'] as const;
const LIMITS = { kcal: 900, proteinG: 100, fatG: 100, carbG: 100, fiberG: 100 } as const;

function nutrient(value: unknown, max: number): number | null | undefined {
  if (value === null) return null;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? value : undefined;
}

export function parseCiqualCatalogue(raw: unknown): CiqualCatalogue | null {
  if (!isObject(raw) || raw['schemaVersion'] !== 1) return null;
  const s = raw['source'];
  if (!isObject(s) || !SOURCE_KEYS.every((k) => text(s[k]))) return null;
  const source = Object.fromEntries(SOURCE_KEYS.map((k) => [k, s[k] as string])) as unknown as CiqualSource;

  const groupList = raw['groups'];
  if (!Array.isArray(groupList)) return null;
  const groups: { code: string; nameFr: string }[] = [];
  const groupCodes = new Set<string>();
  for (const g of groupList as unknown[]) {
    if (!isObject(g) || !text(g['code']) || !text(g['nameFr']) || groupCodes.has(g['code'])) return null;
    groupCodes.add(g['code']);
    groups.push({ code: g['code'], nameFr: g['nameFr'] });
  }

  const foodList = raw['foods'];
  if (!Array.isArray(foodList)) return null;
  const foods: CiqualFood[] = [];
  const codes = new Set<string>();
  for (const f of foodList as unknown[]) {
    if (!isObject(f)) return null;
    const code = f['code'];
    if (typeof code !== 'string' || !/^[0-9]{1,8}$/.test(code) || codes.has(code) || !text(f['nameFr'])) return null;
    const group = f['group'];
    if (group !== null && (typeof group !== 'string' || !groupCodes.has(group))) return null;
    const kcal = nutrient(f['kcal'], LIMITS.kcal);
    const proteinG = nutrient(f['proteinG'], LIMITS.proteinG);
    const fatG = nutrient(f['fatG'], LIMITS.fatG);
    const carbG = nutrient(f['carbG'], LIMITS.carbG);
    const fiberG = nutrient(f['fiberG'], LIMITS.fiberG);
    if (kcal === undefined || proteinG === undefined || fatG === undefined || carbG === undefined || fiberG === undefined) return null;
    codes.add(code);
    foods.push({ code, nameFr: f['nameFr'], group, per100g: { kcal, proteinG, fatG, carbG, fiberG } });
  }
  return { source, groups, foods };
}

/** Aliments Ciqual sous la forme recherchable (référence `ciqual:<code>`). */
export function ciqualSearchable(catalogue: CiqualCatalogue): SearchableFood[] {
  return catalogue.foods.map((f) => ({ ref: `ciqual:${f.code}`, provenance: 'ciqual', name: f.nameFr, brand: null, barcode: null, per100g: f.per100g }));
}
