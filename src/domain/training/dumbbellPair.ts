import type { LoadSource } from './loadGrid';

/**
 * ERGO-02 (D-261, révise D-260) : nombre d'haltères tenus pendant l'exercice, pour l'affichage seulement (« 2 × 26 kg »).
 * La charge stockée, prescrite et comptée dans le volume reste celle d'un haltère : rien ne change dans le moteur. Module pur.
 *
 * Exercices du catalogue tenus avec un seul haltère ; tout autre exercice dont la charge vient des haltères en tient deux
 * (fentes et montées comprises, même unilatérales). Un exercice personnel à un haltère s'affiche donc « 2 × » : écart assumé (D-261).
 */
export const SINGLE_DUMBBELL_EXERCISES: ReadonlySet<string> = new Set([
  'goblet-squat',
  'pullover-dumbbell',
  'overhead-triceps-extension-dumbbell',
  'overhead-triceps-extension-dumbbell-one-arm',
  'concentration-curl',
  'lateral-raise-dumbbell-one-arm',
  'row-dumbbell-one-arm',
  'triceps-kickback',
  'suitcase-carry',
  'pull-up-weighted',
  'single-leg-hip-thrust',
  'single-leg-romanian-deadlift',
]);

/** Matériel qui porte une charge, dans l'ordre de `loadGrid` : sert quand la source de la grille est inconnue (aucun profil). */
const LOADED_IMPLEMENTS: ReadonlySet<string> = new Set(['barbell', 'ez-bar', 'trap-bar', 'dumbbell', 'kettlebell', 'low-pulley', 'high-pulley', 'cable-machine']);

export interface DumbbellExercise {
  readonly id: string;
  readonly equipment: readonly string[];
}

/**
 * 2 (deux haltères), 1 (un seul) ou null (la charge ne vient pas des haltères). `source` : celle de `loadGrid(...)` quand elle est
 * connue ; null (aucune grille) ou `undefined` (aucun profil) : déduite du premier matériel chargé de l'exercice.
 */
export function dumbbellsHeld(exercise: DumbbellExercise, source: LoadSource | null | undefined): 1 | 2 | null {
  const fromDumbbell = source === undefined || source === null ? exercise.equipment.find((id) => LOADED_IMPLEMENTS.has(id)) === 'dumbbell' : source === 'dumbbell';
  if (!fromDumbbell) return null;
  return SINGLE_DUMBBELL_EXERCISES.has(exercise.id) ? 1 : 2;
}
