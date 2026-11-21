import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { FITNESS_PARK_ANTONY } from '../../../tests/fixtures/training/progression';
import {
  R_ASSISTED,
  R_BENCH_BB,
  R_BENCH_DB,
  R_CHEST_MACHINE,
  R_DIPS_WEIGHTED,
  R_FLY_CABLE,
  R_GYM,
  R_LIBRARY,
  R_OHP_BB,
  R_PRESS_KB,
  R_PUSH_UP,
  R_ROW_BB,
  R_ROW_DB_ONE,
  R_SWING_KB,
} from '../../../tests/fixtures/training/replacement';
import { REPLACEMENT_LOAD_FACTORS } from './config';
import { estimateReplacementLoad, implementOf, replacementCandidates, replacementSourceLoad } from './replacement';
import type { WorkoutSet } from './session';
import type { EmbeddedExercise } from './types';

/**
 * SESS-01a (§ 13.2 « Remplacer », § 11.3 arrondi, § 14.1 alternatives ; règle proposée en décision) : charge de départ estimée quand on remplace
 * un exercice par un autre sans historique, barre ↔ paire d'haltères ↔ machine, facteurs prudents, toujours au cran inférieur du matériel.
 */

const groupOf = (e: EmbeddedExercise): string | null => e.group ?? null;

describe('facteurs de conversion (config.ts, décision proposée)', () => {
  it('six sens, tous < 1 sauf haltères → barre (= 1), figés', () => {
    expect(REPLACEMENT_LOAD_FACTORS).toEqual({
      'barbell>dumbbell': 0.75,
      'dumbbell>barbell': 1,
      'barbell>machine': 0.6,
      'machine>barbell': 0.6,
      'dumbbell>machine': 0.6,
      'machine>dumbbell': 0.6,
    });
    expect(Object.isFrozen(REPLACEMENT_LOAD_FACTORS)).toBe(true);
  });
});

describe('implementOf', () => {
  it('barre, haltères, machine (charges guidées ou poulie) ; kettlebell, poids du corps : aucun', () => {
    expect(implementOf(R_BENCH_BB)).toBe('barbell');
    expect(implementOf(R_BENCH_DB)).toBe('dumbbell');
    expect(implementOf(R_CHEST_MACHINE)).toBe('machine');
    expect(implementOf(R_FLY_CABLE)).toBe('machine');
    expect(implementOf(R_SWING_KB)).toBeNull();
    expect(implementOf(R_PUSH_UP)).toBeNull();
  });
});

describe('estimateReplacementLoad — vecteurs', () => {
  const est = (from: EmbeddedExercise, kg: number | null, to: EmbeddedExercise, profile = R_GYM) => estimateReplacementLoad({ from, fromLoadKg: kg, to, profile });

  it('recette : développé couché barre 80 kg → haltères, 2 × 30 kg (80 × 0,75 = 60 la paire)', () => {
    expect(est(R_BENCH_BB, 80, R_BENCH_DB)).toEqual({ loadKg: 30, held: 2, from: 'barbell', to: 'dumbbell', factor: 0.75, rawKg: 30 });
  });

  it('cran inférieur des haltères (pas 2) : 82,5 kg → 30,94 → 30 ; 100 kg → 37,5 → 36', () => {
    expect(est(R_BENCH_BB, 82.5, R_BENCH_DB)?.loadKg).toBe(30);
    expect(est(R_BENCH_BB, 100, R_BENCH_DB)?.loadKg).toBe(36);
  });

  it('haltères 2 × 30 kg → barre : 60 kg (facteur 1, grille de la barre)', () => {
    expect(est(R_BENCH_DB, 30, R_BENCH_BB)).toEqual({ loadKg: 60, held: null, from: 'dumbbell', to: 'barbell', factor: 1, rawKg: 60 });
  });

  it('barre 80 kg → machine par pas de 5 : 48 → 45 ; machine 50 → barre : 30', () => {
    expect(est(R_BENCH_BB, 80, R_CHEST_MACHINE)?.loadKg).toBe(45);
    expect(est(R_CHEST_MACHINE, 50, R_BENCH_BB)?.loadKg).toBe(30);
  });

  it('haltère tenu seul (rowing unilatéral) : barre 60 → 45 kg pour un haltère → 44', () => {
    expect(est(R_ROW_BB, 60, R_ROW_DB_ONE)).toMatchObject({ loadKg: 44, held: 1 });
  });

  it('sans grille connue (aucun profil) : cran de repli de 2,5 kg vers le bas', () => {
    expect(estimateReplacementLoad({ from: R_BENCH_BB, fromLoadKg: 82.5, to: R_BENCH_DB, profile: null })?.loadKg).toBe(30);
    expect(estimateReplacementLoad({ from: R_BENCH_BB, fromLoadKg: 90, to: R_BENCH_DB, profile: null })?.loadKg).toBe(32.5);
  });

  it('estimation sous la plus petite charge du matériel : aucune (jamais plus lourd que l’estimation)', () => {
    expect(est(R_BENCH_BB, 4, R_BENCH_DB)).toBeNull();
  });

  it('aucune estimation : pattern différent, même matériel, kettlebell, poids du corps, lesté, assisté, charge absente ou nulle', () => {
    expect(est(R_BENCH_BB, 80, R_OHP_BB)).toBeNull();
    expect(est(R_BENCH_DB, 30, R_BENCH_DB)).toBeNull();
    expect(est(R_BENCH_BB, 80, R_PRESS_KB)).toBeNull();
    expect(est(R_BENCH_BB, 80, R_PUSH_UP)).toBeNull();
    expect(est(R_BENCH_BB, 80, R_DIPS_WEIGHTED)).toBeNull();
    expect(est(R_BENCH_BB, 80, R_ASSISTED)).toBeNull();
    expect(est(R_ASSISTED, 40, R_BENCH_BB)).toBeNull();
    expect(est(R_BENCH_BB, null, R_BENCH_DB)).toBeNull();
    expect(est(R_BENCH_BB, 0, R_BENCH_DB)).toBeNull();
  });

  it('propriétés : jamais au-dessus de l’estimation brute, monotone, charge toujours dans la grille, déterministe', () => {
    const grid = new Set([...Array(25).keys()].map((i) => 2 + 2 * i));
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 800 }), fc.integer({ min: 0, max: 40 }), (quarters, more) => {
        const a = quarters * 0.25;
        const b = a + more * 0.25;
        const ra = est(R_BENCH_BB, a, R_BENCH_DB);
        const rb = est(R_BENCH_BB, b, R_BENCH_DB);
        if (ra !== null) {
          expect(ra.loadKg).toBeLessThanOrEqual((a * 0.75) / 2 + 1e-9);
          expect(grid.has(ra.loadKg)).toBe(true);
          expect(rb?.loadKg ?? Number.POSITIVE_INFINITY).toBeGreaterThanOrEqual(ra.loadKg);
        }
        expect(est(R_BENCH_BB, a, R_BENCH_DB)).toEqual(ra);
      }),
    );
  });
});

describe('replacementCandidates', () => {
  it('alternatives de la fiche compatibles d’abord, puis même groupe musculaire (même pattern, même type, le reste ; nom), sans incompatibles', () => {
    const out = replacementCandidates({ of: R_BENCH_BB, library: R_LIBRARY, profile: R_GYM, excluded: new Set(), present: new Set(['bench-press-barbell']), groupOf });
    // Développé incliné (banc incliné absent) et dips assistés (machine absente) : incompatibles.
    expect(out.alternatives.map((e) => e.id)).toEqual(['bench-press-dumbbell']);
    expect(out.similar.map((e) => e.id)).toEqual(['floor-press-kettlebell', 'push-up', 'chest-press-machine', 'dips-weighted', 'fly-cable']);
  });

  it('exercices écartés (« ne plus proposer ») et déjà dans la séance : jamais proposés', () => {
    const out = replacementCandidates({ of: R_BENCH_BB, library: R_LIBRARY, profile: R_GYM, excluded: new Set(['bench-press-dumbbell', 'push-up']), present: new Set(['bench-press-barbell', 'fly-cable']), groupOf });
    expect(out.alternatives).toEqual([]);
    expect(out.similar.map((e) => e.id)).toEqual(['floor-press-kettlebell', 'chest-press-machine', 'dips-weighted']);
  });

  it('sans profil : aucun filtre de matériel ; limite du nombre de semblables', () => {
    const out = replacementCandidates({ of: R_BENCH_BB, library: R_LIBRARY, profile: null, excluded: new Set(), present: new Set(), groupOf, limit: 2 });
    expect(out.alternatives.map((e) => e.id)).toEqual(['incline-press-dumbbell', 'bench-press-dumbbell']);
    expect(out.similar).toHaveLength(2);
    expect(replacementCandidates({ of: R_BENCH_BB, library: R_LIBRARY, profile: FITNESS_PARK_ANTONY, excluded: new Set(), present: new Set(), groupOf }).similar.map((e) => e.id)).not.toContain('chest-press-machine');
  });
});

describe('replacementSourceLoad', () => {
  const s = (over: Partial<WorkoutSet>): WorkoutSet => ({ setKind: 'work', done: false, loadKg: null, targetLoadKg: null, position: 0, ...over }) as WorkoutSet;
  it('dernière série de travail validée, sinon charge saisie, sinon charge cible ; échauffement ignoré', () => {
    expect(replacementSourceLoad([s({ setKind: 'warmup', done: true, loadKg: 40 }), s({ done: true, loadKg: 80, position: 1 }), s({ done: true, loadKg: 82.5, position: 2 })])).toBe(82.5);
    expect(replacementSourceLoad([s({ setKind: 'warmup', done: true, loadKg: 40 }), s({ loadKg: 75, position: 1 })])).toBe(75);
    expect(replacementSourceLoad([s({ targetLoadKg: 70 })])).toBe(70);
    expect(replacementSourceLoad([s({})])).toBeNull();
  });
});
