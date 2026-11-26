import { HEIGHT_MAX_CM, HEIGHT_MIN_CM } from '../bodyProfile';
import type { LocalDate } from '../types';
import { isStoredMeasurementValue, type MeasurementKind, type MeasurementPoint } from './measurements';
import { daysBetween, inPeriod, kindSeries, periodStart, roundTo, zoneSeries, type BodyPeriod, type BodySample } from './period';

/**
 * PROG-0301b (BL-178) : ratios sur les dernières mesures (D-707), hauteur du profil puis de Santé (D-715), évolution sur la période (D-718,
 * D-732). AUCUN repère ici : les repères attendent la décision d'Ali (BL-181, D-717) ; le résultat ne porte que la valeur et l'évolution.
 */

export const BODY_RATIOS = ['waist_height', 'shoulders_waist', 'waist_hips', 'chest_waist'] as const;
export type BodyRatioKind = (typeof BODY_RATIOS)[number];

export const RATIO_PARTS: Readonly<Record<BodyRatioKind, { readonly numerator: MeasurementKind; readonly denominator: MeasurementKind | 'height' }>> = {
  waist_height: { numerator: 'waist', denominator: 'height' },
  shoulders_waist: { numerator: 'shoulders', denominator: 'waist' },
  waist_hips: { numerator: 'waist', denominator: 'hips' },
  chest_waist: { numerator: 'chest', denominator: 'waist' },
};

/** Les deux zones d'un ratio à 7 jours au plus d'écart (D-715, D-718). */
export const RATIO_PAIR_MAX_GAP_DAYS = 7;
/** Au-delà de 2 cm (strictement, au dixième) entre profil et Santé, l'écran le note (D-715). */
export const HEIGHT_MISMATCH_CM = 2;

export interface ResolvedHeight {
  readonly cm: number;
  readonly source: 'profile' | 'health';
  /** Profil utilisé et dernière hauteur de Santé à plus de 2 cm. */
  readonly healthDiffers: boolean;
}

const HEALTH_HEIGHT_KIND = 'health_height_cm';

/** Hauteur des ratios : profil (saisie volontaire), sinon la dernière hauteur importée de Santé ; aucune recopiée dans l'autre (D-715). */
export function resolveHeight(profileHeightCm: number | null, samples: readonly BodySample[]): ResolvedHeight | null {
  const health = kindSeries(samples, HEALTH_HEIGHT_KIND)
    .filter((p) => isStoredMeasurementValue(HEALTH_HEIGHT_KIND, p.value))
    .at(-1);
  const profileOk = profileHeightCm !== null && Number.isFinite(profileHeightCm) && profileHeightCm >= HEIGHT_MIN_CM && profileHeightCm <= HEIGHT_MAX_CM;
  if (profileOk) return { cm: profileHeightCm, source: 'profile', healthDiffers: health !== undefined && roundTo(Math.abs(profileHeightCm - health.value), 1) > HEIGHT_MISMATCH_CM };
  return health === undefined ? null : { cm: health.value, source: 'health', healthDiffers: false };
}

export type RatioValue =
  | { readonly status: 'known'; readonly value: number; readonly numeratorDate: LocalDate; readonly denominatorDate: LocalDate | null }
  | { readonly status: 'unknown'; readonly reason: 'no-height' | 'missing' | 'gap' };
export type RatioEvolution = { readonly status: 'known'; readonly delta: number; readonly from: LocalDate; readonly fromValue: number } | { readonly status: 'unknown' };

export interface BodyRatio {
  readonly kind: BodyRatioKind;
  /** Ratio au centième sur les dernières mesures. */
  readonly current: RatioValue;
  /** Valeur actuelle moins valeur de départ, au centième (calculée avant arrondi). */
  readonly evolution: RatioEvolution;
  /** Hauteur utilisée (taille / hauteur seulement, sa source est dite à côté) ; `null` pour les autres ratios. */
  readonly height: ResolvedHeight | null;
}

interface Pair {
  readonly a: MeasurementPoint;
  readonly b: MeasurementPoint | null;
  readonly raw: number;
}

const lastAtOrBefore = (series: readonly MeasurementPoint[], date: LocalDate): MeasurementPoint | undefined => {
  let found: MeasurementPoint | undefined;
  for (const p of series) {
    if (p.date > date) break;
    found = p;
  }
  return found;
};

const pairGapOk = (a: MeasurementPoint, b: MeasurementPoint): boolean => Math.abs(daysBetween(a.date, b.date)) <= RATIO_PAIR_MAX_GAP_DAYS;
const pairDate = (p: Pair): LocalDate => (p.b !== null && p.b.date > p.a.date ? p.b.date : p.a.date);
const samePair = (x: Pair, y: Pair): boolean => x.a.date === y.a.date && (x.b?.date ?? null) === (y.b?.date ?? null);

/** Ratio `kind` : `height` sert à taille / hauteur seulement (voir `resolveHeight`) ; période et fin pour l'évolution. */
export function bodyRatio(kind: BodyRatioKind, samples: readonly BodySample[], height: ResolvedHeight | null, period: BodyPeriod, end: LocalDate): BodyRatio {
  const { numerator, denominator } = RATIO_PARTS[kind];
  const usesHeight = denominator === 'height';
  const unknown = (reason: 'no-height' | 'missing' | 'gap'): BodyRatio => ({ kind, current: { status: 'unknown', reason }, evolution: { status: 'unknown' }, height: usesHeight ? height : null });
  if (usesHeight && height === null) return unknown('no-height');
  const top = zoneSeries(samples, numerator);
  const bottom = denominator === 'height' ? [] : zoneSeries(samples, denominator);

  const pairAt = (aSeries: readonly MeasurementPoint[], bSeries: readonly MeasurementPoint[], date: LocalDate): Pair | 'missing' | 'gap' => {
    const a = lastAtOrBefore(aSeries, date);
    if (a === undefined) return 'missing';
    if (usesHeight && height !== null) return { a, b: null, raw: a.value / height.cm };
    const b = lastAtOrBefore(bSeries, date);
    if (b === undefined) return 'missing';
    if (!pairGapOk(a, b)) return 'gap';
    return { a, b, raw: a.value / b.value };
  };

  const lastDate = [top.at(-1)?.date, bottom.at(-1)?.date].filter((d): d is LocalDate => d !== undefined).sort().at(-1);
  const current = lastDate === undefined ? 'missing' : pairAt(top, bottom, lastDate);
  if (typeof current === 'string') return unknown(current);

  // Départ : première date de la période où les deux zones (mesurées dans la période) sont à 7 jours au plus (D-718, D-732).
  const start = periodStart(period, end);
  const topIn = top.filter((p) => inPeriod(p.date, start, end));
  const bottomIn = bottom.filter((p) => inPeriod(p.date, start, end));
  const dates = [...new Set([...topIn, ...bottomIn].map((p) => p.date))].sort();
  let first: Pair | null = null;
  for (const d of dates) {
    const p = pairAt(topIn, bottomIn, d);
    if (typeof p !== 'string') {
      first = p;
      break;
    }
  }
  const evolution: RatioEvolution =
    first === null || samePair(first, current) ? { status: 'unknown' } : { status: 'known', delta: roundTo(current.raw - first.raw, 2), from: pairDate(first), fromValue: roundTo(first.raw, 2) };
  return {
    kind,
    current: { status: 'known', value: roundTo(current.raw, 2), numeratorDate: current.a.date, denominatorDate: current.b?.date ?? null },
    evolution,
    height: usesHeight ? height : null,
  };
}

/** Les 4 ratios ; hauteur résolue une fois (profil, puis Santé). */
export function bodyRatios(samples: readonly BodySample[], profileHeightCm: number | null, period: BodyPeriod, end: LocalDate): Readonly<Record<BodyRatioKind, BodyRatio>> {
  const height = resolveHeight(profileHeightCm, samples);
  return Object.fromEntries(BODY_RATIOS.map((kind) => [kind, bodyRatio(kind, samples, height, period, end)])) as Record<BodyRatioKind, BodyRatio>;
}
