import { isRestSeconds } from './session';

/**
 * Durée du repos lancé à la validation d'une série (I1-02, § 13.2 « auto à la validation »). Ordre de priorité, sans aucune valeur de
 * progression :
 * 1. la durée explicite de la série (repos de la ligne de routine, ou de la séance copiée) ;
 * 2. le réglage « Repos par défaut » de cet appareil (`training.restSeconds`, local), s'il est choisi ;
 * 3. le repos par défaut de l'exercice dans la bibliothèque (`defaultRestSec`) ;
 * 4. `REST_FALLBACK_SEC` pour un exercice inconnu de la bibliothèque.
 * Un repos de 0 s (routine) signifie « pas de repos » : `null`, aucun minuteur. Une série d'échauffement ne lance jamais de repos.
 */

export const REST_FALLBACK_SEC = 90;
/** Choix proposés pour le réglage « Repos par défaut » (secondes). */
export const REST_CHOICES_SEC = [60, 90, 120, 150, 180, 240, 300] as const;

export interface RestSource {
  readonly setKind: string;
  readonly targetRestSec: number | null;
}

export function restSecondsFor(set: RestSource, settingSec: number | null, exerciseDefaultSec: number | null): number | null {
  if (set.setKind === 'warmup') return null;
  if (set.targetRestSec !== null) return isRestSeconds(set.targetRestSec) ? set.targetRestSec : null;
  if (settingSec !== null && isRestSeconds(settingSec)) return settingSec;
  if (exerciseDefaultSec !== null && isRestSeconds(exerciseDefaultSec)) return exerciseDefaultSec;
  return REST_FALLBACK_SEC;
}

/** Valeur brute du réglage local : une durée valide, sinon null (« selon l'exercice »). */
export function parseRestSetting(raw: unknown): number | null {
  return typeof raw === 'number' && isRestSeconds(raw) ? raw : null;
}
