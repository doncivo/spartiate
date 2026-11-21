import { parseDecimal } from '../bodyProfile';
import { isLocalDate } from '../types';

/**
 * SUIVIS-029d : bilans VISBODY saisis à la main (Progrès › Corps). Genres `visbody_*` de la table publiée `measurement` (unité dans le nom, précédent
 * D-113, aucune migration) ; un bilan = les mesures d'une même date. Chaque champ est facultatif (au moins un), borné (bornes plausibles, refus avec la
 * plage, jamais corrigé). Le métabolisme de base se saisit en kcal et se stocke en décakilocalories (`visbody_bmr_dakcal`, kcal ÷ 10) : la colonne
 * `value` est bornée sous 1 000 par le CHECK de la 0012. Le poids d'un bilan n'entre PAS dans les pesées ni dans la tendance (choix prudent). Module pur.
 *
 * Module sans dépendance vers `measurements.ts` (c'est lui qui importe ces genres).
 */

export type VisbodyUnit = 'kg' | 'pct' | 'level' | 'dakcal';
/** Genre de mesure d'un bilan VISBODY (préfixe `visbody_`, unité dans le nom). */
export type VisbodyKind = `visbody_${string}`;

export interface VisbodyField {
  readonly kind: VisbodyKind;
  readonly unit: VisbodyUnit;
  /** Bornes de SAISIE, dans l'unité affichée (kcal pour le métabolisme), incluses. */
  readonly min: number;
  readonly max: number;
  /** Plafond de la valeur stockée (unité du genre), toujours sous 1 000. */
  readonly storedMax: number;
  readonly storedMin: number;
  readonly integer: boolean;
  /** Mesure segmentaire (bras, tronc, jambes), dans la partie repliable de la saisie. */
  readonly segment: boolean;
}

const f = (kind: VisbodyKind, unit: VisbodyUnit, min: number, max: number, extra: { readonly integer?: boolean; readonly segment?: boolean } = {}): VisbodyField => {
  const scale = unit === 'dakcal' ? 10 : 1;
  return { kind, unit, min, max, storedMin: min / scale, storedMax: max / scale, integer: extra.integer ?? false, segment: extra.segment ?? false };
};

const SEGMENTS = ['arm_left', 'arm_right', 'trunk', 'leg_left', 'leg_right'] as const;

export const VISBODY_FIELDS: readonly VisbodyField[] = [
  f('visbody_weight_kg', 'kg', 20, 300),
  f('visbody_fat_pct', 'pct', 3, 70),
  f('visbody_muscle_kg', 'kg', 10, 150),
  f('visbody_visceral_level', 'level', 1, 59, { integer: true }),
  f('visbody_water_kg', 'kg', 10, 120),
  f('visbody_bmr_dakcal', 'dakcal', 500, 5000, { integer: true }),
  ...SEGMENTS.map((s) => f(`visbody_lean_${s}_kg`, 'kg', 0.5, s === 'trunk' ? 80 : 40, { segment: true })),
  ...SEGMENTS.map((s) => f(`visbody_fat_${s}_kg`, 'kg', 0.1, s === 'trunk' ? 60 : 30, { segment: true })),
];

export const VISBODY_KINDS: readonly VisbodyKind[] = VISBODY_FIELDS.map((x) => x.kind);
const BY_KIND: ReadonlyMap<string, VisbodyField> = new Map(VISBODY_FIELDS.map((x) => [x.kind, x]));

export const visbodyField = (kind: string): VisbodyField | null => BY_KIND.get(kind) ?? null;
export const isVisbodyKind = (kind: string): boolean => BY_KIND.has(kind);

/** Valeur stockée acceptable (dépôt, import d'archive) : bornes du genre, entière pour la graisse viscérale. */
export function isVisbodyStoredValue(kind: string, value: number): boolean {
  const spec = BY_KIND.get(kind);
  if (!spec || !Number.isFinite(value)) return false;
  if (spec.kind === 'visbody_visceral_level' && !Number.isInteger(value)) return false;
  return value >= spec.storedMin && value <= spec.storedMax;
}

/** Valeur affichée (kcal pour le métabolisme, sinon la valeur stockée). */
export function visbodyDisplayValue(kind: string, stored: number): number {
  return BY_KIND.get(kind)?.unit === 'dakcal' ? Math.round(stored * 10) : stored;
}

export type VisbodyFieldIssue = 'format' | 'range';
export type VisbodyForm =
  | { readonly ok: true; readonly date: string; readonly values: Readonly<Record<string, number>> }
  | { readonly ok: false; readonly empty: boolean; readonly date: 'date' | 'future' | null; readonly fields: Readonly<Record<string, VisbodyFieldIssue>> };

/** Lit une saisie : champs vides ignorés, au moins un champ ; date réelle, ni future. Valeurs rendues en unité STOCKÉE. */
export function parseVisbodyForm(texts: Readonly<Record<string, string | undefined>>, date: string, today: string): VisbodyForm {
  const dateIssue = !isLocalDate(date) ? 'date' : date > today ? 'future' : null;
  const values: Record<string, number> = {};
  const fields: Record<string, VisbodyFieldIssue> = {};
  for (const spec of VISBODY_FIELDS) {
    const raw = (texts[spec.kind] ?? '').replace(/\s/g, '');
    if (raw === '') continue;
    const v = parseDecimal(raw);
    if (v === null || (spec.integer && !Number.isInteger(v))) fields[spec.kind] = 'format';
    else if (v < spec.min || v > spec.max) fields[spec.kind] = 'range';
    else values[spec.kind] = spec.unit === 'dakcal' ? Math.round(v) / 10 : v;
  }
  const empty = Object.keys(values).length === 0 && Object.keys(fields).length === 0;
  if (empty || dateIssue !== null || Object.keys(fields).length > 0) return { ok: false, empty, date: dateIssue, fields };
  return { ok: true, date, values };
}

export interface VisbodyReport {
  readonly date: string;
  /** Valeurs STOCKÉES par genre. */
  readonly values: Readonly<Record<string, number>>;
}

/** Bilans par date, du plus ancien au plus récent (genres VISBODY seulement). */
export function visbodyReports(rows: readonly { readonly day: string; readonly kind: string; readonly value: number }[]): VisbodyReport[] {
  const byDate = new Map<string, Record<string, number>>();
  for (const r of rows) {
    if (!BY_KIND.has(r.kind)) continue;
    const values = byDate.get(r.day) ?? {};
    values[r.kind] = r.value;
    byDate.set(r.day, values);
  }
  return [...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([date, values]) => ({ date, values }));
}

export interface VisbodyChange {
  /** Valeurs AFFICHÉES (kcal pour le métabolisme). */
  readonly last: { readonly date: string; readonly value: number };
  readonly previous: { readonly date: string; readonly value: number } | null;
  /** Dernière moins précédente, au dixième (entier pour kcal et niveau) ; null avec un seul bilan (jamais 0). */
  readonly delta: number | null;
  /** Valeurs affichées des bilans qui portent la mesure, du plus ancien au plus récent (courbe). */
  readonly points: readonly number[];
}

export function visbodyChange(reports: readonly VisbodyReport[], kind: string): VisbodyChange | null {
  const carrying = reports.filter((r) => r.values[kind] !== undefined).map((r) => ({ date: r.date, value: visbodyDisplayValue(kind, r.values[kind] ?? 0) }));
  const last = carrying[carrying.length - 1];
  if (!last) return null;
  const previous = carrying[carrying.length - 2] ?? null;
  const delta = previous === null ? null : Math.round((last.value - previous.value) * 10) / 10;
  return { last, previous, delta, points: carrying.map((c) => c.value) };
}
