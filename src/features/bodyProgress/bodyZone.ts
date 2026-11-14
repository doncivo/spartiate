import type { MeasurementKind } from '../../domain/bodyProgress';
import { addDays } from '../../domain/localDate';
import type { LocalDate } from '../../domain/types';

/**
 * ERGO-02 : calculs d'AFFICHAGE de Progrès › Corps (dernière mesure, écart sur 4 semaines, courbe, positions sur la silhouette). Aucune règle métier :
 * les bornes et la validation des mesures restent dans `src/domain/bodyProgress`.
 */
export interface ZonePoint {
  readonly date: LocalDate;
  readonly value: number;
}

export interface ZoneSummary {
  readonly last: ZonePoint | null;
  readonly reference: ZonePoint | null;
  readonly delta: number | null;
  /** `four-weeks` : une mesure existe 28 jours ou plus avant la dernière ; `since` : écart depuis la plus ancienne mesure (historique plus court). */
  readonly span: 'four-weeks' | 'since' | null;
}

const FOUR_WEEKS = 28;
const tenth = (n: number): number => {
  const r = Math.round(n * 10) / 10;
  return r === 0 ? 0 : r;
};
const byDate = (a: ZonePoint, b: ZonePoint): number => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

export function summarizeZone(points: readonly ZonePoint[]): ZoneSummary {
  const sorted = [...points].sort(byDate);
  const last = sorted.at(-1) ?? null;
  if (last === null || sorted.length < 2) return { last, reference: null, delta: null, span: null };
  const limit = addDays(last.date, -FOUR_WEEKS);
  const older = sorted.slice(0, -1).filter((p) => p.date <= limit);
  const reference = older.at(-1) ?? sorted[0] ?? last;
  return { last, reference, delta: tenth(last.value - reference.value), span: older.length > 0 ? 'four-weeks' : 'since' };
}

export interface CurveDot {
  readonly x: number;
  readonly y: number;
  readonly last: boolean;
}
export interface CurveGeometry {
  readonly path: string;
  readonly dots: readonly CurveDot[];
  readonly min: number;
  readonly max: number;
}

const CURVE_MAX_POINTS = 12;
const DAY_MS = 86_400_000;
const dayNumber = (date: LocalDate): number => Date.parse(`${date}T00:00:00Z`) / DAY_MS;

/** Courbe des dernières mesures (au plus 12) dans une boîte `width` x `height` ; `null` sous deux mesures. x suit les dates, y est inversé (plus haut = plus grand). */
export function curveGeometry(points: readonly ZonePoint[], width: number, height: number, pad = 4): CurveGeometry | null {
  const sorted = [...points].sort(byDate).slice(-CURVE_MAX_POINTS);
  const first = sorted[0];
  const end = sorted.at(-1);
  if (first === undefined || end === undefined || sorted.length < 2) return null;
  const values = sorted.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const t0 = dayNumber(first.date);
  const span = dayNumber(end.date) - t0;
  const dots = sorted.map((p, i): CurveDot => {
    const x = span === 0 ? (width * i) / (sorted.length - 1) : ((dayNumber(p.date) - t0) / span) * width;
    const y = max === min ? height / 2 : pad + ((max - p.value) / (max - min)) * (height - 2 * pad);
    return { x, y, last: i === sorted.length - 1 };
  });
  const path = dots.map((d, i) => `${i === 0 ? 'M' : 'L'}${d.x.toFixed(1)} ${d.y.toFixed(1)}`).join(' ');
  return { path, dots, min, max };
}

/** Positions des zones sur la silhouette (viewBox 120 x 230, Corps-apres) ; la taille est la ligne dessinée en plus. */
export const SILHOUETTE_DOTS: Readonly<Record<MeasurementKind, { readonly x: number; readonly y: number }>> = {
  neck: { x: 60, y: 38 },
  shoulders: { x: 60, y: 52 },
  chest: { x: 60, y: 68 },
  waist: { x: 60, y: 98 },
  hips: { x: 60, y: 122 },
  arm_left: { x: 36, y: 80 },
  arm_right: { x: 84, y: 80 },
  thigh_left: { x: 50, y: 160 },
  thigh_right: { x: 70, y: 160 },
  calf_left: { x: 48, y: 196 },
  calf_right: { x: 72, y: 196 },
};
