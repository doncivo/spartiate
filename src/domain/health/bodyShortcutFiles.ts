import { Counter, isFail, parseInstant, readRows, type ShortcutParseReport } from '../recovery/shortcutFiles';

/**
 * Fichiers Renpho / Apple Santé écrits par l'app Raccourcis (I6-04, D-113 ; la balance Renpho écrit dans Santé). Module pur, sans E/S. Guide :
 * docs/guide-raccourcis-sante.md. Même tolérance que les autres fichiers du dossier `sante` : séparateur `;` ou tabulation, en-tête facultatif, BOM
 * et CRLF, décimale à virgule ou à point, unité en colonne ou collée, date ISO 8601 AVEC fuseau (sans fuseau : refusée), valeur vide refusée.
 *
 * Dix fichiers, une ligne par échantillon :
 * - `poids.csv` (kg, lb), `masse-grasse.csv` (% ; une fraction de Santé sans unité, 0,185, vaut 18,5 %), `masse-maigre.csv` (kg, lb),
 *   `tour-taille.csv` et `taille.csv` (cm, m, po) : UNE valeur par jour local de l'appareil, la plus récente ;
 * - `energie.csv` (kcal, cal, kJ), `proteines.csv`, `glucides.csv`, `lipides.csv`, `fibres.csv` (g, mg) : SOMME des échantillons par jour local.
 * Une valeur hors des bornes de plausibilité (`BODY_BOUNDS`) est rejetée et comptée (`out_of_range`) ; pour une somme, la ligne trop grande puis
 * le jour dont le total sort des bornes (un rejet par jour). Jamais une valeur corrigée en silence, jamais une valeur dans un message.
 */

export const BODY_FILE_NAMES = ['poids.csv', 'masse-grasse.csv', 'masse-maigre.csv', 'tour-taille.csv', 'taille.csv', 'energie.csv', 'proteines.csv', 'glucides.csv', 'lipides.csv', 'fibres.csv'] as const;
export type BodyFileName = (typeof BODY_FILE_NAMES)[number];

export const BODY_METRICS = ['weight', 'body_fat', 'lean_mass', 'waist', 'height', 'energy', 'protein', 'carb', 'fat', 'fiber'] as const;
export type BodyMetric = (typeof BODY_METRICS)[number];

export const BODY_METRIC_OF: Readonly<Record<BodyFileName, BodyMetric>> = {
  'poids.csv': 'weight',
  'masse-grasse.csv': 'body_fat',
  'masse-maigre.csv': 'lean_mass',
  'tour-taille.csv': 'waist',
  'taille.csv': 'height',
  'energie.csv': 'energy',
  'proteines.csv': 'protein',
  'glucides.csv': 'carb',
  'lipides.csv': 'fat',
  'fibres.csv': 'fiber',
};

/** Bornes de plausibilité, incluses, `[min, max]`. Poids, taille et tour de taille reprennent celles du profil et des mensurations. */
export const BODY_BOUNDS = {
  weightKg: [20, 500],
  bodyFatPct: [3, 60],
  leanMassKg: [15, 200],
  waistCm: [40, 200],
  heightCm: [100, 250],
  /** Par jour (somme) ; le maximum est aussi celui d'une ligne Quick Add du journal. */
  energyKcalDay: [1, 10_000],
  proteinGDay: [0, 600],
  carbGDay: [0, 1_500],
  fatGDay: [0, 600],
  fiberGDay: [0, 300],
} as const satisfies Readonly<Record<string, readonly [number, number]>>;

const LB_TO_KG = 0.45359237;
const IN_TO_CM = 2.54;
const KJ_PER_KCAL = 4.184;

/** Jusqu'à 15 décimales, point ou virgule ; l'unité peut être collée (`81,4 kg`, `18,5 %`). */
const VALUE = /^(\d{1,7}(?:[.,]\d{1,15})?)\s*([A-Za-z/%]+)?$/;

interface Spec {
  /** Unité (minuscule) vers facteur de conversion ; `''` : unité absente. */
  readonly units: Readonly<Record<string, number>>;
  readonly range: readonly [number, number];
  readonly decimals: number;
  readonly mode: 'latest' | 'sum';
  /** Masse grasse : sans unité, une valeur de 1 ou moins est une fraction (0,185). */
  readonly fraction?: boolean;
}

const KG_UNITS = { '': 1, kg: 1, lb: LB_TO_KG, lbs: LB_TO_KG } as const;
const CM_UNITS = { '': 1, cm: 1, m: 100, in: IN_TO_CM, po: IN_TO_CM } as const;
const GRAM_UNITS = { '': 1, g: 1, mg: 0.001 } as const;

const SPECS: Readonly<Record<BodyMetric, Spec>> = {
  weight: { units: KG_UNITS, range: BODY_BOUNDS.weightKg, decimals: 2, mode: 'latest' },
  body_fat: { units: { '': 1, '%': 1 }, range: BODY_BOUNDS.bodyFatPct, decimals: 1, mode: 'latest', fraction: true },
  lean_mass: { units: KG_UNITS, range: BODY_BOUNDS.leanMassKg, decimals: 1, mode: 'latest' },
  waist: { units: CM_UNITS, range: BODY_BOUNDS.waistCm, decimals: 1, mode: 'latest' },
  height: { units: CM_UNITS, range: BODY_BOUNDS.heightCm, decimals: 1, mode: 'latest' },
  energy: { units: { '': 1, kcal: 1, cal: 1, kj: 1 / KJ_PER_KCAL }, range: BODY_BOUNDS.energyKcalDay, decimals: 0, mode: 'sum' },
  protein: { units: GRAM_UNITS, range: BODY_BOUNDS.proteinGDay, decimals: 1, mode: 'sum' },
  carb: { units: GRAM_UNITS, range: BODY_BOUNDS.carbGDay, decimals: 1, mode: 'sum' },
  fat: { units: GRAM_UNITS, range: BODY_BOUNDS.fatGDay, decimals: 1, mode: 'sum' },
  fiber: { units: GRAM_UNITS, range: BODY_BOUNDS.fiberGDay, decimals: 1, mode: 'sum' },
};

const round = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export interface BodyDayValue {
  /** Jour local de l'appareil. */
  readonly day: string;
  /** Valeur du jour : la plus récente, ou la somme. */
  readonly value: number;
  /** Instant UTC de l'échantillon le plus récent du jour (`toISOString`). */
  readonly measuredAt: string;
}

export interface BodyParseResult extends ShortcutParseReport {
  /** Un résultat par jour, du plus ancien au plus récent. */
  readonly days: readonly BodyDayValue[];
}

function readValue(raw: string, unitCell: string | undefined, spec: Spec): { readonly value: number } | { readonly fail: 'bad_value' | 'bad_unit' } {
  const m = VALUE.exec(raw);
  if (m === null) return { fail: 'bad_value' };
  const unit = (unitCell !== undefined && unitCell !== '' ? unitCell : (m[2] ?? '')).toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(spec.units, unit)) return { fail: 'bad_unit' };
  const number = Number((m[1] ?? '').replace(',', '.'));
  if (spec.fraction === true && unit === '' && number <= 1) return { value: number * 100 };
  return { value: number * (spec.units[unit] ?? 1) };
}

/** Lit un fichier : une valeur par jour local (la plus récente ou la somme selon le type), lignes refusées comptées par raison. */
export function parseBodyFile(name: BodyFileName, text: string, today: string, timeZone: string): BodyParseResult {
  const spec = SPECS[BODY_METRIC_OF[name]];
  const { rows, truncated } = readRows(text);
  const counter = new Counter();
  const seen = new Set<string>();
  const byDay = new Map<string, { value: number; at: number }>();
  for (const cells of rows) {
    if (cells.length < 2 || cells.length > 3) {
      counter.add('bad_column_count');
      continue;
    }
    const instant = parseInstant(cells[0] ?? '', today, timeZone);
    if (isFail(instant)) {
      counter.add(instant.fail);
      continue;
    }
    const read = readValue(cells[1] ?? '', cells[2], spec);
    if ('fail' in read) {
      counter.add(read.fail);
      continue;
    }
    const value = read.value;
    // Une valeur seule ou une ligne d'une somme qui dépasse déjà le maximum est refusée ; le minimum d'une somme ne vaut que pour le total du jour.
    if (value > spec.range[1] || (spec.mode === 'latest' && value < spec.range[0])) {
      counter.add('out_of_range');
      continue;
    }
    // Doublon d'export : seulement pour une valeur par jour ; dans une somme, deux échantillons identiques (deux œufs au même instant) comptent tous les deux.
    if (spec.mode === 'latest') {
      const key = `${instant.at}|${round(value, 6)}`;
      if (seen.has(key)) {
        counter.duplicates += 1;
        continue;
      }
      seen.add(key);
    }
    const current = byDay.get(instant.day);
    if (spec.mode === 'sum') byDay.set(instant.day, { value: (current?.value ?? 0) + value, at: Math.max(current?.at ?? 0, instant.at) });
    else if (current === undefined || instant.at >= current.at) byDay.set(instant.day, { value, at: instant.at });
  }
  const days: BodyDayValue[] = [];
  for (const [day, entry] of [...byDay.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const value = round(entry.value, spec.decimals);
    if (value < spec.range[0] || value > spec.range[1]) {
      // Total du jour hors bornes : un seul rejet pour le jour.
      counter.add('out_of_range');
      continue;
    }
    days.push({ day, value, measuredAt: new Date(entry.at).toISOString() });
  }
  return { ...counter.report(truncated), days };
}
