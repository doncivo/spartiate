import { describe, expect, it } from 'vitest';
import { CURL, daysAgo, input, session, target } from '../../../tests/fixtures/training/progression';
import { DEFAULT_PROGRESSION_CONFIG as CFG, RECOVERY_SPLIT_CONFIG, REASON_ORDER } from './config';
import { constraintAlerts, explainPrescription, explanationNotes } from './explain';
import { prescribe } from './prescribe';
import { isRedDay, redDaySnapshot } from './redDay';
import { musclesToSpare, recoverySplit, sessionPrimaryMuscles } from './recoverySplit';

/**
 * I5-02 point 2.2 (§ 16.4, § 16.7 « Récupération en séance », § 11.3) : journée rouge au lancement d'une séance (Recovery ≤ 33, constante
 * `lowRecovery`), choix d'Ali ACCEPTER / IGNORER, jamais imposé ; Recovery nulle ou absente : aucune offre. Accepté : le signal réel
 * (Recovery du jour) alimente la contrainte existante (maintien ou réduction, jamais une hausse), dite dans la phrase. Recovery Split :
 * pourcentage par muscle principal de la séance ; muscle sans ligne = inconnu (jamais 0 ni 100 %).
 */

const ISO_CURL = { ...CURL, kind: 'isolation' as const };

describe('journée rouge : offre au lancement', () => {
  it('Recovery ≤ 33 (constante `lowRecovery`) : offre ; au-delà, nulle, absente ou non finie : jamais', () => {
    expect(CFG.lowRecovery).toBe(33);
    expect(isRedDay(33, CFG)).toBe(true);
    expect(isRedDay(0, CFG)).toBe(true);
    expect(isRedDay(33.4, CFG)).toBe(false);
    expect(isRedDay(34, CFG)).toBe(false);
    expect(isRedDay(100, CFG)).toBe(false);
    expect(isRedDay(null, CFG)).toBe(false);
    expect(isRedDay(undefined, CFG)).toBe(false);
    expect(isRedDay(Number.NaN, CFG)).toBe(false);
    expect(isRedDay(-1, CFG)).toBe(false);
  });

  it('snapshot du moteur seulement si Ali a ACCEPTÉ une journée rouge ; ignoré ou sans choix : aucun', () => {
    expect(redDaySnapshot(20, 'accepted', CFG)).toEqual({ recovery: 20, sleepHours: null, restingHrDelta: null, redDay: true });
    expect(redDaySnapshot(20, 'ignored', CFG)).toBeNull();
    expect(redDaySnapshot(20, null, CFG)).toBeNull();
    expect(redDaySnapshot(null, 'accepted', CFG)).toBeNull();
    expect(redDaySnapshot(50, 'accepted', CFG)).toBeNull();
  });
});

describe('journée rouge acceptée : prescription', () => {
  const top = [session(3, 100, [10, 10, 10])];

  it('haut de plage atteint : aucune hausse ; contrainte existante (× 0,95), dite « journée rouge » avec l’écart appliqué', () => {
    const normal = prescribe(input({ history: top }));
    expect(normal.loadKg).toBe(102.5);
    const p = prescribe(input({ history: top, recovery: redDaySnapshot(20, 'accepted', CFG) }));
    expect(p.loadKg).toBe(95);
    expect(p.headline).toBe('recovery-low');
    expect(p.reasons).toContain('recovery-low');
    expect(p.reasons).toContain('recovery-red-day');
    expect(explainPrescription(p)).toEqual({ key: 'redDay', params: { delta: 5, cut: 5 } });
    expect(explanationNotes(p)).toEqual([]);
    expect(constraintAlerts(p)).toEqual([]);
  });

  it('ignorée : prescription strictement inchangée', () => {
    const none = prescribe(input({ history: top }));
    expect(prescribe(input({ history: top, recovery: redDaySnapshot(20, 'ignored', CFG) }))).toEqual(none);
    expect(prescribe(input({ history: top, recovery: redDaySnapshot(null, 'accepted', CFG) }))).toEqual(none);
  });

  it('réduction arrondie à la référence : « charges maintenues »', () => {
    const p = prescribe(input({ history: top, recovery: redDaySnapshot(20, 'accepted', CFG), config: { ...CFG, lowRecoveryLoad: 1 } }));
    expect(p.loadKg).toBe(100);
    expect(explainPrescription(p)).toEqual({ key: 'redDayHeld', params: {} });
  });

  it('exercice d’isolation : une série de moins, dite en note', () => {
    const p = prescribe(input({ exercise: ISO_CURL, history: [session(3, 40, [10, 10, 10])], target: target(8, 12), recovery: redDaySnapshot(10, 'accepted', CFG) }));
    expect(p.sets).toHaveLength(2);
    expect(p.loadKg).toBe(38);
    expect(explainPrescription(p)).toEqual({ key: 'redDay', params: { delta: 2, cut: 5 } });
    expect(explanationNotes(p)).toEqual([{ key: 'noteRedDaySet', params: {} }]);
  });

  it('deload en raison principale : la journée rouge est une alerte', () => {
    const p = prescribe(input({ history: [session(3, 100, [8, 8, 8, 8])], target: target(8, 10, 4), recovery: redDaySnapshot(20, 'accepted', CFG), deload: true }));
    expect(p.headline).toBe('deload');
    expect(constraintAlerts(p)).toEqual([{ key: 'alertRedDay', params: {} }]);
  });

  it('jamais au-dessus de la référence ; raison rangée dans l’ordre normatif', () => {
    for (const load of [20, 47.5, 60, 100, 142.5]) {
      for (const reps of [[8, 8, 8], [10, 10, 10], [6, 5, 5]]) {
        const p = prescribe(input({ history: [session(3, load, reps)], recovery: redDaySnapshot(33, 'accepted', CFG) }));
        expect(p.loadKg ?? 0).toBeLessThanOrEqual(load);
        const ranks = p.reasons.map((r) => REASON_ORDER.indexOf(r));
        expect(ranks.every((r) => r >= 0)).toBe(true);
        expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
      }
    }
  });

  it('Recovery basse sans journée rouge (snapshot alimenté à la main) : textes d’avant, aucune raison « journée rouge »', () => {
    const p = prescribe(input({ history: top, recovery: { recovery: 0, sleepHours: null, restingHrDelta: null } }));
    expect(p.reasons).not.toContain('recovery-red-day');
    expect(explainPrescription(p)).toEqual({ key: 'recoveryLow', params: { cut: 5 } });
  });

  it('décision d’Ali : jamais modulée', () => {
    const decided = { decidedAt: daysAgo(1), accepted: false, loadKg: 110, reps: [8, 8, 8] };
    const p = prescribe(input({ history: top, lastDecision: decided, recovery: redDaySnapshot(20, 'accepted', CFG) }));
    expect(p.loadKg).toBe(110);
    expect(p.reasons).not.toContain('recovery-red-day');
  });
});

describe('Recovery Split (§ 16.3 par muscle, § 16.1 niveau A)', () => {
  it('muscles principaux de la séance : premier muscle de poids maximal de chaque exercice, sans doublon, dans l’ordre', () => {
    expect(
      sessionPrimaryMuscles([
        { muscles: [{ id: 'chest', weight: 1 }, { id: 'triceps', weight: 0.5 }] },
        { muscles: [{ id: 'triceps', weight: 0.4 }, { id: 'front-delts', weight: 0.8 }] },
        { muscles: [{ id: 'chest', weight: 1 }] },
        { muscles: [] },
      ]),
    ).toEqual(['chest', 'front-delts']);
  });

  it('pourcentage et repère ; muscle sans ligne ou valeur illisible : inconnu, jamais 0 ni 100 %', () => {
    expect(RECOVERY_SPLIT_CONFIG.spareBelowPercent).toBe(50);
    const split = recoverySplit(['chest', 'quads', 'lats', 'biceps', 'calves', 'abs'], [
      { muscleId: 'chest', percent: 49 },
      { muscleId: 'quads', percent: 50 },
      { muscleId: 'lats', percent: 100 },
      { muscleId: 'biceps', percent: Number.NaN },
      { muscleId: 'calves', percent: 120 },
      { muscleId: 'glutes', percent: 10 },
    ]);
    expect(split).toEqual([
      { muscleId: 'chest', percent: 49, readiness: 'spare' },
      { muscleId: 'quads', percent: 50, readiness: 'ready' },
      { muscleId: 'lats', percent: 100, readiness: 'ready' },
      { muscleId: 'biceps', percent: null, readiness: 'unknown' },
      { muscleId: 'calves', percent: null, readiness: 'unknown' },
      { muscleId: 'abs', percent: null, readiness: 'unknown' },
    ]);
    expect(musclesToSpare(split)).toEqual(['chest']);
    expect(musclesToSpare(recoverySplit(['abs'], []))).toEqual([]);
  });

  it('0 % mesuré reste 0 % (à ménager) : seule l’absence de ligne est inconnue', () => {
    expect(recoverySplit(['chest'], [{ muscleId: 'chest', percent: 0 }])).toEqual([{ muscleId: 'chest', percent: 0, readiness: 'spare' }]);
  });
});
