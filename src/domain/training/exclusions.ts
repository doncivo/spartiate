/**
 * SESS-01b (§ 13.2 « retirer, ne plus proposer ») : exercices écartés par Ali, jamais proposés en remplacement ni par la génération. Valeur du
 * réglage LOCAL `training.excludedExercises` (`{ v: 1, ids }`), lue prudemment : illisible = aucun exercice écarté. Module pur.
 */

export interface ExcludedExercisesValue {
  readonly v: 1;
  readonly ids: readonly string[];
}

/** Relecture 1 (point 4) : mêmes bornes que la table publiée `exercise_exclusion` (1 à 118 caractères, sans « | », CHECK de la migration 0021). */
const ID_MAX = 118;
const isExerciseId = (id: unknown): id is string => typeof id === 'string' && id.trim() !== '' && id.length <= ID_MAX && !id.includes('|');
const normalize = (ids: readonly string[]): string[] => [...new Set(ids)].sort();

export function parseExcludedExercises(raw: unknown): readonly string[] {
  if (typeof raw !== 'object' || raw === null) return [];
  const value = raw as { readonly v?: unknown; readonly ids?: unknown };
  if (value.v !== 1 || !Array.isArray(value.ids)) return [];
  return normalize(value.ids.filter(isExerciseId));
}

/**
 * Relecture 1 (point 4) : l'ancien réglage est-il ENTIÈREMENT lisible (chaque identifiant distinct admis par la table) ? Sinon le lecteur le garde et
 * journalise un code, au lieu de le vider en perdant un écarté.
 */
export function legacyExclusionsComplete(raw: unknown): boolean {
  if (typeof raw !== 'object' || raw === null) return false;
  const value = raw as { readonly v?: unknown; readonly ids?: unknown };
  if (value.v !== 1 || !Array.isArray(value.ids)) return false;
  return new Set(value.ids).size === parseExcludedExercises(raw).length;
}

export function withExcluded(ids: readonly string[], id: string, excluded: boolean): ExcludedExercisesValue {
  return { v: 1, ids: normalize(excluded ? [...ids, id] : ids.filter((x) => x !== id)) };
}
