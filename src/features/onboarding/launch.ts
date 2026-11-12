import type { BasePresence } from '../../domain/onboarding/draft';
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

/**
 * Ce qui existe déjà dans la base : sert à reconnaître un premier lancement (base vide) d'une installation existante. FIX-0173 (constat 10) : TOUS les
 * domaines de l'utilisateur (récupération, facteurs, mensurations, photos compris), par une requête d'existence bornée, jamais un comptage complet.
 */
export async function readBaseCounts(data: DataAccess): Promise<BasePresence> {
  return (await data.repos.userData()).presence();
}

export async function markCompleted(data: DataAccess): Promise<void> {
  await data.repos.settings.set('onboarding.completed', true);
}
