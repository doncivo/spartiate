import type { MesocycleState } from './mesocycle';

/** ERGO-03 (D-297) : repère « Semaine N sur M » d'Aujourd'hui ; `deload` : semaine de décharge (badge « Décharge »). */
export interface CycleWeekMarker {
  readonly week: number;
  readonly total: number;
  readonly deload: boolean;
}

/**
 * Repère du cycle à partir de son état (`mesocycleState`). Cycle actif ou en pause : semaine du cycle sur sa durée (cycle limité) ou
 * semaine du bloc sur la longueur du bloc (cycle illimité) ; décharge si la semaine est une semaine de deload (planifiée ou anticipée).
 * Rien (`null`) hors d'un cycle en cours : pas commencé, fini, clos, invalide.
 */
export function cycleWeekMarker(state: Pick<MesocycleState, 'phase' | 'week' | 'blockWeek' | 'blockLength' | 'totalWeeks' | 'kind'>): CycleWeekMarker | null {
  void state;
  return null;
}
