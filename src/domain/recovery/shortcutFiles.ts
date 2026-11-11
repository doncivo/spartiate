import { RECOVERY_CONFIG } from './config';
import { utcToLocal } from '../timeZone';

/**
 * Fichiers de Santé exportés par l'app Raccourcis (D-69 : HealthKit direct inaccessible avec un compte Apple gratuit). Module pur,
 * modèle : `../health/shortcutWeights.ts`. Guide : docs/guide-raccourcis-sante.md.
 *
 * Formats (une ligne par échantillon, séparateur `;` ou tabulation, en-tête facultatif, BOM UTF-8 et CRLF tolérés) :
 * - `hrv.csv`        `date;valeur[;unité]`  SDNN en ms (unité `ms`) ;
 * - `fc-repos.csv`   `date;valeur[;unité]`  bpm (unités `bpm`, `count/min`) ;
 * - `pas.csv`        `date;valeur[;unité]`  CHOIX : un échantillon de Santé par ligne (`Rechercher des échantillons Santé`, type Pas),
 *                    sommés par jour local de l'appareil. Un fichier « total par jour » (une ligne par jour) est le cas particulier
 *                    à un échantillon par jour et donne le même résultat ; les deux ne se mélangent pas dans un même fichier ;
 * - `sommeil.csv`    `début;fin;stade`  stades de Raccourcis en français (Au lit, Endormi, Éveillé, Paradoxal, Profond, Principal)
 *                    ou en anglais (In Bed, Asleep, Awake, REM, Deep, Core), casse et accents indifférents.
 * Dates : ISO 8601 AVEC fuseau (`yyyy-MM-dd'T'HH:mm:ssZZZZZ`) ; une ligne sans fuseau est refusée (heure ambiguë). Valeurs : virgule
 * ou point décimal. Une ligne illisible est refusée et comptée PAR RAISON (`ShortcutRejectReason`), jamais par sa valeur, jamais devinée.
 * Le jour d'un échantillon est son jour LOCAL de l'appareil (`timeZone`, REV-01 constat 9) ; le jour d'une nuit est le jour du RÉVEIL.
 * Deux lignes identiques (même instant, même valeur) sont un doublon d'export : une seule est gardée et le doublon est compté.
 */

export const SHORTCUT_REJECT_REASONS = [
  'bad_column_count',
  'bad_date',
  'no_timezone',
  'future',
  'bad_value',
  'out_of_range',
  'bad_unit',
  'unknown_stage',
  'end_before_start',
] as const;
export type ShortcutRejectReason = (typeof SHORTCUT_REJECT_REASONS)[number];
export type ShortcutRejections = Readonly<Record<ShortcutRejectReason, number>>;

export interface ShortcutParseReport {
  /** Lignes refusées par raison (toutes les raisons présentes, à zéro si aucune). */
  readonly rejected: ShortcutRejections;
  readonly rejectedTotal: number;
  /** Lignes exactement identiques à une ligne déjà lue. */
  readonly duplicates: number;
  /** Fichier plus long que `MAX_LINES` : seules les premières lignes sont lues. */
  readonly truncated: boolean;
}

export const MAX_LINES = 10_000;
const MAX_SEGMENT_MS = 24 * 3_600_000;
const HRV_RANGE = [5, 300] as const;
const RHR_RANGE = [25, 200] as const;
const STEPS_MAX_PER_LINE = 100_000;

const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})$/;
const ISO_NO_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/;
/** Jusqu'à 15 décimales, point ou virgule : Santé écrit par exemple 33,7171717171717 (I5-04). */
const VALUE = /^(\d{1,7}(?:[.,]\d{1,15})?)\s*([A-Za-z/]+)?$/;
const HEADER = /^(date|d[eé]but|start)/i;

type Fail = { readonly fail: ShortcutRejectReason };
const isFail = <T extends object>(r: T | Fail): r is Fail => 'fail' in r;

class Counter {
  private readonly counts: Record<ShortcutRejectReason, number> = {
    bad_column_count: 0, bad_date: 0, no_timezone: 0, future: 0, bad_value: 0, out_of_range: 0, bad_unit: 0, unknown_stage: 0, end_before_start: 0,
  };
  duplicates = 0;
  add(reason: ShortcutRejectReason): void {
    this.counts[reason] += 1;
  }
  report(truncated: boolean): ShortcutParseReport {
    const rejected = { ...this.counts };
    const rejectedTotal = SHORTCUT_REJECT_REASONS.reduce((sum, r) => sum + rejected[r], 0);
    return { rejected, rejectedTotal, duplicates: this.duplicates, truncated };
  }
}

function readRows(text: string): { readonly rows: readonly (readonly string[])[]; readonly truncated: boolean } {
  const lines = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '');
  const truncated = lines.length > MAX_LINES;
  const rows = lines.slice(0, MAX_LINES).map((l) => l.split(/[;\t]/).map((c) => c.trim()));
  const first = rows[0]?.[0];
  if (first !== undefined && HEADER.test(first) && !ISO_WITH_ZONE.test(first) && !ISO_NO_ZONE.test(first)) rows.shift();
  return { rows, truncated };
}

function parseInstant(cell: string, today: string, timeZone: string): { readonly at: number; readonly day: string } | Fail {
  if (!ISO_WITH_ZONE.test(cell)) return { fail: ISO_NO_ZONE.test(cell) ? 'no_timezone' : 'bad_date' };
  const at = Date.parse(cell);
  if (!Number.isFinite(at)) return { fail: 'bad_date' };
  const day = utcToLocal(new Date(at).toISOString(), timeZone).date;
  if (day > today) return { fail: 'future' };
  return { at, day };
}

function parseNumber(raw: string, unitCell: string | undefined, units: readonly string[]): { readonly value: number } | Fail {
  const m = VALUE.exec(raw);
  if (m === null) return { fail: 'bad_value' };
  const unit = (unitCell !== undefined && unitCell !== '' ? unitCell : m[2] ?? '').toLowerCase();
  if (unit !== '' && !units.includes(unit)) return { fail: 'bad_unit' };
  return { value: Number((m[1] ?? '').replace(',', '.')) };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Échantillons numériques : HRV, FC repos, pas
// ---------------------------------------------------------------------------------------------------------------------------------

export interface ShortcutSample {
  /** Instant UTC normalisé (`toISOString`). */
  readonly measuredAt: string;
  /** Jour local de l'appareil. */
  readonly day: string;
  readonly value: number;
}

export interface ShortcutSamples extends ShortcutParseReport {
  /** Du plus ancien au plus récent. */
  readonly samples: readonly ShortcutSample[];
}

function parseSamples(
  text: string,
  today: string,
  timeZone: string,
  spec: { readonly units: readonly string[]; readonly range: readonly [number, number]; /** Arrondi au dixième (HRV, FC au repos). */ readonly tenth?: boolean },
): ShortcutSamples {
  const { rows, truncated } = readRows(text);
  const counter = new Counter();
  const seen = new Set<string>();
  const samples: (ShortcutSample & { readonly at: number })[] = [];
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
    const num = parseNumber(cells[1] ?? '', cells[2], spec.units);
    if (isFail(num)) {
      counter.add(num.fail);
      continue;
    }
    const value = spec.tenth === true ? Math.round(num.value * 10) / 10 : num.value;
    if (value < spec.range[0] || value > spec.range[1]) {
      counter.add('out_of_range');
      continue;
    }
    const key = `${instant.at}|${value}`;
    if (seen.has(key)) {
      counter.duplicates += 1;
      continue;
    }
    seen.add(key);
    samples.push({ measuredAt: new Date(instant.at).toISOString(), day: instant.day, value, at: instant.at });
  }
  samples.sort((a, b) => a.at - b.at);
  return { ...counter.report(truncated), samples: samples.map(({ measuredAt, day, value }) => ({ measuredAt, day, value })) };
}

/** `hrv.csv` : SDNN en ms. */
export function parseShortcutHrv(text: string, today: string, timeZone: string): ShortcutSamples {
  return parseSamples(text, today, timeZone, { units: ['ms'], range: HRV_RANGE, tenth: true });
}

export interface ShortcutRestingHr extends ShortcutSamples {
  /** Dernière valeur de chaque jour local, du plus ancien au plus récent. */
  readonly latestByDay: readonly { readonly day: string; readonly value: number }[];
}

/** `fc-repos.csv` : bpm. */
export function parseShortcutRestingHr(text: string, today: string, timeZone: string): ShortcutRestingHr {
  const r = parseSamples(text, today, timeZone, { units: ['bpm', 'count/min'], range: RHR_RANGE, tenth: true });
  const byDay = new Map<string, number>();
  for (const s of r.samples) byDay.set(s.day, s.value);
  return { ...r, latestByDay: [...byDay.entries()].map(([day, value]) => ({ day, value })) };
}

export interface ShortcutSteps extends ShortcutParseReport {
  /** Total par jour local, du plus ancien au plus récent. */
  readonly days: readonly { readonly day: string; readonly steps: number }[];
}

/** `pas.csv` : un échantillon par ligne, sommés par jour local (voir l'en-tête du module). */
export function parseShortcutSteps(text: string, today: string, timeZone: string): ShortcutSteps {
  const r = parseSamples(text, today, timeZone, { units: ['count', 'pas', 'steps'], range: [0, STEPS_MAX_PER_LINE] });
  const byDay = new Map<string, number>();
  for (const s of r.samples) byDay.set(s.day, (byDay.get(s.day) ?? 0) + Math.round(s.value));
  const { samples: _samples, ...report } = r;
  return { ...report, days: [...byDay.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([day, steps]) => ({ day, steps })) };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Sommeil
// ---------------------------------------------------------------------------------------------------------------------------------

export const SLEEP_STAGES = ['in_bed', 'asleep', 'awake', 'rem', 'deep', 'core'] as const;
export type SleepStage = (typeof SLEEP_STAGES)[number];

const STAGE_LABELS: Readonly<Record<string, SleepStage>> = {
  'au lit': 'in_bed', 'dans le lit': 'in_bed', 'in bed': 'in_bed', inbed: 'in_bed',
  endormi: 'asleep', asleep: 'asleep',
  eveille: 'awake', reveille: 'awake', awake: 'awake',
  paradoxal: 'rem', 'sommeil paradoxal': 'rem', rem: 'rem',
  profond: 'deep', 'sommeil profond': 'deep', deep: 'deep',
  principal: 'core', 'sommeil principal': 'core', core: 'core',
};

function parseStage(label: string): SleepStage | null {
  const key = label.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
  return Object.prototype.hasOwnProperty.call(STAGE_LABELS, key) ? (STAGE_LABELS[key] ?? null) : null;
}

export interface SleepSegment {
  /** Instants UTC normalisés. */
  readonly start: string;
  readonly end: string;
  readonly stage: SleepStage;
}

export interface ShortcutSleep extends ShortcutParseReport {
  /** Du plus ancien au plus récent. */
  readonly segments: readonly SleepSegment[];
}

/** `sommeil.csv` : `début;fin;stade`. */
export function parseShortcutSleep(text: string, today: string, timeZone: string): ShortcutSleep {
  const { rows, truncated } = readRows(text);
  const counter = new Counter();
  const seen = new Set<string>();
  const segments: (SleepSegment & { readonly s: number })[] = [];
  for (const cells of rows) {
    if (cells.length !== 3) {
      counter.add('bad_column_count');
      continue;
    }
    const start = parseInstant(cells[0] ?? '', today, timeZone);
    if (isFail(start)) {
      counter.add(start.fail);
      continue;
    }
    // La fin n'est pas soumise à « futur » (un segment commencé avant minuit peut finir demain local) ; seul son format compte.
    const endCell = cells[1] ?? '';
    if (!ISO_WITH_ZONE.test(endCell)) {
      counter.add(ISO_NO_ZONE.test(endCell) ? 'no_timezone' : 'bad_date');
      continue;
    }
    const end = Date.parse(endCell);
    if (!Number.isFinite(end)) {
      counter.add('bad_date');
      continue;
    }
    if (end <= start.at) {
      counter.add('end_before_start');
      continue;
    }
    if (end - start.at > MAX_SEGMENT_MS) {
      counter.add('out_of_range');
      continue;
    }
    const stage = parseStage(cells[2] ?? '');
    if (stage === null) {
      counter.add('unknown_stage');
      continue;
    }
    const key = `${start.at}|${end}|${stage}`;
    if (seen.has(key)) {
      counter.duplicates += 1;
      continue;
    }
    seen.add(key);
    segments.push({ start: new Date(start.at).toISOString(), end: new Date(end).toISOString(), stage, s: start.at });
  }
  segments.sort((a, b) => a.s - b.s);
  return { ...counter.report(truncated), segments: segments.map(({ start, end, stage }) => ({ start, end, stage })) };
}

export interface SleepNight {
  /** Jour local du RÉVEIL. */
  readonly day: string;
  /** Début du premier segment endormi (à défaut, du premier segment « Au lit »). */
  readonly bedAt: string;
  /** Fin du dernier segment. */
  readonly wakeAt: string;
  /** Union des segments endormis (Endormi, Paradoxal, Profond, Principal) ; null s'il n'y en a aucun, jamais 0. */
  readonly asleepMinutes: number | null;
  readonly inBedMinutes: number | null;
}

function unionMinutes(intervals: readonly (readonly [number, number])[]): number | null {
  if (intervals.length === 0) return null;
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [curStart, curEnd] = sorted[0] ?? [0, 0];
  for (const [s, e] of sorted.slice(1)) {
    if (s <= curEnd) curEnd = Math.max(curEnd, e);
    else {
      total += curEnd - curStart;
      curStart = s;
      curEnd = e;
    }
  }
  total += curEnd - curStart;
  return Math.round(total / 60_000);
}

/** Regroupe les segments en nuits : un trou d'au moins `episodeGapMinutes` ouvre un autre épisode ; une nuit par jour de réveil (l'épisode dormi le plus long), les autres épisodes sont des siestes ignorées. */
export function buildSleepNights(
  segments: readonly SleepSegment[],
  timeZone: string,
): { readonly nights: readonly SleepNight[]; readonly ignoredGroups: number } {
  const items = segments
    .map((s) => ({ s: Date.parse(s.start), e: Date.parse(s.end), stage: s.stage }))
    .sort((a, b) => a.s - b.s);
  const groups: (typeof items)[] = [];
  let groupEnd = -Infinity;
  const gap = RECOVERY_CONFIG.sleep.episodeGapMinutes * 60_000;
  for (const item of items) {
    const current = groups[groups.length - 1];
    if (current === undefined || item.s - groupEnd >= gap) {
      groups.push([item]);
      groupEnd = item.e;
    } else {
      current.push(item);
      groupEnd = Math.max(groupEnd, item.e);
    }
  }
  const best = new Map<string, SleepNight>();
  let ignoredGroups = 0;
  for (const group of groups) {
    const asleep = group.filter((i) => i.stage !== 'in_bed' && i.stage !== 'awake').map((i) => [i.s, i.e] as const);
    // I5-06 : un épisode sans aucun temps endormi (blocs « Au lit » ou « Éveillé » seuls) n'est jamais une nuit.
    if (asleep.length === 0) {
      ignoredGroups += 1;
      continue;
    }
    const inBed = group.filter((i) => i.stage === 'in_bed').map((i) => [i.s, i.e] as const);
    const bed = asleep.length > 0 ? Math.min(...asleep.map((i) => i[0])) : inBed.length > 0 ? Math.min(...inBed.map((i) => i[0])) : Math.min(...group.map((i) => i.s));
    const wake = Math.max(...group.map((i) => i.e));
    const night: SleepNight = {
      day: utcToLocal(new Date(wake).toISOString(), timeZone).date,
      bedAt: new Date(bed).toISOString(),
      wakeAt: new Date(wake).toISOString(),
      asleepMinutes: unionMinutes(asleep),
      inBedMinutes: unionMinutes(inBed),
    };
    const previous = best.get(night.day);
    if (previous === undefined) best.set(night.day, night);
    else {
      ignoredGroups += 1;
      const rank = (n: SleepNight): number => (n.asleepMinutes ?? 0) * 100_000 + (n.inBedMinutes ?? 0);
      if (rank(night) > rank(previous)) best.set(night.day, night);
    }
  }
  return { nights: [...best.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0)), ignoredGroups };
}
