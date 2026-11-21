import { describe, expect, it } from 'vitest';
import { PUSH_UP, bwSession, daysAgo, input, session } from '../../../tests/fixtures/training/progression';
import { ENGINE_VERSION } from './config';
import { explainPrescription } from './explain';
import { prescribe } from './prescribe';
import { isHarder, isRevertPrescription, revertDecisionPrescription, revertProposal, type DecisionStep } from './revertPrescription';

/** MOTEUR-0281b (PRD § 11.5 « retour à une prescription antérieure », C-189). Données SYNTHÉTIQUES. */

const LOAD = { metric: 'load-reps', assisted: false } as const;
const step = (days: number, loadKg: number | null, reps: readonly number[], over: Partial<DecisionStep> = {}): DecisionStep => ({ workoutId: `w-${String(days)}`, decidedAt: daysAgo(days), loadKg, reps, revert: false, ...over });

describe('MOTEUR-0281b : proposition de retour', () => {
  it('B1 60 kg puis 62,5 kg (hausse) : retour à 60 kg × 10 · 10 · 10, date de la décision reprise', () => {
    expect(revertProposal([step(9, 60, [10, 10, 10]), step(5, 62.5, [8, 8, 8])], LOAD)).toEqual({ kind: 'available', target: { loadKg: 60, reps: [10, 10, 10], decidedAt: daysAgo(9) } });
  });

  it('B1 dernière hausse : la plus récente, même suivie de maintiens ; une valeur par séance (la dernière décision de la séance)', () => {
    const decisions = [step(20, 55, [10, 10, 10]), step(15, 57.5, [8, 8, 8]), step(10, 57.5, [10, 10, 10]), step(6, 60, [8, 8, 8]), step(3, 60, [9, 9, 8])];
    expect(revertProposal(decisions, LOAD)).toMatchObject({ kind: 'available', target: { loadKg: 57.5, reps: [10, 10, 10] } });
    const changedMind = [step(9, 60, [10, 10, 10]), step(5, 65, [8, 8, 8]), { ...step(5, 62.5, [8, 8, 8]), decidedAt: daysAgo(4.9) }];
    expect(revertProposal(changedMind, LOAD)).toMatchObject({ target: { loadKg: 60 } });
  });

  it('B4 aucune hausse, aucune décision ou seulement des refus : rien à proposer', () => {
    expect(revertProposal([], LOAD)).toEqual({ kind: 'none' });
    expect(revertProposal([step(9, 60, [10, 10, 10]), step(5, 57.5, [10, 10, 10])], LOAD)).toEqual({ kind: 'none' });
    expect(revertProposal([step(9, null, []), step(5, null, [])], LOAD)).toEqual({ kind: 'none' });
  });

  it('B4 retour déjà fait (ou séance refaite à ces valeurs) : pas reproposé', () => {
    const base = [step(9, 60, [10, 10, 10]), step(5, 62.5, [8, 8, 8])];
    expect(revertProposal([...base, step(1, 60, [10, 10, 10], { workoutId: 'w-5', revert: true })], LOAD)).toEqual({ kind: 'already' });
    expect(revertProposal([...base, step(1, 60, [10, 10, 10], { workoutId: 'w-1' })], LOAD)).toEqual({ kind: 'already' });
    // Une décision de retour ne remplace jamais la valeur retenue de la séance à laquelle elle est attachée.
    expect(revertProposal([...base, step(1, 60, [10, 10, 10], { workoutId: 'w-5', revert: true }), step(0.5, 62.5, [9, 9, 9], { workoutId: 'w-0' })], LOAD)).toMatchObject({ kind: 'available', target: { loadKg: 60 } });
  });

  it('B5 hausse : charge plus lourde ; assisté : assistance plus faible ; sans charge : plus de répétitions ou de secondes à lest égal', () => {
    expect(isHarder({ loadKg: 62.5, reps: [8] }, { loadKg: 60, reps: [10] }, LOAD)).toBe(true);
    expect(isHarder({ loadKg: 60, reps: [11] }, { loadKg: 60, reps: [10] }, LOAD)).toBe(false);
    expect(isHarder({ loadKg: 20, reps: [8] }, { loadKg: 25, reps: [10] }, { metric: 'load-reps', assisted: true })).toBe(true);
    expect(isHarder({ loadKg: 0, reps: [49, 49] }, { loadKg: 0, reps: [45, 45] }, { metric: 'time', assisted: false })).toBe(true);
    expect(isHarder({ loadKg: 2, reps: [8, 8] }, { loadKg: 0, reps: [12, 12] }, { metric: 'bodyweight-reps', assisted: false })).toBe(true);
    expect(revertProposal([step(9, 0, [45, 45]), step(5, 0, [49, 49])], { metric: 'time', assisted: false })).toMatchObject({ target: { loadKg: 0, reps: [45, 45] } });
  });

  it('B2 prescription tracée du retour : raison revert-previous, valeurs reprises, version du moteur', () => {
    const p = revertDecisionPrescription({ loadKg: 60, reps: [10, 10, 10], decidedAt: daysAgo(9) }, 'load-reps');
    expect(p).toMatchObject({ status: 'prescribed', headline: 'decision', reasons: ['decision-reference', 'revert-previous'], loadKg: 60, engineVersion: ENGINE_VERSION });
    expect(p.sets).toEqual([10, 10, 10].map((reps) => ({ reps, loadKg: 60 })));
    expect(isRevertPrescription(p)).toBe(true);
    expect(revertDecisionPrescription({ loadKg: 0, reps: [45], decidedAt: daysAgo(9) }, 'time').metric).toBe('time');
  });
});

describe('MOTEUR-0281b : la décision de retour est la référence du moteur, dite comme telle', () => {
  it('B3 décision de retour postérieure à la dernière séance : valeurs reprises, phrase « retour à la prescription précédente »', () => {
    const p = prescribe(input({ history: [session(3, 62.5, [8, 8, 8])], lastDecision: { decidedAt: daysAgo(1), accepted: false, loadKg: 60, reps: [10, 10, 10], revert: true } }));
    expect(p.headline).toBe('decision');
    expect(p.reasons).toEqual(['decision-reference', 'revert-previous']);
    expect(p.sets).toEqual([10, 10, 10].map((reps) => ({ reps, loadKg: 60 })));
    expect(explainPrescription(p)).toEqual({ key: 'revert', params: {} });
    const bw = prescribe(input({ exercise: PUSH_UP, history: [bwSession(3, 2, [8, 8, 8])], lastDecision: { decidedAt: daysAgo(1), accepted: false, loadKg: 0, reps: [12, 12, 12], revert: true } }));
    expect(explainPrescription(bw)).toEqual({ key: 'revert', params: {} });
  });
});
