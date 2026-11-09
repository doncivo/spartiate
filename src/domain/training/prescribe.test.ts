import { describe, expect, it } from 'vitest';
import { CURL, CURL_EZ, DEADLIFT_TRAP, KETTLEBELL_GYM, LEG_PRESS, NOW, PLANK, STACK_GYM, SWING, daysAgo, input, session, set, target } from '../../../tests/fixtures/training/progression';
import { DEFAULT_PROGRESSION_CONFIG, ENGINE_VERSION, PRESCRIPTION_HEADLINES, REASON_ORDER } from './config';
import { positionMultiplier, prescribe, primaryMuscle } from './prescribe';
import type { ExerciseSession, Prescription } from './types';

/** I2-01, critères 4 à 9 (§ 11.2, D-72) : vecteurs calculés à la main sur le profil par défaut Fitness Park Antony. */

const loads = (p: Prescription): (number | null)[] => p.sets.map((s) => s.loadKg);
const reps = (p: Prescription): number[] => p.sets.map((s) => s.reps);

describe('sans historique (D-72 point 1)', () => {
  it('« à saisir » : aucune charge inventée, reps au bas de la plage, confiance 0', () => {
    const p = prescribe(input());
    expect(p.status).toBe('to-enter');
    expect(p.headline).toBe('to-enter');
    expect(p.reasons).toEqual(['no-history']);
    expect(p.loadKg).toBeNull();
    expect(loads(p)).toEqual([null, null, null]);
    expect(reps(p)).toEqual([8, 8, 8]);
    expect(p.confidence).toBe(0);
    expect(p.estimated1rmKg).toBeNull();
    expect(p.deltaKg).toBeNull();
    expect(p.reference).toBeNull();
  });

  it('historique sans aucune série exploitable (séance à 0 série faite) : « à saisir »', () => {
    const empty = { ...session(3, 60, [10]), sets: [set(60, null, { done: false })] };
    const p = prescribe(input({ history: [empty] }));
    expect(p.status).toBe('to-enter');
    expect(p.reasons).toEqual(['partial-session-ignored', 'no-history']);
  });
});

describe('échelle de répétitions 8-7-6 → 8-8-6 → 8-8-7 → 8-8-8 (critère 5)', () => {
  it.each([
    [[8, 7, 6], [8, 8, 6], 1],
    [[8, 8, 6], [8, 8, 7], 2],
    [[8, 8, 7], [8, 8, 8], 2],
  ])('%j → %j : une seule série gagne une répétition, charge inchangée', (done, expected, index) => {
    const p = prescribe(input({ history: [session(3, 60, done)], target: target(6, 8) }));
    expect(reps(p)).toEqual(expected);
    expect(loads(p)).toEqual([60, 60, 60]);
    expect(p.headline).toBe('rep-ladder');
    expect(p.ladderSetIndex).toBe(index);
    expect(p.deltaKg).toBe(0);
    expect(p.reasons).toEqual(['history-reference', 'rep-ladder']);
  });

  it('séries manquantes : complétées au plus par min(dernière, bas de plage) ; [9, 9] en 8-10 sur 3 séries → [10, 9, 8]', () => {
    const p = prescribe(input({ history: [session(3, 60, [9, 9])] }));
    expect(reps(p)).toEqual([10, 9, 8]);
    expect(p.reference?.reps).toEqual([9, 9, 8]);
  });

  it('dernière série à une charge plus basse : elle ne compte pas comme série au haut de plage → [10, 10, 9] à 60 kg', () => {
    const s: ExerciseSession = { ...session(3, 60, []), sets: [set(60, 10, { position: 0 }), set(60, 10, { position: 1 }), set(55, 10, { position: 2 })] };
    const p = prescribe(input({ history: [s] }));
    expect(reps(p)).toEqual([10, 10, 9]);
    expect(loads(p)).toEqual([60, 60, 60]);
  });
});

describe('hausse d’un cran au haut de la plage (critère 6)', () => {
  it('barre 60 kg × 10-10-10 en 8-10 : +2,5 kg, 62,5 kg × 8-8-8', () => {
    const p = prescribe(input({ history: [session(3, 60, [10, 10, 10])] }));
    expect(p.status).toBe('prescribed');
    expect(p.headline).toBe('increase');
    expect(p.loadKg).toBe(62.5);
    expect(loads(p)).toEqual([62.5, 62.5, 62.5]);
    expect(reps(p)).toEqual([8, 8, 8]);
    expect(p.deltaKg).toBe(2.5);
    expect(p.reasons).toEqual(['history-reference', 'top-reached']);
    expect(p.reference).toEqual({ loadKg: 60, reps: [10, 10, 10], e1rmKg: 80 });
    expect(p.estimated1rmKg).toBe(80);
  });

  it('haltères 10 kg × 12-12-12 en 8-12 : 12 kg × 8-8-8 (1RM implicite 15,2 ≤ 14 × 1,1)', () => {
    const p = prescribe(input({ exercise: CURL, history: [session(3, 10, [12, 12, 12])], target: target(8, 12) }));
    expect(p.loadKg).toBe(12);
    expect(reps(p)).toEqual([8, 8, 8]);
    expect(p.deltaKg).toBe(2);
  });

  it('charge non entière hors grille (61,25 kg) : cran suivant de la barre, 62,5 kg', () => {
    const p = prescribe(input({ history: [session(3, 61.25, [10, 10, 10])] }));
    expect(p.loadKg).toBe(62.5);
    expect(p.deltaKg).toBe(1.25);
  });

  it('une seule série : 60 kg × 10 → 62,5 kg × 8', () => {
    const p = prescribe(input({ history: [session(3, 60, [10])], target: target(8, 10, 1) }));
    expect(p.sets).toEqual([{ reps: 8, loadKg: 62.5 }]);
  });

  it('machine à pas de 5 kg : 100 kg × 10 → 105 kg × 8', () => {
    const p = prescribe(input({ exercise: LEG_PRESS, equipment: STACK_GYM, history: [session(3, 100, [10, 10, 10])] }));
    expect(p.loadKg).toBe(105);
    expect(p.reasons).toEqual(['history-reference', 'top-reached']);
  });

  it('machine sans palier connu (Fitness Park Antony) ou aucun profil : +2,5 kg par défaut, signalé', () => {
    for (const equipment of [undefined, null]) {
      const p = prescribe(input({ exercise: LEG_PRESS, history: [session(3, 100, [10, 10, 10])], ...(equipment === null ? { equipment: null } : {}) }));
      expect(p.loadKg).toBe(102.5);
      expect(p.reasons).toEqual(['history-reference', 'top-reached', 'increment-unknown']);
    }
  });

  it('charge maximale du matériel (haltère 50 kg) : pas de hausse, une répétition de plus sur une série', () => {
    const p = prescribe(input({ exercise: CURL, history: [session(3, 50, [12, 12, 12])], target: target(8, 12) }));
    expect(p.loadKg).toBe(50);
    expect(reps(p)).toEqual([13, 12, 12]);
    expect(p.headline).toBe('extra-rep');
    expect(p.reasons).toEqual(['history-reference', 'top-reached', 'equipment-max']);
  });
});

describe('plafond +10 % du 1RM par séance (D-72 point 7)', () => {
  it('haltère 4 kg × 12-12 en 10-12 : 6 kg × 10 donnerait 8 kg > 5,6 × 1,1 = 6,16 ; reste à 4 kg, une répétition de plus', () => {
    const p = prescribe(input({ exercise: CURL, history: [session(3, 4, [12, 12])], target: target(10, 12, 2) }));
    expect(p.loadKg).toBe(4);
    expect(reps(p)).toEqual([13, 12]);
    expect(p.headline).toBe('extra-rep');
    expect(p.reasons).toEqual(['history-reference', 'top-reached', 'gain-capped']);
    expect(p.deltaKg).toBe(0);
  });
});

describe('difficulté (critère 7)', () => {
  it('Dur au haut de la plage : hausse bloquée, même charge et mêmes reps', () => {
    const p = prescribe(input({ history: [session(3, 60, [10, 10, 10], { difficulty: 'hard' })] }));
    expect(p.loadKg).toBe(60);
    expect(reps(p)).toEqual([10, 10, 10]);
    expect(p.headline).toBe('hold-hard');
    expect(p.reasons).toEqual(['history-reference', 'top-reached', 'hard-blocks-increase']);
  });

  it('RIR ≤ 1 sur une série, difficulté non saisie : hausse bloquée', () => {
    const s = session(3, 60, [10, 10, 10]);
    const p = prescribe(input({ history: [{ ...s, sets: s.sets.map((x, i) => ({ ...x, rir: i === 2 ? 1 : 3 })) }] }));
    expect(p.headline).toBe('hold-hard');
  });

  it('Dur sous le haut de la plage : l’échelle de répétitions continue (seule la hausse de charge est bloquée)', () => {
    const p = prescribe(input({ history: [session(3, 60, [8, 7, 6], { difficulty: 'hard' })], target: target(6, 8) }));
    expect(reps(p)).toEqual([8, 8, 6]);
    expect(p.headline).toBe('rep-ladder');
  });

  it('RIR ≥ 4 sur toutes les séries : confirme le cran', () => {
    const s = session(3, 60, [10, 10, 10]);
    const p = prescribe(input({ history: [{ ...s, sets: s.sets.map((x) => ({ ...x, rir: 4 })) }] }));
    expect(p.loadKg).toBe(62.5);
    expect(p.reasons).toEqual(['history-reference', 'top-reached', 'easy-confirms']);
  });

  it('Facile avec confiance ≥ 60 % : cran normal, pas de recalibrage', () => {
    const p = prescribe(input({ history: [session(7, 60, [10, 10, 10]), session(3, 60, [10, 10, 10], { difficulty: 'easy' })] }));
    expect(p.confidence).toBeCloseTo(1, 10);
    expect(p.loadKg).toBe(62.5);
    expect(p.recalibration).toBeNull();
    expect(p.reasons).toEqual(['history-reference', 'top-reached', 'easy-confirms']);
  });

  it('Facile avec confiance < 60 % : +5 % à la place du cran, 60 × 1,05 = 63 → 62,5 kg (écart 0,8 %), 1RM recalibré 76 × 1,05', () => {
    const p = prescribe(input({ history: [session(3, 60, [8, 8, 8], { difficulty: 'easy' })] }));
    expect(p.confidence).toBeCloseTo(0.5, 10);
    expect(p.headline).toBe('recalibration');
    expect(p.loadKg).toBe(62.5);
    expect(reps(p)).toEqual([8, 8, 8]);
    expect(p.reasons).toEqual(['history-reference', 'easy-recalibration']);
    expect(p.recalibration?.at).toBe(NOW);
    expect(p.recalibration?.estimated1rmKg).toBeCloseTo(79.8, 10);
  });

  it('recalibrage sur haltères : 10 × 1,05 = 10,5 → 10 kg, charge inchangée → pas de recalibrage, échelle de répétitions (I4-08 ; avant : 11-11-11 « +0 kg »)', () => {
    const p = prescribe(input({ exercise: CURL, history: [session(3, 10, [10, 10, 10], { difficulty: 'easy' })], target: target(8, 12) }));
    expect(p.loadKg).toBe(10);
    expect(reps(p)).toEqual([11, 10, 10]);
    expect(p.reasons).toEqual(['history-reference', 'rep-ladder']);
    expect(p.recalibration).toBeNull();
  });

  it('une fois par exercice et par 30 jours : recalibrage il y a 10 jours → échelle de répétitions ; il y a 30 jours → recalibrage', () => {
    const history = [session(3, 60, [8, 8, 8], { difficulty: 'easy' })];
    const recent = prescribe(input({ history, profile: { estimated1rmKg: 76, confidence: 0.5, lastEasyRecalibrationAt: daysAgo(10) } }));
    expect(recent.headline).toBe('rep-ladder');
    expect(reps(recent)).toEqual([9, 8, 8]);
    expect(recent.recalibration).toBeNull();
    const old = prescribe(input({ history, profile: { estimated1rmKg: 76, confidence: 0.5, lastEasyRecalibrationAt: daysAgo(30) } }));
    expect(old.headline).toBe('recalibration');
  });

  it('Facile contredit par un RIR ≤ 1 : la prudence l’emporte, aucun recalibrage', () => {
    const s = session(3, 60, [8, 8, 8], { difficulty: 'easy' });
    const p = prescribe(input({ history: [{ ...s, sets: s.sets.map((x) => ({ ...x, rir: 1 })) }] }));
    expect(p.recalibration).toBeNull();
    expect(p.headline).toBe('rep-ladder');
  });
});

describe('décision d’Ali (critère 8)', () => {
  it('décision postérieure à la dernière séance : sa valeur effective est rendue telle quelle', () => {
    const p = prescribe(input({ history: [session(3, 60, [10, 10, 10])], lastDecision: { decidedAt: daysAgo(1), accepted: false, loadKg: 57.5, reps: [8, 8, 8] } }));
    expect(p.status).toBe('prescribed');
    expect(p.headline).toBe('decision');
    expect(p.sets).toEqual([{ reps: 8, loadKg: 57.5 }, { reps: 8, loadKg: 57.5 }, { reps: 8, loadKg: 57.5 }]);
    expect(p.reasons).toEqual(['decision-reference']);
  });

  it('décision antérieure à la dernière séance : l’historique fait foi (la séance a été faite après)', () => {
    const p = prescribe(input({ history: [session(3, 60, [10, 10, 10])], lastDecision: { decidedAt: daysAgo(5), accepted: true, loadKg: 60, reps: [10, 10, 10] } }));
    expect(p.headline).toBe('increase');
    expect(p.loadKg).toBe(62.5);
  });

  it('première charge saisie par Ali sans historique : elle sert telle quelle ; décision sans charge : « à saisir »', () => {
    const first = prescribe(input({ lastDecision: { decidedAt: daysAgo(0), accepted: false, loadKg: 40, reps: [10, 10, 10] } }));
    expect(first.status).toBe('prescribed');
    expect(first.loadKg).toBe(40);
    const none = prescribe(input({ lastDecision: { decidedAt: daysAgo(0), accepted: false, loadKg: null, reps: [10, 10, 10] } }));
    expect(none.status).toBe('to-enter');
    expect(none.headline).toBe('decision');
  });
});

describe('validation de l’historique', () => {
  it('dernière séance faite à moins de 50 % : ignorée, la précédente sert de référence', () => {
    const old = session(7, 60, [10, 10, 10]);
    const partial = { ...session(2, 62.5, []), sets: [set(62.5, 8, { position: 0 }), set(62.5, null, { position: 1, done: false }), set(62.5, null, { position: 2, done: false })] };
    const p = prescribe(input({ history: [old, partial] }));
    expect(p.loadKg).toBe(62.5);
    expect(p.reasons).toEqual(['partial-session-ignored', 'history-reference', 'top-reached']);
  });

  it('charge aberrante non confirmée : écartée du 1RM, mais reste la référence de charge sans hausse ; confirmée : elle progresse', () => {
    // Relecture de la PR #60 (B1) : avant, la séance aberrante était écartée et la charge retombait sur l'ancienne (102,5 kg), pour toujours.
    const old = session(10, 100, [5, 5, 5]);
    const outlier = session(3, 200, [5, 5, 5]);
    const p = prescribe(input({ history: [old, outlier], target: target(3, 5) }));
    expect(p.reasons).toEqual(['outlier-excluded', 'history-reference', 'rep-ladder']);
    expect(p.loadKg).toBe(200);
    expect(p.estimated1rmKg ?? 0).toBeLessThan(150);
    const confirmed = { ...outlier, sets: outlier.sets.map((x) => ({ ...x, confirmed: true })) };
    expect(prescribe(input({ history: [old, confirmed], target: target(3, 5) })).loadKg).toBe(202.5);
  });

  it('confiance < 0,4 : prescription provisoire (une séance de 2 séries à 40 jours)', () => {
    const p = prescribe(input({ history: [session(40, 60, [10, 10])], target: target(8, 10, 2) }));
    expect(p.confidence).toBeLessThan(0.4);
    // I2-02 (D-72 point 10) : 40 jours sans le muscle → (40 − 14) / 7 = 3 semaines, −3 % ; 60 × 0,97 = 58,2 → 57,5 kg, progression suspendue.
    expect(p.reasons).toEqual(['history-reference', 'provisional', 'inactivity-discount']);
    expect(p.loadKg).toBe(57.5);
  });
});

describe('métrique non prise en charge', () => {
  it('exercice chronométré : « non pris en charge », aucune charge', () => {
    const p = prescribe(input({ exercise: PLANK, history: [session(3, 0, [45])] }));
    expect(p.status).toBe('unsupported');
    expect(p.headline).toBe('unsupported');
    expect(p.reasons).toEqual(['unsupported-metric']);
    expect(p.sets).toEqual([]);
    expect(p.loadKg).toBeNull();
  });
});

describe('déterminisme, version, explication (critère 9)', () => {
  const history = [session(12, 57.5, [10, 9, 8]), session(8, 60, [9, 8, 8]), session(5, 60, [10, 9, 9], { difficulty: 'ok' }), session(2, 60, [10, 10, 9])];

  it('même entrée → même prescription, quel que soit l’ordre de l’historique', () => {
    const a = prescribe(input({ history }));
    const b = prescribe(input({ history: [...history].reverse() }));
    const c = prescribe(input({ history: [history[2], history[0], history[3], history[1]] as ExerciseSession[] }));
    expect(b).toEqual(a);
    expect(c).toEqual(a);
    expect(prescribe(input({ history }))).toEqual(a);
  });

  it('version du moteur et configuration active jointes', () => {
    const p = prescribe(input({ history }));
    expect(p.engineVersion).toBe(ENGINE_VERSION);
    expect(ENGINE_VERSION).toBe(3); // I2-04 : raison `grid-to-verify` (matériel à vérifier)
    expect(p.activeConfig).toEqual(DEFAULT_PROGRESSION_CONFIG);
  });

  it('les raisons suivent l’ordre normatif et chaque prescription a une seule raison principale connue', () => {
    const cases = [
      prescribe(input()),
      prescribe(input({ history })),
      prescribe(input({ history: [session(3, 60, [10, 10, 10])] })),
      prescribe(input({ history: [session(3, 60, [10, 10, 10], { difficulty: 'hard' })] })),
      prescribe(input({ exercise: PLANK })),
    ];
    for (const p of cases) {
      const ranks = p.reasons.map((r) => REASON_ORDER.indexOf(r));
      expect(ranks.every((r) => r >= 0)).toBe(true);
      expect([...ranks].sort((x, y) => x - y)).toEqual(ranks);
      expect(PRESCRIPTION_HEADLINES).toContain(p.headline);
    }
  });

  it('l’explication tient en une phrase : delta, référence (séries × reps) et confiance suffisent (« +2,5 kg : 3 × 10 atteint la dernière fois »)', () => {
    const p = prescribe(input({ history: [session(3, 60, [10, 10, 10])] }));
    expect({ headline: p.headline, deltaKg: p.deltaKg, sets: p.reference?.reps.length, reps: p.reference?.reps[0] }).toEqual({ headline: 'increase', deltaKg: 2.5, sets: 3, reps: 10 });
  });
});

describe('cas limites (passe qa-test)', () => {
  it('Juste explicite au haut de la plage : cran sans « Facile confirme »', () => {
    const p = prescribe(input({ history: [session(3, 60, [10, 10, 10], { difficulty: 'ok' })] }));
    expect(p.loadKg).toBe(62.5);
    expect(p.reasons).toEqual(['history-reference', 'top-reached']);
  });

  it('reps fixes (5 × 5) : toutes à 5 → cran ; RIR absent sur certaines séries, 4 sur les autres → Facile confirme', () => {
    const s = session(3, 100, [5, 5, 5, 5, 5]);
    const p = prescribe(input({ history: [{ ...s, sets: s.sets.map((x, i) => ({ ...x, rir: i % 2 === 0 ? null : 4 })) }], target: target(5, 5, 5) }));
    expect(p.loadKg).toBe(102.5);
    expect(reps(p)).toEqual([5, 5, 5, 5, 5]);
    expect(p.reasons).toEqual(['history-reference', 'top-reached', 'easy-confirms']);
  });

  it('plus de séries faites que prévues : les premières comptent (4 × 10 pour 3 prévues → cran)', () => {
    const p = prescribe(input({ history: [session(3, 60, [10, 10, 10, 10])] }));
    expect(p.loadKg).toBe(62.5);
    expect(p.sets).toHaveLength(3);
  });

  it('séries de travail avec 0 rep ou sans charge : non exploitables, « à saisir »', () => {
    const s: ExerciseSession = { ...session(3, 60, []), sets: [set(60, 0, { position: 0 }), set(null, 10, { position: 1 })] };
    const p = prescribe(input({ history: [s] }));
    expect(p.status).toBe('to-enter');
    expect(p.reasons).toEqual(['partial-session-ignored', 'no-history']);
  });

  it('séance ignorée plus ancienne que la dernière séance valide : aucune raison de validation', () => {
    const partial = { ...session(9, 60, []), sets: [set(60, 10, { position: 0 }), set(60, null, { position: 1, done: false }), set(60, null, { position: 2, done: false })] };
    const p = prescribe(input({ history: [partial, session(3, 60, [10, 10, 10])] }));
    expect(p.reasons).toEqual(['history-reference', 'top-reached']);
  });

  it('kettlebell au maximum d’une liste vérifiée (34 kg) : pas de hausse ; décision sans reps : reps au bas de la plage', () => {
    const p = prescribe(input({ exercise: SWING, equipment: KETTLEBELL_GYM, history: [session(3, 34, [10, 10, 10])] }));
    expect(p.loadKg).toBe(34);
    expect(p.reasons).toContain('equipment-max');
    const d = prescribe(input({ lastDecision: { decidedAt: NOW, accepted: false, loadKg: 20, reps: [] } }));
    expect(d.sets).toEqual([{ reps: 8, loadKg: 20 }, { reps: 8, loadKg: 20 }, { reps: 8, loadKg: 20 }]);
  });

  // Liste vérifiée (KETTLEBELL_GYM) : avec Fitness Park Antony, les kettlebells sont à pas inconnu (test suivant), d’où le profil explicite.
  it('kettlebell sous le maximum d’une liste vérifiée : cran vers la charge suivante (4 → 34 kg plafonné)', () => {
    const p = prescribe(input({ exercise: SWING, equipment: KETTLEBELL_GYM, history: [session(3, 4, [10, 10, 10])] }));
    expect(p.loadKg).toBe(4);
    expect(reps(p)).toEqual([11, 10, 10]);
    expect(p.reasons).toEqual(['history-reference', 'top-reached', 'gain-capped']);
  });

  it('kettlebells à pas inconnu (Fitness Park Antony) : cran supposé, signalé increment-unknown, jamais 34 kg après 16 kg', () => {
    const p = prescribe(input({ exercise: SWING, history: [session(3, 16, [10, 10, 10])] }));
    expect(p.loadKg).toBe(18.5);
    expect(p.reasons).toEqual(['history-reference', 'top-reached', 'increment-unknown']);
  });

  it('barre EZ (8,5 kg) : 21 kg = 8,5 + 2 × 6,25 au haut de la plage → 23,5 kg, jamais 22,5 kg', () => {
    const p = prescribe(input({ exercise: CURL_EZ, history: [session(3, 21, [12, 12, 12])], target: target(8, 12) }));
    expect(p.loadKg).toBe(23.5);
    expect(p.loadKg).not.toBe(22.5);
    expect(p.reasons).toEqual(['history-reference', 'top-reached']);
  });

  it('barre hexagonale (18 kg) : 63 kg × 8-8-8 en 6-8 → 65,5 kg', () => {
    const p = prescribe(input({ exercise: DEADLIFT_TRAP, history: [session(3, 63, [8, 8, 8])], target: target(6, 8) }));
    expect(p.loadKg).toBe(65.5);
  });

  it('barre non reliée à un matériel : aucune grille, cran supposé signalé', () => {
    const unlinked = { inventory: { ...KETTLEBELL_GYM.inventory, barbells: [{ type: 'Barre', weightKg: 20 }] }, increments: KETTLEBELL_GYM.increments };
    const p = prescribe(input({ equipment: unlinked, history: [session(3, 60, [10, 10, 10])] }));
    expect(p.loadKg).toBe(62.5);
    expect(p.reasons).toEqual(['history-reference', 'top-reached', 'increment-unknown']);
  });

  it('paire d’haltères hors grille (9 kg) : la référence reste disponible ; +5 % → 9 kg, charge inchangée → échelle de répétitions (I4-08)', () => {
    const p = prescribe(input({ exercise: CURL, history: [session(3, 9, [10, 10, 10], { difficulty: 'easy' })], target: target(8, 12) }));
    expect(p.loadKg).toBe(9);
    expect(reps(p)).toEqual([11, 10, 10]);
    expect(p.reasons).toEqual(['history-reference', 'rep-ladder']);
  });

  it('séances terminées au même instant : départage stable par identifiant', () => {
    const a = { ...session(3, 60, [10, 10, 10]), workoutId: 'w-a' };
    const b = { ...session(3, 50, [10, 10, 10]), workoutId: 'w-b' };
    expect(prescribe(input({ history: [a, b] })).reference?.loadKg).toBe(50);
    expect(prescribe(input({ history: [b, a] })).reference?.loadKg).toBe(50);
  });
});

describe('muscle principal et position (D-72 point 5 ; appliqués par la génération, I3)', () => {
  it('muscle principal : premier muscle de poids maximal dans l’ordre des données', () => {
    expect(primaryMuscle([{ id: 'chest', weight: 1 }, { id: 'triceps', weight: 0.5 }])).toBe('chest');
    expect(primaryMuscle([{ id: 'lats', weight: 1 }, { id: 'middle-traps', weight: 1 }, { id: 'biceps', weight: 0.5 }])).toBe('lats');
    expect(primaryMuscle([{ id: 'a', weight: 0.5 }, { id: 'b', weight: 0.8 }])).toBe('b');
    expect(primaryMuscle([])).toBeNull();
  });

  it('multiplicateur de position : 1, 0,93, 0,88, puis 0,88', () => {
    expect([1, 2, 3, 4].map((rank) => positionMultiplier(rank, DEFAULT_PROGRESSION_CONFIG))).toEqual([1, 0.93, 0.88, 0.88]);
    expect(positionMultiplier(0, DEFAULT_PROGRESSION_CONFIG)).toBe(1);
  });
});

describe('aucune lecture d’horloge : `now` est un argument', () => {
  it('la récence se calcule depuis `now`', () => {
    const later = prescribe(input({ history: [session(3, 60, [10, 10, 10])], now: new Date(Date.parse(NOW) + 100 * 86_400_000).toISOString() as typeof NOW }));
    expect(later.confidence).toBeCloseTo(0.2, 10);
    expect(later.reasons).toContain('provisional');
  });
});
