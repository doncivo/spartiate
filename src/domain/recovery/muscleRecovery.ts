import { RECOVERY_CONFIG } from './config';
import type { MuscleRecoveryRow, RecoveryWorkout } from './types';

const HOUR_MS = 3_600_000;

/**
 * Récupération par muscle (§ 16.3), APPROXIMATION dite telle quelle : 0 % à la fin de la séance, linéaire jusqu'à 100 % sur la durée
 * de la classe du groupe (48 / 72 / 96 h) mise à l'échelle par la charge de la séance (séries × poids du muscle × facteur de difficulté,
 * proposition, voir `config.muscle`). Le cardio importé n'entre pas (D-88). Séries comptées : terminées, hors échauffement.
 * Plusieurs séances : la moins récupérée l'emporte. Un muscle sans séance dans la fenêtre n'a pas de ligne (inconnu ≠ 100 %) ;
 * un identifiant absent du catalogue est ignoré, jamais deviné.
 */
export function muscleRecovery(input: { readonly workouts: readonly RecoveryWorkout[]; readonly now: string }): readonly MuscleRecoveryRow[] {
  const cfg = RECOVERY_CONFIG;
  const nowMs = Date.parse(input.now);
  const best = new Map<string, MuscleRecoveryRow>();
  for (const w of input.workouts) {
    const endMs = Date.parse(w.endedAt);
    const elapsedH = (nowMs - endMs) / HOUR_MS;
    if (!Number.isFinite(elapsedH) || elapsedH < 0 || elapsedH > cfg.muscle.lookbackHours) continue;
    const load = new Map<string, number>();
    for (const s of w.sets) {
      if (!s.completed || s.isWarmup) continue;
      for (const m of s.muscles) {
        if (!Object.prototype.hasOwnProperty.call(cfg.muscleGroups, m.id)) continue;
        load.set(m.id, (load.get(m.id) ?? 0) + m.weight * cfg.exertion.difficultyFactor[s.difficulty ?? 'ok']);
      }
    }
    for (const [muscleId, effectiveSets] of load) {
      const group = cfg.muscleGroups[muscleId] ?? '';
      const nominal = cfg.recoveryHours[cfg.groupRecoveryClass[group] ?? 'medium'];
      const scale = Math.min(cfg.muscle.maxScale, Math.max(cfg.muscle.minScale, effectiveSets / cfg.muscle.referenceEffectiveSets));
      const hours = nominal * scale;
      const percent = Math.min(100, Math.max(0, Math.round((elapsedH / hours) * 100)));
      const row: MuscleRecoveryRow = {
        muscleId,
        group,
        percent,
        hours,
        lastWorkedAt: new Date(endMs).toISOString(),
        readyAt: new Date(endMs + hours * HOUR_MS).toISOString(),
      };
      const previous = best.get(muscleId);
      if (previous === undefined || row.percent < previous.percent) best.set(muscleId, row);
    }
  }
  return [...best.values()].sort((a, b) => (a.muscleId < b.muscleId ? -1 : a.muscleId > b.muscleId ? 1 : 0));
}
