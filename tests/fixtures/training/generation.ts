import { DEFAULT_GENERATION_CONFIG } from '../../../src/domain/training/config';
import type { GenerateSessionInput, GenerationEquipment, GenerationProgram } from '../../../src/domain/training/generationTypes';
import type { EmbeddedExercise, EquipmentInventory, ExerciseKind, ExerciseMetric, ExercisePattern, RoutineDaySpec, RoutineExerciseSpec } from '../../../src/domain/training/types';
import type { IsoDateTime } from '../../../src/domain/types';

/**
 * Fixtures synthétiques de la génération de séance (I3-01, § 12.1 ; D-38 : aucune donnée réelle, ce n'est PAS le contenu de `content/`).
 * Bibliothèque de 40 exercices sur 10 groupes, trois profils (salle complète, salle sans poulie, maison haltères), jours de routine et
 * horloge déterministe. Haut A reprend le vecteur de durée de docs/preparation-i3-generation.md (19 séries, 36 min 15 s).
 */

interface ExOptions {
  readonly group: string;
  readonly muscle: string;
  readonly pattern: ExercisePattern;
  readonly kind?: ExerciseKind;
  readonly metric?: ExerciseMetric;
  readonly equipment: readonly string[];
  readonly alternatives?: readonly string[];
}

const ex = (id: string, nameFr: string, o: ExOptions): EmbeddedExercise => ({
  origin: 'embedded',
  id,
  nameFr,
  group: o.group,
  aliasesEn: [],
  muscles: [
    { id: o.muscle, weight: 1 },
    { id: 'forearms', weight: 0.2 },
  ],
  equipment: o.equipment,
  equipmentGroups: o.equipment.map((e) => [e]),
  pattern: o.pattern,
  kind: o.kind ?? (o.pattern === 'isolation' || o.pattern === 'core' ? 'isolation' : 'compound'),
  metric: o.metric ?? 'load-reps',
  bodyweightFraction: null,
  defaultRepRange: [8, 12],
  defaultRestSec: 90,
  instructions: { setup: 'Installation', execution: 'Exécution', mistakes: ['Erreur 1', 'Erreur 2', 'Erreur 3'] },
  media: null,
  strengthStandardKey: null,
  schemaVersion: 1,
  alternatives: o.alternatives ?? [],
});

export const GEN_LIBRARY: readonly EmbeddedExercise[] = [
  // Pectoraux
  ex('bench-barbell', 'Développé couché barre', { group: 'chest', muscle: 'chest', pattern: 'push-horizontal', equipment: ['barbell', 'flat-bench'], alternatives: ['bench-dumbbell', 'incline-dumbbell'] }),
  ex('bench-dumbbell', 'Développé couché haltères', { group: 'chest', muscle: 'chest', pattern: 'push-horizontal', equipment: ['dumbbell', 'flat-bench'] }),
  ex('incline-dumbbell', 'Développé incliné haltères', { group: 'chest', muscle: 'chest', pattern: 'push-horizontal', equipment: ['dumbbell', 'incline-bench'] }),
  ex('push-up', 'Pompes', { group: 'chest', muscle: 'chest', pattern: 'push-horizontal', metric: 'bodyweight-reps', equipment: ['bodyweight'] }),
  ex('chest-fly-cable', 'Écarté poulie', { group: 'chest', muscle: 'chest', pattern: 'isolation', equipment: ['cable'] }),
  ex('chest-fly-dumbbell', 'Écarté haltères', { group: 'chest', muscle: 'chest', pattern: 'isolation', equipment: ['dumbbell', 'flat-bench'] }),
  // Dos
  ex('row-barbell', 'Rowing barre', { group: 'back', muscle: 'lats', pattern: 'pull-horizontal', equipment: ['barbell'], alternatives: ['row-dumbbell'] }),
  ex('row-dumbbell', 'Rowing haltère', { group: 'back', muscle: 'lats', pattern: 'pull-horizontal', equipment: ['dumbbell', 'flat-bench'] }),
  ex('seated-row-cable', 'Tirage horizontal poulie', { group: 'back', muscle: 'lats', pattern: 'pull-horizontal', equipment: ['cable'] }),
  ex('lat-pulldown', 'Tirage vertical poulie', { group: 'back', muscle: 'lats', pattern: 'pull-vertical', equipment: ['cable'], alternatives: ['pull-up', 'pulldown-machine'] }),
  ex('pulldown-machine', 'Tirage vertical machine', { group: 'back', muscle: 'lats', pattern: 'pull-vertical', equipment: ['lat-machine'] }),
  ex('pull-up', 'Tractions', { group: 'back', muscle: 'lats', pattern: 'pull-vertical', metric: 'bodyweight-reps', equipment: ['pull-up-bar'] }),
  // Épaules
  ex('ohp-barbell', 'Développé militaire barre', { group: 'shoulders', muscle: 'front-delts', pattern: 'push-vertical', equipment: ['barbell'], alternatives: ['ohp-dumbbell'] }),
  ex('ohp-dumbbell', 'Développé militaire haltères', { group: 'shoulders', muscle: 'front-delts', pattern: 'push-vertical', equipment: ['dumbbell'] }),
  ex('front-raise-dumbbell', 'Élévations frontales', { group: 'shoulders', muscle: 'front-delts', pattern: 'isolation', equipment: ['dumbbell'] }),
  ex('lateral-raise-dumbbell', 'Élévations latérales haltères', { group: 'shoulders', muscle: 'middle-delts', pattern: 'isolation', equipment: ['dumbbell'] }),
  ex('lateral-raise-cable', 'Élévations latérales poulie', { group: 'shoulders', muscle: 'middle-delts', pattern: 'isolation', equipment: ['cable'] }),
  ex('reverse-fly-dumbbell', 'Oiseau haltères', { group: 'shoulders', muscle: 'rear-delts', pattern: 'isolation', equipment: ['dumbbell'] }),
  // Bras
  ex('curl-barbell', 'Curl barre', { group: 'biceps', muscle: 'biceps', pattern: 'isolation', equipment: ['barbell'] }),
  ex('curl-dumbbell', 'Curl haltères', { group: 'biceps', muscle: 'biceps', pattern: 'isolation', equipment: ['dumbbell'] }),
  ex('curl-cable', 'Curl poulie', { group: 'biceps', muscle: 'biceps', pattern: 'isolation', equipment: ['cable'] }),
  ex('pushdown-cable', 'Extension triceps poulie', { group: 'triceps', muscle: 'triceps', pattern: 'isolation', equipment: ['cable'] }),
  ex('overhead-ext-dumbbell', 'Extension nuque haltère', { group: 'triceps', muscle: 'triceps', pattern: 'isolation', equipment: ['dumbbell'] }),
  // Jambes
  ex('squat-barbell', 'Squat barre', { group: 'quadriceps', muscle: 'quads', pattern: 'squat', equipment: ['barbell', 'squat-rack'], alternatives: ['leg-press', 'goblet-squat'] }),
  ex('leg-press', 'Presse à cuisses', { group: 'quadriceps', muscle: 'quads', pattern: 'squat', equipment: ['leg-press'] }),
  ex('goblet-squat', 'Squat gobelet', { group: 'quadriceps', muscle: 'quads', pattern: 'squat', equipment: ['dumbbell'] }),
  ex('split-squat-dumbbell', 'Fente bulgare haltères', { group: 'quadriceps', muscle: 'quads', pattern: 'lunge', equipment: ['dumbbell', 'flat-bench'] }),
  ex('leg-extension', 'Leg extension', { group: 'quadriceps', muscle: 'quads', pattern: 'isolation', equipment: ['leg-extension-machine'] }),
  ex('rdl-barbell', 'Soulevé de terre roumain barre', { group: 'hamstrings', muscle: 'hamstrings', pattern: 'hinge', equipment: ['barbell'], alternatives: ['rdl-dumbbell'] }),
  ex('rdl-dumbbell', 'Soulevé de terre roumain haltères', { group: 'hamstrings', muscle: 'hamstrings', pattern: 'hinge', equipment: ['dumbbell'] }),
  ex('leg-curl', 'Leg curl', { group: 'hamstrings', muscle: 'hamstrings', pattern: 'isolation', equipment: ['leg-curl-machine'] }),
  ex('hip-thrust-barbell', 'Hip thrust barre', { group: 'glutes', muscle: 'glutes', pattern: 'hinge', equipment: ['barbell', 'flat-bench'] }),
  ex('glute-bridge', 'Pont fessier', { group: 'glutes', muscle: 'glutes', pattern: 'hinge', metric: 'bodyweight-reps', equipment: ['bodyweight'] }),
  ex('calf-raise-standing', 'Mollets debout', { group: 'calves', muscle: 'calves', pattern: 'isolation', equipment: ['calf-machine'] }),
  ex('calf-raise-dumbbell', 'Mollets haltère', { group: 'calves', muscle: 'calves', pattern: 'isolation', equipment: ['dumbbell'] }),
  ex('plank', 'Planche', { group: 'abs', muscle: 'abs', pattern: 'core', metric: 'time', equipment: ['bodyweight'] }),
  ex('side-plank', 'Planche latérale', { group: 'abs', muscle: 'abs', pattern: 'core', metric: 'time', equipment: ['bodyweight'] }),
  ex('cable-crunch', 'Crunch poulie', { group: 'abs', muscle: 'abs', pattern: 'core', equipment: ['cable'] }),
  ex('dead-bug', 'Dead bug', { group: 'abs', muscle: 'abs', pattern: 'core', metric: 'bodyweight-reps', equipment: ['bodyweight'] }),
  ex('farmer-carry', 'Marche du fermier', { group: 'forearms', muscle: 'forearms', pattern: 'carry', metric: 'distance', equipment: ['dumbbell'] }),
];

export const GROUP_OF_MUSCLE: ReadonlyMap<string, string> = new Map([
  ['chest', 'chest'],
  ['lats', 'back'],
  ['front-delts', 'shoulders'],
  ['middle-delts', 'shoulders'],
  ['rear-delts', 'shoulders'],
  ['biceps', 'biceps'],
  ['triceps', 'triceps'],
  ['quads', 'quadriceps'],
  ['hamstrings', 'hamstrings'],
  ['glutes', 'glutes'],
  ['calves', 'calves'],
  ['abs', 'abs'],
  ['forearms', 'forearms'],
]);

const inventory = (available: readonly string[], bodyweight = true): EquipmentInventory => ({
  available,
  forced: [],
  forbidden: [],
  bodyweight,
  barbells: [],
  platesPerSideKg: [],
  dumbbells: null,
  kettlebellsKg: [],
  machines: [],
  cables: [],
});

const GYM_ITEMS = ['barbell', 'flat-bench', 'incline-bench', 'dumbbell', 'cable', 'lat-machine', 'pull-up-bar', 'squat-rack', 'leg-press', 'leg-extension-machine', 'leg-curl-machine', 'calf-machine'];

export const GYM: GenerationEquipment = { kind: 'salle', inventory: inventory(GYM_ITEMS) };
export const GYM_NO_CABLE: GenerationEquipment = { kind: 'salle', inventory: inventory(GYM_ITEMS.filter((i) => i !== 'cable')) };
export const HOME: GenerationEquipment = { kind: 'maison', inventory: inventory(['dumbbell', 'flat-bench']) };

let position = 0;
const line = (exerciseId: string, sets: number, repMin: number, repMax: number, restSec: number, rir: number | null = null): RoutineExerciseSpec => {
  const found = GEN_LIBRARY.find((e) => e.id === exerciseId);
  return { exerciseId, exerciseName: found?.nameFr ?? exerciseId, sets, repMin, repMax, rir, restSec, position: position++ };
};
const day = (name: string, dayOrder: number, build: () => RoutineExerciseSpec[]): RoutineDaySpec => {
  position = 0;
  return { name, dayOrder, exercises: build() };
};

/** Haut A (§ 12.5, valeurs de la semaine 2) : 19 séries, 2 175 s selon la convention D-73 point 4. */
export const UPPER_A = day('Haut A', 1, () => [
  line('bench-barbell', 3, 6, 10, 150, 2),
  line('row-barbell', 3, 6, 10, 150, 2),
  line('incline-dumbbell', 3, 8, 12, 120),
  line('lat-pulldown', 3, 8, 12, 120),
  line('lateral-raise-dumbbell', 3, 12, 15, 60),
  line('curl-barbell', 2, 8, 12, 60),
  line('pushdown-cable', 2, 8, 12, 60),
]);
export const LOWER_A = day('Bas A', 2, () => [
  line('squat-barbell', 3, 5, 8, 180),
  line('rdl-barbell', 3, 6, 10, 150),
  line('leg-curl', 3, 10, 15, 90),
  line('calf-raise-standing', 3, 10, 15, 60),
  line('plank', 3, 45, 45, 60),
]);
export const UPPER_B = day('Haut B', 3, () => [line('ohp-barbell', 3, 6, 10, 150), line('pull-up', 3, 6, 10, 150), line('bench-dumbbell', 3, 8, 12, 120), line('curl-dumbbell', 2, 10, 15, 60)]);
export const LOWER_B = day('Bas B', 4, () => [line('hip-thrust-barbell', 3, 8, 12, 120), line('split-squat-dumbbell', 3, 8, 12, 120), line('leg-extension', 3, 12, 15, 90), line('calf-raise-dumbbell', 3, 12, 15, 60)]);
/** Ordre volontairement mélangé (isolation en tête) pour l'ordre composés → isolations. */
export const MIXED = day('Mélangé', 1, () => [line('lateral-raise-dumbbell', 3, 12, 15, 60), line('curl-barbell', 2, 8, 12, 60), line('bench-barbell', 3, 6, 10, 150), line('row-barbell', 3, 6, 10, 150)]);
export const PUSH = day('Push', 1, () => [line('bench-barbell', 3, 6, 10, 150), line('ohp-barbell', 3, 6, 10, 150), line('lateral-raise-dumbbell', 3, 12, 15, 60), line('pushdown-cable', 2, 8, 12, 60)]);
export const PULL = day('Pull', 2, () => [line('row-barbell', 3, 6, 10, 150), line('lat-pulldown', 3, 8, 12, 120), line('reverse-fly-dumbbell', 3, 12, 15, 60), line('curl-barbell', 2, 8, 12, 60)]);
export const LEGS = day('Legs', 3, () => [line('squat-barbell', 3, 5, 8, 180), line('rdl-barbell', 3, 6, 10, 150), line('calf-raise-standing', 3, 10, 15, 60)]);
export const HOME_A = day('Maison A', 1, () => [line('goblet-squat', 3, 8, 12, 90), line('bench-dumbbell', 3, 8, 12, 90), line('row-dumbbell', 3, 8, 12, 90), line('curl-dumbbell', 2, 10, 15, 60)]);

export const START: IsoDateTime = '2026-11-02T08:00:00.000Z' as IsoDateTime;
/** Instant `weeks` semaines (et `days` jours) après `START`. */
export const at = (weeks: number, days = 0): IsoDateTime => new Date(Date.parse(START) + (weeks * 7 + days) * 86_400_000 + 3_600_000).toISOString() as IsoDateTime;

export const UPPER_LOWER_DAYS: readonly RoutineDaySpec[] = [UPPER_A, LOWER_A, UPPER_B, LOWER_B];
export const PPL_DAYS: readonly RoutineDaySpec[] = [PUSH, PULL, LEGS, { ...PUSH, dayOrder: 4 }, { ...PULL, dayOrder: 5 }, { ...LEGS, dayOrder: 6 }];

export const program = (patch: Partial<GenerationProgram> = {}): GenerationProgram => ({
  mode: 'guide',
  libreVariant: null,
  split: 'upper-lower',
  customDays: [],
  variety: 'consistent',
  style: 'straight',
  priorities: [],
  painfulPatterns: [],
  days: UPPER_LOWER_DAYS,
  startedAt: START,
  ...patch,
});

export const input = (patch: Partial<GenerateSessionInput> = {}, programPatch: Partial<GenerationProgram> = {}): GenerateSessionInput => ({
  day: 0,
  program: program(programPatch),
  library: { exercises: GEN_LIBRARY, groupOfMuscle: GROUP_OF_MUSCLE },
  equipment: GYM,
  profile: null,
  recovery: null,
  timeBudgetMin: null,
  week: null,
  mesocycleIndex: null,
  config: DEFAULT_GENERATION_CONFIG,
  now: at(0),
  ...patch,
});

/** Gel profond : une mutation de l'entrée lève une erreur en mode strict. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value) && !(value instanceof Map)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}
