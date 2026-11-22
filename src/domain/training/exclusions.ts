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
 * Contre-relecture (D-469) : ce qui RESTE de l'ancien réglage après une reprise : les seuls éléments non repris (illisibles ici, ou dont l'insertion a
 * échoué). null : tout est repris, le réglage est vidé. Un élément repris n'y reste jamais : une remise faite ensuite (suppression logique), puis une
 * remise à zéro qui efface la ligne, ne peuvent pas le faire revenir depuis le réglage. Réglage illisible en entier : gardé tel quel.
 */
export function legacyExclusionsResidue(raw: unknown, failedIds: readonly string[]): unknown {
  if (typeof raw !== 'object' || raw === null) return raw ?? null;
  const value = raw as { readonly v?: unknown; readonly ids?: unknown };
  if (value.v !== 1 || !Array.isArray(value.ids)) return raw;
  const failed = new Set(failedIds);
  const rest = [...new Set(value.ids as unknown[])].filter((id) => !isExerciseId(id) || failed.has(id));
  return rest.length === 0 ? null : { v: 1, ids: rest };
}

export function withExcluded(ids: readonly string[], id: string, excluded: boolean): ExcludedExercisesValue {
  return { v: 1, ids: normalize(excluded ? [...ids, id] : ids.filter((x) => x !== id)) };
}
