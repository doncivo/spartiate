import { describe, expect, it } from 'vitest';
import { PROGRAM_ROUTINE } from '../../../tests/fixtures/training';
import { validateCustomExercise, validateRoutine, type RoutineExerciseSpec, type RoutineSpec } from './index';

/** I1-01 critère 5 : une routine (ou un programme de départ chargé) reste valide à l'édition ; séries, plages et repos bornés. */

const line = (over: Partial<RoutineExerciseSpec> = {}): RoutineExerciseSpec => ({ exerciseId: 'plank', exerciseName: 'Planche', sets: 3, repMin: 8, repMax: 12, rir: 2, restSec: 90, position: 0, ...over });
const routine = (exercises: RoutineExerciseSpec[], over: Partial<RoutineSpec> = {}): RoutineSpec => ({ name: 'R', mode: 'libre', days: [{ name: 'Jour', dayOrder: 0, exercises }], ...over });
const codes = (r: RoutineSpec): string[] => validateRoutine(r).map((i) => i.code);

describe('validateRoutine', () => {
  it('le programme de départ de la fixture est valide, et reste valide après édition de série, plage et repos', () => {
    expect(validateRoutine(PROGRAM_ROUTINE)).toEqual([]);
    const edited: RoutineSpec = { ...PROGRAM_ROUTINE, days: PROGRAM_ROUTINE.days.map((d, i) => (i === 0 ? { ...d, exercises: d.exercises.map((e) => ({ ...e, sets: e.sets + 1, repMax: e.repMax + 2, restSec: e.restSec + 30 })) } : d)) };
    expect(validateRoutine(edited)).toEqual([]);
  });

  it('routine sans jour ou jour sans exercice : admis (brouillon)', () => {
    expect(codes({ name: 'R', mode: 'libre', days: [] })).toEqual([]);
    expect(codes(routine([]))).toEqual([]);
  });

  it('nom, mode, nom de jour', () => {
    expect(codes(routine([], { name: '  ' }))).toContain('name-empty');
    expect(codes(routine([], { mode: 'autre' as never }))).toContain('mode');
    expect(codes({ name: 'R', mode: 'libre', days: [{ name: '', dayOrder: 0, exercises: [] }] })).toContain('day-name-empty');
  });

  it('ordre des jours : entier positif ou nul, sans doublon', () => {
    expect(codes({ name: 'R', mode: 'libre', days: [{ name: 'A', dayOrder: 0, exercises: [] }, { name: 'B', dayOrder: 0, exercises: [] }] })).toContain('day-order-duplicate');
    expect(codes({ name: 'R', mode: 'libre', days: [{ name: 'A', dayOrder: -1, exercises: [] }] })).toContain('day-order');
  });

  it('séries : 1 à 20 entières', () => {
    for (const sets of [0, 21, 2.5, Number.NaN]) expect(codes(routine([line({ sets })]))).toContain('sets');
    expect(codes(routine([line({ sets: 1 })]))).toEqual([]);
    expect(codes(routine([line({ sets: 20 })]))).toEqual([]);
  });

  it('plage de répétitions : min ≥ 1, max ≥ min, max ≤ 999', () => {
    expect(codes(routine([line({ repMin: 0 })]))).toContain('rep-range');
    expect(codes(routine([line({ repMin: 12, repMax: 8 })]))).toContain('rep-range');
    expect(codes(routine([line({ repMax: 1000 })]))).toContain('rep-range');
    expect(codes(routine([line({ repMin: 10, repMax: 10 })]))).toEqual([]);
  });

  it('RIR : absent ou entier de 0 à 5 ; repos : 0 à 900 s', () => {
    expect(codes(routine([line({ rir: null })]))).toEqual([]);
    expect(codes(routine([line({ rir: 6 })]))).toContain('rir');
    expect(codes(routine([line({ rir: -1 })]))).toContain('rir');
    expect(codes(routine([line({ restSec: -1 })]))).toContain('rest');
    expect(codes(routine([line({ restSec: 901 })]))).toContain('rest');
    expect(codes(routine([line({ restSec: 0 })]))).toEqual([]);
  });

  it('identifiant et nom figé obligatoires ; positions distinctes dans un jour', () => {
    expect(codes(routine([line({ exerciseId: '' })]))).toContain('exercise-id');
    expect(codes(routine([line({ exerciseName: '' })]))).toContain('exercise-name');
    expect(codes(routine([line(), line()]))).toContain('position-duplicate');
    expect(codes(routine([line({ position: -1 })]))).toContain('position');
  });

  it('chaque problème est localisé (jour, ligne)', () => {
    const issues = validateRoutine(routine([line(), line({ position: 1, sets: 0 })]));
    expect(issues).toEqual([{ code: 'sets', dayIndex: 0, lineIndex: 1 }]);
  });
});

describe('validateCustomExercise', () => {
  const ok = {
    id: '7f3a1c2e-0000-4000-8000-0000000000b1',
    nameFr: 'Tirage',
    aliasesEn: [],
    muscles: [{ id: 'lats', weight: 1 }],
    equipment: ['dumbbell'],
    pattern: 'pull-vertical',
    kind: 'compound',
    metric: 'load-reps',
    bodyweightFraction: null,
    defaultRepRange: [8, 12],
    defaultRestSec: 90,
    instructions: { setup: '', execution: '', mistakes: [] },
    media: null,
    strengthStandardKey: null,
  } as const;
  const codesOf = (over: Record<string, unknown>): string[] => validateCustomExercise({ ...ok, ...over } as never).map((i) => i.code);

  it('valide, puis refus des valeurs hors listes fermées et hors bornes', () => {
    expect(codesOf({})).toEqual([]);
    expect(codesOf({ id: 'bench-press-barbell' })).toContain('id');
    expect(codesOf({ nameFr: ' ' })).toContain('name');
    expect(codesOf({ pattern: 'saut' })).toContain('pattern');
    expect(codesOf({ metric: 'vitesse' })).toContain('metric');
    expect(codesOf({ kind: 'autre' })).toContain('kind');
    expect(codesOf({ muscles: [] })).toContain('muscles');
    expect(codesOf({ muscles: [{ id: 'lats', weight: 0 }] })).toContain('muscles');
    expect(codesOf({ muscles: [{ id: 'lats', weight: 1.5 }] })).toContain('muscles');
    expect(codesOf({ defaultRepRange: [12, 8] })).toContain('rep-range');
    expect(codesOf({ defaultRestSec: -5 })).toContain('rest');
    expect(codesOf({ bodyweightFraction: 2 })).toContain('bodyweight-fraction');
    expect(codesOf({ equipment: ['Barre Droite'] })).toContain('equipment');
  });
});
