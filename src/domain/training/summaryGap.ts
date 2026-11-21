import { roundKg } from './loadGrid';
import type { WorkoutSet } from './session';

/**
 * SESS-01e (§ 13.5 « Résumé : … écart ») : écart de la séance faite à la prescription, par exercice, dans l'ordre de la séance. Module pur.
 *
 * Cible d'un exercice : la décision tracée de la séance (charge et répétitions retenues), sinon la première charge cible de ses séries de travail
 * (aucune cible de répétitions). Séries comptées hors échauffement ; charge faite = la plus lourde des séries de travail validées ; écart de
 * répétitions = somme, série par série, des répétitions faites moins les répétitions retenues. Sans cible : aucun écart (jamais inventé).
 */

export interface GapTarget {
  readonly loadKg: number | null;
  readonly reps: readonly number[];
}

export interface ExerciseGap {
  readonly exerciseId: string;
  readonly exerciseName: string;
  readonly plannedSets: number;
  readonly doneSets: number;
  readonly targetLoadKg: number | null;
  readonly doneLoadKg: number | null;
  readonly loadDeltaKg: number | null;
  readonly repsDelta: number | null;
}

export function prescriptionGaps(sets: readonly WorkoutSet[], targets: ReadonlyMap<string, GapTarget>): ExerciseGap[] {
  const live = sets.filter((s) => (s.deletedAt ?? null) === null && s.setKind !== 'warmup').sort((a, b) => a.position - b.position);
  const order = [...new Set(live.map((s) => s.exerciseId))];
  return order.map((exerciseId) => {
    const own = live.filter((s) => s.exerciseId === exerciseId);
    const done = own.filter((s) => s.done);
    const target = targets.get(exerciseId);
    const targetLoadKg = target?.loadKg ?? own.find((s) => s.targetLoadKg !== null)?.targetLoadKg ?? null;
    const loads = done.map((s) => s.loadKg).filter((kg): kg is number => kg !== null);
    const doneLoadKg = loads.length > 0 ? Math.max(...loads) : null;
    const reps = target?.reps ?? [];
    const repsDelta =
      reps.length === 0 || done.length === 0
        ? null
        : done.reduce((sum, s, i) => sum + ((s.reps ?? 0) - (reps[i] ?? reps[reps.length - 1] ?? 0)), 0);
    return {
      exerciseId,
      exerciseName: own[0]?.exerciseName ?? exerciseId,
      plannedSets: own.length,
      doneSets: done.length,
      targetLoadKg,
      doneLoadKg,
      loadDeltaKg: targetLoadKg !== null && doneLoadKg !== null ? roundKg(doneLoadKg - targetLoadKg) : null,
      repsDelta,
    };
  });
}
