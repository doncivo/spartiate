import type { BasePresence } from '../../domain/onboarding/draft';

/**
 * Présence de données de l'utilisateur (FIX-0173, constat 10) : sert à reconnaître une base vide au premier lancement. Une seule lecture, une requête
 * d'existence bornée par table (`SELECT 1 … LIMIT 1`), jamais un comptage ni une lecture complète ; lignes supprimées (`deleted_at`) non comptées.
 */
export interface UserDataRepository {
  presence(): Promise<BasePresence>;
}
