import { CARDIO_SRPE_SCALE, RECOVERY_CONFIG, STRENGTH_SCALE } from './config';
import type { RecoveryCardio, RecoveryExplanationKey, RecoveryWorkout } from './types';
import { utcToLocal } from '../timeZone';

export interface DayExertion {
  /** 0 à 10, arrondie au centième. */
  readonly value: number;
  /** Points muscu : `tonnage en tonnes × facteur de difficulté × STRENGTH_SCALE`, somme des séries comptées (D-88 révisée). */
  readonly muscuLoad: number;
  /** Points cardio : `minutes × ressenti × CARDIO_SRPE_SCALE`, somme des séances cardio saisies du jour (I6-06, D-220). */
  readonly cardioLoad: number;
  readonly explanationKeys: readonly RecoveryExplanationKey[];
}

const dayOf = (ms: number, timeZone: string): string => utcToLocal(new Date(ms).toISOString(), timeZone).date;

/** Points cardio d'une séance (règle « minutes × ressenti », D-220) ; durée ou ressenti invalides : 0 (jamais deviné). */
export function cardioSessionLoad(c: RecoveryCardio): number {
  const { rpeMin, rpeMax } = RECOVERY_CONFIG.exertion.cardioRpe;
  if (!Number.isFinite(c.durationSec) || c.durationSec <= 0 || !Number.isInteger(c.rpe) || c.rpe < rpeMin || c.rpe > rpeMax) return 0;
  return (c.durationSec / 60) * c.rpe * CARDIO_SRPE_SCALE;
}

/**
 * Exertion d'un jour local (§ 16.3) : `10 × (1 − e^(−(cardio + muscu) / k))`, muscu mis à l'échelle (D-88 révisée) et cardio saisi compté par
 * « minutes × ressenti » (I6-06, D-220, met à jour D-88) ; l'explication le dit (`exertion_cardio_srpe`). Séries comptées : terminées, hors
 * échauffement, charge et répétitions connues. Une séance (musculation ou cardio) compte le jour local de sa FIN. Un jour sans séance vaut 0 :
 * c'est une absence de charge constatée (les séances sont locales ou synchronisées), pas une mesure manquante.
 */
export function dayExertion(workouts: readonly RecoveryWorkout[], day: string, timeZone: string, cardio: readonly RecoveryCardio[] = []): DayExertion {
  const cfg = RECOVERY_CONFIG.exertion;
  let load = 0;
  for (const w of workouts) {
    if (dayOf(Date.parse(w.endedAt), timeZone) !== day) continue;
    for (const s of w.sets) {
      if (!s.completed || s.isWarmup || s.kg === null || s.reps === null || s.kg < 0 || s.reps <= 0) continue;
      load += s.kg * s.reps * cfg.difficultyFactor[s.difficulty ?? 'ok'];
    }
  }
  let cardioLoad = 0;
  for (const c of cardio) {
    const start = Date.parse(c.startedAt);
    if (!Number.isFinite(start)) continue;
    const points = cardioSessionLoad(c);
    if (points > 0 && dayOf(start + c.durationSec * 1000, timeZone) === day) cardioLoad += points;
  }
  const muscuLoad = (load / cfg.tonnageUnit) * STRENGTH_SCALE;
  const value = Math.round(cfg.max * (1 - Math.exp(-(muscuLoad + cardioLoad) / cfg.k)) * 100) / 100;
  return { value, muscuLoad, cardioLoad, explanationKeys: ['exertion_cardio_srpe'] };
}
