import type { ExercisePattern, MuscleWeight } from './types';

/**
 * Filtres de la bibliothèque par muscle et par pattern de mouvement (PRD § 14.2 ; MOTEUR-0281c, C-191). Module pur : l'écran les combine
 * avec ses filtres existants (groupe, compatibilité avec le profil actif, recherche nom FR / alias EN).
 */

/** Valeur « Tous » d'un filtre (aucune restriction). */
export const LIBRARY_ALL = '';

export interface LibraryFilters {
  /** Identifiant du catalogue fermé des muscles, ou `LIBRARY_ALL`. */
  readonly muscle: string;
  readonly pattern: ExercisePattern | typeof LIBRARY_ALL;
}

/** Vrai si l'exercice sollicite le muscle choisi (quel que soit son poids) et suit le pattern choisi. */
export function matchesLibraryFilters(exercise: { readonly muscles: readonly MuscleWeight[]; readonly pattern: ExercisePattern }, filters: LibraryFilters): boolean {
  if (filters.muscle !== LIBRARY_ALL && !exercise.muscles.some((m) => m.id === filters.muscle)) return false;
  return filters.pattern === LIBRARY_ALL || exercise.pattern === filters.pattern;
}

export interface MuscleOptionGroup {
  readonly group: string;
  readonly muscles: readonly { readonly id: string; readonly nameFr: string }[];
}

/** Muscles proposés au filtre : ceux qu'au moins un exercice sollicite, groupés par région, dans l'ordre du catalogue des muscles. */
export function muscleOptions(catalog: readonly { readonly id: string; readonly nameFr: string; readonly group: string }[], exercises: readonly { readonly muscles: readonly MuscleWeight[] }[]): MuscleOptionGroup[] {
  const used = new Set(exercises.flatMap((e) => e.muscles.map((m) => m.id)));
  const groups: { group: string; muscles: { id: string; nameFr: string }[] }[] = [];
  for (const m of catalog) {
    if (!used.has(m.id)) continue;
    let g = groups.find((x) => x.group === m.group);
    if (g === undefined) {
      g = { group: m.group, muscles: [] };
      groups.push(g);
    }
    g.muscles.push({ id: m.id, nameFr: m.nameFr });
  }
  return groups;
}
