import { DEFAULT_PROGRESSION_CONFIG } from '../../../domain/training/config';
import { currentBodyweightKg } from '../../../domain/training/bodyweight';
import { analyzeHistory } from '../../../domain/training/estimate1rm';
import { positionRanksOfSets } from '../../../domain/training/positionRank';
import type { PrescriptionContext } from '../../../domain/training/prescriptionInput';
import type { Exercise, ExerciseSession, MuscleWeight } from '../../../domain/training/types';
import type { DataAccess } from '../../../db/repositories/dataAccess';
import type { DecisionReadEvent } from '../../../db/repositories/progressionRepository';
import { logFailure } from '../../../platform/desktop/log';

/**
 * Lecture partagée de ce que le moteur de prescription voit d'un exercice (FIX-0223, D-260) : séance active (`ExerciseProgression`) et aperçu
 * de la carte « Séance du jour ». Module à la demande, jamais dans le départ.
 */

export const reportUnreadableDecision = (event: DecisionReadEvent): void => logFailure('training', event);

/**
 * Rang qu'avait l'exercice dans sa dernière séance close (celle qui fixe la charge de référence), parmi les exercices du même muscle
 * principal. Null si la séance ou le catalogue des muscles est illisible : aucune décote (jamais de double compte, jamais de faux rang).
 */
export async function referencePositionRank(access: DataAccess, history: readonly ExerciseSession[], exerciseId: string, musclesOf: ((id: string) => readonly MuscleWeight[]) | undefined): Promise<number | null> {
  if (musclesOf === undefined) return null;
  // La séance de référence est celle dont `prescribe` tire la charge : la plus récente VALIDE (ni déload ni partielle), pas la plus récente.
  const latest = analyzeHistory(history, DEFAULT_PROGRESSION_CONFIG).estimates[0] ?? null;
  if (latest === null) return null;
  try {
    const closed = await (await access.repos.workouts()).getClosed(latest.workoutId);
    if (closed === null) return null;
    return positionRanksOfSets(closed.sets, musclesOf).get(exerciseId) ?? null;
  } catch {
    return null;
  }
}

/** Poids de corps actuel (tendance des pesées récentes) ; null si illisible ou sans pesée. */
export async function bodyweightNow(access: DataAccess): Promise<number | null> {
  try {
    const recent = await (await access.repos.bodyWeights()).listRecent(400);
    return currentBodyweightKg(recent.map((w) => ({ date: w.date, kg: w.kg })));
  } catch {
    return null;
  }
}

/** Contexte complet d'un exercice, lu comme la séance active le lit (historique clos, décision de référence, profil, rangs, poids de corps). */
export async function loadPrescriptionContext(access: DataAccess, exerciseId: string, exercise: Exercise | undefined, musclesOf: ((id: string) => readonly MuscleWeight[]) | undefined): Promise<PrescriptionContext> {
  const repo = await access.repos.progression();
  const [history, reference, profile] = await Promise.all([repo.history(exerciseId), repo.lastDecision(exerciseId, reportUnreadableDecision), repo.getProfile(exerciseId)]);
  const lastPositionRank = await referencePositionRank(access, history, exerciseId, musclesOf);
  const bodyweightKg = exercise?.bodyweightFraction ? await bodyweightNow(access) : null;
  return { history, reference, profile, lastPositionRank, bodyweightKg };
}
