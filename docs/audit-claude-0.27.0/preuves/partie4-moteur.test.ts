// AUDIT-CLAUDE-0.27.0, partie 4 : moteur d'entraînement. Jamais branché sur la CI.
// « ROUGE C-xxx » : assertion de la spécification ; un échec est la preuve du constat. « VECTEUR » : valeur recalculée à la main, attendue verte.
// Données entièrement synthétiques (D-38).
import { describe, expect, it } from 'vitest';
import { FITNESS_PARK_ANTONY, CURL, input, session, target } from '../../../tests/fixtures/training/progression';
import { DEFAULT_GENERATION_CONFIG as GC, DEFAULT_PROGRESSION_CONFIG as CFG } from '../../../src/domain/training/config';
import { prescribe } from '../../../src/domain/training/prescribe';
import { current1rmFromSessions, epley, setWeight } from '../../../src/domain/training/estimate1rm';
import { confidenceScore, dispersion, recencyFactor } from '../../../src/domain/training/confidence';
import { inactivityCut, repsDrop } from '../../../src/domain/training/constraints';
import { loadGrid, snapToEquipment } from '../../../src/domain/training/loadGrid';
import { warmupForExercise, warmupRamp } from '../../../src/domain/training/warmup';
import { routineDiff } from '../../../src/domain/training/closure';
import { createMesocycleSpec, linePlanSets, mesocycleState } from '../../../src/domain/training/mesocycle';
import { pauseProgram, resumeProposal } from '../../../src/domain/training/programPause';
import { nextProgramDay, programDayFor } from '../../../src/domain/training/programDay';
import { recoverySplit } from '../../../src/domain/training/recoverySplit';
import { percentileOf, tierOf } from '../../../src/domain/training/strengthScore';
import { addTrackPoint, emptyTrack, haversineM } from '../../../src/domain/cardio/track';
import type { ProgressionEquipment } from '../../../src/domain/training/types';
import type { LocalDate } from '../../../src/domain/types';

const D = (s: string) => s as LocalDate;

// Exercice personnalisé « tractions à la machine assistée » : métrique par défaut du formulaire (load-reps, LibraryView.tsx:397) et
// matériel assisted-pull-up-machine → assisted: true (prescriptionInput.ts:46). Exercice personnalisé : bodyweightFraction absent.
const ASSISTED = { id: 'custom-assisted', metric: 'load-reps', equipment: ['assisted-pull-up-machine'], kind: 'compound', assisted: true } as const;
const ASSIST_GYM: ProgressionEquipment = {
  inventory: { ...FITNESS_PARK_ANTONY.inventory, available: [...FITNESS_PARK_ANTONY.inventory.available, 'assisted-pull-up-machine'], machines: [{ equipmentId: 'assisted-pull-up-machine', stackMinKg: 5, stackMaxKg: 100, stepKg: 5 }] },
  increments: FITNESS_PARK_ANTONY.increments,
};

describe('C-001 exercice assisté hors décharge : la charge saisie est l’assistance', () => {
  it('ROUGE C-001a haut de plage atteint, « Juste » : la progression ne doit pas AUGMENTER l’assistance (> 30 kg = exercice plus facile dit « hausse »)', () => {
    const p = prescribe(input({ exercise: ASSISTED, equipment: ASSIST_GYM, history: [session(2, 30, [10, 10, 10], { difficulty: 'ok' })] }));
    expect(p.loadKg).not.toBeNull();
    expect(p.loadKg as number).toBeLessThanOrEqual(30);
  });
  it('ROUGE C-001a2 même cas sans grille connue (machine non décrite) : pas de hausse de l’assistance', () => {
    const p = prescribe(input({ exercise: ASSISTED, equipment: null, history: [session(2, 30, [10, 10, 10], { difficulty: 'ok' })] }));
    expect(p.loadKg as number).toBeLessThanOrEqual(30);
  });
  it('ROUGE C-001b 84 jours sans l’exercice : la décote d’inactivité ne doit pas BAISSER l’assistance (exercice alourdi)', () => {
    const p = prescribe(input({ exercise: ASSISTED, equipment: ASSIST_GYM, history: [session(84, 30, [8, 8, 8])] }));
    expect(p.loadKg as number).toBeGreaterThanOrEqual(30);
  });
  it('ROUGE C-001c rang 2 dans la séance, poids de corps inconnu : la décote de position ne doit pas BAISSER l’assistance', () => {
    const p = prescribe(input({ exercise: ASSISTED, equipment: ASSIST_GYM, history: [session(2, 30, [8, 8, 8])], positionRank: 2, lastPositionRank: 1 }));
    expect(p.loadKg as number).toBeGreaterThanOrEqual(30);
  });
  it('ROUGE C-002 échauffement d’un assisté : aucune série d’échauffement plus dure (assistance plus faible) que le travail', () => {
    const w = warmupForExercise(ASSISTED, 30, ASSIST_GYM);
    expect(w.every((s) => s.loadKg >= 30)).toBe(true);
  });
});

describe('C-003 écart de routine avec un même exercice sur deux lignes (validateRoutineDay l’accepte hors groupe)', () => {
  it('ROUGE séance identique au jour (3 + 2 séries de développé couché) : aucun écart proposé', () => {
    const line = (id: string, sets: number) => ({ id, exerciseId: 'bench', exerciseName: 'Développé couché', sets, deletedAt: null });
    const day = { id: 'd1', deletedAt: null, exercises: [line('L1', 3), line('L2', 2)] };
    const sets = [0, 1, 2, 3, 4].map((position) => ({ id: `s${position}`, position, exerciseId: 'bench', exerciseName: 'Développé couché', setKind: 'work', deletedAt: null, targetRepsMin: 8, targetRepsMax: 10, targetRestSec: 120 }));
    const diff = routineDiff({ routineDayId: 'd1', sets } as never, day as never);
    expect(diff.setsChanged).toEqual([]);
    expect(diff.hasChanges).toBe(false);
  });
});

describe('C-004 recalibrage « Facile » en confiance provisoire (§ 11.3 : < 0,4 → hausse ≤ 1 cran)', () => {
  it('ROUGE une seule série 100 × 8 « Facile » la veille (confiance 0,367) : au plus un cran de barre (102,5 kg)', () => {
    const p = prescribe(input({ history: [session(1, 100, [8], { difficulty: 'easy' })] }));
    expect(p.confidence).toBeLessThan(0.4);
    expect(p.loadKg as number).toBeLessThanOrEqual(102.5);
  });
});

describe('C-005 charge aberrante de toute une séance (faute de frappe 1 000 kg)', () => {
  it('ROUGE la charge prescrite ne reprend pas une charge > 150 % du 1RM courant non confirmée', () => {
    const p = prescribe(input({ history: [session(2, 1000, [8, 8, 8]), session(9, 100, [8, 8, 8])] }));
    expect(p.loadKg as number).toBeLessThan(150);
  });
});

describe('C-006 décharge (D-269 : × 0,9 arrondi VERS LE BAS au cran, par haltère)', () => {
  it('ROUGE haltères 26 kg × 10 en décharge de cycle de 4 semaines : 22 kg sans répétition ajoutée', () => {
    const p = prescribe(input({ exercise: CURL, history: [session(2, 26, [10, 10, 10])], target: target(8, 12), deload: true, deloadSets: 2, deloadLoad: 0.9 }));
    expect(p.loadKg).toBe(22);
    expect(p.sets.map((s) => s.reps)).toEqual([10, 10]);
  });
});

describe('C-007 grille de la barre et disques réellement disponibles', () => {
  it('ROUGE barre 20 kg, un disque de 20 et un de 2,5 par côté : 45 kg n’est pas montable', () => {
    const profile: ProgressionEquipment = { inventory: { ...FITNESS_PARK_ANTONY.inventory, platesPerSideKg: [{ weightKg: 20, count: 1 }, { weightKg: 2.5, count: 1 }] }, increments: FITNESS_PARK_ANTONY.increments };
    expect(loadGrid(['barbell'], profile)?.loads).not.toContain(45);
  });
});

describe('C-008 tracé GPS immobile', () => {
  it('ROUGE 61 points à l’arrêt, bruit de 10 m, précision 20 m : distance < 50 m', () => {
    let s = emptyTrack();
    for (let i = 0; i <= 60; i += 1) s = addTrackPoint(s, { lat: 0, lon: i % 2 ? 0.00009 : 0, at: i * 5000, accuracyM: 20 });
    expect(s.distanceM).toBeLessThan(50);
  });
});

describe('C-009 Recovery Split (§ 12.1 : muscles ≥ 80 % ; D-93 : 50 %)', () => {
  it('ROUGE muscle à 79 % : non prêt selon le PRD', () => {
    expect(recoverySplit(['m'], [{ muscleId: 'm', percent: 79 }])[0]?.readiness).not.toBe('ready');
  });
});

// ---------------------------------------------------------------------------------------------------------------- vecteurs
describe('VECTEURS § 11.3 recalculés à la main', () => {
  it('Epley et pondérations', () => {
    expect(epley(100, 8)).toBeCloseTo(126.667, 3); // 100 × (1 + 8/30)
    expect(setWeight({ loadKg: 50, reps: 8 }, 100, CFG)).toBe(0.25); // e1RM 63,3 < 60 % de 100 ? non : charge 50 < 60 % de 100 → 0,25
    expect(setWeight({ loadKg: 80, reps: 16 }, 100, CFG)).toBe(0.25); // > 15 reps
    // (120×1×1 + 110×1×0,6 + 100×0,25×0,3) / (1 + 0,6 + 0,075) = 193,5 / 1,675
    expect(current1rmFromSessions([{ e1rmKg: 120, quality: 1 }, { e1rmKg: 110, quality: 1 }, { e1rmKg: 100, quality: 0.25 }], CFG)).toBeCloseTo(115.522, 3);
  });
  it('confiance 0,4 / 0,3 / 0,3', () => {
    expect(recencyFactor(14, CFG)).toBe(1);
    expect(recencyFactor(37, CFG)).toBeCloseTo(0.5, 6); // (60 − 37) / 46
    expect(recencyFactor(60, CFG)).toBe(0);
    expect(dispersion([100, 110, 120])).toBeCloseTo(0.074227, 5); // σ population 8,165 / 110
    expect(confidenceScore({ validSets: 3, dispersion: 0.1, recency: 0.5 }, CFG)).toBeCloseTo(0.62, 6); // 0,4×0,5 + 0,3×0,9 + 0,3×0,5
  });
  it('double progression : un cran de barre, échelle 8-7-6 → 8-8-6, « Dur » bloque', () => {
    expect(prescribe(input({ history: [session(2, 100, [10, 10, 10])] })).loadKg).toBe(102.5);
    const ladder = prescribe(input({ history: [session(2, 100, [8, 7, 6])], target: target(6, 8) })); // haut de plage 8, comme l’exemple du § 11.2
    expect([ladder.loadKg, ladder.sets.map((s) => s.reps)]).toEqual([100, [8, 8, 6]]);
    expect(prescribe(input({ history: [session(2, 100, [10, 10, 10], { difficulty: 'hard' })] })).loadKg).toBe(100);
  });
  it('plafond +10 % du 1RM : 10 kg × 10 → cible 12,5 refusée (epley 15,83 > 13,33 × 1,1)', () => {
    const p = prescribe(input({ history: [session(2, 10, [10, 10, 10])], equipment: null }));
    expect(p.loadKg).toBe(10);
    expect(p.reasons).toContain('gain-capped');
  });
  it('décote de position 0,93 (rang 2, référence au rang 1) sans grille : 93 kg', () => {
    expect(prescribe(input({ history: [session(2, 100, [8, 8, 8])], equipment: null, positionRank: 2, lastPositionRank: 1 })).loadKg).toBe(93);
  });
  it('inactivité : 0 avant J21 (D-72), −1 %/semaine, plancher −10 % ; 28 j sans grille → 98 kg', () => {
    expect([inactivityCut(20, CFG), inactivityCut(21, CFG), inactivityCut(28, CFG), inactivityCut(84, CFG), inactivityCut(200, CFG)]).toEqual([0, 0.01, 0.02, 0.1, 0.1]);
    expect(prescribe(input({ history: [session(28, 100, [8, 8, 8])], equipment: null })).loadKg).toBe(98);
  });
  it('fatigue intra-séance : baisse > 20 % stricte', () => {
    expect(repsDrop([10, 10, 10], [8, 8, 7])).toBeCloseTo(0.2333, 4);
    expect(repsDrop([10, 10, 10], [8, 8, 8])).toBeCloseTo(0.2, 6);
  });
  it('décharge 5 semaines (× 0,8, séries ÷ 2) et de cycle 4/6 semaines (2 séries, × 0,9) sans grille', () => {
    const d5 = prescribe(input({ history: [session(2, 100, [8, 8, 8])], equipment: null, deload: true }));
    expect([d5.loadKg, d5.sets.length]).toEqual([80, 1]);
    const d4 = prescribe(input({ history: [session(2, 100, [8, 8, 8])], equipment: null, deload: true, deloadSets: 2, deloadLoad: 0.9 }));
    expect([d4.loadKg, d4.sets.length]).toEqual([90, 2]);
  });
  it('assisté en décharge (D-273) : assistance gardée', () => {
    expect(prescribe(input({ exercise: ASSISTED, equipment: ASSIST_GYM, history: [session(2, 30, [8, 8, 8])], deload: true })).loadKg).toBe(30);
  });
  it('snap : barre 47 kg × 5 → 45 + 1 rép (écart 4,4 %) ; stack 61,8 → 60 sans rép (3 % strict) ; haltères 23,4 → 22 + 1 rép', () => {
    const bar = loadGrid(['barbell'], FITNESS_PARK_ANTONY)?.loads ?? null;
    expect(snapToEquipment(47, [5, 5], bar, CFG)).toMatchObject({ loadKg: 45, reps: [6, 6] });
    const stack = Array.from({ length: 20 }, (_, i) => 5 * (i + 1));
    expect(snapToEquipment(61.8, [10], stack, CFG)).toMatchObject({ loadKg: 60, reps: [10] });
    const db = loadGrid(['dumbbell'], FITNESS_PARK_ANTONY)?.loads ?? null;
    expect(snapToEquipment(23.4, [10], db, CFG)).toMatchObject({ loadKg: 22, reps: [11] });
  });
  it('échauffement barre 60 kg : 40 / 60 / 80 % arrondis vers le bas → 22,5 × 8, 35 × 5, 47,5 × 2', () => {
    const bar = loadGrid(['barbell'], FITNESS_PARK_ANTONY)?.loads ?? null;
    expect(warmupRamp(60, bar).map((s) => [s.loadKg, s.reps])).toEqual([[22.5, 8], [35, 5], [47.5, 2]]);
  });
});

describe('VECTEURS § 12 mésocycle, pause, séance du jour', () => {
  const plan = (weeks: number, date: string, closedBefore = 0) => mesocycleState(createMesocycleSpec({ routineId: 'r', startDate: D('2026-01-05'), weeks }, GC)!, D(date), GC, { closedBefore }).plan;
  it('5 semaines (D-269 (1)) : séries −1/0/0/+1, RIR 3/2/1/1, décharge RIR 4', () => {
    expect(['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26'].map((d) => [plan(5, d)?.setsOffset, plan(5, d)?.rir])).toEqual([[-1, 3], [0, 2], [0, 1], [1, 1]]);
    expect(plan(5, '2026-02-02')).toMatchObject({ deload: true, rir: 4 });
    expect(linePlanSets(4, plan(5, '2026-01-05')!, GC)).toBe(3);
  });
  it('4 semaines (D-269 (2)) : RIR 3, 2-3 (moteur 3), 2 ; isolation RIR 1 en S3 au 2e cycle ; S4 décharge 2 séries × 0,9', () => {
    expect([plan(4, '2026-01-05', 1)?.rir, plan(4, '2026-01-12', 1)?.rir, plan(4, '2026-01-19', 1)?.rir]).toEqual([3, 3, 2]);
    expect(plan(4, '2026-01-19', 1)?.isolationRir).toBe(1);
    expect(plan(4, '2026-01-19', 0)?.isolationRir).toBeUndefined();
    expect(plan(4, '2026-01-26', 1)).toMatchObject({ deload: true, deloadSets: 2, deloadLoad: 0.9 });
  });
  it('6 semaines : RIR 3, 3, 3 (2-3), 2, 2 (1-2) ; S6 décharge', () => {
    expect(['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26', '2026-02-02'].map((d) => plan(6, d, 1)?.rir)).toEqual([3, 3, 3, 2, 2]);
    expect(plan(6, '2026-02-09', 1)).toMatchObject({ deload: true });
  });
  it('pause : semaine allégée proposée au-delà de 21 jours seulement', () => {
    const p = pauseProgram(createMesocycleSpec({ routineId: 'r', startDate: D('2026-01-05'), weeks: 5 }, GC)!, D('2026-01-14'))!;
    expect(resumeProposal(p, D('2026-02-04'), GC)).toEqual({ pausedDays: 21, lightWeekProposed: false });
    expect(resumeProposal(p, D('2026-02-05'), GC)).toEqual({ pausedDays: 22, lightWeekProposed: true });
  });
  it('séance du jour : jour de la semaine (D-316) et rotation (D-243)', () => {
    const days = [{ id: 'a', dayOrder: 1, weekday: 1, exercises: [1] }, { id: 'b', dayOrder: 2, weekday: 4, exercises: [1] }, { id: 'c', dayOrder: 3, weekday: null, exercises: [1] }];
    expect(programDayFor(days, [], 'r', D('2026-01-05'))).toMatchObject({ kind: 'day', dayId: 'a' }); // lundi
    expect(programDayFor(days, [], 'r', D('2026-01-06'))).toMatchObject({ kind: 'rest', nextDayId: 'b', nextWeekday: 4 });
    const rot = [{ id: 'A', dayOrder: 1, exercises: [1] }, { id: 'B', dayOrder: 2, exercises: [] }, { id: 'C', dayOrder: 3, exercises: [1] }];
    expect(nextProgramDay(rot, [{ routineId: 'r', routineDayId: 'A' }], 'r')).toBe('C'); // B vide sauté
    expect(nextProgramDay(rot, [{ routineId: 'r', routineDayId: 'C' }], 'r')).toBe('A'); // boucle
  });
});

describe('VECTEURS Strength Score (D-312) et cardio', () => {
  const P = [10, 25, 50, 75, 90, 95, 99];
  const S = [66.7, 79.3, 92.6, 106.7, 119.5, 128.3, 147.3];
  it('interpolation linéaire et bornes', () => {
    expect(percentileOf(100, S, P)).toEqual({ score: 63, bound: null }); // 50 + 25 × 7,4 / 14,1 = 63,12
    expect(percentileOf(147.4, S, P)).toEqual({ score: 99, bound: 'above' });
    expect(percentileOf(60, S, P)).toEqual({ score: 10, bound: 'below' });
  });
  it('paliers', () => {
    expect([24, 25, 49, 50, 74, 75].map(tierOf)).toEqual(['iron', 'bronze', 'bronze', 'silver', 'silver', 'gold']);
  });
  it('haversine 1° de longitude à l’équateur = 6 371 000 × π / 180', () => {
    expect(haversineM({ lat: 0, lon: 0, at: 0, accuracyM: 5 }, { lat: 0, lon: 1, at: 0, accuracyM: 5 })).toBeCloseTo(111194.93, 1);
  });
});
