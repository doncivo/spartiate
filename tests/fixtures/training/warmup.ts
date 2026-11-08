import type { ProgressionEquipment } from '../../../src/domain/training/types';
import { FITNESS_PARK_ANTONY } from './progression';

/**
 * Fixtures synthétiques I2-03 (D-38 : aucune donnée réelle) : matériels dont les pas ne permettent pas toujours la cible exacte d'une rampe
 * d'échauffement (§ 13.8, D-72 point 11).
 */

/** Barre de 20 kg, disques de 5 kg seulement (pas de 10 kg), au plus 2 par côté : 20 à 40 kg. */
export const SMALL_PLATES: ProgressionEquipment = {
  inventory: {
    ...FITNESS_PARK_ANTONY.inventory,
    barbells: [{ type: 'Barre olympique', weightKg: 20, equipmentId: 'barbell' }],
    platesPerSideKg: [{ weightKg: 5, count: 2 }],
  },
  increments: {},
};

/** Machine guidée de 10 à 100 kg par pas de 5 kg (vecteur « stack 5 kg »). */
export const STACK_5: ProgressionEquipment = {
  inventory: { ...FITNESS_PARK_ANTONY.inventory, machines: [{ equipmentId: 'leg-press-machine', stackMinKg: 10, stackMaxKg: 100, stepKg: 5 }] },
  increments: FITNESS_PARK_ANTONY.increments,
};

/** Haltères 2 à 50 kg par pas de 2, plus une paire de 9 kg (comme à Antony). */
export const DUMBBELLS_WITH_9: ProgressionEquipment = {
  inventory: { ...FITNESS_PARK_ANTONY.inventory, dumbbells: { minKg: 2, maxKg: 50, stepKg: 2, extraKg: [9] } },
  increments: FITNESS_PARK_ANTONY.increments,
};

export const BENCH_DB = { id: 'bench-press-dumbbell', metric: 'load-reps', equipment: ['dumbbell', 'flat-bench'] } as const;
export const PUSH_UP = { id: 'push-up', metric: 'bodyweight-reps', equipment: ['bodyweight'] } as const;
