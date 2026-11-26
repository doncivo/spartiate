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
