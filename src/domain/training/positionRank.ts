import { primaryMuscle } from './prescribe';
import type { MuscleWeight } from './types';

/**
 * Rang de position (PRD § 11.3, D-72 point 5 ; REV-01 constat 6) : pour chaque exercice d'une séance ou d'un jour de routine, dans l'ordre,
 * le rang parmi les exercices dont le MUSCLE PRINCIPAL est le même (1 = premier). Un exercice répété ne compte qu'une fois (à sa première
 * apparition) ; sans muscle, rang 1. Pur.
 */
export function positionRanks(order: readonly { readonly exerciseId: string; readonly muscles: readonly MuscleWeight[] }[]): ReadonlyMap<string, number> {
  const ranks = new Map<string, number>();
  const perMuscle = new Map<string, number>();
  for (const { exerciseId, muscles } of order) {
    if (ranks.has(exerciseId)) continue;
    const muscle = primaryMuscle(muscles);
    if (muscle === null) {
      ranks.set(exerciseId, 1);
      continue;
    }
    const rank = (perMuscle.get(muscle) ?? 0) + 1;
    perMuscle.set(muscle, rank);
    ranks.set(exerciseId, rank);
  }
  return ranks;
}
