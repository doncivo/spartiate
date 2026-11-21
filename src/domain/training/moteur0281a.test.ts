import { describe, expect, it } from 'vitest';
import {
  BELT_GYM,
  BODYWEIGHT_ONLY,
  DIPS,
  FARMER,
  FITNESS_PARK_ANTONY,
  PLANK,
  PUSH_UP,
  bwSession,
  daysAgo,
  input,
  set,
  target,
  timedSession,
} from '../../../tests/fixtures/training/progression';
import { progressionFr } from '../../i18n/fr.progression';
import { ballastLoads, timeStepSec } from './bodyweightProgression';
import { DEFAULT_PROGRESSION_CONFIG as CFG, ENGINE_VERSION, REASON_ORDER } from './config';
import { constraintAlerts, explainPrescription, explanationNotes } from './explain';
import { prescribe } from './prescribe';
import type { RecoverySnapshot } from './types';

/**
 * MOTEUR-0281a (PRD § 11.3 « Sans charge », C-189) : exercice au poids du corps progressé en répétitions jusqu'au haut de la plage, puis lest
 * au plus petit cran du matériel (ceinture, haltère), retour au bas de la plage ; exercice chronométré progressé en secondes par pas prudent.
 * Données SYNTHÉTIQUES.
 */

const BW = target(8, 12);
const bw = (over: Parameters<typeof input>[0] = {}) => prescribe(input({ exercise: PUSH_UP, target: BW, ...over }));
const timed = (over: Parameters<typeof input>[0] = {}) => prescribe(input({ exercise: PLANK, target: target(45, 45), ...over }));
const LOW: RecoverySnapshot = { recovery: 20, sleepHours: null, restingHrDelta: null };

describe('MOTEUR-0281a : poids du corps, répétitions puis lest', () => {
  it('A1 sous le haut de plage : une répétition de plus sur une série, aucun lest', () => {
    const p = bw({ history: [bwSession(3, null, [10, 9, 8])] });
    expect(p.status).toBe('prescribed');
    expect(p.metric).toBe('bodyweight-reps');
    expect(p.headline).toBe('rep-ladder');
    expect(p.reasons).toEqual(['history-reference', 'rep-ladder']);
    expect(p.sets).toEqual([11, 9, 8].map((reps) => ({ reps, loadKg: 0 })));
    expect(p.loadKg).toBe(0);
    expect(p.ladderSetIndex).toBe(0);
    expect(p.estimated1rmKg).toBeNull();
    expect(explainPrescription(p)).toEqual({ key: 'bodyweightRepLadder', params: { set: 1 } });
  });

  it('A2 haut de plage partout, haltères dans le profil : lest du plus petit cran (2 kg), retour au bas de la plage', () => {
    const p = bw({ history: [bwSession(3, null, [12, 12, 12])] });
    expect(p.headline).toBe('ballast-add');
    expect(p.reasons).toEqual(['history-reference', 'top-reached', 'ballast-added']);
    expect(p.sets).toEqual([8, 8, 8].map((reps) => ({ reps, loadKg: 2 })));
    expect(p.deltaKg).toBe(2);
    expect(explainPrescription(p)).toEqual({ key: 'ballastAdd', params: { load: 2, reps: 8, sets: 3, top: 12 } });
  });

  it('A2 ceinture de lest et disques : plus petit disque (1,25 kg)', () => {
    const p = prescribe(input({ exercise: DIPS, equipment: BELT_GYM, target: BW, history: [bwSession(3, null, [12, 12, 12])] }));
    expect(p.loadKg).toBe(1.25);
    expect(p.sets.map((s) => s.reps)).toEqual([8, 8, 8]);
  });

  it('A3 aucun matériel de lest (ou aucun profil) : aucune proposition de lest, une répétition de plus, la phrase dit pourquoi', () => {
    for (const equipment of [BODYWEIGHT_ONLY, null]) {
      const p = bw({ equipment, history: [bwSession(3, null, [12, 12, 12])] });
      expect(p.headline).toBe('extra-rep');
      expect(p.reasons).toEqual(['history-reference', 'top-reached', 'ballast-unavailable']);
      expect(p.sets).toEqual([13, 12, 12].map((reps) => ({ reps, loadKg: 0 })));
      expect(explainPrescription(p)).toEqual({ key: 'ballastNone', params: { set: 1 } });
    }
  });

  it('A4 lest déjà porté : lest suivant de la grille ; au lest maximal du matériel, une répétition de plus', () => {
    const next = prescribe(input({ exercise: DIPS, target: BW, history: [bwSession(3, 4, [12, 12, 12])] }));
    expect(next.loadKg).toBe(6);
    expect(next.deltaKg).toBe(2);
    expect(next.sets.map((s) => s.reps)).toEqual([8, 8, 8]);
    const max = prescribe(input({ exercise: DIPS, target: BW, history: [bwSession(3, 50, [12, 12, 12])] }));
    expect(max.headline).toBe('extra-rep');
    expect(max.reasons).toContain('equipment-max');
    expect(max.loadKg).toBe(50);
    expect(max.sets.map((s) => s.reps)).toEqual([13, 12, 12]);
    const ladder = prescribe(input({ exercise: DIPS, target: BW, history: [bwSession(3, 10, [10, 9, 8])] }));
    expect(ladder.loadKg).toBe(10);
    expect(explainPrescription(ladder).key).toBe('repLadder');
  });

  it('A5 ressenti Dur ou RIR ≤ 1 au haut de plage : mêmes valeurs, aucun lest', () => {
    for (const h of [bwSession(3, null, [12, 12, 12], { difficulty: 'hard' }), { ...bwSession(3, null, [12, 12, 12]), sets: [0, 1, 2].map((position) => set(null, 12, { position, rir: 1 })) }]) {
      const p = bw({ history: [h] });
      expect(p.headline).toBe('hold-hard');
      expect(p.sets).toEqual([12, 12, 12].map((reps) => ({ reps, loadKg: 0 })));
      expect(explainPrescription(p).key).toBe('holdHardNoLoad');
    }
  });

  it('Facile au haut de plage : le cran de lest est confirmé, jamais de recalibrage', () => {
    const p = bw({ history: [bwSession(3, null, [12, 12, 12], { difficulty: 'easy' })] });
    expect(p.reasons).toEqual(['history-reference', 'top-reached', 'easy-confirms', 'ballast-added']);
    expect(p.recalibration).toBeNull();
  });

  it('grille de lest : ceinture (disques, kettlebells vérifiées, haltères) et haltères seuls ; rien sans ceinture ni haltère', () => {
    expect(ballastLoads(BODYWEIGHT_ONLY).length).toBe(0);
    expect(ballastLoads(null).length).toBe(0);
    expect(ballastLoads(BELT_GYM).slice(0, 4)).toEqual([1.25, 2.5, 3.75, 5]);
    expect(Math.max(...ballastLoads(BELT_GYM))).toBe(35);
    expect(ballastLoads(FITNESS_PARK_ANTONY)[0]).toBe(2);
    const forbidden = { ...FITNESS_PARK_ANTONY, inventory: { ...FITNESS_PARK_ANTONY.inventory, forbidden: ['dumbbell'] } };
    expect(ballastLoads(forbidden).length).toBe(0);
  });
});

describe('MOTEUR-0281a : chronométrés, secondes par pas prudent', () => {
  it('pas : 10 % du temps tenu arrondi en dessous, au moins 1 s, au plus 5 s', () => {
    expect([8, 20, 30, 45, 60, 120].map((s) => timeStepSec(s, CFG))).toEqual([1, 2, 3, 4, 5, 5]);
  });

  it('A6 3 × 45 s tenues, cible 45 s : +4 s par série', () => {
    const p = timed({ history: [timedSession(3, [45, 45, 45])] });
    expect(p.status).toBe('prescribed');
    expect(p.metric).toBe('time');
    expect(p.headline).toBe('time-increase');
    expect(p.reasons).toEqual(['history-reference', 'top-reached', 'time-step']);
    expect(p.sets.map((s) => s.reps)).toEqual([49, 49, 49]);
    expect(explainPrescription(p)).toEqual({ key: 'timeIncrease', params: { delta: 4, sets: 3, sec: 45 } });
  });

  it('A7 séries inégales ou sous la cible : seule la première série en retard gagne un pas, sans dépasser la meilleure ni la cible', () => {
    const under = timed({ history: [timedSession(3, [45, 45, 40])] });
    expect(under.headline).toBe('time-ladder');
    expect(under.sets.map((s) => s.reps)).toEqual([45, 45, 44]);
    expect(explainPrescription(under)).toEqual({ key: 'timeLadder', params: { delta: 4, set: 3 } });
    expect(timed({ history: [timedSession(3, [50, 50, 45])] }).sets.map((s) => s.reps)).toEqual([50, 50, 49]);
    expect(timed({ history: [timedSession(3, [44, 40, 40])] }).sets.map((s) => s.reps)).toEqual([45, 40, 40]);
  });

  it('ressenti Dur : mêmes durées', () => {
    const p = timed({ history: [timedSession(3, [45, 45, 45], { difficulty: 'hard' })] });
    expect(p.headline).toBe('hold-hard');
    expect(p.sets.map((s) => s.reps)).toEqual([45, 45, 45]);
  });

  it('série chronométrée enregistrée en « work » avec une durée : comptée', () => {
    const s = timedSession(3, [45, 45, 45]);
    const p = timed({ history: [{ ...s, sets: s.sets.map((x) => ({ ...x, setKind: 'work' as const })) }] });
    expect(p.sets.map((x) => x.reps)).toEqual([49, 49, 49]);
  });

  it('sans historique : à saisir', () => {
    const p = timed();
    expect(p.status).toBe('to-enter');
    expect(p.sets.map((s) => s.reps)).toEqual([45, 45, 45]);
  });
});

describe('MOTEUR-0281a : contraintes, validation, référence', () => {
  it('A8 deload : moitié des séries, mêmes valeurs, lest × 0,8 arrondi vers le bas, RIR 4+', () => {
    const p = bw({ deload: true, history: [bwSession(3, null, [10, 9, 8])] });
    expect(p.headline).toBe('deload');
    expect(p.deload).toBe(true);
    expect(p.rirTarget).toBe(4);
    expect(p.sets).toEqual([{ reps: 10, loadKg: 0 }]);
    expect(explainPrescription(p)).toEqual({ key: 'deloadNoLoad', params: { sets: 1, rir: 4 } });
    const ballast = prescribe(input({ exercise: DIPS, target: BW, deload: true, history: [bwSession(3, 10, [10, 9, 8])] }));
    expect(ballast.loadKg).toBe(8);
    expect(explainPrescription(ballast).key).toBe('deload');
    expect(timed({ deload: true, history: [timedSession(3, [45, 45, 45])] }).sets.map((s) => s.reps)).toEqual([45]);
  });

  it('A8 pause de 3 semaines ou récupération basse : mêmes valeurs, aucune hausse, la phrase le dit', () => {
    const off = bw({ history: [bwSession(30, null, [12, 12, 12])] });
    expect(off.headline).toBe('inactivity');
    expect(off.sets.map((s) => s.reps)).toEqual([12, 12, 12]);
    expect(off.loadKg).toBe(0);
    expect(explainPrescription(off).key).toBe('inactivityNoLoad');
    const low = timed({ recovery: LOW, history: [timedSession(3, [45, 45, 45])] });
    expect(low.headline).toBe('recovery-low');
    expect(low.sets.map((s) => s.reps)).toEqual([45, 45, 45]);
    expect(explainPrescription(low).key).toBe('recoveryLowNoLoad');
    expect(explainPrescription(timed({ recovery: { ...LOW, redDay: true }, history: [timedSession(3, [45, 45, 45])] })).key).toBe('redDayNoLoad');
    // Aucune alerte « charge réduite de x % » pour un exercice sans charge.
    expect(constraintAlerts(bw({ deload: true, recovery: LOW, history: [bwSession(30, null, [12, 12, 12])] }))).toEqual([]);
  });

  it('A9 séance à moins de 50 % ignorée, séance de deload jamais référence', () => {
    const partial = bwSession(2, null, [12, 12, 12]);
    const p = bw({ history: [bwSession(6, null, [10, 10, 10]), { ...partial, sets: partial.sets.map((s, i) => ({ ...s, done: i === 0 })) }] });
    expect(p.reasons).toContain('partial-session-ignored');
    expect(p.sets.map((s) => s.reps)).toEqual([11, 10, 10]);
    expect(explanationNotes(p).map((n) => n.key)).toEqual(['notePartialIgnored']);
    const d = bw({ history: [bwSession(6, null, [10, 10, 10]), bwSession(2, null, [12, 12, 12], { deload: true })] });
    expect(d.sets.map((s) => s.reps)).toEqual([11, 10, 10]);
  });

  it('décision d’Ali postérieure à la dernière séance : reprise telle quelle', () => {
    const p = bw({ history: [bwSession(3, null, [10, 9, 8])], lastDecision: { decidedAt: daysAgo(1), accepted: false, loadKg: 0, reps: [9, 9, 9] } });
    expect(p.headline).toBe('decision');
    expect(p.sets.map((s) => s.reps)).toEqual([9, 9, 9]);
    expect(explainPrescription(p).key).toBe('decisionNoLoad');
  });

  it('A10 déterminisme, ordre des raisons, version du moteur 4', () => {
    const history = [bwSession(9, null, [10, 10, 10]), bwSession(6, null, [11, 11, 10]), bwSession(3, null, [12, 12, 12])];
    expect(bw({ history: [...history].reverse() })).toEqual(bw({ history }));
    for (const p of [bw({ history }), timed({ history: [timedSession(3, [45, 45, 40])] }), bw({ deload: true, history })]) {
      const ranks = p.reasons.map((r) => REASON_ORDER.indexOf(r));
      expect(ranks.every((r) => r >= 0)).toBe(true);
      expect([...ranks].sort((x, y) => x - y)).toEqual(ranks);
    }
    expect(ENGINE_VERSION).toBe(4);
    expect(bw({ history }).engineVersion).toBe(4);
  });

  it('A11 portés (distance) et traction assistée du catalogue : toujours hors moteur', () => {
    expect(prescribe(input({ exercise: FARMER, history: [bwSession(3, 20, [30])] })).status).toBe('unsupported');
    const assisted = { id: 'pull-up-assisted', metric: 'bodyweight-reps', equipment: ['assisted-pull-up-machine', 'resistance-band', 'pull-up-bar'] } as const;
    expect(prescribe(input({ exercise: assisted, history: [bwSession(3, 30, [10, 10, 10])] })).status).toBe('unsupported');
  });

  it('A10 textes : chaque phrase nouvelle est au catalogue de la progression', () => {
    const texts: Readonly<Record<string, string>> = progressionFr;
    for (const key of [
      'explainBodyweightRepLadder',
      'explainBallastAdd',
      'explainBallastNone',
      'explainTimeIncrease',
      'explainTimeLadder',
      'explainHoldHardNoLoad',
      'explainDeloadNoLoad',
      'explainInactivityNoLoad',
      'explainRecoveryLowNoLoad',
      'explainRedDayNoLoad',
      'explainDecisionNoLoad',
      'valueBodyweight',
      'valueBallast',
      'valueSeconds',
      'editBallast',
      'editSeconds',
    ])
      expect(texts[key], key).toMatch(/\S/);
  });
});
