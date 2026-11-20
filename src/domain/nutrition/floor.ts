/**
 * Plancher calorique (PRD § 15.2 ; D-74 point 7 ; FIX-PLANCHER). Module pur. Avec une cible de repos, le plancher se contrôle sur la PLUS BASSE
 * des deux cibles : une seule règle, réutilisée par l'enregistrement, le check-in, Stratégie et les formulaires.
 */
import { NUTRITION_CONFIG } from './config';
import type { RestPlan } from './restDay';
import type { Target } from './types';

/** `ok` : au plancher ou au-dessus ; `confirm` : sous 1 200 kcal, confirmation explicite requise ; `rejected` : sous 800 kcal. */
export type FloorVerdict = 'ok' | 'confirm' | 'rejected';

export const lowestKcal = (target: Target, plan: RestPlan | null): number => (plan === null ? target.kcal : Math.min(target.kcal, plan.rest.kcal));

export function floorVerdictOfKcal(kcal: number): FloorVerdict {
  if (kcal < NUTRITION_CONFIG.confirmedFloorKcal) return 'rejected';
  return kcal < NUTRITION_CONFIG.floorKcal ? 'confirm' : 'ok';
}

export const floorVerdict = (target: Target, plan: RestPlan | null): FloorVerdict => floorVerdictOfKcal(lowestKcal(target, plan));

interface Pair {
  readonly target: Target;
  readonly plan: RestPlan | null;
}

/**
 * Une confirmation en vigueur est reprise : la décision d'avant n'existe que parce qu'Ali a confirmé (la confirmation n'est pas stockée). Elle
 * vaut pour la nouvelle tant que la plus basse des deux cibles ne descend pas plus bas ; sinon, une nouvelle case est demandée.
 */
export function confirmationCarriedOver(before: Pair | null, after: Pair): boolean {
  if (before === null) return false;
  const was = lowestKcal(before.target, before.plan);
  return floorVerdictOfKcal(was) === 'confirm' && lowestKcal(after.target, after.plan) >= was;
}
