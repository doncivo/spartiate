import type { CustomExercise, CustomExerciseInput } from '../../domain/training';
import type { ReadOptions } from './common';

/**
 * Exercices PERSONNALISÉS (table `exercise`, D-71, P-09). Les exercices embarqués n'ont aucune ligne : ce repository ne les voit jamais.
 * L'identifiant (UUID) arrive de l'appelant ; une collision est refusée, supprimée ou non (`RepositoryError('conflict')`), et un
 * identifiant qui n'est pas un UUID (dont celui d'un exercice embarqué) est refusé (`'invalid'`). Les JSON sont validés à l'écriture
 * (`src/db/parse`) ; à la lecture, un JSON illisible (ligne reçue d'une autre version) rend une valeur de repli sans échouer.
 * Supprimer un exercice ne touche ni les routines ni l'historique qui le référencent.
 */
export interface ExerciseRepository {
  create(input: CustomExerciseInput): Promise<CustomExercise>;
  /** Champs fournis seulement ; `'not-found'` si la ligne est absente ou supprimée. */
  update(id: string, patch: Partial<Omit<CustomExerciseInput, 'id'>>): Promise<CustomExercise>;
  /** Suppression logique (la tombstone est propagée par la synchro). */
  softDelete(id: string): Promise<void>;
  /** Rétablit un exercice supprimé (`deleted_at` à NULL, entrée « + »). */
  restore(id: string): Promise<CustomExercise>;
  get(id: string, options?: ReadOptions): Promise<CustomExercise | null>;
  /** Triés par nom français. */
  list(options?: ReadOptions): Promise<CustomExercise[]>;
}
