import type { BodyGoal } from '../bodyProfile';
import { addDays } from '../localDate';
import type { LocalDate } from '../types';
import { MEASUREMENT_KINDS, type MeasurementKind, type MeasurementPoint } from './measurements';
import { daysBetween, inPeriod, periodStart, roundTo, zoneSeries, type BodyPeriod, type BodySample } from './period';

/**
 * PROG-0301b (BL-178) : tendance d'une zone (D-705, D-716, D-730) et rythme par mois (D-718). Règles pures ; la couleur et les textes
 * restent à l'écran (BL-179), qui dit toujours la tendance en texte en plus de la couleur.
 */

/** Écart absolu sous lequel une zone est « stable » (cm, résolution d'un mètre ruban, D-716). Comparé à l'écart arrondi au dixième (D-730). */
export const TREND_STABLE_CM = 0.5;
/** Au moins 2 mesures, la référence au moins 14 jours avant la dernière (D-716). */
export const TREND_MIN_POINTS = 2;
export const TREND_MIN_SPAN_DAYS = 14;
/** Référence de l'écran actuel : une mesure 28 à 42 jours avant la dernière, sinon la plus récente au-delà, sinon la plus ancienne. */
const REFERENCE_MIN_DAYS = 28;
const REFERENCE_MAX_DAYS = 42;

export type TrendDirection = 'up' | 'down' | 'stable' | 'insufficient';
/** `favorable` : vers l'objectif du profil ; `unfavorable` : à l'inverse ; `neutral` : stable, pas assez de mesures ou objectif absent. */
export type TrendTone = 'favorable' | 'unfavorable' | 'neutral';
export type TrendNeutralReason = 'insufficient' | 'stable' | 'no-goal';

export interface ZoneTrend {
  readonly kind: MeasurementKind;
  readonly last: MeasurementPoint | null;
  readonly reference: MeasurementPoint | null;
  /** Dernière moins référence, au dixième ; `null` sous deux mesures (jamais un faux zéro). */
  readonly delta: number | null;
  /** `four-weeks` : référence 28 à 42 jours avant ; `since` : autre référence (sa date est dite). */
  readonly span: 'four-weeks' | 'since' | null;
  readonly direction: TrendDirection;
  readonly tone: TrendTone;
  readonly neutralReason: TrendNeutralReason | null;
}

function pickReference(sorted: readonly MeasurementPoint[], last: MeasurementPoint): { reference: MeasurementPoint; span: 'four-weeks' | 'since' } {
  const limit = addDays(last.date, -REFERENCE_MIN_DAYS);
  const farLimit = addDays(last.date, -REFERENCE_MAX_DAYS);
  const older = sorted.slice(0, -1).filter((p) => p.date <= limit);
  const inBand = older.filter((p) => p.date >= farLimit);
  const reference = inBand.at(-1) ?? older.at(-1) ?? sorted[0] ?? last;
  return { reference, span: inBand.length > 0 ? 'four-weeks' : 'since' };
}

/** Sens favorable (D-716) : perte, la baisse ; prise, la hausse sauf le tour de taille ; maintien, aucune évolution n'est favorable. */
function toneOf(kind: MeasurementKind, direction: 'up' | 'down', goal: BodyGoal): TrendTone {
  if (goal === 'maintain') return 'unfavorable';
  const favorableIsDown = goal === 'loss' || kind === 'waist';
  return (direction === 'down') === favorableIsDown ? 'favorable' : 'unfavorable';
}

/** Tendance d'une zone saisie, selon l'objectif du profil (lu en lecture seule, D-669) ; `goal` null : neutre, le sens reste dit. */
export function zoneTrend(samples: readonly BodySample[], kind: MeasurementKind, goal: BodyGoal | null): ZoneTrend {
  const sorted = zoneSeries(samples, kind);
  const last = sorted.at(-1) ?? null;
  if (last === null || sorted.length < TREND_MIN_POINTS) {
    return { kind, last, reference: null, delta: null, span: null, direction: 'insufficient', tone: 'neutral', neutralReason: 'insufficient' };
  }
  const { reference, span } = pickReference(sorted, last);
  const delta = roundTo(last.value - reference.value, 1);
  const base = { kind, last, reference, delta, span };
  if (daysBetween(reference.date, last.date) < TREND_MIN_SPAN_DAYS) return { ...base, direction: 'insufficient', tone: 'neutral', neutralReason: 'insufficient' };
  if (Math.abs(delta) < TREND_STABLE_CM) return { ...base, direction: 'stable', tone: 'neutral', neutralReason: 'stable' };
  const direction = delta > 0 ? 'up' : 'down';
  if (goal === null) return { ...base, direction, tone: 'neutral', neutralReason: 'no-goal' };
  return { ...base, direction, tone: toneOf(kind, direction, goal), neutralReason: null };
}

/** Tendance des 11 zones saisies. */
export function zoneTrends(samples: readonly BodySample[], goal: BodyGoal | null): Readonly<Record<MeasurementKind, ZoneTrend>> {
  return Object.fromEntries(MEASUREMENT_KINDS.map((kind) => [kind, zoneTrend(samples, kind, goal)])) as Record<MeasurementKind, ZoneTrend>;
}

/** Longueur moyenne d'un mois (jours) : 365,25 / 12 arrondi (D-718). */
export const DAYS_PER_MONTH = 30.44;
/** Au moins 2 mesures sur au moins 14 jours dans la période (D-718). */
export const RATE_MIN_POINTS = 2;
export const RATE_MIN_SPAN_DAYS = 14;

export type MonthlyRate =
  | { readonly status: 'known'; readonly cmPerMonth: number; readonly from: LocalDate; readonly to: LocalDate; readonly count: number }
  | { readonly status: 'unknown' };

/** Rythme par mois d'une zone dans la période : pente des moindres carrés (cm/jour) × 30,44, au dixième ; sinon « inconnu », jamais 0. */
export function monthlyRate(samples: readonly BodySample[], kind: MeasurementKind, period: BodyPeriod, end: LocalDate): MonthlyRate {
  const start = periodStart(period, end);
  const points = zoneSeries(samples, kind).filter((p) => inPeriod(p.date, start, end));
  const first = points[0];
  const last = points.at(-1);
  if (first === undefined || last === undefined || points.length < RATE_MIN_POINTS || daysBetween(first.date, last.date) < RATE_MIN_SPAN_DAYS) return { status: 'unknown' };
  const xs = points.map((p) => daysBetween(first.date, p.date));
  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
  const meanY = points.reduce((a, p) => a + p.value, 0) / points.length;
  let sxy = 0;
  let sxx = 0;
  points.forEach((p, i) => {
    const dx = (xs[i] ?? 0) - meanX;
    sxy += dx * (p.value - meanY);
    sxx += dx * dx;
  });
  return { status: 'known', cmPerMonth: roundTo((sxy / sxx) * DAYS_PER_MONTH, 1), from: first.date, to: last.date, count: points.length };
}
