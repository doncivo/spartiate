import { describe, expect, it } from 'vitest';
import { BENCH, PLANK, PUSH_UP, bwSession, daysAgo, input, session, target } from '../../../tests/fixtures/training/progression';
import { ENGINE_VERSION } from './config';
import { explainPrescription, explanationNotes } from './explain';
import { prescribe } from './prescribe';

/**
 * SEANCE-0299 (BL-171, D-657, Ali le 26/11, Q-11 option B ; C-026) : une décision d'Ali postérieure à la dernière séance devient la
 * référence ; la décharge, la pause et la récupération basse (journée rouge comprise) la réduisent comme une référence d'historique, au poids
 * du corps et en chronométré aussi. Valeurs inventées, vérifiables à la main.
 */

const RED = { recovery: 20, sleepHours: null, restingHrDelta: null, redDay: true };

describe('SEANCE-0299 BL-171 : poids du corps (prescribeUnloaded)', () => {
  const hist = [bwSession(3, null, [10, 10, 10])];
  const decision = { decidedAt: daysAgo(1), accepted: false, loadKg: 0, reps: [12, 12, 12] };

  it('sans contrainte : la décision est reprise telle quelle (12, 12, 12)', () => {
    const p = prescribe(input({ exercise: PUSH_UP, history: hist, lastDecision: decision, target: target(8, 12) }));
    expect(p.headline).toBe('decision');
    expect(p.sets.map((s) => s.reps)).toEqual([12, 12, 12]);
    expect(p.reasons).toEqual(['decision-reference']);
  });

  it('décharge : moitié des séries (une), valeurs de la décision, RIR ≥ 4 ; la décision est la référence', () => {
    const p = prescribe(input({ exercise: PUSH_UP, history: hist, lastDecision: decision, target: target(8, 12), deload: true }));
    expect(p.headline).toBe('deload');
    expect(p.sets).toEqual([{ reps: 12, loadKg: 0 }]);
    expect(p.deload).toBe(true);
    expect(p.rirTarget).toBe(4);
    expect(p.reference).toMatchObject({ loadKg: 0, reps: [12, 12, 12] });
    expect(p.reasons).toEqual(expect.arrayContaining(['decision-reference', 'deload']));
    expect(explainPrescription(p).key).toBe('deloadNoLoad');
    expect(explanationNotes(p)).toEqual([{ key: 'noteDecisionReference', params: {} }]);
  });

  it('décharge avec lest décidé 10 kg : × 0,8 = 8 kg (haltère disponible vers le bas)', () => {
    const p = prescribe(input({ exercise: PUSH_UP, history: hist, lastDecision: { ...decision, loadKg: 10 }, target: target(8, 12), deload: true }));
    expect(p.loadKg).toBe(8);
    expect(p.sets).toEqual([{ reps: 12, loadKg: 8 }]);
  });

  it('journée rouge : mêmes valeurs que la décision, phrase de la journée rouge', () => {
    const p = prescribe(input({ exercise: PUSH_UP, history: hist, lastDecision: decision, target: target(8, 12), recovery: RED }));
    expect(p.headline).toBe('recovery-low');
    expect(p.sets.map((s) => s.reps)).toEqual([12, 12, 12]);
    expect(p.reasons).toEqual(expect.arrayContaining(['decision-reference', 'recovery-low', 'recovery-red-day']));
    expect(explainPrescription(p).key).toBe('redDayNoLoad');
  });

  it('pause de 35 jours : mêmes valeurs, phrase de la pause', () => {
    const p = prescribe(input({ exercise: PUSH_UP, history: [bwSession(35, null, [10, 10, 10])], lastDecision: decision, target: target(8, 12) }));
    expect(p.headline).toBe('inactivity');
    expect(p.sets.map((s) => s.reps)).toEqual([12, 12, 12]);
    expect(p.reasons).toContain('inactivity-discount');
  });

  it('chronométré (planche) : décharge, une série à la durée décidée', () => {
    const plank = prescribe(input({ exercise: PLANK, history: [session(3, 0, [], { sets: [1, 2, 3].map((position) => ({ position, setKind: 'timed', done: true, reps: null, loadKg: null, rir: null, durationSec: 45 })) })], lastDecision: { decidedAt: daysAgo(1), accepted: false, loadKg: 0, reps: [60, 60, 60] }, target: target(30, 60), deload: true }));
    expect(plank.headline).toBe('deload');
    expect(plank.sets.map((s) => s.reps)).toEqual([60]);
  });
});

describe('SEANCE-0299 BL-171 : note et version', () => {
  it('décision réduite (décharge) : la note dit que la référence est la décision ; décision seule : aucune note', () => {
    const hist = [session(3, 100, [8, 8, 8])];
    const decision = { decidedAt: daysAgo(1), accepted: false, loadKg: 90, reps: [8, 8, 8] };
    const reduced = prescribe(input({ exercise: BENCH, history: hist, lastDecision: decision, deload: true }));
    expect(explanationNotes(reduced)).toEqual([{ key: 'noteDecisionReference', params: {} }]);
    expect(explanationNotes(prescribe(input({ exercise: BENCH, history: hist, lastDecision: decision })))).toEqual([]);
  });

  it('ENGINE_VERSION 5 → 6 (D-681) : les propositions d’une décision changent', () => {
    expect(ENGINE_VERSION).toBe(6);
  });
});

describe('SEANCE-0299 BL-171, relecture à froid : cas limites', () => {
  const hist = [session(3, 100, [8, 8, 8])];
  const decision = { decidedAt: daysAgo(1), accepted: false, loadKg: 90, reps: [8, 8, 8] };

  it('lesté, décision à 0 kg (poids du corps seul) en décharge : réduite comme une référence (une série, RIR ≥ 4)', () => {
    const WEIGHTED = { id: 'pull-up-weighted', metric: 'load-reps', equipment: ['pull-up-bar', 'loading-belt', 'dumbbell'], bodyweightFraction: 1 } as const;
    const p = prescribe(input({ exercise: WEIGHTED, bodyweightKg: 80, history: [session(3, 10, [8, 8, 8])], lastDecision: { ...decision, loadKg: 0 }, deload: true }));
    expect(p.headline).toBe('deload');
    expect(p.sets).toEqual([{ reps: 8, loadKg: 0 }]);
    expect(p.rirTarget).toBe(4);
  });

  it('dernière séance partielle : ni sa raison ni sa note, qui contrediraient « Référence : ta dernière décision »', () => {
    const partial = { ...session(3, 100, [8, 8, 8]), sets: [0, 1, 2].map((position) => ({ position, setKind: 'work' as const, done: position === 0, reps: 8, loadKg: 100, rir: null })) };
    const p = prescribe(input({ history: [session(10, 100, [8, 8, 8]), partial], lastDecision: decision, deload: true }));
    expect(p.headline).toBe('deload');
    expect(p.reasons).not.toContain('partial-session-ignored');
    expect(explanationNotes(p)).toEqual([{ key: 'noteDecisionReference', params: {} }]);
    const bw = prescribe(input({ exercise: PUSH_UP, history: [{ ...bwSession(3, null, [10, 10, 10]), sets: [0, 1, 2].map((position) => ({ position, setKind: 'work' as const, done: position === 0, reps: 10, loadKg: null, rir: null })) }], lastDecision: { ...decision, loadKg: 0 }, deload: true }));
    expect(bw.reasons).not.toContain('partial-session-ignored');
  });

  it('assisté, pause de 35 jours hors décharge : assistance décidée maintenue et dite', () => {
    const ASSISTED = { id: 'pull-up-assisted', metric: 'load-reps', equipment: ['pull-up-bar'], kind: 'compound', assisted: true, bodyweightFraction: 1 } as const;
    const p = prescribe(input({ exercise: ASSISTED, bodyweightKg: 80, history: [session(35, 30, [8, 8, 8])], lastDecision: { ...decision, loadKg: 25 } }));
    expect(p.headline).toBe('inactivity');
    expect(p.loadKg).toBe(25);
    expect(p.reasons).toContain('assistance-held');
    expect(explainPrescription(p).key).toBe('inactivityAssistHeld');
  });

  it('décision sans répétitions en décharge : bas de la plage, une série (70 kg × 8)', () => {
    const p = prescribe(input({ history: hist, lastDecision: { ...decision, reps: [] }, deload: true }));
    expect(p.sets).toEqual([{ reps: 8, loadKg: 70 }]);
  });

  it('décharge du plan de cycle (2 séries, × 0,9) : 90 × 0,9 = 81 → 80 kg, deux séries', () => {
    const p = prescribe(input({ history: hist, lastDecision: decision, deload: true, deloadSets: 2, deloadLoad: 0.9 }));
    expect(p.sets).toEqual([{ reps: 8, loadKg: 80 }, { reps: 8, loadKg: 80 }]);
  });

  it('fatigue lue dans l’historique, aucune autre contrainte : décision reprise telle quelle, aucun choix', () => {
    const p = prescribe(input({ history: [session(10, 100, [10, 10, 10]), session(3, 100, [7, 7, 7])], lastDecision: decision }));
    expect(p.headline).toBe('decision');
    expect(p.options).toEqual([]);
  });

  it('isolation, récupération basse (sans journée rouge) : une série de moins', () => {
    const p = prescribe(input({ exercise: { id: 'curl-dumbbell', metric: 'load-reps', equipment: ['dumbbell'], kind: 'isolation' }, history: [session(3, 20, [10, 10, 10])], lastDecision: { ...decision, loadKg: 20, reps: [10, 10, 10] }, recovery: { recovery: 20, sleepHours: null, restingHrDelta: null } }));
    expect(p.headline).toBe('recovery-low');
    expect(p.sets).toHaveLength(2);
    expect(p.reasons).toContain('recovery-set-removed');
  });

  it('retour à la charge d’avant réduit par la décharge : raison gardée, phrase de la décharge (D-684)', () => {
    const p = prescribe(input({ history: hist, lastDecision: { ...decision, revert: true }, deload: true }));
    expect(p.headline).toBe('deload');
    expect(p.reasons).toContain('revert-previous');
    expect(explainPrescription(p).key).toBe('deload');
  });

  it('la référence d’une décision ne porte aucun 1RM (aucun 1RM tiré d’une décision)', () => {
    const p = prescribe(input({ history: hist, lastDecision: decision, deload: true }));
    expect(p.reference?.e1rmKg).toBe(0);
  });
});
