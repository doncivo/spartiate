import type { CustomExercise, EmbeddedExercise, Exercise } from './types';

/**
 * Catalogue embarqué injecté (§ 14.1) : le domaine ne lit jamais `content/`. L'interface (ou un test) fournit la liste des exercices du
 * JSON ; `createExerciseCatalog` en fait une table de recherche par identifiant, insensible aux noms hérités d'`Object`.
 */
export interface ExerciseCatalog {
  get(id: string): EmbeddedExercise | undefined;
  has(id: string): boolean;
  list(): readonly EmbeddedExercise[];
}

export function createExerciseCatalog(exercises: readonly EmbeddedExercise[]): ExerciseCatalog {
  const byId = new Map<string, EmbeddedExercise>();
  for (const exercise of exercises) {
    if (byId.has(exercise.id)) throw new Error(`catalogue d'exercices : identifiant en double (${exercise.id})`);
    byId.set(exercise.id, exercise);
  }
  return { get: (id) => byId.get(id), has: (id) => byId.has(id), list: () => exercises };
}

/** Exercices personnalisés fournis à la résolution : liste ou table par identifiant. */
export type CustomExerciseSource = readonly CustomExercise[] | ReadonlyMap<string, CustomExercise>;

export function customExerciseById(source: CustomExerciseSource, id: string): CustomExercise | undefined {
  if (source instanceof Map) return source.get(id);
  return (source as readonly CustomExercise[]).find((e) => e.id === id);
}

/** Tous les exercices utilisables (embarqués puis personnalisés actifs), pour la bibliothèque et la recherche. */
export function allExercises(catalog: ExerciseCatalog, customs: readonly CustomExercise[]): readonly Exercise[] {
  return [...catalog.list(), ...customs.filter((c) => c.deletedAt === null)];
}
