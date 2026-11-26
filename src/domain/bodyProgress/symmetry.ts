import type { MeasurementKind, MeasurementPoint } from './measurements';
import { daysBetween, roundTo, zoneSeries, type BodySample } from './period';

/**
 * PROG-0301b (BL-178, D-708, D-718, D-730) : symétrie gauche / droite des bras, des cuisses et des mollets, sur la dernière mesure de chaque
 * côté. Écart en cm au dixième ; en % de la moyenne des deux côtés, calculé sur l'écart arrondi (résolution 0,1 cm), au dixième pour
 * l'affichage ; signalé strictement au-dessus de 2 %, valeur non arrondie.
 */

export const SYMMETRY_PAIRS = ['arm', 'thigh', 'calf'] as const;
export type SymmetryPair = (typeof SYMMETRY_PAIRS)[number];
export const SYMMETRY_SIDES: Readonly<Record<SymmetryPair, { readonly left: MeasurementKind; readonly right: MeasurementKind }>> = {
  arm: { left: 'arm_left', right: 'arm_right' },
  thigh: { left: 'thigh_left', right: 'thigh_right' },
  calf: { left: 'calf_left', right: 'calf_right' },
};
export const SYMMETRY_FLAG_PCT = 2;
export const SYMMETRY_MAX_GAP_DAYS = 7;

export type Symmetry =
  | {
      readonly status: 'known';
      readonly pair: SymmetryPair;
      readonly left: MeasurementPoint;
      readonly right: MeasurementPoint;
      readonly diffCm: number;
      readonly diffPct: number;
      readonly flagged: boolean;
      /** Côté le plus grand ; `null` si l'écart arrondi est nul. */
      readonly larger: 'left' | 'right' | null;
    }
  /** `gap` : « pas de mesure récente des deux côtés » ; `missing` : un côté jamais mesuré. */
  | { readonly status: 'unknown'; readonly pair: SymmetryPair; readonly reason: 'missing' | 'gap' };

export function symmetry(pair: SymmetryPair, samples: readonly BodySample[]): Symmetry {
  const left = zoneSeries(samples, SYMMETRY_SIDES[pair].left).at(-1);
  const right = zoneSeries(samples, SYMMETRY_SIDES[pair].right).at(-1);
  if (left === undefined || right === undefined) return { status: 'unknown', pair, reason: 'missing' };
  if (Math.abs(daysBetween(left.date, right.date)) > SYMMETRY_MAX_GAP_DAYS) return { status: 'unknown', pair, reason: 'gap' };
  const diffCm = roundTo(Math.abs(left.value - right.value), 1);
  const pct = (diffCm / ((left.value + right.value) / 2)) * 100;
  const larger = diffCm === 0 ? null : left.value > right.value ? 'left' : 'right';
  return { status: 'known', pair, left, right, diffCm, diffPct: roundTo(pct, 1), flagged: pct > SYMMETRY_FLAG_PCT, larger };
}

export function symmetryAll(samples: readonly BodySample[]): Readonly<Record<SymmetryPair, Symmetry>> {
  return Object.fromEntries(SYMMETRY_PAIRS.map((pair) => [pair, symmetry(pair, samples)])) as Record<SymmetryPair, Symmetry>;
}
