import type { BaseCounts } from '../../domain/onboarding/draft';
import type { LocalDate } from '../../domain/types';
import type { DataAccess } from '../../db/repositories/dataAccess';

/**
 * Premier lancement (I3-07) : ce dont l'hôte a besoin pour décider d'ouvrir l'onboarding, sans tirer l'écriture finale ni le contenu
 * d'entraînement (l'hôte est préchargé au repos, les écrans ne le sont pas).
 */

/** Accroche de développement (e2e, tests) : `localStorage[SKIP_ONBOARDING_KEY] = '1'` masque le lancement automatique (jamais dans un build de production). */
export const SKIP_ONBOARDING_KEY = 'ct.skipOnboarding';

export function onboardingDisabledForDev(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    return globalThis.localStorage?.getItem(SKIP_ONBOARDING_KEY) === '1';
  } catch {
    return false;
  }
}

/** Ce qui existe déjà dans la base : sert à reconnaître un premier lancement (base vide) d'une installation existante. */
export async function readBaseCounts(data: DataAccess): Promise<BaseCounts> {
  const { repos } = data;
  const [profile, routines, weights, openWorkout, closedWorkouts, meals] = await Promise.all([
    repos.profile().then((r) => r.get()),
    repos.trainingRoutines().then((r) => r.list()),
    repos.bodyWeights().then((r) => r.listRecent(1)),
    repos.workouts().then((r) => r.getOpen()),
    repos.workouts().then((r) => r.listClosed(1)),
    repos.mealEntries().then((r) => r.listBetween('2000-01-01' as LocalDate, '2999-12-31' as LocalDate)),
  ]);
  return { profile: profile !== null, routines: routines.length, weights: weights.length, workouts: (openWorkout ? 1 : 0) + closedWorkouts.length, meals: meals.length };
}

export async function markCompleted(data: DataAccess): Promise<void> {
  await data.repos.settings.set('onboarding.completed', true);
}
