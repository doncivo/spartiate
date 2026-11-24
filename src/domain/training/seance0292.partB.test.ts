import { describe, expect, it } from 'vitest';
import * as training from './index';
import { emptyInventory, validateEquipmentProfile } from './index';

/** SEANCE-0292, partie B : vecteurs du domaine de l'entraînement (une section par ligne). */

describe('C-081 : un même poids deux fois dans l’inventaire est refusé', () => {
  const profile = (over: Partial<ReturnType<typeof emptyInventory>>) => ({ name: 'Salle', kind: 'salle' as const, inventory: { ...emptyInventory(), ...over }, increments: {} });
  it('disques en double : « plates » ; kettlebells en double : « kettlebells » ; sans double : aucun motif', () => {
    expect(validateEquipmentProfile(profile({ platesPerSideKg: [{ weightKg: 20, count: 2 }, { weightKg: 20, count: 1 }] })).map((i) => i.code)).toEqual(['plates']);
    expect(validateEquipmentProfile(profile({ kettlebellsKg: [16, 16] })).map((i) => i.code)).toEqual(['kettlebells']);
    expect(validateEquipmentProfile(profile({ platesPerSideKg: [{ weightKg: 20, count: 4 }], kettlebellsKg: [12, 16] }))).toEqual([]);
  });
});

describe('C-072 : une correction ne vide pas la charge d’un exercice à charge', () => {
  const fn = (training as unknown as { correctionIssues?: (before: training.SetEntry, after: training.SetEntry, metric: training.ExerciseMetric) => string[] }).correctionIssues;
  const e = (loadKg: number | null): training.SetEntry => ({ reps: 8, loadKg, durationSec: null, rir: null });
  it('charge × répétitions : charge vidée refusée (« load-cleared ») ; modifiée : acceptée ; poids du corps : vidée acceptée', () => {
    expect(typeof fn).toBe('function');
    if (fn === undefined) return;
    expect(fn(e(80), e(null), 'load-reps')).toEqual(['load-cleared']);
    expect(fn(e(80), e(82.5), 'load-reps')).toEqual([]);
    expect(fn(e(null), e(null), 'load-reps')).toEqual([]);
    expect(fn(e(10), e(null), 'bodyweight-reps')).toEqual([]);
  });
});
