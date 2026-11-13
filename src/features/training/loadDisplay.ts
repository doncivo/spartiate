import { dumbbellsHeld } from '../../domain/training/dumbbellPair';
import { loadGrid } from '../../domain/training/loadGrid';
import type { Exercise } from '../../domain/training';
import type { TrainingData } from './trainingState';

/**
 * ERGO-02 (D-261, révise D-260) : nombre d'haltères tenus pour AFFICHER une charge (« 2 × 26 kg » ou « 26 kg »). La valeur stockée, saisie,
 * prescrite et comptée dans le volume reste celle d'un haltère : rien d'autre ne lit ce nombre.
 */
export type Held = 1 | 2 | null;

/** Profil de matériel tel que `loadGrid` le lit (profil actif de l'appareil). */
type GridProfile = Parameters<typeof loadGrid>[1];

/** Exercice inconnu : null (aucun « 2 × ») ; sans profil : source déduite du matériel de l'exercice (`undefined`). */
export function heldFor(exercise: Exercise | undefined, profile: GridProfile | undefined): Held {
  if (exercise === undefined) return null;
  return dumbbellsHeld(exercise, profile === undefined || profile === null ? undefined : (loadGrid(exercise.equipment, profile)?.source ?? null));
}

/** Recherche par identifiant (catalogue, puis exercices personnels, supprimés compris) avec le profil actif. */
export function heldLookup(data: TrainingData): (exerciseId: string) => Held {
  return (exerciseId) => heldFor(data.content.catalog.get(exerciseId) ?? data.allCustoms.find((c) => c.id === exerciseId), data.active);
}
