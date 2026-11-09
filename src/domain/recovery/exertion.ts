import { RECOVERY_CONFIG } from './config';
import type { RecoveryExplanationKey, RecoveryWorkout } from './types';
import { utcToLocal } from '../timeZone';

export interface DayExertion {
  /** 0 à 10, arrondie au centième. */
  readonly value: number;
  /** `tonnage / 1000 × facteur de difficulté`, somme des séries comptées. */
  readonly muscuLoad: number;
  /** Toujours 0 : pas de zones FC fiables (D-88). */
  readonly cardioLoad: 0;
  readonly explanationKeys: readonly RecoveryExplanationKey[];
}

/**
 * Exertion d'un jour local (§ 16.3), MUSCULATION SEULE : `10 × (1 − e^(−(cardio + muscu) / k))` avec cardio = 0 (D-88),
 * et l'explication le dit (`exertion_cardio_not_counted`). Séries comptées : terminées, hors échauffement, charge et répétitions connues.
 * Un jour sans séance vaut 0 : c'est une absence de charge constatée (les séances sont locales), pas une mesure manquante.
 */
export function dayExertion(workouts: readonly RecoveryWorkout[], day: string, timeZone: string): DayExertion {
  const cfg = RECOVERY_CONFIG.exertion;
  let load = 0;
  for (const w of workouts) {
    if (utcToLocal(new Date(Date.parse(w.endedAt)).toISOString(), timeZone).date !== day) continue;
    for (const s of w.sets) {
      if (!s.completed || s.isWarmup || s.kg === null || s.reps === null || s.kg < 0 || s.reps <= 0) continue;
      load += s.kg * s.reps * cfg.difficultyFactor[s.difficulty ?? 'ok'];
    }
  }
  const muscuLoad = load / cfg.tonnageUnit;
  const value = Math.round(cfg.max * (1 - Math.exp(-muscuLoad / cfg.k)) * 100) / 100;
  return { value, muscuLoad, cardioLoad: 0, explanationKeys: ['exertion_cardio_not_counted'] };
}
