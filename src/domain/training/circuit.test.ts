import { describe, expect, it } from 'vitest';
import { setRow } from '../../../tests/fixtures/training/workout';
import {
  CIRCUIT_MIN_EXERCISES,
  CIRCUIT_ROUNDS_MAX,
  circuitKind,
  circuitsOf,
  nextCircuitSet,
  orderWithCircuit,
  restAfterCircuitSet,
  roundOf,
  validateCircuit,
} from './circuit';
import { planFromPastWorkout, type WorkoutSet, type WorkoutWithSets } from './session';

/**
 * I6-03 (§ 13.8, circuits) : regroupement générique de plusieurs exercices d'une séance (superset, triset, circuit : un seul mécanisme). Règles
 * pures : groupe de 2 exercices au moins, nombre de tours, ordre alterné série par série, repos entre exercices puis repos de fin de tour.
 */
const ex = (id: string, n: number, over: Partial<WorkoutSet> = {}): WorkoutSet[] =>
  Array.from({ length: n }, (_, i) => setRow(0, { id: `${id}-${i + 1}`, exerciseId: id, exerciseName: id, position: 0, ...over }));
const withPositions = (sets: WorkoutSet[]): WorkoutSet[] => sets.map((s, position) => ({ ...s, position }));

describe('nature du groupe : un seul mécanisme', () => {
  it('2 exercices superset, 3 triset, 4 et plus circuit', () => {
    expect(CIRCUIT_MIN_EXERCISES).toBe(2);
    expect([2, 3, 4, 6].map(circuitKind)).toEqual(['superset', 'triset', 'circuit', 'circuit']);
  });
});

describe('validateCircuit', () => {
  const ok = { exerciseIds: ['a', 'b'], rounds: 3, restBetweenSec: 0, restRoundSec: 90 };
  it('un groupe valide', () => {
    expect(validateCircuit(ok)).toEqual([]);
    expect(validateCircuit({ ...ok, restRoundSec: null })).toEqual([]);
  });
  it('moins de deux exercices, ou un exercice répété', () => {
    expect(validateCircuit({ ...ok, exerciseIds: ['a'] })).toContain('exercises');
    expect(validateCircuit({ ...ok, exerciseIds: [] })).toContain('exercises');
    expect(validateCircuit({ ...ok, exerciseIds: ['a', 'a'] })).toContain('exercises');
  });
  it('tours : entier de 1 à la borne', () => {
    for (const rounds of [0, -1, 1.5, CIRCUIT_ROUNDS_MAX + 1, Number.NaN]) expect(validateCircuit({ ...ok, rounds }), String(rounds)).toContain('rounds');
    expect(validateCircuit({ ...ok, rounds: CIRCUIT_ROUNDS_MAX })).toEqual([]);
  });
  it('repos : entiers de 0 à 3 600 s', () => {
    for (const restBetweenSec of [-1, 3601, 1.5]) expect(validateCircuit({ ...ok, restBetweenSec }), String(restBetweenSec)).toContain('restBetween');
    for (const restRoundSec of [-1, 3601, 0.5]) expect(validateCircuit({ ...ok, restRoundSec }), String(restRoundSec)).toContain('restRound');
  });
});

describe('orderWithCircuit : ordre alterné série par série', () => {
  it('deux exercices, trois tours : A1 B1 A2 B2 A3 B3', () => {
    const sets = withPositions([...ex('a', 3), ...ex('b', 3)]);
    expect(orderWithCircuit(sets, ['a', 'b'])).toEqual(['a-1', 'b-1', 'a-2', 'b-2', 'a-3', 'b-3']);
  });
  it('le groupe prend la place de son premier exercice ; les autres exercices gardent leur ordre', () => {
    const sets = withPositions([...ex('x', 2), ...ex('a', 2), ...ex('y', 1), ...ex('b', 2)]);
    expect(orderWithCircuit(sets, ['a', 'b'])).toEqual(['x-1', 'x-2', 'a-1', 'b-1', 'a-2', 'b-2', 'y-1']);
  });
  it('les échauffements passent avant les tours, jamais dans l’alternance', () => {
    const sets = withPositions([...ex('a', 1, { setKind: 'warmup' }).map((s) => ({ ...s, id: 'a-w' })), ...ex('a', 2), ...ex('b', 2)]);
    expect(orderWithCircuit(sets, ['a', 'b'])).toEqual(['a-w', 'a-1', 'b-1', 'a-2', 'b-2']);
  });
  it('nombres de séries inégaux : le tour court saute l’exercice épuisé', () => {
    const sets = withPositions([...ex('a', 3), ...ex('b', 2)]);
    expect(orderWithCircuit(sets, ['a', 'b'])).toEqual(['a-1', 'b-1', 'a-2', 'b-2', 'a-3']);
  });
  it('trois exercices : l’ordre des exercices du groupe est celui demandé', () => {
    const sets = withPositions([...ex('a', 2), ...ex('b', 2), ...ex('c', 2)]);
    expect(orderWithCircuit(sets, ['c', 'a', 'b'])).toEqual(['c-1', 'a-1', 'b-1', 'c-2', 'a-2', 'b-2']);
  });
  it('idempotent', () => {
    const sets = withPositions([...ex('a', 2), ...ex('b', 2)]);
    const once = orderWithCircuit(sets, ['a', 'b']);
    const reordered = once.map((id, position) => ({ ...(sets.find((s) => s.id === id) as WorkoutSet), position }));
    expect(orderWithCircuit(reordered, ['a', 'b'])).toEqual(once);
  });
});

const circuitSets = (): WorkoutSet[] => {
  const raw = [...ex('a', 3, { circuitId: 'c1', circuitRestSec: 0, targetRestSec: 90 }), ...ex('b', 3, { circuitId: 'c1', circuitRestSec: 0, targetRestSec: 90 })];
  const order = orderWithCircuit(withPositions(raw), ['a', 'b']);
  return order.map((id, position) => ({ ...(raw.find((s) => s.id === id) as WorkoutSet), position }));
};

describe('lecture d’un groupe', () => {
  it('circuitsOf : identifiant, exercices dans l’ordre, tours, nature, repos', () => {
    expect(circuitsOf(circuitSets())).toEqual([{ circuitId: 'c1', exerciseIds: ['a', 'b'], rounds: 3, kind: 'superset', restBetweenSec: 0, restRoundSec: 90 }]);
    expect(circuitsOf(withPositions(ex('a', 2)))).toEqual([]);
  });
  it('un groupe réduit à un seul exercice n’en est plus un', () => {
    expect(circuitsOf(circuitSets().filter((s) => s.exerciseId === 'a'))).toEqual([]);
  });
  it('roundOf : tour de la série (rang parmi les séries de travail de son exercice) ; null hors groupe et pour un échauffement', () => {
    const sets = circuitSets();
    expect(['a-1', 'b-1', 'a-2', 'b-3'].map((id) => roundOf(sets, id))).toEqual([1, 1, 2, 3]);
    expect(roundOf(withPositions(ex('a', 2)), 'a-1')).toBeNull();
  });
  it('nextCircuitSet : première série de travail non faite, dans l’ordre', () => {
    const sets = circuitSets().map((s) => (s.id === 'a-1' ? { ...s, done: true } : s));
    expect(nextCircuitSet(sets, 'c1')?.id).toBe('b-1');
    expect(nextCircuitSet(sets.map((s) => ({ ...s, done: true })), 'c1')).toBeNull();
  });
});

describe('restAfterCircuitSet : repos entre exercices du groupe, puis repos de fin de tour', () => {
  it('entre deux exercices d’un même tour : repos du groupe (nul = aucun)', () => {
    const sets = circuitSets();
    expect(restAfterCircuitSet(sets, 'a-1')).toEqual({ phase: 'between', seconds: null });
    const withRest = sets.map((s) => ({ ...s, circuitRestSec: 20 }));
    expect(restAfterCircuitSet(withRest, 'a-2')).toEqual({ phase: 'between', seconds: 20 });
  });
  it('dernier exercice du tour : repos de fin de tour (cible de la série)', () => {
    expect(restAfterCircuitSet(circuitSets(), 'b-1')).toEqual({ phase: 'round', seconds: 90 });
    expect(restAfterCircuitSet(circuitSets(), 'b-3')).toEqual({ phase: 'round', seconds: 90 });
  });
  it('hors groupe, échauffement : null (repos habituel de l’exercice)', () => {
    expect(restAfterCircuitSet(withPositions(ex('a', 2)), 'a-1')).toBeNull();
    const warm = circuitSets().map((s) => (s.id === 'a-1' ? { ...s, setKind: 'warmup' as const } : s));
    expect(restAfterCircuitSet(warm, 'a-1')).toBeNull();
  });
});

describe('copie et rejeu : les groupes sont conservés, jamais les séries faites', () => {
  const past = (): WorkoutWithSets =>
    ({
      id: 'w',
      routineId: null,
      routineDayId: null,
      name: 'Superset bras',
      startedAt: '2026-10-26T17:00:00.000Z',
      endedAt: '2026-10-26T18:00:00.000Z',
      source: 'empty',
      copiedFromWorkoutId: null,
      restTimerEndAt: null,
      restTimerSeconds: 0,
      notes: '',
      createdAt: '2026-10-26T17:00:00.000Z',
      updatedAt: '2026-10-26T18:00:00.000Z',
      deletedAt: null,
      deviceId: 'd',
      hlc: 'h',
      sets: circuitSets().map((s, i) => ({ ...s, done: true, reps: 10 + i, loadKg: 20 + i, doneAt: '2026-10-26T17:30:00.000Z' })),
    }) as unknown as WorkoutWithSets;
  it('le plan garde l’identifiant de groupe, le repos du groupe, l’ordre alterné et prend charges et répétitions comme cibles', () => {
    const plan = planFromPastWorkout(past());
    expect(plan.map((p) => p.exerciseId)).toEqual(['a', 'b', 'a', 'b', 'a', 'b']);
    expect(new Set(plan.map((p) => p.circuitId))).toEqual(new Set(['c1']));
    expect(plan.every((p) => p.circuitRestSec === 0)).toBe(true);
    expect(plan[0]).toMatchObject({ targetRepsMin: 10, targetRepsMax: 10, targetLoadKg: 20 });
  });
  it('un groupe dont un seul exercice a des séries faites est dissous', () => {
    const only = past();
    const plan = planFromPastWorkout({ ...only, sets: only.sets.map((s) => (s.exerciseId === 'b' ? { ...s, done: false } : s)) });
    expect(plan.map((p) => p.exerciseId)).toEqual(['a', 'a', 'a']);
    expect(plan.every((p) => (p.circuitId ?? null) === null)).toBe(true);
  });
  it('les séances sans groupe donnent un plan sans groupe', () => {
    const plain = planFromPastWorkout({ ...past(), sets: withPositions(ex('a', 2)).map((s) => ({ ...s, done: true, reps: 5 })) });
    expect(plain.every((p) => (p.circuitId ?? null) === null)).toBe(true);
  });
});
