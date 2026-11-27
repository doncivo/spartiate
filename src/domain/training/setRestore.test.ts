import { describe, expect, it } from 'vitest';
import type { WorkoutSet } from './session';
import { restoreAnchor, restoreOrder } from './setRestore';

/**
 * GEST-0303, relecture (code-reviewer, important) : « Annuler » une série supprimée d'un geste la remet après la série vivante qui la
 * précédait DANS SA PROPRE UNITÉ (exercice libre ou groupe), sinon avant celle qui la suivait ; seule dans son unité : à sa place d'avant si
 * l'ordre de la séance n'a pas changé. Repère disparu, unité changée (groupe défait, exercice groupé ou retiré) ou ordre changé : null
 * (annulation impossible, rien n'est écrit). Valeurs inventées.
 */
let n = 0;
const s = (exerciseId: string, over: Partial<WorkoutSet> = {}): WorkoutSet => ({ id: `s${String(n++)}`, exerciseId, position: n, done: false, deletedAt: null, setKind: 'work', circuitId: null, ...over }) as WorkoutSet;
const ids = (sets: readonly WorkoutSet[]): string[] => sets.map((x) => x.id);
const at = (sets: readonly WorkoutSet[], i: number): WorkoutSet => {
  const x = sets[i];
  if (x === undefined) throw new Error('série absente');
  return x;
};
const without = (sets: readonly WorkoutSet[], id: string): WorkoutSet[] => sets.filter((x) => x.id !== id);
/** Séance [X0, X1, Y0] : deux séries de X, une de Y. */
const sample = (): WorkoutSet[] => {
  n = 0;
  return [s('x'), s('x'), s('y')];
};
const reorder = (sets: readonly WorkoutSet[], order: readonly string[]): WorkoutSet[] => order.map((id, position) => ({ ...sets.find((x) => x.id === id), position }) as WorkoutSet);

describe('GEST-0303 relecture : repère de l’annulation', () => {
  it('après la série précédente de la même unité ; première de son unité : avant la suivante ; seule : place et ordre d’avant', () => {
    const sets = sample();
    expect(restoreAnchor(sets, 's1')).toEqual({ kind: 'after', id: 's0' });
    expect(restoreAnchor(sets, 's0')).toEqual({ kind: 'before', id: 's1' });
    expect(restoreAnchor(sets, 's2')).toEqual({ kind: 'alone', index: 2, order: ['s0', 's1'] });
    expect(restoreAnchor(sets, 'inconnue')).toBeNull();
  });

  it('séries supprimées ignorées ; groupe : l’unité est le groupe entier (séries alternées)', () => {
    n = 0;
    const sets = [s('a', { circuitId: 'c1' }), s('b', { circuitId: 'c1' }), s('b', { deletedAt: 'x' as WorkoutSet['deletedAt'] }), s('a', { circuitId: 'c1' }), s('z')];
    expect(restoreAnchor(sets, 's3')).toEqual({ kind: 'after', id: 's1' });
    expect(restoreAnchor(sets, 's0')).toEqual({ kind: 'before', id: 's1' });
  });
});

describe('GEST-0303 relecture : ordre rendu', () => {
  it('réordonner puis annuler : [X0, X1, Y], X1 glissée, Y monté, annuler : [Y, X0, X1] (jamais [Y, X1, X0])', () => {
    const before = sample();
    const anchor = restoreAnchor(before, 's1');
    if (anchor === null) throw new Error('repère absent');
    const now = reorder(without(before, 's1'), ['s2', 's0']);
    expect(restoreOrder(now, at(before, 1), anchor)).toEqual(['s2', 's0', 's1']);
  });

  it('série ajoutée ou retirée ailleurs entre-temps : la série revient après sa voisine', () => {
    const before = sample();
    const anchor = restoreAnchor(before, 's1');
    if (anchor === null) throw new Error('repère absent');
    const added = [...without(before, 's1'), s('x', { id: 'n1' })];
    expect(restoreOrder(reorder(added, ['s0', 'n1', 's2']), at(before, 1), anchor)).toEqual(['s0', 's1', 'n1', 's2']);
    expect(restoreOrder(without(without(before, 's1'), 's2'), at(before, 1), anchor)).toEqual(['s0', 's1']);
    const first = restoreAnchor(before, 's0');
    if (first === null) throw new Error('repère absent');
    expect(restoreOrder(reorder(without(before, 's0'), ['s2', 's1']), at(before, 0), first)).toEqual(['s2', 's0', 's1']);
  });

  it('repère retiré entre-temps, ou passé dans une autre unité : null', () => {
    const before = sample();
    const anchor = restoreAnchor(before, 's1');
    if (anchor === null) throw new Error('repère absent');
    expect(restoreOrder(without(without(before, 's1'), 's0'), at(before, 1), anchor)).toBeNull();
    // X groupé avec Y depuis : la série libre ne rejoint pas le groupe.
    const grouped = without(before, 's1').map((x) => ({ ...x, circuitId: 'c9' }) as WorkoutSet);
    expect(restoreOrder(grouped, at(before, 1), anchor)).toBeNull();
  });

  it('série d’un groupe défait depuis (aucune série vivante du groupe) : null', () => {
    n = 0;
    const before = [s('a', { circuitId: 'c1' }), s('b', { circuitId: 'c1' }), s('a', { circuitId: 'c1' }), s('b', { circuitId: 'c1' })];
    const anchor = restoreAnchor(before, 's2');
    if (anchor === null) throw new Error('repère absent');
    expect(restoreOrder(without(before, 's2'), at(before, 2), anchor)).toEqual(['s0', 's1', 's2', 's3']);
    const ungrouped = without(before, 's2').map((x) => ({ ...x, circuitId: null }) as WorkoutSet);
    expect(restoreOrder(ungrouped, at(before, 2), anchor)).toBeNull();
  });

  it('série seule de son unité : place d’avant si l’ordre est inchangé ; sinon null', () => {
    const before = sample();
    const anchor = restoreAnchor(before, 's2');
    if (anchor === null) throw new Error('repère absent');
    expect(restoreOrder(without(before, 's2'), at(before, 2), anchor)).toEqual(['s0', 's1', 's2']);
    expect(restoreOrder(reorder(without(before, 's2'), ['s1', 's0']), at(before, 2), anchor)).toBeNull();
    expect(restoreOrder([...without(before, 's2'), s('x', { id: 'n2' })], at(before, 2), anchor)).toBeNull();
  });

  it('la série rendue est ignorée si elle figure encore dans la séance (ligne supprimée lue avec les autres)', () => {
    const before = sample();
    const anchor = restoreAnchor(before, 's1');
    if (anchor === null) throw new Error('repère absent');
    const withDeleted = before.map((x) => (x.id === 's1' ? ({ ...x, deletedAt: 'x' } as WorkoutSet) : x));
    expect(ids(withDeleted)).toEqual(['s0', 's1', 's2']);
    expect(restoreOrder(withDeleted, at(before, 1), anchor)).toEqual(['s0', 's1', 's2']);
  });
});
