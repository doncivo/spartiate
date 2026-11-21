import type { EmbeddedExercise, ExercisePattern, ProgressionEquipment } from '../../../src/domain/training';
import { FITNESS_PARK_ANTONY } from './progression';

/**
 * SESS-01a : exercices synthétiques (identifiants du catalogue, valeurs inventées) pour la règle de remplacement en séance. Aucune donnée réelle.
 */

const base = (id: string, nameFr: string, equipment: readonly string[], pattern: ExercisePattern, over: Partial<EmbeddedExercise> = {}): EmbeddedExercise => ({
  origin: 'embedded',
  id,
  nameFr,
  aliasesEn: [],
  muscles: [{ id: 'chest', weight: 1 }],
  equipment,
  equipmentGroups: equipment.map((e) => [e]),
  pattern,
  kind: 'compound',
  metric: 'load-reps',
  bodyweightFraction: null,
  defaultRepRange: [6, 10],
  defaultRestSec: 120,
  instructions: { setup: 'Mise en place.', execution: 'Exécution.', mistakes: ['Erreur.'] },
  media: null,
  strengthStandardKey: null,
  schemaVersion: 1,
  group: 'chest',
  ...over,
});

export const R_BENCH_BB = base('bench-press-barbell', 'Développé couché à la barre', ['barbell', 'flat-bench'], 'push-horizontal', { alternatives: ['incline-press-dumbbell', 'bench-press-dumbbell'] });
export const R_BENCH_DB = base('bench-press-dumbbell', 'Développé couché aux haltères', ['dumbbell', 'flat-bench'], 'push-horizontal', { alternatives: ['bench-press-barbell', 'chest-press-machine'] });
export const R_INCLINE_DB = base('incline-press-dumbbell', 'Développé incliné aux haltères', ['dumbbell', 'incline-bench'], 'push-horizontal');
export const R_CHEST_MACHINE = base('chest-press-machine', 'Presse pectoraux', ['chest-press-machine'], 'push-horizontal');
export const R_FLY_CABLE = base('fly-cable', 'Écarté à la poulie', ['high-pulley'], 'isolation', { kind: 'isolation' });
export const R_PUSH_UP = base('push-up', 'Pompes', ['bodyweight'], 'push-horizontal', { metric: 'bodyweight-reps', bodyweightFraction: 0.65 });
export const R_DIPS_WEIGHTED = base('dips-weighted', 'Dips lestés', ['parallel-bars', 'weight-plate'], 'push-vertical', { bodyweightFraction: 0.9 });
export const R_OHP_BB = base('overhead-press-barbell', 'Développé militaire', ['barbell'], 'push-vertical', { muscles: [{ id: 'front-delts', weight: 1 }], group: 'shoulders' });
export const R_SQUAT_BB = base('squat-barbell', 'Squat', ['barbell', 'rack'], 'squat', { muscles: [{ id: 'quads', weight: 1 }], group: 'legs' });
export const R_ROW_BB = base('row-barbell', 'Rowing à la barre', ['barbell'], 'pull-horizontal', { muscles: [{ id: 'lats', weight: 1 }], group: 'back' });
export const R_ROW_DB_ONE = base('row-dumbbell-one-arm', 'Rowing unilatéral', ['dumbbell', 'flat-bench'], 'pull-horizontal', { muscles: [{ id: 'lats', weight: 1 }], group: 'back' });
export const R_SWING_KB = base('swing-kettlebell', 'Swing', ['kettlebell'], 'hinge', { muscles: [{ id: 'glutes', weight: 1 }], group: 'legs' });
export const R_PRESS_KB = base('floor-press-kettlebell', 'Développé au sol kettlebell', ['kettlebell'], 'push-horizontal');
export const R_ASSISTED = base('assisted-dip-machine', 'Dips assistés', ['assisted-pull-up-machine'], 'push-horizontal');

export const R_LIBRARY: readonly EmbeddedExercise[] = [
  R_BENCH_BB,
  R_BENCH_DB,
  R_INCLINE_DB,
  R_CHEST_MACHINE,
  R_FLY_CABLE,
  R_PUSH_UP,
  R_DIPS_WEIGHTED,
  R_OHP_BB,
  R_SQUAT_BB,
  R_ROW_BB,
  R_ROW_DB_ONE,
  R_SWING_KB,
  R_PRESS_KB,
  R_ASSISTED,
];

/** Salle de l'essai : profil par défaut (barre 20 kg pas 2,5, haltères 2 à 50 pas 2) + presse pectoraux 5 à 100 kg par 5, sans banc incliné. */
export const R_GYM: ProgressionEquipment = {
  inventory: {
    ...FITNESS_PARK_ANTONY.inventory,
    available: [...FITNESS_PARK_ANTONY.inventory.available, 'rack', 'parallel-bars', 'weight-plate'],
    machines: [{ equipmentId: 'chest-press-machine', stackMinKg: 5, stackMaxKg: 100, stepKg: 5 }],
  },
  increments: FITNESS_PARK_ANTONY.increments,
};
