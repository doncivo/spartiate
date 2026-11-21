import type { SetKind, WorkoutSet } from './session';

/**
 * SESS-01c (§ 13.2 « types Warm-up / Normal / Drop / Failure / Chrono ») : la série « Échec » est une série de TRAVAIL à RIR 0 (décision proposée :
 * aucune migration de la contrainte `set_kind`, aucun changement du catalogue publié ; le moteur la lit déjà comme une série menée à l'échec).
 * Module pur : choix du sélecteur de type et écriture qui en découle.
 */

export type SetKindChoice = SetKind | 'failure';

export const isFailureSet = (set: Pick<WorkoutSet, 'setKind' | 'rir'>): boolean => set.setKind === 'work' && set.rir === 0;

/** Valeur du sélecteur de type d'une série. */
export const setKindChoiceOf = (set: Pick<WorkoutSet, 'setKind' | 'rir'>): SetKindChoice => (isFailureSet(set) ? 'failure' : set.setKind);

/** Écriture d'un choix : « Échec » = travail + RIR 0 ; quitter « Échec » efface le RIR 0 qu'il avait posé ; sinon le type seul. */
export function setKindPatch(choice: SetKindChoice, current: Pick<WorkoutSet, 'setKind' | 'rir'>): { readonly setKind: SetKind; readonly rir?: number | null } {
  if (choice === 'failure') return { setKind: 'work', rir: 0 };
  return isFailureSet(current) ? { setKind: choice, rir: null } : { setKind: choice };
}
