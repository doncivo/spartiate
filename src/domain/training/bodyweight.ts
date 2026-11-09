import { computeTrend } from '../nutrition/weightTrend';
import type { WeighIn } from '../nutrition/types';

/**
 * Poids de corps pris pour les exercices au poids du corps (REV-01) : la dernière tendance de poids (EMA, § 15.1), qui est aussi la
 * dernière pesée quand il n'y en a qu'une ; null sans aucune pesée valide (le moteur le dit et garde le lest seul).
 */
export function currentBodyweightKg(weighIns: readonly WeighIn[]): number | null {
  const points = computeTrend(weighIns);
  const last = points[points.length - 1];
  return last === undefined ? null : Math.round(last.trend * 10) / 10;
}
