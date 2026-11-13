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

describe('journée rouge acceptée : prescription (D-93 révisée par Ali le 12/11, FIX-0181)', () => {
  const top = [session(3, 100, [10, 10, 10])];

  // Décision d'Ali (D-170) : charges × 0,95 (`lowRecoveryLoad`), arrondies au matériel VERS LE BAS, jamais sous la charge minimale ;
  // séries et répétitions de la référence inchangées (aucune répétition ajoutée par l'arrondi, aucune série retirée), aucune hausse.
  it('haut de plage atteint : aucune hausse, 100 kg × 0,95 = 95 kg, dit « charges −5 % »', () => {
    const normal = prescribe(input({ history: top }));
    expect(normal.loadKg).toBe(102.5);
    const p = prescribe(input({ history: top, recovery: redDaySnapshot(20, 'accepted', CFG) }));
    expect(p.loadKg).toBe(95);
    expect(p.sets).toEqual([{ reps: 10, loadKg: 95 }, { reps: 10, loadKg: 95 }, { reps: 10, loadKg: 95 }]);
    expect(p.deltaKg).toBe(-5);
    expect(p.headline).toBe('recovery-low');
    expect(p.reasons).toContain('recovery-low');
    expect(p.reasons).toContain('recovery-red-day');
    expect(p.reasons).not.toContain('snap-extra-rep');
    expect(explainPrescription(p)).toEqual({ key: 'redDay', params: { cut: 5, delta: 5 } });
    expect(explanationNotes(p)).toEqual([]);
    expect(constraintAlerts(p)).toEqual([]);
  });

  it('ignorée : prescription strictement inchangée', () => {
    const none = prescribe(input({ history: top }));
    expect(prescribe(input({ history: top, recovery: redDaySnapshot(20, 'ignored', CFG) }))).toEqual(none);
    expect(prescribe(input({ history: top, recovery: redDaySnapshot(null, 'accepted', CFG) }))).toEqual(none);
  });

  it('le facteur vient de la configuration active (`lowRecoveryLoad`)', () => {
    const p = prescribe(input({ history: top, recovery: redDaySnapshot(20, 'accepted', CFG), config: { ...CFG, lowRecoveryLoad: 0.5 } }));
    expect(p.loadKg).toBe(50);
    expect(explainPrescription(p)).toEqual({ key: 'redDay', params: { cut: 50, delta: 50 } });
  });

  // Vecteurs du moteur : barre olympique (grille de 2,5 kg à partir de 20 kg) et haltères (grille de 2 kg à partir de 2 kg) du profil de test.
  const BAR_VECTORS: readonly (readonly [number, number])[] = [
    [100, 95],
    [142.5, 135], // 135,375 → 135
    [60, 55], // 57 → 55 (57,5 est au-dessus de la cible)
    [47.5, 45], // 45,125 → 45
    [22.5, 20], // 21,375 → 20
    [20, 20], // 19 → sous la barre seule : charge minimale, maintenue
  ];
  it.each(BAR_VECTORS)('barre : %s kg → %s kg, répétitions de la référence, jamais au-dessus', (load, expected) => {
    for (const reps of [[8, 8, 8], [10, 10, 10], [6, 5, 5]]) {
      const p = prescribe(input({ history: [session(3, load, reps)], recovery: redDaySnapshot(33, 'accepted', CFG) }));
      expect(p.loadKg).toBe(expected);
      expect(p.sets.map((s) => s.reps)).toEqual(reps);
      expect(p.sets.every((s) => s.loadKg === expected)).toBe(true);
    }
  });

  const DUMBBELL_VECTORS: readonly (readonly [number, number])[] = [
    [40, 38],
    [10, 8], // 9,5 → 8
    [2, 2], // 1,9 → sous la plus petite paire : charge minimale, maintenue
  ];
  it.each(DUMBBELL_VECTORS)('haltères : %s kg → %s kg', (load, expected) => {
    const p = prescribe(input({ exercise: ISO_CURL, history: [session(3, load, [10, 10, 10])], target: target(8, 12), recovery: redDaySnapshot(10, 'accepted', CFG) }));
    expect(p.loadKg).toBe(expected);
    expect(p.sets).toHaveLength(3);
  });

  it('sans grille connue : demi-kilo inférieur, jamais sous le demi-kilo', () => {
    const noGrid = { equipment: null };
    expect(prescribe(input({ ...noGrid, history: [session(3, 33, [10, 10, 10])], recovery: redDaySnapshot(20, 'accepted', CFG) })).loadKg).toBe(31); // 31,35
    expect(prescribe(input({ ...noGrid, history: [session(3, 0.5, [10, 10, 10])], recovery: redDaySnapshot(20, 'accepted', CFG) })).loadKg).toBe(0.5); // 0,475
  });

  it('charge minimale atteinte : maintenue, dite « maintenue »', () => {
    const p = prescribe(input({ history: [session(3, 20, [10, 10, 10])], recovery: redDaySnapshot(20, 'accepted', CFG) }));
    expect(p.loadKg).toBe(20);
    expect(explainPrescription(p)).toEqual({ key: 'redDayHeld', params: {} });
  });

  it('exercice d’isolation : charges × 0,95, aucune série retirée', () => {
    const p = prescribe(input({ exercise: ISO_CURL, history: [session(3, 40, [10, 10, 10])], target: target(8, 12), recovery: redDaySnapshot(10, 'accepted', CFG) }));
    expect(p.sets).toHaveLength(3);
    expect(p.loadKg).toBe(38);
    expect(p.reasons).not.toContain('recovery-set-removed');
    expect(explainPrescription(p)).toEqual({ key: 'redDay', params: { cut: 5, delta: 2 } });
    expect(explanationNotes(p)).toEqual([]);
  });

  it('exercice assisté : l’assistance n’est jamais réduite (la séance ne devient pas plus dure), maintien dit', () => {
    const assisted = { id: 'pull-up-assisted', metric: 'load-reps', equipment: ['pull-up-bar'], kind: 'compound', assisted: true, bodyweightFraction: 1 } as const;
    for (const bodyweightKg of [80, null]) {
      const p = prescribe(input({ exercise: assisted, bodyweightKg, history: [session(3, 30, [10, 10, 10])], recovery: redDaySnapshot(20, 'accepted', CFG) }));
      expect(p.loadKg).toBe(30);
      expect(explainPrescription(p)).toEqual({ key: 'redDayHeld', params: {} });
    }
  });

  it('deload en raison principale : la journée rouge est une alerte, et réduit encore (× 0,8 × 0,95)', () => {
    const p = prescribe(input({ history: [session(3, 100, [8, 8, 8, 8])], target: target(8, 10, 4), recovery: redDaySnapshot(20, 'accepted', CFG), deload: true }));
    expect(p.headline).toBe('deload');
    expect(p.loadKg).toBe(75); // 76 → 75
    expect(constraintAlerts(p)).toEqual([{ key: 'alertRedDay', params: { cut: 5 } }]);
  });

  it('raisons rangées dans l’ordre normatif', () => {
    for (const [load] of BAR_VECTORS) {
      const p = prescribe(input({ history: [session(3, load, [8, 8, 8])], recovery: redDaySnapshot(33, 'accepted', CFG) }));
      const ranks = p.reasons.map((r) => REASON_ORDER.indexOf(r));
      expect(ranks.every((r) => r >= 0)).toBe(true);
      expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    }
  });

  it('Recovery basse sans journée rouge (snapshot alimenté à la main) : textes d’avant, aucune raison « journée rouge »', () => {
    const p = prescribe(input({ history: top, recovery: { recovery: 0, sleepHours: null, restingHrDelta: null } }));
    expect(p.reasons).not.toContain('recovery-red-day');
    expect(explainPrescription(p)).toEqual({ key: 'recoveryLow', params: { cut: 5 } });
  });

  it('journée rouge acceptée + décote d’inactivité : un seul arrondi, jamais plus haut que sans journée rouge', () => {
    const old = [session(22, 100, [10, 10, 10])];
    const ignored = prescribe(input({ history: old, recovery: redDaySnapshot(20, 'ignored', CFG) }));
    const accepted = prescribe(input({ history: old, recovery: redDaySnapshot(20, 'accepted', CFG) }));
    expect(accepted.loadKg ?? 0).toBeLessThan(ignored.loadKg ?? 0);
    expect(accepted.loadKg).toBe(92.5); // 100 × 0,99 × 0,95 = 94,05 → 92,5
  });

  it('un signal bas sans journée rouge garde × 0,95 et la série retirée sur une isolation', () => {
    const p = prescribe(input({ history: top, recovery: { recovery: 0, sleepHours: null, restingHrDelta: null } }));
    expect(p.loadKg).toBe(95);
    const iso = prescribe(input({ exercise: ISO_CURL, history: [session(3, 40, [10, 10, 10])], target: target(8, 12), recovery: { recovery: 0, sleepHours: null, restingHrDelta: null } }));
    expect(iso.sets).toHaveLength(2);
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
