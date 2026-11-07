import { describe, expect, it } from 'vitest';
import { CURL, LEG_PRESS, PLANK, daysAgo, input, session, target } from '../../../tests/fixtures/training/progression';
import { DEFAULT_PROGRESSION_CONFIG as CFG, PROPOSAL_OPTION_ORDER, REASON_ORDER } from './config';
import { deloadSetCount, inactivityCut, isLowRecovery, isStalled, progressed, repsDrop } from './constraints';
import { analyzeHistory } from './estimate1rm';
import { constraintAlerts, explainOption, explainPrescription } from './explain';
import { prescribe } from './prescribe';
import type { ExerciseSession, PrescribeInput, RecoverySnapshot } from './types';

/**
 * I2-02 (§ 11.2 point 6, § 11.3, § 11.5 ; D-72 points 7 à 10, qui priment) : contraintes de fatigue, stagnation, inactivité, deload et
 * récupération. Elles maintiennent ou réduisent, jamais de bonus ; les choix sont présentés, jamais appliqués d'office. Vecteurs calculés à
 * la main (commentaires) ; grille barre de Fitness Park Antony : 20 kg + pas de 2,5 kg ; haltères 2 à 50 kg par 2 ; presse sans grille
 * (arrondi au demi-kilo inférieur).
 */

const SNAP = (low: number): RecoverySnapshot => ({ recovery: low, sleepHours: null, restingHrDelta: null });
const ISO_CURL = { ...CURL, kind: 'isolation' as const };

describe('fonctions pures', () => {
  it('baisse de répétitions sur les séries communes : (somme précédente − somme dernière) / somme précédente', () => {
    expect(repsDrop([10], [8])).toBeCloseTo(0.2, 12); // (10 − 8) / 10
    expect(repsDrop([10], [7])).toBeCloseTo(0.3, 12);
    expect(repsDrop([10, 10, 10], [8, 8, 7])).toBeCloseTo(7 / 30, 12);
    // Une série en moins n'est pas une baisse : seules les 2 premières séries comptent (20 vs 20).
    expect(repsDrop([10, 10, 10], [10, 10])).toBe(0);
    expect(repsDrop([], [8])).toBe(0);
    expect(repsDrop([8, 8], [9, 9])).toBe(0); // hausse : pas de baisse négative
  });

  it('progrès : charge plus haute, ou même charge et plus de répétitions sur les séries communes', () => {
    expect(progressed({ loadKg: 102.5, reps: [6, 6, 6] }, { loadKg: 100, reps: [8, 8, 8] })).toBe(true);
    expect(progressed({ loadKg: 100, reps: [8, 8, 9] }, { loadKg: 100, reps: [8, 8, 8] })).toBe(true);
    expect(progressed({ loadKg: 100, reps: [8, 8, 8] }, { loadKg: 100, reps: [8, 8, 8] })).toBe(false);
    expect(progressed({ loadKg: 97.5, reps: [12, 12, 12] }, { loadKg: 100, reps: [8, 8, 8] })).toBe(false);
  });

  it('inactivité : rien avant J21, puis −1 % par semaine complète au-delà de J14, plancher −10 %', () => {
    expect(inactivityCut(13, CFG)).toBe(0);
    expect(inactivityCut(14, CFG)).toBe(0); // seuil atteint, aucune semaine complète
    expect(inactivityCut(20.99, CFG)).toBe(0);
    expect(inactivityCut(21, CFG)).toBeCloseTo(0.01, 12); // (21 − 14) / 7 = 1 semaine
    expect(inactivityCut(27.9, CFG)).toBeCloseTo(0.01, 12);
    expect(inactivityCut(28, CFG)).toBeCloseTo(0.02, 12);
    expect(inactivityCut(84, CFG)).toBeCloseTo(0.1, 12); // (84 − 14) / 7 = 10 semaines
    expect(inactivityCut(200, CFG)).toBeCloseTo(0.1, 12); // plancher
  });

  it('séries de deload : moitié arrondie en dessous, au moins une (D-72 point 9)', () => {
    expect([1, 2, 3, 4, 5, 6].map(deloadSetCount)).toEqual([1, 1, 1, 2, 2, 3]);
  });

  it('récupération basse : Recovery ≤ 33, sommeil < 6 h, FC repos > +8 % ; absent ou nul : jamais', () => {
    expect(isLowRecovery(null, CFG)).toBe(false);
    expect(isLowRecovery(undefined, CFG)).toBe(false);
    expect(isLowRecovery({ recovery: null, sleepHours: null, restingHrDelta: null }, CFG)).toBe(false);
    expect(isLowRecovery(SNAP(33), CFG)).toBe(true);
    expect(isLowRecovery(SNAP(34), CFG)).toBe(false);
    // Vecteur P-10 : Recovery 33, sommeil 6 h, FC +8 % → seule la condition Recovery est active.
    expect(isLowRecovery({ recovery: 34, sleepHours: 6, restingHrDelta: 0.08 }, CFG)).toBe(false);
    expect(isLowRecovery({ recovery: 34, sleepHours: 5 + 59 / 60, restingHrDelta: 0.08 }, CFG)).toBe(true);
    expect(isLowRecovery({ recovery: null, sleepHours: null, restingHrDelta: 0.081 }, CFG)).toBe(true);
    expect(isLowRecovery({ recovery: 0, sleepHours: null, restingHrDelta: null }, CFG)).toBe(true); // 0 est une valeur, pas une absence
  });

  it('stagnation : 3 séances de suite sans progrès (4 séances valides) ; une séance ignorée ne compte pas', () => {
    const flat = [session(12, 100, [8, 8, 8]), session(9, 100, [8, 8, 8]), session(6, 100, [8, 8, 8]), session(3, 100, [8, 8, 8])];
    expect(isStalled(analyzeHistory(flat, CFG).estimates, CFG)).toBe(true);
    expect(isStalled(analyzeHistory(flat.slice(1), CFG).estimates, CFG)).toBe(false); // 2 comparaisons seulement
    const moving = [session(12, 100, [8, 8, 8]), session(9, 100, [8, 8, 8]), session(6, 100, [8, 8, 9]), session(3, 100, [8, 8, 9])];
    expect(isStalled(analyzeHistory(moving, CFG).estimates, CFG)).toBe(false);
    // Séance partielle (1 série faite sur 3) entre deux : ignorée, ce n'est ni un progrès ni une régression.
    const partial = session(8, 100, [3, 0, 0], { sets: [0, 1, 2].map((position) => ({ position, setKind: 'work', done: position === 0, reps: 3, loadKg: 100, rir: null })) });
    const withGap = [session(12, 100, [8, 8, 8]), partial, session(6, 100, [8, 8, 9]), session(3, 100, [8, 8, 9])];
    expect(isStalled(analyzeHistory(withGap, CFG).estimates, CFG)).toBe(false);
  });
});

describe('fatigue : baisse de répétitions à charge égale (D-72 point 7)', () => {
  it('baisse de 20 % pile : seuil strict non franchi, l’échelle continue', () => {
    const p = prescribe(input({ history: [session(6, 100, [10]), session(3, 100, [8])], target: target(8, 10, 1) }));
    expect(p.reasons).not.toContain('fatigue-drop');
    expect(p.headline).toBe('rep-ladder');
    expect(p.options).toEqual([]);
  });

  it('baisse de 30 % : maintien (même charge, mêmes répétitions) et deux choix refusables, aucun appliqué', () => {
    const p = prescribe(input({ history: [session(6, 100, [10, 10, 10]), session(3, 100, [7, 7, 7])] }));
    expect(p.headline).toBe('fatigue');
    expect(p.reasons).toEqual(['history-reference', 'fatigue-drop']);
    expect(p.loadKg).toBe(100);
    expect(p.sets.map((s) => s.reps)).toEqual([7, 7, 7]);
    // −5 % : 95 kg (sur la grille) ; −2 reps : 5 par série.
    expect(p.options).toEqual([
      { kind: 'fatigue-load', loadKg: 95, reps: [7, 7, 7] },
      { kind: 'fatigue-reps', loadKg: 100, reps: [5, 5, 5] },
    ]);
  });

  it('séries inégales : 30 → 23 répétitions (23,3 %) déclenche ; 30 → 24 (20 %) non', () => {
    const fired = prescribe(input({ history: [session(6, 100, [10, 10, 10]), session(3, 100, [8, 8, 7])] }));
    expect(fired.headline).toBe('fatigue');
    expect(fired.options?.[1]).toEqual({ kind: 'fatigue-reps', loadKg: 100, reps: [6, 6, 5] });
    const held = prescribe(input({ history: [session(6, 100, [10, 10, 10]), session(3, 100, [8, 8, 8])] }));
    expect(held.reasons).not.toContain('fatigue-drop');
  });

  it('charges différentes : pas comparables, aucune fatigue ; la dernière séance comparable à charge égale fait référence', () => {
    const up = prescribe(input({ history: [session(6, 100, [10, 10, 10]), session(3, 102.5, [7, 7, 7])] }));
    expect(up.reasons).not.toContain('fatigue-drop');
    const back = prescribe(input({ history: [session(9, 100, [10, 10, 10]), session(6, 102.5, [8, 8, 8]), session(3, 100, [7, 7, 7])] }));
    expect(back.reasons).toContain('fatigue-drop');
  });

  it('−2 reps jamais sous 1 ; −5 % sans charge inférieure disponible : choix absent', () => {
    // Haltères : minimum 2 kg ; 2 × 0,95 = 1,9 → aucune charge inférieure.
    const p = prescribe(input({ exercise: CURL, history: [session(6, 2, [3, 3]), session(3, 2, [2, 2])], target: target(2, 4, 2) }));
    expect(p.headline).toBe('fatigue');
    expect(p.options).toEqual([{ kind: 'fatigue-reps', loadKg: 2, reps: [1, 1] }]);
  });

  it('une séance ignorée (moins de 50 % faite) n’est pas une baisse', () => {
    const partial = session(3, 100, [], { sets: [0, 1, 2].map((position) => ({ position, setKind: 'work', done: position === 0, reps: 4, loadKg: 100, rir: null })) });
    const p = prescribe(input({ history: [session(6, 100, [10, 10, 10]), partial] }));
    expect(p.reasons).not.toContain('fatigue-drop');
    expect(p.reasons).toContain('partial-session-ignored');
  });
});

describe('stagnation (D-72 point 8)', () => {
  const flat = [session(12, 100, [8, 8, 8]), session(9, 100, [8, 8, 8]), session(6, 100, [8, 8, 8]), session(3, 100, [8, 8, 8])];

  it('trois choix présentés (variante, autre plage, mini-deload −10 %), la proposition principale inchangée', () => {
    const p = prescribe(input({ history: flat }));
    expect(p.reasons).toEqual(['history-reference', 'rep-ladder', 'stall']);
    expect(p.headline).toBe('rep-ladder');
    expect(p.loadKg).toBe(100);
    expect(p.sets.map((s) => s.reps)).toEqual([9, 8, 8]);
    expect(p.options).toEqual([
      { kind: 'stall-variant', loadKg: null, reps: null },
      { kind: 'stall-range', loadKg: null, reps: null },
      { kind: 'stall-mini-deload', loadKg: 90, reps: [8, 8, 8] }, // 100 × 0,9, répétitions de la référence
    ]);
  });

  it('mini-deload −10 % pris sur la référence même si la proposition est une hausse', () => {
    const top = [session(12, 100, [10, 10, 10]), session(9, 100, [10, 10, 10]), session(6, 100, [10, 10, 10]), session(3, 100, [10, 10, 10])];
    const p = prescribe(input({ history: top }));
    expect(p.headline).toBe('increase');
    expect(p.loadKg).toBe(102.5);
    expect(p.options?.at(-1)).toEqual({ kind: 'stall-mini-deload', loadKg: 90, reps: [10, 10, 10] });
  });
});

describe('inactivité (D-72 point 10)', () => {
  // Presse sans grille : arrondi au demi-kilo inférieur, la décote se lit directement.
  const at = (days: number) => prescribe(input({ exercise: LEG_PRESS, history: [session(days, 100, [8, 8, 8])] }));

  it('J13 et J14 : aucune décote ; J20 : toujours aucune', () => {
    for (const d of [13, 14, 20]) {
      const p = at(d);
      expect(p.reasons).not.toContain('inactivity-discount');
      expect(p.inactivityCut).toBe(0);
    }
  });

  it('J21 : −1 % (99 kg), maintien des répétitions, progression suspendue', () => {
    const p = at(21);
    expect(p.headline).toBe('inactivity');
    expect(p.reasons).toEqual(['history-reference', 'inactivity-discount']);
    expect(p.inactivityCut).toBeCloseTo(0.01, 12);
    expect(p.loadKg).toBe(99);
    expect(p.sets.map((s) => s.reps)).toEqual([8, 8, 8]);
  });

  it('J28 : −2 % (98 kg) ; J84 : −10 % (90 kg) ; J200 : plancher −10 %', () => {
    expect(at(28).loadKg).toBe(98);
    expect(at(84).loadKg).toBe(90);
    expect(at(200).loadKg).toBe(90);
  });

  it('barre : 100 × 0,99 = 99 → charge disponible juste en dessous, 97,5 kg (écart 1,5 % ≤ 3 % : pas de répétition ajoutée)', () => {
    const p = prescribe(input({ history: [session(21, 100, [8, 8, 8])] }));
    expect(p.loadKg).toBe(97.5);
    expect(p.sets.map((s) => s.reps)).toEqual([8, 8, 8]);
  });

  it('une séance close sans aucune série faite n’est pas un travail du muscle : la décote court depuis la dernière série faite', () => {
    const empty = session(2, 100, [], { sets: [0, 1, 2].map((position) => ({ position, setKind: 'work', done: false, reps: null, loadKg: null, rir: null })) });
    const p = prescribe(input({ exercise: LEG_PRESS, history: [session(28, 100, [8, 8, 8]), empty] }));
    expect(p.inactivityCut).toBeCloseTo(0.02, 12);
    expect(p.loadKg).toBe(98);
  });

  it('le muscle travaillé par un autre exercice : pas de décote ; donnée absente : dernière séance de l’exercice', () => {
    const p = prescribe(input({ exercise: LEG_PRESS, history: [session(30, 100, [8, 8, 8])], muscleLastWorkedAt: daysAgo(5) }));
    expect(p.reasons).not.toContain('inactivity-discount');
    const q = prescribe(input({ exercise: LEG_PRESS, history: [session(30, 100, [8, 8, 8])], muscleLastWorkedAt: null }));
    expect(q.loadKg).toBe(98); // (30 − 14) / 7 = 2 semaines
  });
});

describe('deload manuel (D-72 point 9, § 11.3)', () => {
  it('5 séries → 2, charge × 0,8, RIR cible 4, raisons et phrase', () => {
    const p = prescribe(input({ history: [session(3, 100, [8, 8, 8, 8, 8])], target: target(8, 10, 5), deload: true }));
    expect(p.headline).toBe('deload');
    expect(p.deload).toBe(true);
    expect(p.reasons).toEqual(['history-reference', 'deload']);
    expect(p.sets).toEqual([
      { reps: 8, loadKg: 80 },
      { reps: 8, loadKg: 80 },
    ]);
    expect(p.rirTarget).toBe(4);
    expect(explainPrescription(p)).toEqual({ key: 'deload', params: { sets: 2, rir: 4 } });
  });

  it('1 série → 1 ; RIR cible déjà plus haut conservé', () => {
    const p = prescribe(input({ history: [session(3, 100, [8])], target: { sets: 1, repMin: 8, repMax: 10, rir: 5 }, deload: true }));
    expect(p.sets).toHaveLength(1);
    expect(p.rirTarget).toBe(5);
  });

  it('séance de deload : visible dans l’historique, exclue des statistiques, mais compte comme travail du muscle', () => {
    const base = session(30, 100, [10, 10, 10]);
    const deload = session(3, 80, [8], { deload: true });
    const p = prescribe(input({ exercise: LEG_PRESS, history: [base, deload] }));
    // Référence = la séance de J30 (le deload n'entre pas dans l'estimation) ; aucune décote : le muscle a travaillé à J3.
    expect(p.reference?.loadKg).toBe(100);
    expect(p.reasons).not.toContain('inactivity-discount');
    expect(p.headline).toBe('increase');
    expect(analyzeHistory([base, deload], CFG).estimates.map((e) => e.workoutId)).toEqual([base.workoutId]);
  });

  it('sans historique : « à saisir » inchangé, aucune charge, pas de deload', () => {
    const p = prescribe(input({ deload: true }));
    expect(p.status).toBe('to-enter');
    expect(p.deload).toBe(false);
    expect(p.sets).toHaveLength(3);
    expect(p.sets.every((s) => s.loadKg === null)).toBe(true);
  });
});

describe('récupération (§ 11.3 ; I2 consomme un snapshot nullable)', () => {
  const hist = [session(3, 100, [8, 8, 8])];

  it('snapshot absent ou nul : aucune modulation, aucun score inventé', () => {
    const none = prescribe(input({ history: hist }));
    for (const recovery of [null, { recovery: null, sleepHours: null, restingHrDelta: null }]) {
      const p = prescribe(input({ history: hist, recovery }));
      expect(p).toEqual(none);
      expect(p.reasons).not.toContain('recovery-low');
    }
  });

  it('snapshot explicitement `undefined` (donnée non fournie) : identique à l’absence', () => {
    const none = prescribe(input({ history: hist }));
    const x = { ...input({ history: hist }), recovery: undefined } as unknown as PrescribeInput;
    expect(prescribe(x)).toEqual(none);
  });

  it('phrase et alerte Recovery : pourcentage tiré de lowRecoveryLoad ; la série retirée d’un exercice d’isolation est dite', () => {
    const main = prescribe(input({ history: hist, recovery: SNAP(0), config: { ...CFG, lowRecoveryLoad: 0.9 } }));
    expect(main.loadKg).toBe(90);
    expect(explainPrescription(main)).toEqual({ key: 'recoveryLow', params: { cut: 10 } });
    const iso = prescribe(input({ exercise: ISO_CURL, history: [session(3, 40, [10, 10, 10])], target: target(8, 12), recovery: SNAP(0) }));
    expect(iso.reasons).toContain('recovery-set-removed');
    expect(explainPrescription(iso)).toEqual({ key: 'recoveryLowSet', params: { cut: 5 } });
    const deload = prescribe(input({ exercise: ISO_CURL, history: [session(3, 40, [10, 10, 10, 10])], target: target(8, 12, 4), recovery: SNAP(0), deload: true }));
    expect(deload.sets).toHaveLength(1); // 4 → 2 (deload) → 1 (Recovery)
    expect(constraintAlerts(deload)).toEqual([{ key: 'alertRecoveryLowSet', params: { cut: 5 } }]);
    // Une seule série : rien à retirer, l'alerte ne le prétend pas.
    const single = prescribe(input({ exercise: ISO_CURL, history: [session(3, 40, [10])], target: target(8, 12, 1), recovery: SNAP(0) }));
    expect(single.reasons).not.toContain('recovery-set-removed');
    expect(explainPrescription(single).key).toBe('recoveryLow');
  });

  it('Recovery 33 sur un exercice principal : charge × 0,95 (95 kg), séries inchangées', () => {
    const p = prescribe(input({ history: hist, recovery: SNAP(33) }));
    expect(p.headline).toBe('recovery-low');
    expect(p.loadKg).toBe(95);
    expect(p.sets.map((s) => s.reps)).toEqual([8, 8, 8]);
  });

  it('secondaire (isolation) : une série retirée, charge × 0,95 (40 → 38 kg)', () => {
    const p = prescribe(input({ exercise: ISO_CURL, history: [session(3, 40, [10, 10, 10])], target: target(8, 12), recovery: { recovery: null, sleepHours: 5.5, restingHrDelta: null } }));
    expect(p.loadKg).toBe(38);
    expect(p.sets.map((s) => s.reps)).toEqual([10, 10]);
  });

  it('borné par le maximum du matériel : jamais au-dessus de la référence ni du maximum', () => {
    const p = prescribe(input({ exercise: CURL, history: [session(3, 50, [10, 10, 10])], target: target(8, 12), recovery: SNAP(10) }));
    // 50 × 0,95 = 47,5 → 46 kg (haltères par 2) ; écart 1,5 / 46 = 3,26 % > 3 % → une répétition de plus.
    expect(p.loadKg).toBe(46);
    expect(p.sets.map((s) => s.reps)).toEqual([11, 11, 11]);
    expect(p.loadKg).toBeLessThanOrEqual(50);
  });

  it('pas de recalibrage « Facile » sous une contrainte : jamais de bonus', () => {
    const easy = [session(3, 100, [8, 8, 8], { difficulty: 'easy' })];
    expect(prescribe(input({ history: easy })).headline).toBe('recalibration');
    const p = prescribe(input({ history: easy, recovery: SNAP(20) }));
    expect(p.recalibration).toBeNull();
    expect(p.reasons).not.toContain('easy-recalibration');
    expect(p.loadKg).toBe(95);
  });
});

describe('combinaisons, décisions et stabilité', () => {
  it('fatigue + inactivité J28 + Recovery bas : réductions multipliées dans l’ordre, une phrase principale, les autres en alertes', () => {
    // 100 × 0,98 × 0,95 = 93,1 → 93 kg (demi-kilo inférieur) ; choix −5 % : 93 × 0,95 = 88,35 → 88 kg.
    const p = prescribe(input({ exercise: LEG_PRESS, history: [session(35, 100, [10, 10, 10]), session(28, 100, [7, 7, 7])], recovery: SNAP(30) }));
    expect(p.reasons).toEqual(['history-reference', 'fatigue-drop', 'inactivity-discount', 'recovery-low']);
    expect(p.headline).toBe('inactivity');
    expect(p.loadKg).toBe(93);
    expect(p.options).toEqual([
      { kind: 'fatigue-load', loadKg: 88, reps: [7, 7, 7] },
      { kind: 'fatigue-reps', loadKg: 93, reps: [5, 5, 5] },
    ]);
    expect(constraintAlerts(p).map((a) => a.key)).toEqual(['alertFatigue', 'alertRecoveryLow']);
  });

  it('deload + Recovery bas : 100 × 0,8 × 0,95 = 76 → 75 kg ; la phrase principale est le deload', () => {
    const p = prescribe(input({ history: [session(3, 100, [8, 8, 8, 8])], target: target(8, 10, 4), deload: true, recovery: SNAP(30) }));
    expect(p.headline).toBe('deload');
    expect(p.loadKg).toBe(75); // écart 1 / 75 = 1,3 % : pas de répétition ajoutée
    expect(p.sets).toHaveLength(2);
  });

  it('l’entrée d’Ali l’emporte : une décision postérieure à la dernière séance est rendue telle quelle, sans contrainte', () => {
    const history = [session(40, 100, [10, 10, 10]), session(30, 100, [7, 7, 7])];
    const lastDecision = { decidedAt: daysAgo(1), accepted: false, loadKg: 105, reps: [8, 8, 8] };
    const p = prescribe(input({ history, lastDecision, recovery: SNAP(10), deload: true }));
    expect(p.headline).toBe('decision');
    expect(p.loadKg).toBe(105);
    expect(p.options).toEqual([]);
    expect(p.reasons).toEqual(['decision-reference']);
  });

  it('décision refusée (antérieure à la séance faite) : la proposition ne dépend pas du refus', () => {
    const history = [session(6, 100, [10, 10, 10]), session(3, 100, [7, 7, 7])];
    const refused = { decidedAt: daysAgo(4), accepted: false, loadKg: null, reps: [] };
    expect(prescribe(input({ history, lastDecision: refused }))).toEqual(prescribe(input({ history })));
  });

  it('aucune contrainte ne crée de bonus : charge ≤ référence, séries ≤ cible, choix ≤ proposition', () => {
    const cases: PrescribeInput[] = [
      input({ history: [session(6, 100, [10, 10, 10]), session(3, 100, [7, 7, 7])] }),
      input({ history: [session(25, 100, [10, 10, 10])] }),
      input({ history: [session(3, 100, [10, 10, 10])], recovery: SNAP(0) }),
      input({ history: [session(3, 100, [10, 10, 10])], deload: true }),
      input({ exercise: ISO_CURL, history: [session(30, 20, [12, 12, 12])], recovery: SNAP(0), deload: true }),
    ];
    for (const x of cases) {
      const p = prescribe(x);
      expect(p.loadKg).not.toBeNull();
      expect(p.loadKg ?? Infinity).toBeLessThanOrEqual(p.reference?.loadKg ?? 0);
      expect(p.sets.length).toBeLessThanOrEqual(x.target.sets);
      for (const o of p.options ?? []) if (o.loadKg !== null) expect(o.loadKg).toBeLessThanOrEqual(p.loadKg ?? 0);
    }
  });

  it('ordre des raisons et des choix stable, historique dans n’importe quel ordre', () => {
    const history = [session(40, 100, [10, 10, 10]), session(37, 100, [10, 10, 10]), session(34, 100, [10, 10, 10]), session(31, 100, [7, 7, 7])];
    const a = prescribe(input({ exercise: LEG_PRESS, history, recovery: SNAP(1) }));
    const b = prescribe(input({ exercise: LEG_PRESS, history: [...history].reverse(), recovery: SNAP(1) }));
    expect(b).toEqual(a);
    const ranks = a.reasons.map((r) => REASON_ORDER.indexOf(r));
    expect([...ranks].sort((x, y) => x - y)).toEqual(ranks);
    const order = (a.options ?? []).map((o) => PROPOSAL_OPTION_ORDER.indexOf(o.kind));
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    expect((a.options ?? []).map((o) => o.kind)).toEqual(['fatigue-load', 'fatigue-reps', 'stall-variant', 'stall-range', 'stall-mini-deload']);
  });

  it('aucune mutation de l’entrée (historique gelé en profondeur)', () => {
    const history: ExerciseSession[] = [session(35, 100, [10, 10, 10]), session(28, 100, [7, 7, 7], { deload: false })];
    const x = input({ exercise: LEG_PRESS, history, recovery: SNAP(1), deload: true });
    const before = JSON.stringify(x);
    const freeze = (o: unknown): unknown => {
      if (o !== null && typeof o === 'object') {
        for (const v of Object.values(o)) freeze(v);
        Object.freeze(o);
      }
      return o;
    };
    freeze(x);
    expect(() => prescribe(x)).not.toThrow();
    expect(JSON.stringify(x)).toBe(before);
  });

  it('métrique hors moteur : aucune contrainte', () => {
    const p = prescribe(input({ exercise: PLANK, history: [session(40, 0, [45])], recovery: SNAP(0), deload: true }));
    expect(p.status).toBe('unsupported');
    expect(p.options).toEqual([]);
    expect(p.deload).toBe(false);
  });
});

describe('explication : une phrase par proposition et par choix', () => {
  it('phrase principale de chaque contrainte', () => {
    expect(explainPrescription(prescribe(input({ history: [session(6, 100, [10, 10, 10]), session(3, 100, [7, 7, 7])] })))).toEqual({ key: 'fatigue', params: {} });
    expect(explainPrescription(prescribe(input({ exercise: LEG_PRESS, history: [session(28, 100, [8, 8, 8])] })))).toEqual({ key: 'inactivity', params: { cut: 2 } });
    expect(explainPrescription(prescribe(input({ history: [session(3, 100, [8, 8, 8])], recovery: SNAP(0) })))).toEqual({ key: 'recoveryLow', params: { cut: 5 } });
  });

  it('chaque choix a sa phrase ; la stagnation s’annonce en alerte', () => {
    expect(explainOption({ kind: 'fatigue-load', loadKg: 95, reps: [7, 7, 7] }, CFG)).toEqual({ key: 'optionFatigueLoad', params: { cut: 5 } });
    expect(explainOption({ kind: 'fatigue-reps', loadKg: 100, reps: [5, 5, 5] }, CFG)).toEqual({ key: 'optionFatigueReps', params: { reps: 2 } });
    expect(explainOption({ kind: 'stall-variant', loadKg: null, reps: null }, CFG)).toEqual({ key: 'optionStallVariant', params: {} });
    expect(explainOption({ kind: 'stall-range', loadKg: null, reps: null }, CFG)).toEqual({ key: 'optionStallRange', params: {} });
    expect(explainOption({ kind: 'stall-mini-deload', loadKg: 90, reps: [8, 8, 8] }, CFG)).toEqual({ key: 'optionStallMiniDeload', params: { cut: 10 } });
    const flat = [session(12, 100, [8, 8, 8]), session(9, 100, [8, 8, 8]), session(6, 100, [8, 8, 8]), session(3, 100, [8, 8, 8])];
    expect(constraintAlerts(prescribe(input({ history: flat })))).toEqual([{ key: 'alertStall', params: { sessions: 3 } }]);
  });
});
