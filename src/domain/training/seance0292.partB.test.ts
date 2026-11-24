import { describe, expect, it } from 'vitest';
import * as training from './index';
import { emptyInventory, validateEquipmentProfile } from './index';
import { replacementCandidates } from './replacement';
import { R_BENCH_BB, R_BENCH_DB, R_FLY_CABLE, R_GYM, R_LIBRARY } from '../../../tests/fixtures/training/replacement';

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

describe('BL-121 : gênes appliquées au remplacement d’exercice en séance', () => {
  const groupOf = (e: training.EmbeddedExercise): string | null => e.group ?? null;
  it('exercices évités (muscle d’une gêne) et patterns douloureux : jamais proposés ; leur nombre est rendu', () => {
    const avoid = { patterns: [R_FLY_CABLE.pattern === R_BENCH_DB.pattern ? 'hinge' : R_FLY_CABLE.pattern], exerciseIds: ['bench-press-dumbbell'] } as const;
    const out = replacementCandidates({ of: R_BENCH_BB, library: R_LIBRARY, profile: R_GYM, excluded: new Set(), present: new Set(['bench-press-barbell']), groupOf, avoid } as Parameters<typeof replacementCandidates>[0]);
    expect(out.alternatives.map((e) => e.id)).toEqual([]);
    expect(out.similar.map((e) => e.id)).not.toContain('fly-cable');
    expect(out.similar.map((e) => e.id)).not.toContain('bench-press-dumbbell');
    expect((out as unknown as { avoided?: number }).avoided).toBeGreaterThanOrEqual(2);
  });
});
