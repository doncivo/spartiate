import { describe, expect, it } from 'vitest';
import { FITNESS_PARK_ANTONY, PLANK, input, session, target } from '../../../tests/fixtures/training/progression';
import { confidenceBand, confidencePercent, explainPrescription } from './explain';
import { prescribe } from './prescribe';

/**
 * I2-01 (PR 2/2, critères 10 et 11 ; § 11.4) : une phrase par proposition, tirée de la raison principale (`headline`) et de ses valeurs ;
 * confiance en pourcentage et en mot (jamais par la couleur seule). Module pur : clés et paramètres, les textes sont dans src/i18n.
 */

const three = (load: number, reps: readonly number[], days = 3) => [session(days, load, reps)];

describe('explainPrescription', () => {
  it('sans historique : « à saisir », sans charge', () => {
    expect(explainPrescription(prescribe(input()))).toEqual({ key: 'toEnter', params: {} });
  });

  it('métrique hors moteur (durée) : pas de proposition', () => {
    expect(explainPrescription(prescribe(input({ exercise: PLANK })))).toEqual({ key: 'unsupported', params: {} });
  });

  it('haut de plage atteint partout : « +2,5 kg : 3 × 10 atteint la dernière fois »', () => {
    const p = prescribe(input({ history: three(60, [10, 10, 10]) }));
    expect(p.headline).toBe('increase');
    expect(explainPrescription(p)).toEqual({ key: 'increase', params: { delta: 2.5, sets: 3, reps: 10 } });
  });

  it('cran supposé (matériel sans palier connu) : la phrase le dit', () => {
    const p = prescribe(input({ exercise: { id: 'leg-press', metric: 'load-reps', equipment: ['leg-press-machine'] }, history: three(100, [10, 10, 10]) }));
    expect(p.reasons).toContain('increment-unknown');
    expect(explainPrescription(p)).toEqual({ key: 'increaseUnknownStep', params: { delta: 2.5, sets: 3, reps: 10 } });
  });

  it('échelle de répétitions : même charge, une répétition de plus sur la série n', () => {
    const p = prescribe(input({ history: three(60, [10, 9, 8]) }));
    expect(explainPrescription(p)).toEqual({ key: 'repLadder', params: { set: 2 } });
  });

  it('« Dur » la dernière fois : même charge', () => {
    const p = prescribe(input({ history: [session(3, 60, [10, 10, 10], { difficulty: 'hard' })] }));
    expect(explainPrescription(p)).toEqual({ key: 'holdHard', params: {} });
  });

  it('recalibrage « Facile » : hausse et raison dites', () => {
    const p = prescribe(input({ history: [session(3, 60, [10, 10, 10], { difficulty: 'easy' })] }));
    expect(p.headline).toBe('recalibration');
    expect(explainPrescription(p)).toEqual({ key: 'recalibration', params: { delta: p.deltaKg ?? 0 } });
  });

  it('charge maximale du matériel : une répétition de plus, raison dite', () => {
    const p = prescribe(input({ exercise: { id: 'curl-dumbbell', metric: 'load-reps', equipment: ['dumbbell'] }, history: three(50, [12, 12, 12]), target: target(8, 12) }));
    expect(p.reasons).toContain('equipment-max');
    expect(explainPrescription(p)).toEqual({ key: 'extraRepMax', params: { set: (p.ladderSetIndex ?? 0) + 1 } });
  });

  it('décision d’Ali postérieure à la dernière séance : rendue telle quelle', () => {
    const p = prescribe(input({ history: three(60, [10, 10, 10]), lastDecision: { decidedAt: '2026-11-06T10:00:00.000Z' as never, accepted: false, loadKg: 57.5, reps: [8, 8, 8] } }));
    expect(explainPrescription(p)).toEqual({ key: 'decision', params: { load: 57.5 } });
  });

  it('revue #61 (C) : décision sans charge retenue : « à saisir » (aucune phrase de décision sans valeur)', () => {
    const p = prescribe(input({ history: three(60, [10, 10, 10]), lastDecision: { decidedAt: '2026-11-06T10:00:00.000Z' as never, accepted: false, loadKg: null, reps: [8, 8, 8] } }));
    expect(p.headline).toBe('decision');
    expect(explainPrescription(p)).toEqual({ key: 'toEnter', params: {} });
  });

  it('même entrée : même phrase (déterminisme)', () => {
    const make = () => explainPrescription(prescribe(input({ history: three(60, [10, 10, 10]), equipment: FITNESS_PARK_ANTONY })));
    expect(make()).toEqual(make());
  });
});

describe('confiance', () => {
  it('pourcentage arrondi ; mot : faible sous 40 %, moyenne sous 70 %, bonne au-delà', () => {
    expect(confidencePercent(0.724)).toBe(72);
    expect(confidencePercent(1)).toBe(100);
    expect([0, 0.39, 0.4, 0.69, 0.7, 1].map(confidenceBand)).toEqual(['low', 'low', 'medium', 'medium', 'high', 'high']);
  });
});
