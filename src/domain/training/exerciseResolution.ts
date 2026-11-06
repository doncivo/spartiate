import { customExerciseById, type CustomExerciseSource, type ExerciseCatalog } from './exerciseCatalog';
import type { CustomExercise, EmbeddedExercise } from './types';

/**
 * Résolution d'une référence d'exercice (P-09, D-71) : embarqué (JSON), personnalisé actif (ligne `exercise`) ou inconnu. Une référence
 * inconnue n'est jamais une erreur : elle reste affichée par son nom figé (celui de la ligne qui la porte), sinon par le dernier nom
 * connu d'un exercice personnalisé supprimé, sinon par son identifiant. L'identifiant n'est jamais réattribué à un autre exercice.
 */
export interface ExerciseRef {
  readonly id: string;
  /** Nom figé porté par la ligne de routine ou de séance. */
  readonly frozenName?: string | null;
}

export type ResolvedExercise =
  | { readonly status: 'embedded'; readonly id: string; readonly name: string; readonly exercise: EmbeddedExercise }
  | { readonly status: 'custom'; readonly id: string; readonly name: string; readonly exercise: CustomExercise }
  | { readonly status: 'unknown'; readonly reason: 'absent' | 'deleted'; readonly id: string; readonly name: string; readonly exercise: null };

export function resolveExercise(ref: ExerciseRef, catalog: ExerciseCatalog, customs: CustomExerciseSource): ResolvedExercise {
  const embedded = catalog.get(ref.id);
  if (embedded) return { status: 'embedded', id: ref.id, name: embedded.nameFr, exercise: embedded };
  const custom = customExerciseById(customs, ref.id);
  if (custom && custom.deletedAt === null) return { status: 'custom', id: ref.id, name: custom.nameFr, exercise: custom };
  const frozen = ref.frozenName !== undefined && ref.frozenName !== null && ref.frozenName.trim() !== '' ? ref.frozenName : null;
  if (custom) return { status: 'unknown', reason: 'deleted', id: ref.id, name: frozen ?? custom.nameFr, exercise: null };
  return { status: 'unknown', reason: 'absent', id: ref.id, name: frozen ?? ref.id, exercise: null };
}
