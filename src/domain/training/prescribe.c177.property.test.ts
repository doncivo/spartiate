import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BENCH, CURL, FITNESS_PARK_ANTONY, LEG_PRESS, daysAgo, input } from '../../../tests/fixtures/training/progression';
import { DEFAULT_PROGRESSION_CONFIG as CFG } from './config';
import { epley } from './estimate1rm';
import { prescribe } from './prescribe';
import type { Difficulty, ExerciseSession, PrescribeInput, ProgressionEquipment } from './types';

/**
 * SEANCE-0292 (C-177, § 11.6 « propriétés ») : propriétés du moteur indépendantes de sa sortie. Le plafond se mesure contre le meilleur e1RM
 * BRUT de l'historique (aucune valeur rendue par le moteur, qui pouvait gonfler sa propre base) ; le générateur couvre aussi l'assisté, le
 * lesté avec poids de corps, la décharge, la Recovery et la position.
 */

const WEIGHTED = { id: 'pull-up-weighted', metric: 'load-reps', equipment: ['pull-up-bar', 'loading-belt', 'dumbbell'], kind: 'compound', bodyweightFraction: 1 } as const;
const ASSISTED = { id: 'custom-assisted', metric: 'load-reps', equipment: ['assisted-pull-up-machine'], kind: 'compound', assisted: true } as const;
const GYM: ProgressionEquipment = {
  inventory: {
    ...FITNESS_PARK_ANTONY.inventory,
    available: [...FITNESS_PARK_ANTONY.inventory.available, 'pull-up-bar', 'loading-belt', 'assisted-pull-up-machine'],
    // Presse à pas grossier (20 kg) : les crans dépassent souvent +10 %, le plafond est réellement exercé.
    machines: [{ equipmentId: 'assisted-pull-up-machine', stackMinKg: 5, stackMaxKg: 100, stepKg: 5 }, { equipmentId: 'leg-press-machine', stackMinKg: 20, stackMaxKg: 400, stepKg: 20 }],
  },
  increments: FITNESS_PARK_ANTONY.increments,
};

const arbSession = (index: number): fc.Arbitrary<ExerciseSession> =>
  fc
    .record({
      days: fc.integer({ min: 0, max: 90 }),
      load: fc.integer({ min: 1, max: 80 }).map((n) => n * 2.5),
      reps: fc.array(fc.integer({ min: 1, max: 20 }), { minLength: 1, maxLength: 4 }),
      rir: fc.option(fc.integer({ min: 0, max: 5 }), { nil: null }),
      difficulty: fc.option(fc.constantFrom<Difficulty>('easy', 'ok', 'hard'), { nil: null }),
      deload: fc.boolean(),
    })
    .map(({ days, load, reps, rir, difficulty, deload }) => ({
      workoutId: `w-${String(index)}`,
      endedAt: daysAgo(days),
      difficulty,
      ...(deload ? { deload: true } : {}),
      sets: reps.map((r, position) => ({ position, setKind: 'work' as const, done: true, reps: r, loadKg: load, rir })),
    }));

const arbInput: fc.Arbitrary<PrescribeInput> = fc
  .record({
    count: fc.integer({ min: 0, max: 5 }),
    repMin: fc.integer({ min: 3, max: 12 }),
    span: fc.integer({ min: 0, max: 6 }),
    sets: fc.integer({ min: 1, max: 5 }),
    exercise: fc.constantFrom(BENCH, CURL, LEG_PRESS, WEIGHTED, ASSISTED),
    bodyweightKg: fc.option(fc.integer({ min: 50, max: 120 }), { nil: null }),
    deload: fc.boolean(),
    recovery: fc.option(fc.record({ recovery: fc.integer({ min: 0, max: 100 }), redDay: fc.boolean() }), { nil: null }),
    positionRank: fc.integer({ min: 1, max: 4 }),
    lastPositionRank: fc.integer({ min: 1, max: 4 }),
  })
  .chain(({ count, repMin, span, sets, exercise, bodyweightKg, deload, recovery, positionRank, lastPositionRank }) =>
    fc.tuple(...Array.from({ length: count }, (_, i) => arbSession(i))).map((history) =>
      input({
        exercise,
        history,
        equipment: GYM,
        target: { sets, repMin, repMax: repMin + span, rir: null },
        bodyweightKg,
        deload,
        recovery: recovery === null ? null : { recovery: recovery.recovery, sleepHours: null, restingHrDelta: null, redDay: recovery.redDay },
        positionRank,
        lastPositionRank,
      }),
    ),
  );

/** Charge totale d'une série (corps × fraction + lest ; assisté : corps − assistance) quand le poids de corps est connu, sinon la charge saisie. */
function totalOf(x: PrescribeInput, loadKg: number): number {
  const fraction = x.exercise.bodyweightFraction ?? null;
  const body = x.bodyweightKg ?? null;
  if (fraction === null || !(fraction > 0) || body === null) return loadKg;
  return body * fraction + (x.exercise.assisted === true ? -loadKg : loadKg);
}

describe('C-177 : propriétés indépendantes de la sortie du moteur', () => {
  it('plafond : e1RM implicite de la proposition ≤ meilleur e1RM brut de l’historique × 1,1 (exercices chargés, hors assisté)', () => {
    fc.assert(
      fc.property(arbInput, (x) => {
        const p = prescribe(x);
        if (p.status !== 'prescribed' || p.loadKg === null || x.exercise.assisted === true || p.headline === 'decision') return;
        const raw = Math.max(...x.history.flatMap((s) => s.sets.filter((t) => t.done && t.loadKg !== null && t.reps !== null).map((t) => epley(totalOf(x, t.loadKg as number), t.reps as number))));
        const implied = epley(totalOf(x, p.loadKg), Math.max(...p.sets.map((s) => s.reps)));
        expect(implied).toBeLessThanOrEqual(raw * (1 + CFG.maxGainPerSession) + 1e-6);
      }),
    );
  });

  it('déterminisme, au moins une série, aucune charge négative, sur tout le générateur (assisté, lesté, décharge, Recovery, position)', () => {
    fc.assert(
      fc.property(arbInput, (x) => {
        const p = prescribe(x);
        expect(prescribe({ ...x, history: [...x.history].reverse() })).toEqual(p);
        if (p.status !== 'prescribed') return;
        expect(p.sets.length).toBeGreaterThanOrEqual(1);
        expect(p.sets.length).toBeLessThanOrEqual(x.target.sets);
        for (const s of p.sets) if (s.loadKg !== null) expect(s.loadKg).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it('décharge : jamais plus de séries que la cible, charge jamais au-dessus de la référence (assisté : assistance jamais sous la référence)', () => {
    fc.assert(
      fc.property(arbInput, (x) => {
        const p = prescribe({ ...x, deload: true });
        if (p.status !== 'prescribed' || p.reference === null || p.loadKg === null || !p.deload) return;
        expect(p.sets.length).toBeLessThanOrEqual(x.target.sets);
        if (x.exercise.assisted === true) expect(p.loadKg).toBeGreaterThanOrEqual(p.reference.loadKg);
        else expect(p.loadKg).toBeLessThanOrEqual(p.reference.loadKg);
      }),
    );
  });
});
