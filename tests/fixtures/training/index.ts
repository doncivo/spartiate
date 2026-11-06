import type { CustomExercise, EmbeddedExercise, EquipmentInventory, EquipmentProfile, RoutineSpec } from '../../../src/domain/training';

/**
 * Fixtures synthétiques I1-01 (D-38 : aucune donnée réelle). Le catalogue embarqué ci-dessous n'est PAS le contenu de `content/` : c'est un
 * jeu minimal injecté par l'interface `ExerciseCatalog` pour tester la résolution, le filtrage matériel et les routines.
 */

const exercise = (
  id: string,
  nameFr: string,
  equipment: readonly string[],
  pattern: EmbeddedExercise['pattern'],
  kind: EmbeddedExercise['kind'] = 'compound',
  metric: EmbeddedExercise['metric'] = 'load-reps',
): EmbeddedExercise => ({
  origin: 'embedded',
  id,
  nameFr,
  aliasesEn: [],
  muscles: [{ id: 'chest', weight: 1 }],
  equipment,
  pattern,
  kind,
  metric,
  bodyweightFraction: metric === 'bodyweight-reps' ? 0.64 : null,
  defaultRepRange: [6, 10],
  defaultRestSec: 120,
  instructions: { setup: 'Installation', execution: 'Exécution', mistakes: ['Erreur 1', 'Erreur 2', 'Erreur 3'] },
  media: null,
  strengthStandardKey: null,
  schemaVersion: 1,
});

export const EMBEDDED_EXERCISES: readonly EmbeddedExercise[] = [
  exercise('bench-press-barbell', 'Développé couché à la barre', ['barbell', 'flat-bench'], 'push-horizontal'),
  exercise('row-barbell', 'Rowing à la barre', ['barbell'], 'pull-horizontal'),
  exercise('squat-barbell', 'Squat à la barre', ['barbell', 'rack'], 'squat'),
  exercise('lat-pulldown', 'Tirage vertical', ['high-pulley'], 'pull-vertical'),
  exercise('curl-dumbbell', 'Curl aux haltères', ['dumbbell'], 'isolation', 'isolation'),
  exercise('push-up', 'Pompe', ['bodyweight'], 'push-horizontal', 'compound', 'bodyweight-reps'),
  exercise('plank', 'Planche', [], 'core', 'isolation', 'time'),
  exercise('leg-press', 'Presse à cuisses', ['leg-press-machine'], 'squat'),
];

export const CUSTOM_ID = '7f3a1c2e-0000-4000-8000-0000000000a1';
export const DELETED_CUSTOM_ID = '7f3a1c2e-0000-4000-8000-0000000000a2';

const meta = { createdAt: '2026-10-01T08:00:00.000Z', updatedAt: '2026-10-01T08:00:00.000Z', deviceId: '0f8fad5b-d9cb-469f-a165-70867728950e', hlc: '000000000000001-0000-0f8fad5b-d9cb-469f-a165-70867728950e' } as const;

export const CUSTOM_EXERCISE = {
  origin: 'custom',
  id: CUSTOM_ID,
  nameFr: 'Tirage à la sangle',
  aliasesEn: ['strap row'],
  muscles: [{ id: 'lats', weight: 1 }],
  equipment: ['resistance-strap'],
  pattern: 'pull-horizontal',
  kind: 'compound',
  metric: 'load-reps',
  bodyweightFraction: null,
  defaultRepRange: [8, 12],
  defaultRestSec: 90,
  instructions: { setup: '', execution: '', mistakes: [] },
  media: null,
  strengthStandardKey: null,
  schemaVersion: 1,
  deletedAt: null,
  ...meta,
} as unknown as CustomExercise;

export const DELETED_CUSTOM_EXERCISE = { ...CUSTOM_EXERCISE, id: DELETED_CUSTOM_ID, nameFr: 'Ancien exercice maison', deletedAt: '2026-10-02T08:00:00.000Z' } as unknown as CustomExercise;

const emptyInventory: EquipmentInventory = {
  available: [],
  forced: [],
  forbidden: [],
  bodyweight: false,
  barbells: [],
  platesPerSideKg: [],
  dumbbells: null,
  kettlebellsKg: [],
  machines: [],
  cables: [],
};

const profile = (id: string, name: string, kind: EquipmentProfile['kind'], inventory: Partial<EquipmentInventory>): EquipmentProfile =>
  ({ id, name, kind, inventory: { ...emptyInventory, ...inventory }, increments: {}, deletedAt: null, ...meta }) as unknown as EquipmentProfile;

export const GYM_PROFILE = profile('11111111-0000-4000-8000-000000000001', 'Salle synthétique', 'salle', {
  available: ['barbell', 'flat-bench', 'rack', 'high-pulley', 'dumbbell', 'leg-press-machine'],
  bodyweight: true,
  barbells: [{ type: 'olympique', weightKg: 20 }],
  platesPerSideKg: [{ weightKg: 2.5, count: 2 }, { weightKg: 10, count: 2 }],
  dumbbells: { minKg: 2, maxKg: 40, stepKg: 2 },
  machines: [{ equipmentId: 'leg-press-machine', stackMinKg: 10, stackMaxKg: 200, stepKg: 10 }],
});

export const HOME_PROFILE = profile('11111111-0000-4000-8000-000000000002', 'Maison synthétique', 'maison', {
  available: ['dumbbell', 'flat-bench'],
  bodyweight: true,
  dumbbells: { minKg: 2, maxKg: 30, stepKg: 2 },
});

export const BODYWEIGHT_PROFILE = profile('11111111-0000-4000-8000-000000000003', 'Poids de corps', 'voyage', { bodyweight: true });

export const FORBIDDEN_PROFILE = profile('11111111-0000-4000-8000-000000000004', 'Salle sans rack', 'salle', {
  available: ['barbell', 'flat-bench', 'rack', 'dumbbell'],
  forbidden: ['rack'],
});

/** Forme d'un programme de départ de § 12.5 : Haut A (réduit), valeurs de la semaine 2. */
export const PROGRAM_ROUTINE: RoutineSpec = {
  name: 'Haut / Bas 4 j',
  mode: 'programme',
  days: [
    {
      name: 'Haut A',
      dayOrder: 0,
      exercises: [
        { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché à la barre', sets: 3, repMin: 6, repMax: 10, rir: 2, restSec: 150, position: 0 },
        { exerciseId: 'row-barbell', exerciseName: 'Rowing à la barre', sets: 3, repMin: 6, repMax: 10, rir: 2, restSec: 150, position: 1 },
        { exerciseId: 'plank', exerciseName: 'Planche', sets: 3, repMin: 45, repMax: 45, rir: null, restSec: 60, position: 2 },
      ],
    },
    {
      name: 'Bas A',
      dayOrder: 1,
      exercises: [{ exerciseId: 'squat-barbell', exerciseName: 'Squat à la barre', sets: 3, repMin: 5, repMax: 8, rir: 2, restSec: 180, position: 0 }],
    },
  ],
};
