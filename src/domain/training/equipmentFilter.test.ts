import { describe, expect, it } from 'vitest';
import { BODYWEIGHT_PROFILE, CUSTOM_EXERCISE, EMBEDDED_EXERCISES, FORBIDDEN_PROFILE, GYM_PROFILE, HOME_PROFILE, PROGRAM_ROUTINE } from '../../../tests/fixtures/training';
import { createExerciseCatalog, filterCompatibleExercises, incompatibleRoutineLines, isExerciseCompatible, usableEquipment, validateEquipmentProfile } from './index';

/** I1-01 critère 4 : filtrage par profil de matériel (le profil actif est local ; ici on ne filtre que sur le profil reçu). */

const ids = (list: readonly { id: string }[]): string[] => list.map((e) => e.id);

describe('matériel utilisable', () => {
  it('disponible, forcé et machines déclarées ; le poids du corps via l’indicateur ; l’interdit l’emporte', () => {
    expect([...usableEquipment(HOME_PROFILE)].sort()).toEqual(['bodyweight', 'dumbbell', 'flat-bench']);
    expect(usableEquipment(GYM_PROFILE).has('leg-press-machine')).toBe(true);
    expect(usableEquipment(FORBIDDEN_PROFILE).has('rack')).toBe(false);
    const forcedAndForbidden = { ...HOME_PROFILE, inventory: { ...HOME_PROFILE.inventory, forced: ['kettlebell'], forbidden: ['kettlebell'] } };
    expect(usableEquipment(forcedAndForbidden).has('kettlebell')).toBe(false);
    const forced = { ...HOME_PROFILE, inventory: { ...HOME_PROFILE.inventory, forced: ['kettlebell'] } };
    expect(usableEquipment(forced).has('kettlebell')).toBe(true);
  });
});

describe('compatibilité', () => {
  it('salle : tout sauf ce qui manque', () => {
    expect(ids(filterCompatibleExercises(EMBEDDED_EXERCISES, GYM_PROFILE))).toEqual(['bench-press-barbell', 'row-barbell', 'squat-barbell', 'lat-pulldown', 'curl-dumbbell', 'push-up', 'plank', 'leg-press']);
  });

  it('maison haltères : ni barre ni machine ; poids du corps et exercice sans matériel restent', () => {
    expect(ids(filterCompatibleExercises(EMBEDDED_EXERCISES, HOME_PROFILE))).toEqual(['curl-dumbbell', 'push-up', 'plank']);
  });

  it('poids du corps : seulement les exercices sans équipement externe', () => {
    expect(ids(filterCompatibleExercises(EMBEDDED_EXERCISES, BODYWEIGHT_PROFILE))).toEqual(['push-up', 'plank']);
  });

  it('interdit : un exercice qui exige le matériel interdit est exclu même si présent', () => {
    expect(ids(filterCompatibleExercises(EMBEDDED_EXERCISES, FORBIDDEN_PROFILE))).toEqual(['bench-press-barbell', 'row-barbell', 'curl-dumbbell', 'plank']);
  });

  it('exercice personnalisé : même règle', () => {
    expect(isExerciseCompatible(CUSTOM_EXERCISE, GYM_PROFILE)).toBe(false);
    expect(isExerciseCompatible({ equipment: ['resistance-strap'] }, { ...GYM_PROFILE, inventory: { ...GYM_PROFILE.inventory, available: ['resistance-strap'] } })).toBe(true);
  });

  it('sans profil : aucun filtre', () => {
    expect(filterCompatibleExercises(EMBEDDED_EXERCISES, null)).toHaveLength(EMBEDDED_EXERCISES.length);
  });
});

describe('lignes de routine incompatibles', () => {
  const catalog = createExerciseCatalog(EMBEDDED_EXERCISES);
  const lines = PROGRAM_ROUTINE.days.flatMap((d) => d.exercises);

  it('signale les lignes résolues dont le matériel manque, jamais les références inconnues', () => {
    const withUnknown = [...lines, { ...lines[0], exerciseId: 'ancien-exercice', exerciseName: 'Ancien' }] as typeof lines;
    expect(incompatibleRoutineLines(withUnknown, HOME_PROFILE, catalog, []).map((l) => l.exerciseId)).toEqual(['bench-press-barbell', 'row-barbell', 'squat-barbell']);
    expect(incompatibleRoutineLines(withUnknown, GYM_PROFILE, catalog, [])).toEqual([]);
  });
});

describe('validation d’un profil de matériel', () => {
  const codes = (input: Parameters<typeof validateEquipmentProfile>[0]): string[] => validateEquipmentProfile(input).map((i) => i.code);

  it('profil valide, nom vide, genre inconnu, doublon forcé / interdit, haltères incohérents, incrément nul', () => {
    expect(codes({ name: 'Salle', kind: 'salle', inventory: GYM_PROFILE.inventory, increments: { barbell: 2.5 } })).toEqual([]);
    expect(codes({ name: ' ', kind: 'salle', inventory: GYM_PROFILE.inventory, increments: {} })).toContain('name-empty');
    expect(codes({ name: 'x', kind: 'garage' as never, inventory: GYM_PROFILE.inventory, increments: {} })).toContain('kind');
    expect(codes({ name: 'x', kind: 'maison', inventory: { ...HOME_PROFILE.inventory, forced: ['bench'], forbidden: ['bench'] }, increments: {} })).toContain('forced-forbidden');
    expect(codes({ name: 'x', kind: 'maison', inventory: { ...HOME_PROFILE.inventory, dumbbells: { minKg: 10, maxKg: 4, stepKg: 2 } }, increments: {} })).toContain('dumbbells');
    expect(codes({ name: 'x', kind: 'maison', inventory: HOME_PROFILE.inventory, increments: { dumbbell: 0 } })).toContain('increment');
  });
});

describe('groupes d’alternatives (exercice embarqué, content/README.md)', () => {
  it('un matériel par groupe suffit ; le matériel facultatif hors groupe n’est pas exigé', () => {
    const dips = { equipment: ['parallel-bars', 'dip-belt'], equipmentGroups: [['parallel-bars']] };
    const withBars = { ...HOME_PROFILE, inventory: { ...HOME_PROFILE.inventory, available: ['parallel-bars'] } };
    expect(isExerciseCompatible(dips, withBars)).toBe(true);
    expect(isExerciseCompatible(dips, HOME_PROFILE)).toBe(false);
    const press = { equipment: ['flat-bench', 'incline-bench', 'dumbbell'], equipmentGroups: [['dumbbell'], ['flat-bench', 'incline-bench']] };
    expect(isExerciseCompatible(press, HOME_PROFILE)).toBe(true);
    expect(isExerciseCompatible({ equipment: press.equipment }, HOME_PROFILE)).toBe(false);
  });
});
