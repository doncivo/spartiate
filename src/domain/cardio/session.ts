import { isIsoDateTime } from '../types';

/**
 * I6-06 (D-221, D-224) : séance cardio saisie, règles pures. Les bornes sont celles des CHECK de la migration (`cardio_session`) : le domaine refuse
 * avant toute écriture, la base reste le dernier recours. Aucune I/O, aucune horloge (l'instant courant est un paramètre).
 */

/** Types de cardio, dans l'ordre de l'écran. `other` couvre tout le reste (et un type inconnu écrit par une version plus récente). */
export const CARDIO_KINDS = ['walk', 'run', 'bike', 'row', 'elliptical', 'skierg', 'other'] as const;
export type CardioKind = (typeof CARDIO_KINDS)[number];

/** `manual` : saisie ; `gps` : durée et distance suivies au GPS de l'iPhone (premier plan), puis vérifiées par Ali avant l'enregistrement. */
export const CARDIO_SOURCES = ['manual', 'gps'] as const;
export type CardioSource = (typeof CARDIO_SOURCES)[number];

export const CARDIO_BOUNDS = {
  /** Durée : 1 s à 24 h. */
  durationMinSec: 1,
  durationMaxSec: 86_400,
  /** Distance : strictement positive, 1 000 km au plus. */
  distanceMaxM: 1_000_000,
  /** FC moyenne, battements par minute. */
  avgHrMin: 30,
  avgHrMax: 250,
  rpeMin: 1,
  rpeMax: 10,
  notesMax: 2_000,
  /** Tolérance d'horloge entre appareils : un début jusqu'à 5 min dans le futur est admis. */
  futureToleranceMs: 5 * 60_000,
} as const;

export interface CardioSessionInput {
  readonly kind: CardioKind;
  /** Instant ISO 8601 UTC du début. */
  readonly startedAt: string;
  readonly durationSec: number;
  readonly distanceM: number | null;
  readonly avgHr: number | null;
  readonly rpe: number;
  readonly notes: string;
  readonly source: CardioSource;
}

export type CardioIssue = 'kind' | 'start' | 'future' | 'duration' | 'distance' | 'avgHr' | 'rpe' | 'notes' | 'source';
export type FieldIssue = 'empty' | 'format' | 'range';
export type Parsed<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly issue: FieldIssue };

const isKind = (v: unknown): v is CardioKind => typeof v === 'string' && (CARDIO_KINDS as readonly string[]).includes(v);

/** Type lu en base ou reçu : inconnu → `other` (jamais une erreur d'affichage). */
export function toCardioKind(v: unknown): CardioKind {
  return isKind(v) ? v : 'other';
}

const isIntIn = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** Ressenti 1 à 10, entier ; sinon null. */
export function parseRpe(v: unknown): number | null {
  return isIntIn(v, CARDIO_BOUNDS.rpeMin, CARDIO_BOUNDS.rpeMax) ? v : null;
}

/** Durée saisie : minutes (« 45 »), « mm:ss » (« 45:30 ») ou « h:mm:ss » (« 1:05:00 ») ; secondes et minutes de 0 à 59 après un deux-points. */
export function parseDurationText(text: string): Parsed<number> {
  const t = text.trim();
  if (t === '') return { ok: false, issue: 'empty' };
  const parts = t.split(':');
  if (parts.length > 3 || parts.some((p) => !/^\d{1,4}$/.test(p))) return { ok: false, issue: 'format' };
  const n = parts.map(Number) as [number, ...number[]];
  let sec: number;
  if (n.length === 1) sec = n[0] * 60;
  else if (n.length === 2) {
    const [m, s = 0] = n;
    if (s > 59) return { ok: false, issue: 'format' };
    sec = m * 60 + s;
  } else {
    const [h, m = 0, s = 0] = n;
    if (m > 59 || s > 59) return { ok: false, issue: 'format' };
    sec = h * 3600 + m * 60 + s;
  }
  return sec < CARDIO_BOUNDS.durationMinSec || sec > CARDIO_BOUNDS.durationMaxSec ? { ok: false, issue: 'range' } : { ok: true, value: sec };
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** « 45:30 » sous une heure, « 1:05:00 » au-delà (format accepté en retour par `parseDurationText`). */
export function formatDurationText(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s % 60)}` : `${m}:${pad2(s % 60)}`;
}

/** Distance en km (virgule ou point décimal), facultative : vide → null ; arrondie au mètre. */
export function parseDistanceKmText(text: string): Parsed<number | null> {
  const t = text.trim();
  if (t === '') return { ok: true, value: null };
  if (!/^\d+([.,]\d+)?$/.test(t)) return { ok: false, issue: 'format' };
  const m = Math.round(Number(t.replace(',', '.')) * 1000);
  return m <= 0 || m > CARDIO_BOUNDS.distanceMaxM ? { ok: false, issue: 'range' } : { ok: true, value: m };
}

/** FC moyenne, entier, facultative : vide → null. */
export function parseAvgHrText(text: string): Parsed<number | null> {
  const t = text.trim();
  if (t === '') return { ok: true, value: null };
  if (!/^\d+$/.test(t)) return { ok: false, issue: 'format' };
  const v = Number(t);
  return isIntIn(v, CARDIO_BOUNDS.avgHrMin, CARDIO_BOUNDS.avgHrMax) ? { ok: true, value: v } : { ok: false, issue: 'range' };
}

/** Champs fautifs d'une séance (vide : séance valide). `nowIso` : instant courant (le domaine ne lit jamais l'horloge). */
export function validateCardioSession(s: CardioSessionInput, nowIso: string): CardioIssue[] {
  const issues: CardioIssue[] = [];
  if (!isKind(s.kind)) issues.push('kind');
  if (!isIsoDateTime(s.startedAt)) issues.push('start');
  else if (Date.parse(s.startedAt) > Date.parse(nowIso) + CARDIO_BOUNDS.futureToleranceMs) issues.push('future');
  if (!isIntIn(s.durationSec, CARDIO_BOUNDS.durationMinSec, CARDIO_BOUNDS.durationMaxSec)) issues.push('duration');
  if (s.distanceM !== null && !(typeof s.distanceM === 'number' && Number.isFinite(s.distanceM) && s.distanceM > 0 && s.distanceM <= CARDIO_BOUNDS.distanceMaxM)) issues.push('distance');
  if (s.avgHr !== null && !isIntIn(s.avgHr, CARDIO_BOUNDS.avgHrMin, CARDIO_BOUNDS.avgHrMax)) issues.push('avgHr');
  if (parseRpe(s.rpe) === null) issues.push('rpe');
  if (typeof s.notes !== 'string' || s.notes.length > CARDIO_BOUNDS.notesMax) issues.push('notes');
  if (!(CARDIO_SOURCES as readonly string[]).includes(s.source)) issues.push('source');
  return issues;
}

/** Allure en secondes par kilomètre, arrondie ; sans distance : null. */
export function paceSecPerKm(durationSec: number, distanceM: number | null): number | null {
  return distanceM === null || distanceM <= 0 ? null : Math.round((durationSec * 1000) / distanceM);
}
