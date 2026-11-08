import { WARMUP_STEPS, type WarmupStep } from './config';
import { loadGrid, roundKg, snapDown } from './loadGrid';
import type { ExerciseBase, ProgressionEquipment, ProgressionExercise } from './types';

export type { WarmupStep } from './config';

/**
 * Rampes d'échauffement (PRD § 13.8 ; I2-03 ; D-72 point 11). Module pur.
 *
 * - Cibles : fractions de la charge de travail (`WARMUP_STEPS`, 40 % × 8, 60 % × 5, 80 % × 2), répétitions arrondies en dessous.
 * - Snap : charge disponible juste en dessous sur la grille du matériel (`loadGrid`) ; sous le minimum, le minimum (barre à vide). La règle
 *   « +1 répétition au-delà de 3 % » ne vaut que pour le travail : une rampe garde ses répétitions.
 * - Une rampe n'atteint jamais la charge de travail : une étape au-dessus ou égale est retirée ; deux étapes à la même charge n'en font
 *   qu'une (la première, aux répétitions les plus nombreuses). Sans grille connue (machine ou poulie « à vérifier », kettlebells sans pas,
 *   aucun profil), aucune rampe : jamais une charge que le matériel ne permet pas.
 * - Une rampe pour le PREMIER exercice composé chargé (`compound`, `load-reps`) de chaque pattern, dans l'ordre de la séance (§ 13.8).
 */

export interface WarmupSet {
  readonly loadKg: number;
  readonly reps: number;
}

const EPS = 1e-9;

/** Cibles avant snap ; charge de travail invalide (≤ 0, non finie) : aucune. Une étape à 0 répétition après arrondi est retirée. */
export function warmupTargets(workLoadKg: number, steps: readonly WarmupStep[] = WARMUP_STEPS): WarmupSet[] {
  if (!Number.isFinite(workLoadKg) || workLoadKg <= 0) return [];
  return steps.flatMap((step) => {
    const reps = Math.floor(step.reps + EPS);
    return reps >= 1 && Number.isFinite(step.ratio) && step.ratio > 0 ? [{ loadKg: roundKg(step.ratio * workLoadKg), reps }] : [];
  });
}

/** Rampe snappée sur les charges disponibles `loads` (croissantes) ; null ou vide : aucune rampe. */
export function warmupRamp(workLoadKg: number, loads: readonly number[] | null, steps: readonly WarmupStep[] = WARMUP_STEPS): WarmupSet[] {
  if (loads === null || loads.length === 0) return [];
  const ramp: WarmupSet[] = [];
  for (const target of warmupTargets(workLoadKg, steps)) {
    const loadKg = snapDown(target.loadKg, loads);
    if (loadKg >= workLoadKg - EPS) continue;
    const last = ramp.at(-1);
    if (last !== undefined && loadKg <= last.loadKg + EPS) continue;
    ramp.push({ loadKg, reps: target.reps });
  }
  return ramp;
}

/** Rampe d'un exercice avec ce profil : charge × répétitions seulement, grille du matériel de l'exercice. */
export function warmupForExercise(
  exercise: Pick<ProgressionExercise, 'metric' | 'equipment'>,
  workLoadKg: number,
  profile: ProgressionEquipment | null,
  steps: readonly WarmupStep[] = WARMUP_STEPS,
): WarmupSet[] {
  if (exercise.metric !== 'load-reps') return [];
  return warmupRamp(workLoadKg, loadGrid(exercise.equipment, profile)?.loads ?? null, steps);
}

export interface WarmupCandidate {
  readonly exerciseId: string;
  /** Exercice résolu ; absent (référence inconnue) : jamais désigné. */
  readonly exercise: Pick<ExerciseBase, 'pattern' | 'kind' | 'metric'> | undefined;
}

/** Exercices qui reçoivent une rampe : le premier composé chargé de chaque pattern, dans l'ordre reçu (ordre de la séance). */
export function warmupExerciseIds(candidates: readonly WarmupCandidate[]): ReadonlySet<string> {
  const seen = new Set<string>();
  const ids = new Set<string>();
  for (const { exerciseId, exercise } of candidates) {
    if (exercise === undefined || exercise.kind !== 'compound' || exercise.metric !== 'load-reps' || seen.has(exercise.pattern)) continue;
    seen.add(exercise.pattern);
    ids.add(exerciseId);
  }
  return ids;
}
