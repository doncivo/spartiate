import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULT_PROGRESSION_CONFIG as CFG } from './config';
import { prescribe } from './prescribe';
import { toEmbeddedProfile } from '../../features/training/content';
import type { ExerciseSession, PrescribeInput } from './types';

/**
 * Relecture à froid du moteur I2-01 (PR #60 et #61), cas réels de la salle d'Ali (Fitness Park Antony) avant sa première séance réelle
 * du 9 novembre 2026 : une vraie progression ne doit jamais être écartée pour toujours, une série isolée ne fixe pas la charge des autres,
 * « Facile » au haut de la fourchette ne fait pas moins bien que sans, la confiance n'est jamais NaN, la paire d'haltères de 9 kg existe.
 */

const profiles = JSON.parse(readFileSync(new URL('../../../content/equipment-profiles/profiles.json', import.meta.url), 'utf8')) as { profiles: Parameters<typeof toEmbeddedProfile>[0][] };
const antonyJson = profiles.profiles[0];
if (antonyJson === undefined) throw new Error('profil Antony absent');
const ANTONY = toEmbeddedProfile(antonyJson);
const NOW = '2026-11-09T18:00:00.000Z';
const ago = (days: number): string => new Date(Date.parse(NOW) - days * 86_400_000).toISOString();
let n = 0;
const session = (days: number, load: number | readonly number[], reps: readonly number[], over: Partial<ExerciseSession> = {}): ExerciseSession => ({
  workoutId: `w${String(++n).padStart(3, '0')}`,
  endedAt: ago(days) as ExerciseSession['endedAt'],
  difficulty: null,
  sets: reps.map((r, i) => ({ position: i, setKind: 'work', done: true, reps: r, loadKg: typeof load === 'number' ? load : (load[i] ?? null), rir: null })),
  ...over,
});
const BENCH = { id: 'bench-press-barbell', metric: 'load-reps', equipment: ['barbell', 'flat-bench'] } as PrescribeInput['exercise'];
const DB = { id: 'bench-press-dumbbell', metric: 'load-reps', equipment: ['dumbbell', 'flat-bench'] } as PrescribeInput['exercise'];
const target = (repMin: number, repMax: number, sets = 3): PrescribeInput['target'] => ({ sets, repMin, repMax, rir: null });
const run = (over: Partial<PrescribeInput>) =>
  prescribe({ exercise: BENCH, history: [], lastDecision: null, profile: null, equipment: ANTONY, target: target(6, 10), config: CFG, now: NOW, ...over } as PrescribeInput);

describe('B1 : une vraie progression n’est jamais écartée pour toujours', () => {
  it('calibration 30 kg puis 50 kg : la référence est la dernière séance réellement faite (50 kg)', () => {
    const p = run({ target: target(8, 12), history: [session(10, 30, [10, 10, 10]), session(3, 50, [8, 8, 8])] });
    expect(p.reference?.loadKg).toBe(50);
    expect(p.loadKg).toBe(50);
    expect(p.reasons).toContain('outlier-excluded');
  });
  it('deux séances à 50 kg confirment le saut : le 1RM suit, et la charge progresse au haut de la fourchette', () => {
    const p = run({ target: target(8, 12), history: [session(20, 30, [10, 10, 10]), session(14, 50, [8, 8, 8]), session(10, 50, [9, 9, 9]), session(7, 50, [10, 10, 10]), session(3, 50, [12, 12, 12])] });
    expect(p.estimated1rmKg ?? 0).toBeGreaterThan(60);
    expect(p.loadKg ?? 0).toBeGreaterThanOrEqual(50);
    expect(p.headline).toBe('increase');
  });
});

describe('I1 : une série isolée ne fixe pas la charge des autres', () => {
  it('faute de frappe 60 / 70 / 60 × 10 : la référence est la charge majoritaire, jamais au-delà du plafond', () => {
    const p = run({ history: [session(3, [60, 70, 60], [10, 10, 10])] });
    expect(p.reference?.loadKg).toBe(60);
    expect(p.loadKg ?? 0).toBeLessThanOrEqual(66);
  });
  it('top set 65 × 6 puis 2 × 10 à 60 : référence 60 kg', () => {
    const p = run({ history: [session(3, [65, 60, 60], [6, 10, 10])] });
    expect(p.reference?.loadKg).toBe(60);
  });
});

describe('I2 : « Facile » au haut de la fourchette prend le cran', () => {
  it('haltères 3 × 12 à 22 kg (8–12) + Facile → 24 kg, comme sans « Facile »', () => {
    const p = run({ exercise: DB, target: target(8, 12), history: [session(3, 22, [12, 12, 12], { difficulty: 'easy' })] });
    expect(p.headline).toBe('increase');
    expect(p.loadKg).toBe(24);
    expect(p.recalibration).toBeNull();
  });
});

describe('I3 : la confiance est toujours un nombre', () => {
  it('fin de séance illisible ou instant illisible : confiance finie entre 0 et 1', () => {
    const bad = { ...session(3, 60, [10, 10, 10]), endedAt: 'pas-une-date' as ExerciseSession['endedAt'] };
    for (const p of [run({ history: [bad] }), run({ now: 'x' as PrescribeInput['now'], history: [session(3, 60, [10, 10, 10])] })]) {
      expect(Number.isFinite(p.confidence)).toBe(true);
      expect(p.confidence).toBeGreaterThanOrEqual(0);
      expect(p.confidence).toBeLessThanOrEqual(1);
    }
  });
});

describe('M1 : la paire d’haltères de 9 kg existe', () => {
  // FIX-0173 (D-142) : « Salle complète » n'a plus la paire de 9 kg propre à l'ancienne salle ; un profil qui la déclare (copie, profil personnel) la garde.
  const WITH_9 = { ...ANTONY, inventory: { ...ANTONY.inventory, dumbbells: { minKg: 2, maxKg: 58, stepKg: 2, extraKg: [9] } } };
  it('8 kg × 12 (8–12) → 9 kg avec la paire de 9 kg ; jamais 9 kg sur « Salle complète » (paire absente)', () => {
    const p = run({ exercise: DB, target: target(8, 12), history: [session(3, 8, [12, 12, 12])], equipment: WITH_9 });
    expect(p.loadKg).toBe(9);
    const generic = run({ exercise: DB, target: target(8, 12), history: [session(3, 8, [12, 12, 12])] });
    expect(generic.loadKg).not.toBe(9);
    expect([8, 10]).toContain(generic.loadKg);
  });
});
