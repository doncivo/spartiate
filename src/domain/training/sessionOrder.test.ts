import { describe, expect, it } from 'vitest';
import { parseExcludedExercises, withExcluded } from './exclusions';
import type { WorkoutSet } from './session';
import { moveUnitOrder, sessionUnits, skipUnitOrder } from './sessionOrder';

/**
 * SESS-01b (§ 13.2 « Vignettes réordonnables ; sauter », « retirer, ne plus proposer ») : unités de la séance (un exercice libre, ou un groupe
 * entier), déplacement d'une unité, « Sauter » (l'unité passe en fin de séance) ; liste des exercices écartés (réglage local).
 */

let n = 0;
const s = (exerciseId: string, over: Partial<WorkoutSet> = {}): WorkoutSet => ({ id: `s${String(n++)}`, exerciseId, position: n, done: false, deletedAt: null, setKind: 'work', circuitId: null, ...over }) as WorkoutSet;
const sample = (): WorkoutSet[] => {
  n = 0;
  return [s('a'), s('a'), s('b', { circuitId: 'c1' }), s('c', { circuitId: 'c1' }), s('b', { circuitId: 'c1' }), s('c', { circuitId: 'c1' }), s('d'), s('d', { deletedAt: 'x' as WorkoutSet['deletedAt'] }), s('d')];
};

describe('sessionUnits', () => {
  it('un exercice libre ou un groupe entier par unité, dans l’ordre de la séance ; séries supprimées ignorées', () => {
    expect(sessionUnits(sample()).map((u) => [u.key, u.exerciseIds, u.setIds])).toEqual([
      ['x:a', ['a'], ['s0', 's1']],
      ['c:c1', ['b', 'c'], ['s2', 's3', 's4', 's5']],
      ['x:d', ['d'], ['s6', 's8']],
    ]);
  });
});

describe('moveUnitOrder', () => {
  it('déplace une unité (le groupe d’un bloc) ; index borné ; clé inconnue ou même place : null', () => {
    expect(moveUnitOrder(sample(), 'x:d', 0)).toEqual(['s6', 's8', 's0', 's1', 's2', 's3', 's4', 's5']);
    expect(moveUnitOrder(sample(), 'c:c1', 99)).toEqual(['s0', 's1', 's6', 's8', 's2', 's3', 's4', 's5']);
    expect(moveUnitOrder(sample(), 'x:a', -3)).toBeNull();
    expect(moveUnitOrder(sample(), 'x:zz', 1)).toBeNull();
  });
});

describe('skipUnitOrder (« Sauter »)', () => {
  it('l’unité de l’exercice passe en fin de séance ; déjà dernière, absente ou sans série à faire : null', () => {
    expect(skipUnitOrder(sample(), 'a')).toEqual(['s2', 's3', 's4', 's5', 's6', 's8', 's0', 's1']);
    expect(skipUnitOrder(sample(), 'c')).toEqual(['s0', 's1', 's6', 's8', 's2', 's3', 's4', 's5']);
    expect(skipUnitOrder(sample(), 'd')).toBeNull();
    expect(skipUnitOrder(sample(), 'zz')).toBeNull();
    const done = sample().map((x) => (x.exerciseId === 'a' ? { ...x, done: true } : x));
    expect(skipUnitOrder(done, 'a')).toBeNull();
  });
});

describe('exercices écartés (« ne plus proposer »)', () => {
  it('lecture prudente de la valeur brute : illisible → aucun ; identifiants uniques, triés', () => {
    expect(parseExcludedExercises(null)).toEqual([]);
    expect(parseExcludedExercises({ v: 2, ids: ['a'] })).toEqual([]);
    expect(parseExcludedExercises({ v: 1, ids: 'a' })).toEqual([]);
    expect(parseExcludedExercises({ v: 1, ids: ['b', 'a', 'b', 3, ''] })).toEqual(['a', 'b']);
  });
  it('ajout et retrait idempotents', () => {
    expect(withExcluded([], 'b', true)).toEqual({ v: 1, ids: ['b'] });
    expect(withExcluded(['b'], 'a', true)).toEqual({ v: 1, ids: ['a', 'b'] });
    expect(withExcluded(['a', 'b'], 'a', true)).toEqual({ v: 1, ids: ['a', 'b'] });
    expect(withExcluded(['a', 'b'], 'a', false)).toEqual({ v: 1, ids: ['b'] });
  });
});
