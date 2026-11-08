import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BENCH, CURL, DEADLIFT_TRAP, FITNESS_PARK_ANTONY, LEG_PRESS, SWING, input, session, set, target } from '../../../tests/fixtures/training/progression';
import { BENCH_DB, DUMBBELLS_WITH_9, PUSH_UP, SMALL_PLATES, STACK_5 } from '../../../tests/fixtures/training/warmup';
import { WARMUP_STEPS } from './config';
import { analyzeHistory } from './estimate1rm';
import { loadGrid } from './loadGrid';
import { prescribe } from './prescribe';
import { warmupExerciseIds, warmupForExercise, warmupRamp, warmupTargets, type WarmupStep } from './warmup';

/**
 * I2-03 (PRD § 13.8, D-72 point 11) : rampes d'échauffement 40 % × 8, 60 % × 5, 80 % × 2 de la charge de travail, snappées à la charge
 * disponible juste en dessous, répétitions arrondies en dessous, une rampe pour le premier exercice composé de chaque pattern.
 */

const grid = (equipment: readonly string[], profile = FITNESS_PARK_ANTONY): readonly number[] | null => loadGrid(equipment, profile)?.loads ?? null;

describe('paramètres (config.ts, § 13.8)', () => {
  it('40 % × 8, 60 % × 5, 80 % × 2, figés', () => {
    expect(WARMUP_STEPS).toEqual([
      { ratio: 0.4, reps: 8 },
      { ratio: 0.6, reps: 5 },
      { ratio: 0.8, reps: 2 },
    ]);
    expect(Object.isFrozen(WARMUP_STEPS)).toBe(true);
  });
});

describe('cibles avant snap (critère 1)', () => {
  it('100 kg : 40 kg × 8, 60 kg × 5, 80 kg × 2', () => {
    expect(warmupTargets(100)).toEqual([
      { loadKg: 40, reps: 8 },
      { loadKg: 60, reps: 5 },
      { loadKg: 80, reps: 2 },
    ]);
  });

  it('charges au centième, sans bruit de virgule flottante : 62,5 kg → 25, 37,5, 50', () => {
    expect(warmupTargets(62.5).map((s) => s.loadKg)).toEqual([25, 37.5, 50]);
    expect(warmupTargets(33.3).map((s) => s.loadKg)).toEqual([13.32, 19.98, 26.64]);
  });

  it('répétitions arrondies en dessous (D-72 point 11), au moins 1 ; étape sans répétition retirée', () => {
    const steps: readonly WarmupStep[] = [
      { ratio: 0.5, reps: 7.9 },
      { ratio: 0.7, reps: 0.4 },
      { ratio: 0.9, reps: 1 },
    ];
    expect(warmupTargets(100, steps)).toEqual([
      { loadKg: 50, reps: 7 },
      { loadKg: 90, reps: 1 },
    ]);
  });

  it('charge de travail nulle, négative, absente ou non finie : aucune rampe', () => {
    for (const kg of [0, -10, Number.NaN, Number.POSITIVE_INFINITY]) expect(warmupTargets(kg)).toEqual([]);
  });
});

describe('snap au matériel (critère 3)', () => {
  it('barre olympique d’Antony (pas de 2,5 kg) : 100 kg → 40 × 8, 60 × 5, 80 × 2 exacts', () => {
    expect(warmupRamp(100, grid(BENCH.equipment))).toEqual([
      { loadKg: 40, reps: 8 },
      { loadKg: 60, reps: 5 },
      { loadKg: 80, reps: 2 },
    ]);
  });

  it('cible indisponible : charge disponible juste en dessous, sans répétition ajoutée (62,5 kg → 25 / 37,5 / 50 ; 67,5 kg → 25 / 40 / 52,5)', () => {
    expect(warmupRamp(62.5, grid(BENCH.equipment))).toEqual([
      { loadKg: 25, reps: 8 },
      { loadKg: 37.5, reps: 5 },
      { loadKg: 50, reps: 2 },
    ]);
    // 27 → 25 ; 40,5 → 40 ; 54 → 52,5 : écart de 8 % sur la première, toujours 8 répétitions (la règle +1 rep ne vaut que pour le travail).
    expect(warmupRamp(67.5, grid(BENCH.equipment))).toEqual([
      { loadKg: 25, reps: 8 },
      { loadKg: 40, reps: 5 },
      { loadKg: 52.5, reps: 2 },
    ]);
  });

  it('barre hexagonale d’Antony (18 kg, pas de 2,5) : 100 kg → 38 / 58 / 78', () => {
    expect(warmupRamp(100, grid(DEADLIFT_TRAP.equipment))?.map((s) => s.loadKg)).toEqual([38, 58, 78]);
  });

  it('haltères d’Antony avec la paire de 9 kg : 24 kg → 9 / 14 / 18 ; sans la paire : 8 / 14 / 18', () => {
    expect(warmupRamp(24, grid(BENCH_DB.equipment, DUMBBELLS_WITH_9))).toEqual([
      { loadKg: 9, reps: 8 },
      { loadKg: 14, reps: 5 },
      { loadKg: 18, reps: 2 },
    ]);
    expect(warmupRamp(24, grid(BENCH_DB.equipment))?.map((s) => s.loadKg)).toEqual([8, 14, 18]);
  });

  it('pile de 5 kg (10 à 100 kg) : 70 kg → 25 / 40 / 55', () => {
    expect(warmupRamp(70, grid(LEG_PRESS.equipment, STACK_5))?.map((s) => s.loadKg)).toEqual([25, 40, 55]);
  });

  it('sous le minimum du matériel : le minimum (barre à vide), une seule fois ; jamais à la charge de travail ni au-dessus', () => {
    // 40 kg : 16 → 20 (barre), 24 → 22,5, 32 → 30.
    expect(warmupRamp(40, grid(BENCH.equipment))).toEqual([
      { loadKg: 20, reps: 8 },
      { loadKg: 22.5, reps: 5 },
      { loadKg: 30, reps: 2 },
    ]);
    // 25 kg : 10 → 20, 15 → 20 (doublon retiré, la première étape reste), 20 → 20 (doublon).
    expect(warmupRamp(25, grid(BENCH.equipment))).toEqual([{ loadKg: 20, reps: 8 }]);
    // 20 kg : la barre à vide EST la charge de travail : aucune rampe.
    expect(warmupRamp(20, grid(BENCH.equipment))).toEqual([]);
    expect(warmupRamp(2, grid(CURL.equipment))).toEqual([]);
  });

  it('au-delà du maximum du matériel (charge saisie à la main) : jamais au-dessus du maximum', () => {
    // SMALL_PLATES : 20 à 40 kg par pas de 10. 100 kg → 40 / 40 / 40 → une étape, 40 × 8.
    expect(grid(BENCH.equipment, SMALL_PLATES)).toEqual([20, 30, 40]);
    expect(warmupRamp(100, grid(BENCH.equipment, SMALL_PLATES))).toEqual([{ loadKg: 40, reps: 8 }]);
    expect(warmupRamp(60, grid(BENCH.equipment, SMALL_PLATES))).toEqual([
      { loadKg: 20, reps: 8 },
      { loadKg: 30, reps: 5 },
      { loadKg: 40, reps: 2 },
    ]);
  });

  it('aucune grille connue (machine ou poulie « à vérifier », kettlebells sans pas, aucun profil) : aucune rampe, aucune charge inventée', () => {
    expect(warmupRamp(100, null)).toEqual([]);
    expect(warmupRamp(100, [])).toEqual([]);
    expect(warmupForExercise(LEG_PRESS, 100, FITNESS_PARK_ANTONY)).toEqual([]);
    expect(warmupForExercise({ id: 'lat-pulldown', metric: 'load-reps', equipment: ['high-pulley'] }, 60, FITNESS_PARK_ANTONY)).toEqual([]);
    expect(warmupForExercise(SWING, 24, FITNESS_PARK_ANTONY)).toEqual([]);
    expect(warmupForExercise(BENCH, 100, null)).toEqual([]);
  });

  it('exercice hors charge × répétitions (poids du corps, chrono) : aucune rampe', () => {
    expect(warmupForExercise(PUSH_UP, 100, FITNESS_PARK_ANTONY)).toEqual([]);
    expect(warmupForExercise({ id: 'plank', metric: 'time', equipment: [] }, 60, FITNESS_PARK_ANTONY)).toEqual([]);
  });

  it('warmupForExercise prend la grille du matériel de l’exercice (barre olympique d’Antony)', () => {
    expect(warmupForExercise(BENCH, 100, FITNESS_PARK_ANTONY)).toEqual(warmupRamp(100, grid(BENCH.equipment)));
    expect(warmupForExercise(BENCH_DB, 24, DUMBBELLS_WITH_9).map((s) => s.loadKg)).toEqual([9, 14, 18]);
  });
});

describe('propriétés (déterminisme, bornes, monotonie)', () => {
  const grids = fc
    .record({ min: fc.integer({ min: 1, max: 40 }), step: fc.constantFrom(0.5, 1, 1.25, 2, 2.5, 5), n: fc.integer({ min: 1, max: 80 }) })
    .map(({ min, step, n }) => Array.from({ length: n }, (_, i) => Math.round((min + i * step) * 100) / 100));

  it('chaque charge de rampe est disponible, strictement sous la charge de travail, strictement croissante ; au plus 3 séries ; même entrée, même sortie', () => {
    fc.assert(
      fc.property(grids, fc.double({ min: 0.5, max: 400, noNaN: true }), (loads, work) => {
        const ramp = warmupRamp(work, loads);
        expect(warmupRamp(work, loads)).toEqual(ramp);
        expect(ramp.length).toBeLessThanOrEqual(WARMUP_STEPS.length);
        for (const [i, s] of ramp.entries()) {
          expect(loads).toContain(s.loadKg);
          expect(s.loadKg).toBeLessThan(work);
          expect(Number.isInteger(s.reps) && s.reps >= 1).toBe(true);
          if (i > 0) expect(s.loadKg).toBeGreaterThan(ramp[i - 1]?.loadKg ?? 0);
        }
      }),
    );
  });

  it('entrée non modifiée', () => {
    const loads = Object.freeze([20, 22.5, 25, 40, 60, 80]);
    const steps = Object.freeze(WARMUP_STEPS.map((s) => Object.freeze({ ...s })));
    expect(() => warmupRamp(100, loads, steps)).not.toThrow();
    expect(loads).toEqual([20, 22.5, 25, 40, 60, 80]);
  });
});

describe('premier exercice composé de chaque pattern (critères 2 et 5)', () => {
  const ex = (exerciseId: string, pattern: string, kind: 'compound' | 'isolation' = 'compound', metric = 'load-reps') => ({ exerciseId, exercise: { pattern, kind, metric } as never });

  it('une rampe par pattern, au premier composé chargé dans l’ordre de la séance ; les suivants du même pattern n’en ont pas', () => {
    const ids = warmupExerciseIds([
      ex('curl-dumbbell', 'isolation', 'isolation'),
      ex('bench-press-barbell', 'push-horizontal'),
      ex('row-barbell', 'pull-horizontal'),
      ex('bench-press-dumbbell', 'push-horizontal'),
      ex('squat-barbell', 'squat'),
      ex('leg-press', 'squat'),
    ]);
    expect([...ids]).toEqual(['bench-press-barbell', 'row-barbell', 'squat-barbell']);
  });

  it('isolation, poids du corps, chrono et exercice inconnu : jamais désignés, et ne prennent pas la place du premier composé chargé', () => {
    const ids = warmupExerciseIds([
      ex('push-up', 'push-horizontal', 'compound', 'bodyweight-reps'),
      ex('plank', 'core', 'compound', 'time'),
      { exerciseId: 'inconnu', exercise: undefined },
      ex('bench-press-barbell', 'push-horizontal'),
      ex('leg-extension', 'squat', 'isolation'),
    ]);
    expect([...ids]).toEqual(['bench-press-barbell']);
  });

  it('déterministe : même ordre, même résultat ; ordre changé, premier changé', () => {
    const list = [ex('a', 'hinge'), ex('b', 'hinge'), ex('c', 'squat')];
    expect([...warmupExerciseIds(list)]).toEqual([...warmupExerciseIds(list)]);
    expect([...warmupExerciseIds([list[1], list[0], list[2]] as typeof list)]).toEqual(['b', 'c']);
    expect([...warmupExerciseIds([])]).toEqual([]);
  });
});

describe('rampes hors statistiques du moteur (critère 4)', () => {
  const ramp = [set(40, 8, { setKind: 'warmup', position: 0 }), set(60, 5, { setKind: 'warmup', position: 1 }), set(80, 2, { setKind: 'warmup', position: 2 })];
  const withRamp = (s: ReturnType<typeof session>, done = true) => ({ ...s, sets: [...ramp.map((r) => ({ ...r, done })), ...s.sets.map((w, i) => ({ ...w, position: i + 3 }))] });

  it('rampes validées : 1RM et prescription identiques à la même séance sans rampe', () => {
    const plain = [session(3, 100, [10, 10, 10]), session(6, 97.5, [10, 9, 9])];
    const ramped = plain.map((s) => withRamp(s));
    const view = (h: typeof plain) => analyzeHistory(h, input().config).estimates.map((e) => [e.e1rmKg, e.quality, e.validSets, e.sets.map((s) => [s.setKind, s.loadKg, s.reps])]);
    expect(view(ramped)).toEqual(view(plain));
    expect(view(ramped).flatMap((e) => e[3] as unknown[][]).every((s) => s[0] === 'work')).toBe(true);
    const a = prescribe(input({ history: plain, target: target(8, 10) }));
    const b = prescribe(input({ history: ramped, target: target(8, 10) }));
    expect(b.loadKg).toBe(a.loadKg);
    expect(b.sets).toEqual(a.sets);
    expect(b.reasons).toEqual(a.reasons);
  });

  it('rampes ignorées (non validées) : la séance n’est pas « partielle »', () => {
    const p = prescribe(input({ history: [withRamp(session(3, 100, [10, 10, 10]), false)] }));
    expect(p.reasons).not.toContain('partial-session-ignored');
    expect(p.loadKg).toBe(102.5);
  });
});
