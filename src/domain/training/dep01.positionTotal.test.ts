import { describe, expect, it } from 'vitest';
import { daysAgo, input, set, target } from '../../../tests/fixtures/training/progression';
import { prescribe } from './prescribe';
import type { ExerciseSession, ProgressionExercise } from './types';

/**
 * DEP-01 (0.9.4, décision d'Ali) : la décote de position (2ᵉ exercice −7 %, 3ᵉ −12 %) se calcule sur la charge TOTALE pour les exercices lestés
 * (poids de corps × fraction compris), comme le 1RM ; le lest affiché est ensuite déduit de cette charge totale. Assistance : même principe,
 * la charge totale baisse donc l'assistance monte. Sans pesée connue : décote sur la charge affichée, comme avant.
 */
const exercise = (id: string, fraction: number, over: Partial<ProgressionExercise> = {}): ProgressionExercise => ({ id, metric: 'load-reps', equipment: ['pull-up-bar', 'loading-belt'], kind: 'compound', bodyweightFraction: fraction, ...over } as ProgressionExercise);
const sessionOf = (loadKg: number, reps: readonly number[]): ExerciseSession => ({ workoutId: `w-pt-${String(loadKg)}`, endedAt: daysAgo(3), difficulty: null, sets: reps.map((r, position) => set(loadKg, r, { position })) });
const run = (ex: ProgressionExercise, loadKg: number, bodyweightKg: number | null, rank: number, lastRank = 1) =>
  prescribe(input({ exercise: ex, history: [sessionOf(loadKg, [8, 8, 8])], bodyweightKg, target: target(6, 10), positionRank: rank, lastPositionRank: lastRank }));

describe('DEP-01 : décote de position sur la charge totale', () => {
  it('traction lestée, 80 kg de corps, 20 kg de lest : 2ᵉ position → total 100 × 0,93 = 93, lest ≈ 13 kg (pas 18,6)', () => {
    const first = run(exercise('pull-up-weighted', 1), 20, 80, 1);
    const second = run(exercise('pull-up-weighted', 1), 20, 80, 2);
    const firstTotal = 80 + (first.loadKg ?? 0);
    const secondBallast = second.loadKg ?? 0;
    expect(second.reasons).toContain('position-discount');
    // Total cible = 0,93 × total du rang 1 ; le lest est déduit, arrondi au matériel vers le bas (un cran de tolérance).
    const wanted = firstTotal * 0.93 - 80;
    expect(secondBallast).toBeLessThanOrEqual(wanted + 1e-9);
    expect(secondBallast).toBeGreaterThan(wanted - 2.6);
    expect(secondBallast).toBeLessThan((first.loadKg ?? 0) * 0.93 - 2);
  });

  it('3ᵉ position : −12 % de la charge totale', () => {
    const first = run(exercise('pull-up-weighted', 1), 20, 80, 1);
    const third = run(exercise('pull-up-weighted', 1), 20, 80, 3);
    const wanted = (80 + (first.loadKg ?? 0)) * 0.88 - 80;
    expect(third.loadKg ?? 0).toBeLessThanOrEqual(wanted + 1e-9);
    expect(third.loadKg ?? 0).toBeGreaterThan(wanted - 2.6);
  });

  it('dips (fraction 0,95) : décote sur 85,5 + lest', () => {
    const ex = exercise('dips-weighted', 0.95, { equipment: ['parallel-bars', 'loading-belt'] });
    const first = run(ex, 20, 90, 1);
    const second = run(ex, 20, 90, 2);
    const wanted = (85.5 + (first.loadKg ?? 0)) * 0.93 - 85.5;
    expect(second.loadKg ?? 0).toBeLessThanOrEqual(wanted + 1e-9);
    expect(second.loadKg ?? 0).toBeGreaterThan(wanted - 2.6);
  });

  it('un lest qui ne suffit pas à porter la décote : lest nul, jamais négatif', () => {
    const second = run(exercise('pull-up-weighted', 1), 2.5, 80, 2);
    expect(second.loadKg ?? 0).toBeGreaterThanOrEqual(0);
    expect(second.loadKg ?? 0).toBeLessThan(2.5);
  });

  it('traction assistée : la charge totale baisse, donc l’assistance MONTE', () => {
    const ex = exercise('pull-up-assisted', 1, { assisted: true, equipment: ['assisted-machine'] });
    const first = run(ex, 30, 80, 1);
    const second = run(ex, 30, 80, 2);
    expect(second.loadKg ?? 0).toBeGreaterThan(first.loadKg ?? 0);
    expect(second.reasons).toContain('position-discount');
  });

  it('sans pesée connue : décote sur la charge affichée, comme avant', () => {
    const first = run(exercise('pull-up-weighted', 1), 20, null, 1);
    const second = run(exercise('pull-up-weighted', 1), 20, null, 2);
    expect(second.loadKg ?? 0).toBeLessThan(first.loadKg ?? 0);
    expect(second.loadKg ?? 0).toBeGreaterThan((first.loadKg ?? 0) * 0.93 - 2.6);
  });

  it('exercice sans fraction (barre) : décote sur la charge affichée, inchangée', () => {
    const bar = { id: 'bench-press-barbell', metric: 'load-reps', equipment: ['barbell'], kind: 'compound' } as ProgressionExercise;
    const first = run(bar, 60, 80, 1);
    const second = run(bar, 60, 80, 2);
    expect(second.loadKg ?? 0).toBeLessThan(first.loadKg ?? 0);
  });
});
