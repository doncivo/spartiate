import type { WorkoutSet } from './session';

/**
 * SESS-01b (§ 13.2 « Vignettes réordonnables ; sauter ») : ordre des exercices d'une séance ouverte. Module pur.
 *
 * Une unité est un exercice libre (toutes ses séries) ou un groupe entier (superset, circuit : toutes ses séries alternées, jamais séparées).
 * Les fonctions rendent la liste des séries vivantes dans le nouvel ordre (à écrire par `WorkoutRepository.reorderSets`), ou null s'il n'y a
 * rien à changer.
 */

export interface SessionUnit {
  /** `c:<groupe>` ou `x:<exercice>`. */
  readonly key: string;
  readonly circuitId: string | null;
  /** Exercices de l'unité, dans l'ordre de première apparition. */
  readonly exerciseIds: readonly string[];
  readonly setIds: readonly string[];
}

const live = (sets: readonly WorkoutSet[]): WorkoutSet[] =>
  sets.filter((s) => (s.deletedAt ?? null) === null).sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

export function sessionUnits(sets: readonly WorkoutSet[]): SessionUnit[] {
  const units = new Map<string, { circuitId: string | null; exerciseIds: string[]; setIds: string[] }>();
  for (const s of live(sets)) {
    const circuitId = s.circuitId ?? null;
    const key = circuitId !== null ? `c:${circuitId}` : `x:${s.exerciseId}`;
    const unit = units.get(key) ?? { circuitId, exerciseIds: [], setIds: [] };
    units.set(key, unit);
    if (!unit.exerciseIds.includes(s.exerciseId)) unit.exerciseIds.push(s.exerciseId);
    unit.setIds.push(s.id);
  }
  return [...units].map(([key, u]) => ({ key, ...u }));
}

const flatten = (units: readonly SessionUnit[]): string[] => units.flatMap((u) => u.setIds);

/** L'unité `key` à l'index `toIndex` (borné) ; clé inconnue ou même place : null. */
export function moveUnitOrder(sets: readonly WorkoutSet[], key: string, toIndex: number): string[] | null {
  const units = sessionUnits(sets);
  const from = units.findIndex((u) => u.key === key);
  if (from < 0) return null;
  const to = Math.max(0, Math.min(units.length - 1, Math.trunc(toIndex)));
  if (to === from) return null;
  const [unit] = units.splice(from, 1);
  if (unit === undefined) return null;
  units.splice(to, 0, unit);
  return flatten(units);
}

/** « Sauter » : l'unité de l'exercice passe en fin de séance (séries gardées, à faire) ; déjà dernière, absente ou sans série à faire : null. */
export function skipUnitOrder(sets: readonly WorkoutSet[], exerciseId: string): string[] | null {
  const units = sessionUnits(sets);
  const index = units.findIndex((u) => u.exerciseIds.includes(exerciseId));
  const unit = units[index];
  if (unit === undefined || index === units.length - 1) return null;
  const ids = new Set(unit.setIds);
  if (!sets.some((s) => ids.has(s.id) && !s.done && s.setKind !== 'warmup')) return null;
  return moveUnitOrder(sets, unit.key, units.length - 1);
}
