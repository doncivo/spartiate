import { describe, expect, it } from 'vitest';
import { daysAgo, input, set, target } from '../../../tests/fixtures/training/progression';
import { DEFAULT_PROGRESSION_CONFIG } from './config';
import { analyzeHistory, epley } from './estimate1rm';
import { explanationNotes } from './explain';
import { prescribe } from './prescribe';
import type { ExerciseSession, ProgressionExercise } from './types';

/**
 * REV-01 (point 7 du rapport 0.9.2) : pour un exercice au poids du corps lesté ou assisté (`bodyweightFraction`), le 1RM estimé et les
 * écarts de charge se calculent sur la charge TOTALE = poids de corps × fraction, plus le lest (ou moins l'assistance). La charge affichée
 * et saisie reste le lest. Sans pesée connue : comportement d'avant, et la phrase le dit.
 */
const exercise = (id: string, fraction: number | null, over: Partial<ProgressionExercise> = {}): ProgressionExercise => ({ id, metric: 'load-reps', equipment: ['pull-up-bar', 'loading-belt'], kind: 'compound', bodyweightFraction: fraction, ...over } as ProgressionExercise);
const sessionOf = (daysBefore: number, loadKg: number, reps: readonly number[]): ExerciseSession => ({
  workoutId: `w-bw-${String(daysBefore)}-${String(loadKg)}`,
  endedAt: daysAgo(daysBefore),
  difficulty: null,
  sets: reps.map((r, position) => set(loadKg, r, { position })),
});
const run = (ex: ProgressionExercise, history: readonly ExerciseSession[], bodyweightKg: number | null) => prescribe(input({ exercise: ex, history, bodyweightKg, target: target(6, 10) }));

describe('REV-01 : 1RM estimé sur la charge totale', () => {
  it('traction lestée : 80 kg de corps × 1 + 10 kg de lest × 6 → 90 kg × 6, soit 108 kg', () => {
    const p = run(exercise('pull-up-weighted', 1), [sessionOf(3, 10, [6, 6, 6])], 80);
    expect(p.estimated1rmKg).toBeCloseTo(epley(90, 6), 5);
    expect(p.reasons).not.toContain('bodyweight-unknown');
  });

  it('dips (fraction 0,95) : 90 kg de corps → 85,5 + 20 kg de lest × 8', () => {
    const p = run(exercise('dips-weighted', 0.95, { equipment: ['parallel-bars', 'loading-belt'] }), [sessionOf(3, 20, [8, 8, 8])], 90);
    expect(p.estimated1rmKg).toBeCloseTo(epley(85.5 + 20, 8), 5);
  });

  it('pompe lestée (fraction 0,64) : 80 kg de corps → 51,2 + 10 kg de lest × 10', () => {
    const p = run(exercise('push-up-weighted', 0.64, { equipment: ['loading-belt'] }), [sessionOf(3, 10, [10, 10, 10])], 80);
    expect(p.estimated1rmKg).toBeCloseTo(epley(51.2 + 10, 10), 5);
  });

  it('traction assistée : 80 kg de corps − 30 kg d’assistance × 8 → 50 kg × 8', () => {
    const analysis = analyzeHistory([sessionOf(3, 30, [8, 8, 8])], DEFAULT_PROGRESSION_CONFIG, { baseKg: 80, sign: -1 });
    expect(analysis.estimates[0]?.e1rmKg).toBeCloseTo(epley(50, 8), 5);
    // La charge saisie (l'assistance) reste celle des séries.
    expect(analysis.estimates[0]?.sets.every((s) => s.loadKg === 30)).toBe(true);
  });

  it('la charge affichée et saisie reste le lest : la référence et la proposition sont en lest', () => {
    const p = run(exercise('pull-up-weighted', 1), [sessionOf(3, 10, [10, 10, 10])], 80);
    expect(p.reference?.loadKg).toBe(10);
    expect(p.loadKg).toBeLessThan(20);
  });

  it('les écarts de charge se mesurent sur la charge totale : le plafond +10 % du 1RM total laisse monter le lest, pas le 1RM du lest seul', () => {
    const history = [sessionOf(3, 10, [10, 10, 10])];
    const withBody = run(exercise('pull-up-weighted', 1), history, 80);
    expect(withBody.headline).toBe('increase');
    expect(withBody.loadKg).toBeGreaterThan(10);
    const without = run(exercise('pull-up-weighted', 1), history, null);
    expect(without.headline).toBe('extra-rep');
    expect(without.reasons).toContain('gain-capped');
  });

  it('même exercice, du lest nul (poids du corps seul) au lest : 1RM sur la charge totale (dans le catalogue, pull-up et pull-up-weighted restent deux exercices)', () => {
    const history = [sessionOf(7, 0, [12, 12, 12]), sessionOf(3, 10, [8, 8, 8])];
    const p = run(exercise('pull-up-weighted', 1), history, 80);
    // 80 × 1,4 = 112 (corps seul, 12 reps), 90 × (1 + 8/30) = 114 (lestée) ; moyenne pondérée par récence 1 / 0,6.
    expect(p.estimated1rmKg).toBeCloseTo((114 + 0.6 * 112) / 1.6, 4);
    expect(p.reference?.loadKg).toBe(10);
  });

  it('sans pesée connue : comportement actuel (1RM du lest seul) et la phrase le dit', () => {
    const p = run(exercise('pull-up-weighted', 1), [sessionOf(3, 10, [6, 6, 6])], null);
    expect(p.estimated1rmKg).toBeCloseTo(epley(10, 6), 5);
    expect(p.reasons).toContain('bodyweight-unknown');
    expect(explanationNotes(p).map((n) => n.key)).toContain('noteBodyweightUnknown');
  });

  it('un exercice sans fraction (barre, machine) : aucun changement, aucune note', () => {
    const p = run(exercise('bench-press-barbell', null), [sessionOf(3, 60, [8, 8, 8])], 80);
    expect(p.estimated1rmKg).toBeCloseTo(epley(60, 8), 5);
    expect(p.reasons).not.toContain('bodyweight-unknown');
  });
});
