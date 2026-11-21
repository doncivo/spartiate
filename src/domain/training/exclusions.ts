/**
 * SESS-01b (§ 13.2 « retirer, ne plus proposer ») : exercices écartés par Ali, jamais proposés en remplacement ni par la génération. Valeur du
 * réglage LOCAL `training.excludedExercises` (`{ v: 1, ids }`), lue prudemment : illisible = aucun exercice écarté. Module pur.
 */

export interface ExcludedExercisesValue {
  readonly v: 1;
  readonly ids: readonly string[];
}

const ID_MAX = 128;
const normalize = (ids: readonly string[]): string[] => [...new Set(ids)].sort();

export function parseExcludedExercises(raw: unknown): readonly string[] {
  if (typeof raw !== 'object' || raw === null) return [];
  const value = raw as { readonly v?: unknown; readonly ids?: unknown };
  if (value.v !== 1 || !Array.isArray(value.ids)) return [];
  return normalize(value.ids.filter((id): id is string => typeof id === 'string' && id.trim() !== '' && id.length <= ID_MAX));
}

export function withExcluded(ids: readonly string[], id: string, excluded: boolean): ExcludedExercisesValue {
  return { v: 1, ids: normalize(excluded ? [...ids, id] : ids.filter((x) => x !== id)) };
}
