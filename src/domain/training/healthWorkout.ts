import { workoutDurationSec } from './closure';
import type { PauseFields } from './pause';

/**
 * § 13.5 (écriture Apple Santé, si `CONFIRMED`) : séance close → `HKWorkout` `traditionalStrengthTraining` (début, fin, énergie estimée). Module pur ;
 * aucune écriture HealthKit n'existe encore (H-3a BLOCKED : entitlement retiré par SideStore) : la façade la consommera quand elle existera.
 *
 * SESS-0302 (D-658) : l'énergie est estimée sur la durée EFFECTIVE (pauses retirées), jamais sur fin − début. Début et fin restent les instants réels
 * (Santé place la séance dans la journée ; la pause n'y est pas un intervalle séparé).
 */

/**
 * Équivalent métabolique d'une séance de musculation (kcal par kg et par heure). Choix prudent proposé (SESS-0302, valeur d'un ordre de grandeur courant
 * pour la musculation en séries), hors PRD : révisable par Ali.
 */
export const STRENGTH_TRAINING_MET = 3.5;
/** Poids admis pour l'estimation (kg) : en dehors, l'énergie est inconnue plutôt qu'inventée. */
const BODY_KG_MIN = 20;
const BODY_KG_MAX = 400;

export interface HealthWorkoutPayload {
  readonly activity: 'traditionalStrengthTraining';
  readonly startedAt: string;
  readonly endedAt: string;
  /** Durée effective (secondes), pauses retirées. */
  readonly activeSec: number;
  /** Énergie estimée (kcal, entier) ; null sans poids lisible. */
  readonly energyKcal: number | null;
}

/** Contenu du `HKWorkout` d'une séance close ; ouverte ou instants illisibles : null. */
export function healthWorkoutOf(workout: PauseFields & { readonly startedAt: string; readonly endedAt: string | null }, bodyKg: number | null): HealthWorkoutPayload | null {
  if (workout.endedAt === null) return null;
  const activeSec = workoutDurationSec(workout);
  if (activeSec === null) return null;
  const kg = bodyKg !== null && Number.isFinite(bodyKg) && bodyKg >= BODY_KG_MIN && bodyKg <= BODY_KG_MAX ? bodyKg : null;
  return {
    activity: 'traditionalStrengthTraining',
    startedAt: workout.startedAt,
    endedAt: workout.endedAt,
    activeSec,
    energyKcal: kg === null ? null : Math.round((STRENGTH_TRAINING_MET * kg * activeSec) / 3600),
  };
}
