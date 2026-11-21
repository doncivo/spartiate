import { addDays } from '../localDate';
import type { LocalDate } from '../types';
import { RECOVERY_CONFIG } from './config';

/**
 * Progrès › Récupération : tendances sur 30 jours (PROGRES-c, § 17.1, lues depuis `recovery_day`). Règle pure, sans horloge ; aucune
 * interprétation de tendance (aucun seuil dans le PRD) : points, jours mesurés, moyennes 30 j et 7 j, min et max. Un jour sans ligne ou sans
 * mesure vaut `null`, jamais 0.
 */

export const TREND_DAYS = 30;
const RECENT_DAYS = 7;

export const TREND_METRICS = ['recovery', 'hrv', 'restingHr', 'sleep'] as const;
export type TrendMetric = (typeof TREND_METRICS)[number];

/** Sous-ensemble d'un résumé `recovery_day` lu par les tendances. */
export interface TrendDay {
  readonly day: string;
  readonly recovery: number | null;
  readonly hrvMs: number | null;
  readonly restingHr: number | null;
  readonly sleepMinutes: number | null;
}

export interface TrendSeries {
  /** Une valeur par jour de la fenêtre, du plus ancien à aujourd'hui. */
  readonly points: readonly (number | null)[];
  readonly measured: number;
  readonly mean30: number | null;
  readonly mean7: number | null;
  readonly min: number | null;
  readonly max: number | null;
}

export interface RecoveryTrends {
  readonly days: readonly LocalDate[];
  readonly series: Readonly<Record<TrendMetric, TrendSeries>>;
}

const PICK: Readonly<Record<TrendMetric, (d: TrendDay) => number | null>> = {
  recovery: (d) => d.recovery,
  hrv: (d) => d.hrvMs,
  restingHr: (d) => d.restingHr,
  sleep: (d) => d.sleepMinutes,
};

const finite = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);
const mean = (values: readonly number[]): number | null => (values.length === 0 ? null : Math.round(values.reduce((a, b) => a + b, 0) / values.length));

function seriesOf(points: readonly (number | null)[]): TrendSeries {
  const values = points.filter(finite);
  const recent = points.slice(-RECENT_DAYS).filter(finite);
  return {
    points,
    measured: values.length,
    mean30: mean(values),
    mean7: mean(recent),
    min: values.length === 0 ? null : Math.round(Math.min(...values)),
    max: values.length === 0 ? null : Math.round(Math.max(...values)),
  };
}

/** Tendances des `windowDays` jours finissant à `today` (compris). */
export function recoveryTrends(days: readonly TrendDay[], today: LocalDate, windowDays: number = TREND_DAYS): RecoveryTrends {
  const window = Array.from({ length: windowDays }, (_, i) => addDays(today, i - windowDays + 1));
  const byDay = new Map(days.map((d) => [d.day, d]));
  const series = Object.fromEntries(
    TREND_METRICS.map((metric) => {
      const points = window.map((day) => {
        const row = byDay.get(day);
        const v = row === undefined ? null : PICK[metric](row);
        return finite(v) ? v : null;
      });
      return [metric, seriesOf(points)];
    }),
  ) as Record<TrendMetric, TrendSeries>;
  return { days: window, series };
}

export type RecoveryZoneTier = 'high' | 'mid' | 'low';

/** Palier de Recovery qui fixe la zone cible d'Exertion (§ 16.3 : ≥ 66 / 34–65 / ≤ 33) ; `null` sans score. */
export function recoveryZoneTier(score: number | null): RecoveryZoneTier | null {
  if (score === null || !Number.isFinite(score)) return null;
  const z = RECOVERY_CONFIG.zones;
  return score >= z.high.from ? 'high' : score >= z.mid.from ? 'mid' : 'low';
}
