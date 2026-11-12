import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { input, session, target } from '../../../tests/fixtures/training/progression';
import { positionRanksOfSets } from './positionRank';
import { prescribe } from './prescribe';
import type { MuscleWeight } from './types';

/**
 * I6-03, D-87 : la décote de position (2ᵉ exercice d'un muscle −7 %, 3ᵉ −12 %, calculée sur la charge totale d'un exercice lesté ou assisté)
 * n'est PAS appliquée entre exercices de muscles principaux différents d'un même circuit. Le rang se lit sur l'ordre d'exécution alterné
 * (A1 B1 A2 B2…), jamais sur la position des séries : un exercice du groupe ne passe pas « deuxième » parce que ses séries sont intercalées.
 */
const CATALOGUE = (JSON.parse(readFileSync('content/exercises/exercises.json', 'utf8')) as { exercises: { id: string; muscles: MuscleWeight[] }[] }).exercises;
const musclesOf = (id: string): readonly MuscleWeight[] => CATALOGUE.find((e) => e.id === id)?.muscles ?? [];
const interleaved = (ids: readonly string[], rounds: number) =>
  Array.from({ length: rounds }, () => ids.map((exerciseId) => ({ exerciseId })))
    .flat()
    .map((s, position) => ({ ...s, position }));

describe('rang de position dans un circuit', () => {
  it('superset d’antagonistes (pectoraux + dos) : les deux au rang 1, séries intercalées', () => {
    const ranks = positionRanksOfSets(interleaved(['bench-press-barbell', 'row-barbell'], 3), musclesOf);
    expect(ranks.get('bench-press-barbell')).toBe(1);
    expect(ranks.get('row-barbell')).toBe(1);
  });

  it('circuit de quatre exercices de muscles différents : aucun n’est décoté', () => {
    const ids = ['bench-press-barbell', 'row-barbell', 'overhead-press-barbell', 'triceps-pushdown-cable'];
    const ranks = positionRanksOfSets(interleaved(ids, 2), musclesOf);
    expect(ids.map((id) => ranks.get(id))).toEqual([1, 1, 1, 1]);
  });

  it('deux exercices du même muscle dans le même groupe : la règle de § 11.3 reste inchangée (le second est au rang 2)', () => {
    const ranks = positionRanksOfSets(interleaved(['bench-press-barbell', 'incline-press-dumbbell'], 3), musclesOf);
    expect([ranks.get('bench-press-barbell'), ranks.get('incline-press-dumbbell')]).toEqual([1, 2]);
  });

  it('les séries sont lues par position, quel que soit l’ordre du tableau reçu', () => {
    const sets = interleaved(['row-barbell', 'bench-press-barbell', 'incline-press-dumbbell'], 2).reverse();
    const ranks = positionRanksOfSets(sets, musclesOf);
    expect([ranks.get('row-barbell'), ranks.get('bench-press-barbell'), ranks.get('incline-press-dumbbell')]).toEqual([1, 1, 2]);
  });

  it('prescription : un exercice de muscle différent dans un circuit garde exactement sa charge du rang 1', () => {
    const ranks = positionRanksOfSets(interleaved(['bench-press-barbell', 'row-barbell'], 3), musclesOf);
    const history = [session(3, 60, [10, 10, 10])];
    const base = prescribe(input({ history, target: target(8, 10) }));
    const inCircuit = prescribe(input({ history, target: target(8, 10), positionRank: ranks.get('row-barbell') ?? 1, lastPositionRank: 1 }));
    expect(inCircuit).toEqual(base);
    expect(inCircuit.reasons).not.toContain('position-discount');
  });
});
