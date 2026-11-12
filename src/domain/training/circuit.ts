import { REST_TIMER_MAX_SEC, type WorkoutSet } from './session';

/**
 * Circuits dans la séance (PRD § 13.8, I6-03) : UN SEUL mécanisme pour le superset (2 exercices), le triset (3) et le circuit (4 et plus). Un groupe
 * relie au moins deux exercices d'une séance ; l'ordre d'exécution alterne série par série (tour 1 : A1 B1 C1, tour 2 : A2 B2 C2…) ; le repos entre
 * exercices du groupe (nul = aucun) s'applique à l'intérieur d'un tour, le repos de fin de tour après le dernier exercice du tour.
 *
 * Stockage : `circuit_id` et `circuit_rest_sec` sur chaque série du groupe (migration 0013). Le nombre de tours n'est pas stocké : c'est le plus grand
 * nombre de séries de travail d'un exercice du groupe. Le repos de fin de tour est la cible de repos des séries (`target_rest_sec`), comme hors groupe.
 * Un échauffement n'entre jamais dans l'alternance : il passe avant le premier tour. Module pur.
 */

export const CIRCUIT_MIN_EXERCISES = 2;
/** Tours au plus (autant que de séries par exercice, `SETS_MAX`). */
export const CIRCUIT_ROUNDS_MAX = 20;
/** Repos entre exercices ou de fin de tour : de 0 à une heure, comme tout repos programmé. */
export const CIRCUIT_REST_MAX_SEC = REST_TIMER_MAX_SEC;
export const CIRCUIT_ID_MAX = 64;

export type CircuitKind = 'superset' | 'triset' | 'circuit';
export type CircuitIssue = 'exercises' | 'rounds' | 'restBetween' | 'restRound';

/** Nature affichée d'un groupe, selon le nombre d'exercices : le mécanisme est le même. */
export function circuitKind(exerciseCount: number): CircuitKind {
  return exerciseCount <= 2 ? 'superset' : exerciseCount === 3 ? 'triset' : 'circuit';
}

export interface CircuitInput {
  readonly exerciseIds: readonly string[];
  readonly rounds: number;
  readonly restBetweenSec: number;
  /** Repos de fin de tour ; null : les cibles de repos des séries restent celles de l'exercice. */
  readonly restRoundSec: number | null;
}

const isInt = (n: number, min: number, max: number): boolean => Number.isInteger(n) && n >= min && n <= max;

/** Règles de création d'un groupe : deux exercices distincts au moins, tours et repos entiers dans leurs bornes. */
export function validateCircuit(input: CircuitInput): CircuitIssue[] {
  const issues: CircuitIssue[] = [];
  if (input.exerciseIds.length < CIRCUIT_MIN_EXERCISES || new Set(input.exerciseIds).size !== input.exerciseIds.length) issues.push('exercises');
  if (!isInt(input.rounds, 1, CIRCUIT_ROUNDS_MAX)) issues.push('rounds');
  if (!isInt(input.restBetweenSec, 0, CIRCUIT_REST_MAX_SEC)) issues.push('restBetween');
  if (input.restRoundSec !== null && !isInt(input.restRoundSec, 0, CIRCUIT_REST_MAX_SEC)) issues.push('restRound');
  return issues;
}

const byPosition = (a: WorkoutSet, b: WorkoutSet): number => a.position - b.position || a.id.localeCompare(b.id);
const isWork = (s: WorkoutSet): boolean => s.setKind !== 'warmup';

/**
 * Nouvel ordre (identifiants des séries) quand `exerciseIds` forment un groupe : le groupe prend la place de son premier exercice, échauffements
 * d'abord, puis les tours alternés ; un exercice qui n'a plus de série dans un tour est sauté. Les autres exercices gardent leur ordre. Idempotent.
 */
export function orderWithCircuit(sets: readonly WorkoutSet[], exerciseIds: readonly string[]): string[] {
  const sorted = [...sets].sort(byPosition);
  const inGroup = new Set(exerciseIds);
  const members = sorted.filter((s) => inGroup.has(s.exerciseId));
  const warmups = exerciseIds.flatMap((e) => members.filter((s) => s.exerciseId === e && !isWork(s)));
  const works = exerciseIds.map((e) => members.filter((s) => s.exerciseId === e && isWork(s)));
  const rounds = Math.max(0, ...works.map((w) => w.length));
  const block = [...warmups];
  for (let round = 0; round < rounds; round += 1) for (const list of works) if (list[round] !== undefined) block.push(list[round] as WorkoutSet);
  const firstIndex = sorted.findIndex((s) => inGroup.has(s.exerciseId));
  const out: string[] = [];
  for (const [index, set] of sorted.entries()) {
    if (index === firstIndex) out.push(...block.map((s) => s.id));
    if (!inGroup.has(set.exerciseId)) out.push(set.id);
  }
  return out;
}

export interface CircuitInfo {
  readonly circuitId: string;
  /** Exercices du groupe, dans l'ordre d'exécution du tour. */
  readonly exerciseIds: readonly string[];
  readonly rounds: number;
  readonly kind: CircuitKind;
  /** Repos entre exercices d'un même tour (0 = aucun). */
  readonly restBetweenSec: number;
  /** Repos de fin de tour (cible de repos des séries de travail du dernier exercice) ; null : celui de l'exercice. */
  readonly restRoundSec: number | null;
}

/** Groupes d'une séance, dans l'ordre de leur première série. Un identifiant porté par un seul exercice n'est pas un groupe. */
export function circuitsOf(sets: readonly WorkoutSet[]): CircuitInfo[] {
  const sorted = [...sets].sort(byPosition);
  const byId = new Map<string, WorkoutSet[]>();
  for (const s of sorted) if (s.circuitId) byId.set(s.circuitId, [...(byId.get(s.circuitId) ?? []), s]);
  const out: CircuitInfo[] = [];
  for (const [circuitId, members] of byId) {
    const exerciseIds = [...new Set(members.map((s) => s.exerciseId))];
    if (exerciseIds.length < CIRCUIT_MIN_EXERCISES) continue;
    const rounds = Math.max(...exerciseIds.map((e) => members.filter((s) => s.exerciseId === e && isWork(s)).length));
    const lastExercise = exerciseIds[exerciseIds.length - 1] as string;
    const roundSet = members.find((s) => s.exerciseId === lastExercise && isWork(s));
    out.push({ circuitId, exerciseIds, rounds, kind: circuitKind(exerciseIds.length), restBetweenSec: members[0]?.circuitRestSec ?? 0, restRoundSec: roundSet?.targetRestSec ?? null });
  }
  return out;
}

/** Tour (à partir de 1) d'une série de travail d'un groupe : son rang parmi les séries de travail de son exercice ; null hors groupe et pour un échauffement. */
export function roundOf(sets: readonly WorkoutSet[], setId: string): number | null {
  const set = sets.find((s) => s.id === setId);
  if (set === undefined || !set.circuitId || !isWork(set)) return null;
  if (!circuitsOf(sets).some((c) => c.circuitId === set.circuitId)) return null;
  const own = [...sets].sort(byPosition).filter((s) => s.exerciseId === set.exerciseId && isWork(s));
  return own.findIndex((s) => s.id === setId) + 1;
}

/** Prochaine série de travail à faire du groupe, dans l'ordre d'exécution ; null si tout est fait. */
export function nextCircuitSet(sets: readonly WorkoutSet[], circuitId: string): WorkoutSet | null {
  return [...sets].sort(byPosition).find((s) => s.circuitId === circuitId && isWork(s) && !s.done) ?? null;
}

export interface CircuitRest {
  /** `between` : entre deux exercices d'un même tour ; `round` : après le dernier exercice du tour (ou de la dernière série du groupe). */
  readonly phase: 'between' | 'round';
  /** Durée du repos ; null : aucun repos programmé par le groupe (`between` nul) ou à prendre chez l'exercice (`round` sans cible). */
  readonly seconds: number | null;
}

/**
 * Repos à lancer après la validation d'une série de groupe. Null hors groupe et pour un échauffement : le repos habituel de l'exercice s'applique.
 */
export function restAfterCircuitSet(sets: readonly WorkoutSet[], setId: string): CircuitRest | null {
  const round = roundOf(sets, setId);
  const set = sets.find((s) => s.id === setId);
  if (round === null || set === undefined) return null;
  const sorted = [...sets].sort(byPosition);
  const index = sorted.findIndex((s) => s.id === setId);
  const next = sorted.slice(index + 1).find((s) => s.circuitId === set.circuitId && isWork(s));
  if (next !== undefined && roundOf(sets, next.id) === round) {
    const between = set.circuitRestSec ?? 0;
    return { phase: 'between', seconds: between > 0 ? between : null };
  }
  return { phase: 'round', seconds: set.targetRestSec };
}
