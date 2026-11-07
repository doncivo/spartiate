import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BENCH, CURL, LEG_PRESS, daysAgo, input } from '../../../tests/fixtures/training/progression';
import { DEFAULT_PROGRESSION_CONFIG as CFG } from './config';
import { epley } from './estimate1rm';
import { prescribe } from './prescribe';
import type { Difficulty, ExerciseSession, PrescribeInput, ReasonCode } from './types';

/** Raisons de réduction ou de maintien (I2-02) ; `stall` ne réduit rien (choix seulement). */
const CONSTRAINTS: ReadonlySet<ReasonCode> = new Set(['fatigue-drop', 'inactivity-discount', 'deload', 'recovery-low']);

/** I2-01 (§ 11.2 invariant, § 11.6 propriétés) : déterminisme, plafond, aucune baisse sans contrainte, reps jamais converties en charge. */

const arbSession = (index: number): fc.Arbitrary<ExerciseSession> =>
  fc
    .record({
      days: fc.integer({ min: 0, max: 90 }),
      load: fc.integer({ min: 1, max: 80 }).map((n) => n * 2.5),
      reps: fc.array(fc.integer({ min: 1, max: 20 }), { minLength: 1, maxLength: 4 }),
      rir: fc.option(fc.integer({ min: 0, max: 5 }), { nil: null }),
      difficulty: fc.option(fc.constantFrom<Difficulty>('easy', 'ok', 'hard'), { nil: null }),
    })
    .map(({ days, load, reps, rir, difficulty }) => ({
      workoutId: `w-${String(index)}`,
      endedAt: daysAgo(days),
      difficulty,
      sets: reps.map((r, position) => ({ position, setKind: 'work' as const, done: true, reps: r, loadKg: load, rir })),
    }));

const arbInput: fc.Arbitrary<PrescribeInput> = fc
  .record({
    count: fc.integer({ min: 0, max: 5 }),
    repMin: fc.integer({ min: 3, max: 12 }),
    span: fc.integer({ min: 0, max: 6 }),
    sets: fc.integer({ min: 1, max: 5 }),
    exercise: fc.constantFrom(BENCH, CURL, LEG_PRESS),
  })
  .chain(({ count, repMin, span, sets, exercise }) =>
    fc.tuple(...Array.from({ length: count }, (_, i) => arbSession(i))).map((history) => input({ exercise, history, target: { sets, repMin, repMax: repMin + span, rir: null } })),
  );

describe('propriétés du moteur', () => {
  it('déterminisme : même entrée, même sortie, historique inversé compris', () => {
    fc.assert(
      fc.property(arbInput, (x) => {
        expect(prescribe({ ...x, history: [...x.history].reverse() })).toEqual(prescribe(x));
      }),
    );
  });

  it('plafond : aucune proposition au-delà de +10 % du 1RM (courant ou de la dernière séance)', () => {
    fc.assert(
      fc.property(arbInput, (x) => {
        const p = prescribe(x);
        if (p.status !== 'prescribed' || p.reference === null || p.loadKg === null) return;
        const base = Math.max(p.estimated1rmKg ?? 0, p.reference.e1rmKg);
        const implied = epley(p.loadKg, Math.max(...p.sets.map((s) => s.reps)));
        expect(implied).toBeLessThanOrEqual(base * (1 + CFG.maxGainPerSession) + 1e-6);
      }),
    );
  });

  it('contraintes (I2-02) : jamais de bonus ; charge ≤ référence, séries ≤ cible, choix ≤ proposition ; aucun choix appliqué d’office', () => {
    fc.assert(
      fc.property(arbInput, fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }), fc.boolean(), (x, recovery, deload) => {
        const p = prescribe({ ...x, recovery: recovery === null ? null : { recovery, sleepHours: null, restingHrDelta: null }, deload });
        if (p.reference === null || p.loadKg === null) return;
        if (!p.reasons.some((r) => CONSTRAINTS.has(r))) return;
        expect(p.loadKg).toBeLessThanOrEqual(p.reference.loadKg);
        expect(p.sets.length).toBeLessThanOrEqual(x.target.sets);
        expect(p.sets.length).toBeGreaterThanOrEqual(1);
        for (const o of p.options ?? []) if (o.loadKg !== null) expect(o.loadKg).toBeLessThanOrEqual(p.loadKg);
      }),
    );
  });

  it('sans contrainte (I2-02), la charge ne baisse jamais sous la référence ; l’échelle de reps garde la charge', () => {
    fc.assert(
      fc.property(arbInput, (x) => {
        const p = prescribe(x);
        if (p.reference === null || p.loadKg === null) return;
        if (p.reasons.some((r) => CONSTRAINTS.has(r))) return;
        expect(p.loadKg).toBeGreaterThanOrEqual(p.reference.loadKg);
        if (p.headline === 'rep-ladder' || p.headline === 'hold-hard' || p.headline === 'extra-rep') expect(p.loadKg).toBe(p.reference.loadKg);
        expect(p.sets).toHaveLength(x.target.sets);
        expect(p.confidence).toBeGreaterThanOrEqual(0);
        expect(p.confidence).toBeLessThanOrEqual(1);
      }),
    );
  });
});
