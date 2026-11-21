import { describe, expect, it } from 'vitest';
import { BODYWEIGHT_ONLY, DIPS, FITNESS_PARK_ANTONY, PLANK, PUSH_UP, bwSession, daysAgo, input, target, timedSession } from '../../../tests/fixtures/training/progression';
import { DEFAULT_PROGRESSION_CONFIG as CFG } from './config';
import { explainPrescription } from './explain';
import { prescribe } from './prescribe';
import { prescriptionInputOf } from './prescriptionInput';
import { revertProposal } from './revertPrescription';
import type { Exercise } from './types';

/** MOTEUR-0281 passe qa-test : cas limites des trois sous-tickets. Données SYNTHÉTIQUES. */

describe('MOTEUR-0281a qa : cas limites', () => {
  it('pas de secondes : jamais plus de +10 % dès 10 s, jamais au-delà de la cible ou de la meilleure série (propriété sur une grille)', () => {
    for (let base = 10; base <= 180; base += 7) {
      for (const goal of [base - 5, base, base + 9]) {
        const p = prescribe(input({ exercise: PLANK, target: target(goal, goal), history: [timedSession(3, [base, base, base - 3])] }));
        const ref = p.reference?.reps ?? [];
        p.sets.forEach((s, i) => {
          const before = ref[i] ?? 0;
          expect(s.reps - before).toBeLessThanOrEqual(Math.max(1, Math.floor(before * CFG.maxGainPerSession)));
          expect(s.reps).toBeGreaterThanOrEqual(before);
        });
        const changed = p.sets.filter((s, i) => s.reps !== ref[i]).length;
        expect(changed === 1 || changed === p.sets.length).toBe(true);
      }
    }
  });

  it('lest porté, ceinture et haltères devenus indisponibles : lest maintenu, aucune proposition de lest, répétition de plus', () => {
    const p = prescribe(input({ exercise: DIPS, equipment: BODYWEIGHT_ONLY, target: target(8, 12), history: [bwSession(3, 10, [12, 12, 12])] }));
    expect(p.loadKg).toBe(10);
    expect(p.reasons).toContain('ballast-unavailable');
    expect(p.sets.map((s) => s.reps)).toEqual([13, 12, 12]);
  });

  it('chronométré lesté : le lest est gardé, les secondes progressent', () => {
    const s = timedSession(3, [30, 30, 30]);
    const p = prescribe(input({ exercise: PLANK, target: target(30, 30), history: [{ ...s, sets: s.sets.map((x) => ({ ...x, loadKg: 10 })) }] }));
    expect(p.loadKg).toBe(10);
    expect(p.sets.map((x) => x.reps)).toEqual([33, 33, 33]);
  });

  it('séries de travail incomplètes (2 faites sur 3 prévues) au haut de plage : pas de lest, échelle sur la série manquante', () => {
    const p = prescribe(input({ exercise: PUSH_UP, target: target(8, 12), history: [bwSession(3, null, [12, 12])] }));
    expect(p.headline).toBe('rep-ladder');
    expect(p.loadKg).toBe(0);
    expect(p.sets.map((s) => s.reps)).toEqual([12, 12, 9]);
  });

  it('lest négatif ou répétitions non entières : série inéligible (séance ignorée si moins de la moitié reste)', () => {
    const s = bwSession(3, null, [12, 12, 12]);
    const p = prescribe(input({ exercise: PUSH_UP, target: target(8, 12), history: [bwSession(6, null, [10, 10, 10]), { ...s, sets: s.sets.map((x, i) => ({ ...x, loadKg: i < 2 ? -5 : null })) }] }));
    expect(p.reasons).toContain('partial-session-ignored');
    expect(p.sets.map((x) => x.reps)).toEqual([11, 10, 10]);
  });

  it('entrée de la séance : un exercice du catalogue au poids du corps arrive au moteur en `bodyweight-reps`, assisté hors moteur', () => {
    const pushUp = { id: 'push-up', metric: 'bodyweight-reps', equipment: ['bodyweight'], kind: 'compound', bodyweightFraction: null } as unknown as Exercise;
    const args = { exerciseId: 'push-up', exercise: pushUp, context: { history: [bwSession(3, null, [10, 10, 10])], reference: null, profile: null, lastPositionRank: null, bodyweightKg: null }, equipment: FITNESS_PARK_ANTONY, target: target(8, 15), now: daysAgo(0), recovery: null, deload: false, positionRank: 1 } as const;
    expect(prescribe(prescriptionInputOf(args)).metric).toBe('bodyweight-reps');
    const assisted = { ...pushUp, id: 'pull-up-assisted', equipment: ['assisted-pull-up-machine', 'pull-up-bar'] } as unknown as Exercise;
    expect(prescribe(prescriptionInputOf({ ...args, exerciseId: 'pull-up-assisted', exercise: assisted })).status).toBe('unsupported');
  });
});

describe('MOTEUR-0281b qa : cas limites', () => {
  it('décision de retour transmise au moteur par l’entrée partagée (séance et carte du jour)', () => {
    const exercise = { id: 'bench-press-barbell', metric: 'load-reps', equipment: ['barbell'], kind: 'compound', bodyweightFraction: null } as unknown as Exercise;
    const reference = { decidedAt: daysAgo(1), accepted: false, loadKg: 60, reps: [10, 10, 10], revert: true };
    const i = prescriptionInputOf({ exerciseId: exercise.id, exercise, context: { history: [], reference, profile: null, lastPositionRank: null, bodyweightKg: null }, equipment: FITNESS_PARK_ANTONY, target: target(8, 10), now: daysAgo(0), recovery: null, deload: false, positionRank: 1 });
    expect(i.lastDecision?.revert).toBe(true);
    expect(explainPrescription(prescribe(i)).key).toBe('revert');
  });

  it('dates égales : ordre stable, aucune exception ; décisions d’autres valeurs que des nombres finis ignorées par le repository (amont)', () => {
    const d = (id: string, loadKg: number) => ({ workoutId: id, decidedAt: daysAgo(2), loadKg, reps: [8], revert: false });
    expect(() => revertProposal([d('a', 60), d('b', 62.5)], { metric: 'load-reps', assisted: false })).not.toThrow();
  });

  it('décision sans séance (workoutId nul) : comptée une fois, dans l’ordre des dates', () => {
    const steps = [
      { workoutId: null, decidedAt: daysAgo(9), loadKg: 50, reps: [10], revert: false },
      { workoutId: null, decidedAt: daysAgo(5), loadKg: 55, reps: [8], revert: false },
    ];
    expect(revertProposal(steps, { metric: 'load-reps', assisted: false })).toMatchObject({ kind: 'available', target: { loadKg: 50 } });
  });
});

describe('MOTEUR-0281a × SESS-01d qa : « Fatigué » déclaré', () => {
  it('poids du corps au haut de plage : le lest prévu n’est pas ajouté, phrase sans « 0 kg »', async () => {
    const { holdForDeclaredFatigue } = await import('./declaredFatigue');
    const p = prescribe(input({ exercise: PUSH_UP, target: target(8, 12), history: [bwSession(3, null, [12, 12, 12])] }));
    expect(p.headline).toBe('ballast-add');
    const held = holdForDeclaredFatigue(p, 'tired', { assisted: false, loads: null });
    expect(held.loadKg).toBe(0);
    expect(held.sets.map((s) => s.reps)).toEqual([12, 12, 12]);
    expect(explainPrescription(held)).toEqual({ key: 'declaredFatigueNoLoad', params: {} });
  });
});

describe('MOTEUR-0281a qa : matériel de lest utilisable', () => {
  it('même règle que usableEquipment (disponible, forcé, interdit) pour la ceinture, les haltères et les kettlebells', async () => {
    const { usableEquipment } = await import('./equipment');
    const { ballastLoads } = await import('./prescribe');
    const base = FITNESS_PARK_ANTONY.inventory;
    const cases = [
      { ...base, available: ['loading-belt'], toVerify: [] },
      { ...base, available: [], forced: ['dumbbell'] },
      { ...base, available: ['dumbbell', 'loading-belt'], forbidden: ['loading-belt'] },
      { ...base, available: ['loading-belt', 'kettlebell'], forbidden: ['dumbbell'], toVerify: [] },
    ];
    for (const inventory of cases) {
      const usable = usableEquipment({ inventory });
      const loads = ballastLoads({ inventory, increments: FITNESS_PARK_ANTONY.increments });
      expect(loads.length > 0).toBe(usable.has('loading-belt') || usable.has('dumbbell'));
      if (!usable.has('dumbbell') && !usable.has('loading-belt')) expect(loads).toEqual([]);
    }
  });
});
