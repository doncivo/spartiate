import type { ExerciseSession, HistorySet, PrescribeInput, ProgressionEquipment, RepTarget } from '../../../src/domain/training/types';
import { DEFAULT_PROGRESSION_CONFIG } from '../../../src/domain/training/config';
import type { IsoDateTime } from '../../../src/domain/types';

/**
 * Fixtures synthétiques I2-01 (D-38 : aucune donnée réelle). `FITNESS_PARK_ANTONY` reprend les valeurs du profil embarqué par défaut
 * (content/equipment-profiles/profiles.json, converti par `toEmbeddedProfile`) : barre olympique 20 kg, disques 1,25 à 30 kg (un par
 * masse et par côté), haltères 2 à 50 kg par pas de 2, incréments barre 2,5 et haltère 2 ; machines et poulies sans palier connu.
 */

export const NOW = '2026-11-07T18:00:00.000Z' as IsoDateTime;
const DAY = 86_400_000;
export const daysAgo = (days: number): IsoDateTime => new Date(Date.parse(NOW) - days * DAY).toISOString() as IsoDateTime;

export const FITNESS_PARK_ANTONY: ProgressionEquipment = {
  inventory: {
    available: ['barbell', 'ez-bar', 'dumbbell', 'kettlebell', 'leg-press-machine', 'high-pulley', 'flat-bench'],
    forced: [],
    forbidden: [],
    bodyweight: true,
    barbells: [
      { type: 'Barre olympique', weightKg: 20 },
      { type: 'Petite barre droite', weightKg: 8 },
    ],
    platesPerSideKg: [1.25, 2.5, 5, 10, 15, 20, 25, 30].map((weightKg) => ({ weightKg, count: 1 })),
    dumbbells: { minKg: 2, maxKg: 50, stepKg: 2 },
    kettlebellsKg: [4, 34],
    machines: [],
    cables: [],
  },
  increments: { barbell: 2.5, dumbbell: 2 },
};

/** Salle avec une machine à charges guidées par pas de 5 kg (vecteur « stack 5 kg » du § 11.6). */
export const STACK_GYM: ProgressionEquipment = {
  inventory: { ...FITNESS_PARK_ANTONY.inventory, machines: [{ equipmentId: 'leg-press-machine', stackMinKg: 5, stackMaxKg: 200, stepKg: 5 }] },
  increments: FITNESS_PARK_ANTONY.increments,
};

export const BENCH = { id: 'bench-press-barbell', metric: 'load-reps', equipment: ['barbell', 'flat-bench'] } as const;
export const CURL = { id: 'curl-dumbbell', metric: 'load-reps', equipment: ['dumbbell'] } as const;
export const LEG_PRESS = { id: 'leg-press', metric: 'load-reps', equipment: ['leg-press-machine'] } as const;
export const PLANK = { id: 'plank', metric: 'time', equipment: [] } as const;

/** Série de travail validée. */
export const set = (loadKg: number | null, reps: number | null, over: Partial<HistorySet> = {}): HistorySet => ({ position: 0, setKind: 'work', done: true, reps, loadKg, rir: null, ...over });

let seq = 0;
/** Séance close de `daysBefore` jours, séries de travail validées à `loadKg` (positions 0, 1, 2…). */
export function session(daysBefore: number, loadKg: number, reps: readonly number[], over: Partial<ExerciseSession> = {}): ExerciseSession {
  seq += 1;
  return {
    workoutId: `w-${String(daysBefore).padStart(3, '0')}-${String(seq)}`,
    endedAt: daysAgo(daysBefore),
    difficulty: null,
    sets: reps.map((r, position) => set(loadKg, r, { position })),
    ...over,
  };
}

export const target = (repMin: number, repMax: number, sets = 3): RepTarget => ({ sets, repMin, repMax, rir: null });

export const input = (over: Partial<PrescribeInput> = {}): PrescribeInput => ({
  exercise: BENCH,
  history: [],
  lastDecision: null,
  profile: null,
  equipment: FITNESS_PARK_ANTONY,
  target: target(8, 10),
  config: DEFAULT_PROGRESSION_CONFIG,
  now: NOW,
  ...over,
});
