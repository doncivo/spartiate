import { describe, expect, it } from 'vitest';

import { CURL, KETTLEBELL_GYM, input, session, target } from '../../../tests/fixtures/training/progression';
import { DEFAULT_PROGRESSION_CONFIG as CFG } from './config';
import { inactivityCut } from './constraints';
import { epley } from './estimate1rm';
import { prescribe } from './prescribe';
import type { ExerciseSession, ProgressionEquipment } from './types';

/**
 * SEANCE-0292b (H-1, BL-156) : vecteurs du moteur comparés aux exemples chiffrés publiés par Gravl (« How the Gravl algorithm works »,
 * https://gravl.ai/blog/how-gravl-algorithm-works, lu le 24/11/2026). Chaque test dit « concordant » ou « écart » ; un écart est une
 * différence de règle assumée (PRD § 11, décisions D-), jamais un défaut : il est consigné dans docs/SEANCE-0292b.md, section H-1.
 */
const STEP_25: ProgressionEquipment = { inventory: { ...KETTLEBELL_GYM.inventory, dumbbells: { minKg: 5, maxKg: 60, stepKg: 2.5 } }, increments: { dumbbell: 2.5 } };
const DAY = 86_400_000;
const NOW = Date.parse('2026-11-07T18:00:00.000Z');
const at = (days: number): ExerciseSession['endedAt'] => new Date(NOW - days * DAY).toISOString() as ExerciseSession['endedAt'];
const done = (days: number, kg: number, reps: readonly number[], difficulty: ExerciseSession['difficulty'] = null): ExerciseSession => ({ ...session(days, kg, reps), endedAt: at(days), difficulty });

describe('H-1 : exemples publiés par Gravl', () => {
  it('G1 (écart, formule) : 8 × 100 kg → Gravl ≈ 124 kg (124,2 affiché) ; Spartiate (Epley, § 11.3) ≈ 126,7 kg (+2 %)', () => {
    expect(epley(100, 8)).toBeCloseTo(126.67, 2);
    expect(epley(100, 8) / 124.2 - 1).toBeLessThan(0.025);
  });

  it('G2 (concordant) : échelle de répétitions 8-7-6 → 8-8-6 → 8-8-7 → 8-8-8 à 40 kg, puis un cran (42,5 kg, haltères par 2,5)', () => {
    const t = target(6, 8);
    const history: ExerciseSession[] = [done(28, 40, [8, 7, 6], 'hard')];
    const loads: (number | null)[] = [];
    const reps: number[][] = [];
    for (let i = 1; i <= 4; i += 1) {
      const p = prescribe(input({ exercise: CURL, history, target: t, equipment: STEP_25, now: at(28 - i * 7) }));
      loads.push(p.loadKg);
      reps.push(p.sets.map((s) => s.reps));
      history.push(done(28 - i * 7, p.loadKg ?? 0, p.sets.map((s) => s.reps)));
    }
    expect(reps.slice(0, 3)).toEqual([[8, 8, 6], [8, 8, 7], [8, 8, 8]]);
    expect(loads).toEqual([40, 40, 40, 42.5]);
    // Écart (G2b) : après le cran, Gravl repart à 8-7-6 ; Spartiate repart au bas de la plage sur chaque série (6-6-6).
    expect(reps[3]).toEqual([6, 6, 6]);
  });

  it('G3 (écart, arrondi) : 2ᵉ exercice du muscle, ≈ −7 % ; Gravl 40 → 37,5 kg ; Spartiate 37,2 arrondi VERS LE BAS (35 kg) et une répétition de plus', () => {
    expect(CFG.positionDiscount[1]).toBe(0.93);
    const p = prescribe(input({ exercise: CURL, history: [done(3, 40, [8, 8, 6], 'hard')], target: target(6, 8), equipment: STEP_25, positionRank: 2, lastPositionRank: 1 }));
    expect(p.reasons).toContain('position-discount');
    expect(p.loadKg).toBe(35);
  });

  it('G4 (écart, plancher) : muscle non travaillé plus de 2 semaines, ≈ −1 % par semaine ; Gravl « quelques % au plus », Spartiate −10 % au plus', () => {
    expect(inactivityCut(14, CFG)).toBe(0);
    expect(inactivityCut(21, CFG)).toBeCloseTo(0.01, 6);
    expect(inactivityCut(28, CFG)).toBeCloseTo(0.02, 6);
    expect(inactivityCut(365, CFG)).toBeCloseTo(0.1, 6);
  });

  it('G5 (concordant) : le 1RM estimé ne monte jamais de plus d’environ 10 % par séance', () => {
    expect(CFG.maxGainPerSession).toBe(0.1);
  });
});
