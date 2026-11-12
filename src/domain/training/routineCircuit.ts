import { CIRCUIT_ID_MAX, CIRCUIT_MIN_EXERCISES, CIRCUIT_REST_MAX_SEC, circuitKind, type CircuitKind } from './circuit';
import { REST_MAX_SEC, SETS_MAX } from './routineRules';

/**
 * Groupes de circuit dans un jour de routine (I6-03b, § 13.8 ; constat 11 de la relecture Codex du 12/11). Même mécanisme que dans la séance (D-102) :
 * superset (2 lignes), triset (3), circuit (4 et plus). Stockage : `circuit_id` et `circuit_rest_sec` sur chaque ligne du groupe (migration 0014).
 * Le nombre de tours n'est pas stocké : c'est le plus grand nombre de séries d'une ligne du groupe ; le repos de fin de tour est le repos de la ligne
 * (`rest_sec`), comme hors groupe. Un identifiant porté par une seule ligne n'est pas un groupe (ligne libre). Module pur.
 */

/** Ligne de routine vue par les règles de groupe (saisie de l'éditeur ou ligne stockée). */
export interface RoutineCircuitLine {
  readonly id: string;
  readonly exerciseId: string;
  readonly sets: number;
  readonly restSec: number;
  readonly position: number;
  readonly circuitId?: string | null;
  readonly circuitRestSec?: number | null;
}

export interface RoutineCircuitInfo {
  readonly circuitId: string;
  /** Lignes du groupe, par position. */
  readonly lineIds: readonly string[];
  readonly kind: CircuitKind;
  readonly rounds: number;
  /** Repos entre deux exercices d'un même tour (0 = aucun). */
  readonly restBetweenSec: number;
  /** Repos de fin de tour : repos de la dernière ligne du groupe. */
  readonly restRoundSec: number;
}

export interface RoutineGroupInput {
  /** Identifiant du groupe (UUID fabriqué par l'éditeur). */
  readonly circuitId: string;
  readonly lineIds: readonly string[];
  /** Nombre de tours ; null : le plus grand nombre de séries des lignes cochées. */
  readonly rounds: number | null;
  readonly restBetweenSec: number;
  /** Repos de fin de tour écrit sur chaque ligne du groupe ; null : chaque ligne garde le sien. */
  readonly restRoundSec: number | null;
}

export type RoutineGroupIssue = 'lines' | 'grouped' | 'rounds' | 'restBetween' | 'restRound' | 'circuitId';

const isInt = (n: number, min: number, max: number): boolean => Number.isInteger(n) && n >= min && n <= max;
const byPosition = <T extends RoutineCircuitLine>(a: T, b: T): number => a.position - b.position || a.id.localeCompare(b.id);
const groupOf = (line: RoutineCircuitLine): string | null => (line.circuitId === undefined || line.circuitId === null || line.circuitId === '' ? null : line.circuitId);

/** Groupes d'un jour, dans l'ordre de leur première ligne. Un identifiant porté par une seule ligne n'est pas un groupe. */
export function routineCircuitsOf<T extends RoutineCircuitLine>(lines: readonly T[]): RoutineCircuitInfo[] {
  const byId = new Map<string, T[]>();
  for (const line of [...lines].sort(byPosition)) {
    const id = groupOf(line);
    if (id !== null) byId.set(id, [...(byId.get(id) ?? []), line]);
  }
  const out: RoutineCircuitInfo[] = [];
  for (const [circuitId, members] of byId) {
    if (members.length < CIRCUIT_MIN_EXERCISES) continue;
    const last = members[members.length - 1] as T;
    out.push({
      circuitId,
      lineIds: members.map((m) => m.id),
      kind: circuitKind(members.length),
      rounds: Math.max(...members.map((m) => m.sets)),
      restBetweenSec: members[0]?.circuitRestSec ?? 0,
      restRoundSec: last.restSec,
    });
  }
  return out;
}

/** Règles de création d'un groupe dans un jour : deux lignes distinctes et libres au moins, exercices distincts, bornes. */
export function validateRoutineGroup(lines: readonly RoutineCircuitLine[], input: RoutineGroupInput): RoutineGroupIssue[] {
  const issues: RoutineGroupIssue[] = [];
  const members = input.lineIds.map((id) => lines.find((l) => l.id === id));
  const exercises = members.map((m) => m?.exerciseId);
  if (input.lineIds.length < CIRCUIT_MIN_EXERCISES || new Set(input.lineIds).size !== input.lineIds.length || members.some((m) => m === undefined) || new Set(exercises).size !== exercises.length) issues.push('lines');
  const grouped = new Set(routineCircuitsOf(lines).flatMap((c) => c.lineIds));
  if (members.some((m) => m !== undefined && grouped.has(m.id))) issues.push('grouped');
  if (input.rounds !== null && !isInt(input.rounds, 1, SETS_MAX)) issues.push('rounds');
  if (!isInt(input.restBetweenSec, 0, CIRCUIT_REST_MAX_SEC)) issues.push('restBetween');
  if (input.restRoundSec !== null && !isInt(input.restRoundSec, 0, REST_MAX_SEC)) issues.push('restRound');
  if (input.circuitId.length < 1 || input.circuitId.length > CIRCUIT_ID_MAX) issues.push('circuitId');
  return issues;
}

/**
 * Crée le groupe : ses lignes deviennent voisines à la place de la première (ordre des positions), positions renumérotées 0, 1, 2… ; séries de chaque
 * ligne = nombre de tours (par défaut le plus grand nombre) ; repos de fin de tour écrit sur chaque ligne s'il est donné. Groupe refusé : lignes
 * rendues inchangées (l'appelant affiche `validateRoutineGroup`).
 */
export function groupRoutineLines<T extends RoutineCircuitLine>(lines: readonly T[], input: RoutineGroupInput): T[] {
  if (validateRoutineGroup(lines, input).length > 0) return [...lines];
  const sorted = [...lines].sort(byPosition);
  const inGroup = new Set(input.lineIds);
  const members = sorted.filter((l) => inGroup.has(l.id));
  const rounds = input.rounds ?? Math.max(...members.map((m) => m.sets));
  const block = members.map((m): T => ({ ...m, sets: rounds, restSec: input.restRoundSec ?? m.restSec, circuitId: input.circuitId, circuitRestSec: input.restBetweenSec }));
  const firstIndex = sorted.findIndex((l) => inGroup.has(l.id));
  const ordered: T[] = [];
  for (const [index, line] of sorted.entries()) {
    if (index === firstIndex) ordered.push(...block);
    if (!inGroup.has(line.id)) ordered.push(line);
  }
  return ordered.map((l, position) => ({ ...l, position }));
}

/** Défait un groupe : identifiant et repos du groupe effacés ; séries, repos et ordre des lignes gardés. */
export function ungroupRoutineLines<T extends RoutineCircuitLine>(lines: readonly T[], circuitId: string): T[] {
  return lines.map((l) => (groupOf(l) === circuitId ? { ...l, circuitId: null, circuitRestSec: null } : l));
}

/** Après un retrait : un groupe qui n'a plus qu'une ligne n'en est plus un (identifiant et repos effacés). */
export function dissolveLoneRoutineCircuits<T extends RoutineCircuitLine>(lines: readonly T[]): T[] {
  const kept = new Set(routineCircuitsOf(lines).map((c) => c.circuitId));
  return lines.map((l) => {
    const id = groupOf(l);
    return id !== null && !kept.has(id) ? { ...l, circuitId: null, circuitRestSec: null } : l;
  });
}
