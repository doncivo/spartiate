import { describe, expect, it } from 'vitest';
import { circuitsOf, orderWithCircuit } from './circuit';
import { validateRoutine, validateRoutineDay, validateRoutineLine } from './routineRules';
import { dissolveLoneRoutineCircuits, groupRoutineLines, routineCircuitsOf, ungroupRoutineLines, validateRoutineGroup, type RoutineGroupInput } from './routineCircuit';
import { planFromRoutineDay, type WorkoutSet } from './session';
import type { RoutineExerciseInput } from './types';

/**
 * I6-03b (§ 13.8, constat 11 de la relecture Codex du 12/11) : un groupe (superset, triset, circuit : un seul mécanisme) se définit dans un jour de
 * routine et se retrouve dans la séance démarrée depuis ce jour. Règles pures : création du groupe sur les lignes, lecture, dissolution, plan de
 * départ alterné A1 B1 A2 B2 avec l'identifiant et le repos du groupe.
 */
const line = (id: string, exerciseId: string, position: number, over: Partial<RoutineExerciseInput> = {}): RoutineExerciseInput => ({
  id,
  exerciseId,
  exerciseName: exerciseId,
  sets: 3,
  repMin: 8,
  repMax: 12,
  rir: null,
  restSec: 120,
  position,
  ...over,
});
const DAY = [line('l1', 'bench', 0), line('l2', 'row', 1, { sets: 2, restSec: 90 }), line('l3', 'squat', 2, { sets: 4 }), line('l4', 'curl', 3)];
const GROUP: RoutineGroupInput = { circuitId: 'c-1', lineIds: ['l1', 'l3'], rounds: null, restBetweenSec: 15, restRoundSec: 100 };

describe('validateRoutineGroup', () => {
  it('un groupe valide de deux lignes ou plus', () => {
    expect(validateRoutineGroup(DAY, GROUP)).toEqual([]);
    expect(validateRoutineGroup(DAY, { ...GROUP, lineIds: ['l1', 'l2', 'l3', 'l4'], rounds: 5, restRoundSec: null })).toEqual([]);
  });
  it('moins de deux lignes, ligne inconnue ou répétée, même exercice deux fois', () => {
    expect(validateRoutineGroup(DAY, { ...GROUP, lineIds: ['l1'] })).toContain('lines');
    expect(validateRoutineGroup(DAY, { ...GROUP, lineIds: ['l1', 'l1'] })).toContain('lines');
    expect(validateRoutineGroup(DAY, { ...GROUP, lineIds: ['l1', 'x'] })).toContain('lines');
    expect(validateRoutineGroup([...DAY, line('l5', 'bench', 4)], { ...GROUP, lineIds: ['l1', 'l5'] })).toContain('lines');
  });
  it('ligne déjà dans un groupe', () => {
    const grouped = groupRoutineLines(DAY, GROUP);
    expect(validateRoutineGroup(grouped, { ...GROUP, circuitId: 'c-2', lineIds: ['l1', 'l2'] })).toContain('grouped');
  });
  it('bornes : tours de 1 à 20, repos entre exercices de 0 à 3 600 s, repos de fin de tour de 0 à 900 s (repos d’une ligne de routine), entiers', () => {
    expect(validateRoutineGroup(DAY, { ...GROUP, rounds: 0 })).toContain('rounds');
    expect(validateRoutineGroup(DAY, { ...GROUP, rounds: 21 })).toContain('rounds');
    expect(validateRoutineGroup(DAY, { ...GROUP, rounds: 2.5 })).toContain('rounds');
    expect(validateRoutineGroup(DAY, { ...GROUP, restBetweenSec: -1 })).toContain('restBetween');
    expect(validateRoutineGroup(DAY, { ...GROUP, restBetweenSec: 3601 })).toContain('restBetween');
    expect(validateRoutineGroup(DAY, { ...GROUP, restRoundSec: 901 })).toContain('restRound');
    expect(validateRoutineGroup(DAY, { ...GROUP, restRoundSec: 0, restBetweenSec: 0, rounds: 20 })).toEqual([]);
    expect(validateRoutineGroup(DAY, { ...GROUP, circuitId: '' })).toContain('circuitId');
    expect(validateRoutineGroup(DAY, { ...GROUP, circuitId: 'x'.repeat(65) })).toContain('circuitId');
  });
});

describe('groupRoutineLines', () => {
  it('les lignes du groupe deviennent voisines à la place de la première, positions 0, 1, 2… ; séries égalisées au plus grand nombre ; repos de fin de tour écrit', () => {
    const out = groupRoutineLines(DAY, GROUP);
    expect(out.map((l) => [l.id, l.position])).toEqual([
      ['l1', 0],
      ['l3', 1],
      ['l2', 2],
      ['l4', 3],
    ]);
    const members = out.filter((l) => l.circuitId === 'c-1');
    expect(members.map((l) => [l.sets, l.restSec, l.circuitRestSec])).toEqual([
      [4, 100, 15],
      [4, 100, 15],
    ]);
    expect(out.filter((l) => l.circuitId === undefined || l.circuitId === null).map((l) => [l.id, l.sets, l.restSec])).toEqual([
      ['l2', 2, 90],
      ['l4', 3, 120],
    ]);
  });
  it('nombre de tours donné : séries de chaque ligne du groupe ; repos de fin de tour vide : celui de chaque ligne', () => {
    const out = groupRoutineLines(DAY, { ...GROUP, lineIds: ['l2', 'l4'], rounds: 5, restRoundSec: null });
    expect(out.filter((l) => l.circuitId === 'c-1').map((l) => [l.id, l.sets, l.restSec])).toEqual([
      ['l2', 5, 90],
      ['l4', 5, 120],
    ]);
  });
  it('groupe refusé : les lignes reviennent inchangées', () => {
    expect(groupRoutineLines(DAY, { ...GROUP, lineIds: ['l1'] })).toEqual(DAY);
  });
});

describe('routineCircuitsOf, ungroupRoutineLines, dissolveLoneRoutineCircuits', () => {
  it('lecture : nature, lignes dans l’ordre, tours, repos ; un identifiant porté par une seule ligne n’est pas un groupe', () => {
    const grouped = groupRoutineLines(DAY, { ...GROUP, lineIds: ['l1', 'l2', 'l3'] });
    expect(routineCircuitsOf(grouped)).toEqual([{ circuitId: 'c-1', lineIds: ['l1', 'l2', 'l3'], kind: 'triset', rounds: 4, restBetweenSec: 15, restRoundSec: 100 }]);
    expect(routineCircuitsOf([line('a', 'bench', 0, { circuitId: 'seul', circuitRestSec: 0 }), line('b', 'row', 1)])).toEqual([]);
  });
  it('défaire : identifiant et repos du groupe effacés, séries et repos des lignes gardés', () => {
    const out = ungroupRoutineLines(groupRoutineLines(DAY, GROUP), 'c-1');
    expect(out.every((l) => (l.circuitId ?? null) === null && (l.circuitRestSec ?? null) === null)).toBe(true);
    expect(out.find((l) => l.id === 'l1')?.sets).toBe(4);
  });
  it('retirer une ligne d’un superset : la ligne restante redevient libre', () => {
    const grouped = groupRoutineLines(DAY, GROUP).filter((l) => l.id !== 'l3');
    const out = dissolveLoneRoutineCircuits(grouped);
    expect(out.find((l) => l.id === 'l1')).toMatchObject({ circuitId: null, circuitRestSec: null });
    const triset = groupRoutineLines(DAY, { ...GROUP, lineIds: ['l1', 'l2', 'l3'] }).filter((l) => l.id !== 'l3');
    expect(dissolveLoneRoutineCircuits(triset).filter((l) => l.circuitId === 'c-1').map((l) => l.id)).toEqual(['l1', 'l2']);
  });
});

describe('validateRoutineLine et validateRoutineDay : colonnes de groupe', () => {
  it('identifiant de 1 à 64 caractères, repos entre exercices entier de 0 à 3 600 s ; une ligne sans groupe reste valide', () => {
    expect(validateRoutineLine(line('a', 'bench', 0))).toEqual([]);
    expect(validateRoutineLine(line('a', 'bench', 0, { circuitId: 'c', circuitRestSec: 0 }))).toEqual([]);
    expect(validateRoutineLine(line('a', 'bench', 0, { circuitId: '', circuitRestSec: 0 }))).toContain('circuit');
    expect(validateRoutineLine(line('a', 'bench', 0, { circuitId: 'x'.repeat(65), circuitRestSec: 0 }))).toContain('circuit');
    expect(validateRoutineLine(line('a', 'bench', 0, { circuitId: 'c', circuitRestSec: 3601 }))).toContain('circuit');
    expect(validateRoutineLine(line('a', 'bench', 0, { circuitId: 'c', circuitRestSec: 1.5 }))).toContain('circuit');
  });
  it('un même exercice deux fois dans un groupe : refusé', () => {
    const day = { name: 'Haut', dayOrder: 1, exercises: [line('a', 'bench', 0, { circuitId: 'c' }), line('b', 'bench', 1, { circuitId: 'c' })] };
    expect(validateRoutineDay(day).map((i) => i.code)).toContain('circuit-duplicate');
    expect(validateRoutine({ name: 'R', mode: 'libre', days: [day] }).map((i) => i.code)).toContain('circuit-duplicate');
  });
});

describe('planFromRoutineDay : la séance démarrée depuis le jour retrouve le groupe', () => {
  it('séries alternées A1 B1 A2 B2 à la place de la première ligne, identifiant et repos du groupe sur chaque série, cibles de la ligne', () => {
    const plan = planFromRoutineDay(groupRoutineLines(DAY, { ...GROUP, lineIds: ['l1', 'l2'], rounds: 2 }));
    expect(plan.map((s) => s.exerciseId)).toEqual(['bench', 'row', 'bench', 'row', 'squat', 'squat', 'squat', 'squat', 'curl', 'curl', 'curl']);
    expect(plan.slice(0, 4).every((s) => s.circuitId === 'c-1' && s.circuitRestSec === 15 && s.targetRestSec === 100)).toBe(true);
    expect(plan.slice(4).every((s) => (s.circuitId ?? null) === null && (s.circuitRestSec ?? null) === null)).toBe(true);
    expect(plan[1]).toMatchObject({ targetRepsMin: 8, targetRepsMax: 12, targetLoadKg: null, setKind: 'work' });
  });
  it('groupe dont les lignes ne sont pas voisines (ordre changé après coup) : le bloc prend la place de la première ligne', () => {
    const lines = [line('a', 'bench', 0, { circuitId: 'g', circuitRestSec: 0, sets: 2 }), line('b', 'curl', 1, { sets: 1 }), line('c', 'row', 2, { circuitId: 'g', circuitRestSec: 0, sets: 2 })];
    expect(planFromRoutineDay(lines).map((s) => s.exerciseId)).toEqual(['bench', 'row', 'bench', 'row', 'curl']);
  });
  it('lignes de séries différentes : un exercice sans série dans un tour est sauté (même règle que la séance)', () => {
    const lines = [line('a', 'bench', 0, { circuitId: 'g', circuitRestSec: 10, sets: 3 }), line('b', 'row', 1, { circuitId: 'g', circuitRestSec: 10, sets: 1 })];
    expect(planFromRoutineDay(lines).map((s) => s.exerciseId)).toEqual(['bench', 'row', 'bench', 'bench']);
  });
  it('identifiant porté par une seule ligne : exercice libre, aucune colonne de groupe', () => {
    const plan = planFromRoutineDay([line('a', 'bench', 0, { circuitId: 'seul', circuitRestSec: 10, sets: 1 }), line('b', 'row', 1, { sets: 1 })]);
    expect(plan.every((s) => (s.circuitId ?? null) === null)).toBe(true);
  });
  it('routine sans groupe (générée ou programme de départ) : plan inchangé, aucune colonne de groupe', () => {
    const plan = planFromRoutineDay(DAY);
    expect(plan.map((s) => s.exerciseId)).toEqual(['bench', 'bench', 'bench', 'row', 'row', 'squat', 'squat', 'squat', 'squat', 'curl', 'curl', 'curl']);
    expect(plan.every((s) => s.circuitId === undefined && s.circuitRestSec === undefined)).toBe(true);
  });
  it('le plan d’une séance de routine groupée se lit comme le groupe de la séance (circuitsOf, ordre déjà alterné)', () => {
    const plan = planFromRoutineDay(groupRoutineLines(DAY, GROUP));
    const sets = plan.map((p, position): WorkoutSet => ({
      ...p,
      id: `s${position}`,
      workoutId: 'w',
      position,
      reps: null,
      loadKg: null,
      durationSec: null,
      rir: null,
      done: false,
      doneAt: null,
      createdAt: '2026-11-12T10:00:00.000Z' as WorkoutSet['createdAt'],
      updatedAt: '2026-11-12T10:00:00.000Z' as WorkoutSet['updatedAt'],
      deletedAt: null,
      deviceId: 'd' as WorkoutSet['deviceId'],
      hlc: 'h' as WorkoutSet['hlc'],
    }));
    expect(circuitsOf(sets)).toEqual([{ circuitId: 'c-1', exerciseIds: ['bench', 'squat'], rounds: 4, kind: 'superset', restBetweenSec: 15, restRoundSec: 100 }]);
    expect(orderWithCircuit(sets, ['bench', 'squat'])).toEqual(sets.map((s) => s.id));
  });
});
