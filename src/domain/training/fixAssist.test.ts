import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FITNESS_PARK_ANTONY, input, session, target } from '../../../tests/fixtures/training/progression';
import { setRow, workoutRow } from '../../../tests/fixtures/training/workout';
import type { IsoDateTime } from '../types';
import { CATALOG_ASSISTED_IDS, isAssistedEquipment } from './assisted';
import { personalRecords, summarizeWorkout, tonnageKg } from './closure';
import { ENGINE_VERSION } from './config';
import { redDaySnapshot } from './redDay';
import { sheetStats } from './exerciseSheet';
import { explainPrescription, explanationNotes } from './explain';
import { prescribe } from './prescribe';
import type { WorkoutSet, WorkoutWithSets } from './session';
import type { ExerciseSession, ProgressionEquipment } from './types';
import { warmupForExercise } from './warmup';

/**
 * FIX-ASSIST (lot 0.28.0 ; audit Claude 0.27.0, C-001, C-002, C-011) : pour un exercice assisté, la charge saisie est l'assistance, une charge
 * NÉGATIVE. Les cinq premiers tests sont ceux de la preuve de l'audit (`preuves/partie4-moteur.test.ts`, describe « C-001 »), recopiés tels quels.
 */

// Exercice personnalisé « tractions à la machine assistée » : métrique par défaut du formulaire (load-reps, LibraryView.tsx:397) et
// matériel assisted-pull-up-machine → assisted: true (prescriptionInput.ts:46). Exercice personnalisé : bodyweightFraction absent.
const ASSISTED = { id: 'custom-assisted', metric: 'load-reps', equipment: ['assisted-pull-up-machine'], kind: 'compound', assisted: true } as const;
const ASSIST_GYM: ProgressionEquipment = {
  inventory: { ...FITNESS_PARK_ANTONY.inventory, available: [...FITNESS_PARK_ANTONY.inventory.available, 'assisted-pull-up-machine'], machines: [{ equipmentId: 'assisted-pull-up-machine', stackMinKg: 5, stackMaxKg: 100, stepKg: 5 }] },
  increments: FITNESS_PARK_ANTONY.increments,
};
/** Même exercice, poids de corps connu (fraction 1, corps 80 kg : charge réelle = 80 − assistance). */
const ASSISTED_BODY = { ...ASSISTED, bodyweightFraction: 1 } as const;

describe('C-001 exercice assisté hors décharge : la charge saisie est l’assistance (preuve de l’audit)', () => {
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

describe('FIX-ASSIST (a) progression : l’assistance baisse d’un cran, jamais sous le minimum', () => {
  const top = (loadKg: number): ExerciseSession[] => [session(2, loadKg, [10, 10, 10], { difficulty: 'ok' })];

  it('critère 1 : grille connue (pile de 5 kg) → 30 → 25 kg, raison « increase », écart −5 kg', () => {
    for (const exercise of [ASSISTED, ASSISTED_BODY]) {
      const p = prescribe(input({ exercise, bodyweightKg: 80, equipment: ASSIST_GYM, history: top(30) }));
      expect(p.headline).toBe('increase');
      expect(p.loadKg).toBe(25);
      expect(p.deltaKg).toBe(-5);
      expect(p.sets.every((s) => s.loadKg === 25 && s.reps === 8)).toBe(true);
    }
  });
  it('critère 2 : sans grille connue → 30 → 27,5 kg (cran supposé de 2,5 kg, D-244)', () => {
    const p = prescribe(input({ exercise: ASSISTED, equipment: null, history: top(30) }));
    expect(p.headline).toBe('increase');
    expect(p.loadKg).toBe(27.5);
    expect(p.reasons).toContain('increment-unknown');
  });
  it('critère 3 : assistance au minimum de la grille (5 kg) → maintenue, une répétition de plus, raison « assistance-min »', () => {
    const p = prescribe(input({ exercise: ASSISTED, equipment: ASSIST_GYM, history: top(5) }));
    expect(p.loadKg).toBe(5);
    expect(p.headline).toBe('extra-rep');
    expect(p.reasons).toContain('assistance-min');
    expect(p.reasons).not.toContain('equipment-max');
    expect(explainPrescription(p).key).toBe('extraRepAssistMin');
  });
  it('critère 3 : sans grille, 2,5 kg d’assistance → maintenue (jamais 0 ni négative)', () => {
    const p = prescribe(input({ exercise: ASSISTED, equipment: null, history: top(2.5) }));
    expect(p.loadKg).toBe(2.5);
    expect(p.reasons).toContain('assistance-min');
  });
  it('critère 8 : « Facile », confiance faible → aucun recalibrage +5 % (qui hausserait l’assistance)', () => {
    const p = prescribe(input({ exercise: ASSISTED, equipment: ASSIST_GYM, history: [session(2, 30, [8, 8, 8], { difficulty: 'easy' })] }));
    expect(p.headline).not.toBe('recalibration');
    expect(p.recalibration).toBeNull();
    expect(p.loadKg as number).toBeLessThanOrEqual(30);
  });
  it('critère 11 : la phrase dit « Assistance −5 kg », jamais « +x kg »', () => {
    const p = prescribe(input({ exercise: ASSISTED, equipment: ASSIST_GYM, history: top(30) }));
    expect(explainPrescription(p)).toEqual({ key: 'assistDecrease', params: { delta: 5, sets: 3, reps: 10 } });
    const blind = prescribe(input({ exercise: ASSISTED, equipment: null, history: top(30) }));
    expect(explainPrescription(blind)).toEqual({ key: 'assistDecreaseUnknownStep', params: { delta: 2.5, sets: 3, reps: 10 } });
  });
});

describe('FIX-ASSIST (b) réductions : l’assistance n’est jamais baissée', () => {
  it('critère 4 : 84 jours d’inactivité, poids de corps connu ou non → 30 kg, phrase « Assistance maintenue »', () => {
    for (const bodyweightKg of [80, null]) {
      const p = prescribe(input({ exercise: ASSISTED_BODY, bodyweightKg, equipment: ASSIST_GYM, history: [session(84, 30, [8, 8, 8])] }));
      expect(p.loadKg).toBe(30);
      expect(p.headline).toBe('inactivity');
      expect(p.reasons).toContain('assistance-held');
      expect(explainPrescription(p).key).toBe('inactivityAssistHeld');
    }
  });
  it('critère 5 : rang 2, poids de corps inconnu → 30 kg et note « assistance maintenue »', () => {
    const p = prescribe(input({ exercise: ASSISTED, equipment: ASSIST_GYM, history: [session(2, 30, [8, 8, 8])], positionRank: 2, lastPositionRank: 1 }));
    expect(p.loadKg).toBe(30);
    expect(p.reasons).not.toContain('position-discount');
    expect(explanationNotes(p).map((n) => n.key)).toContain('noteAssistanceHeld');
  });
  it('critère 5 : rang 2, poids de corps connu → calcul existant sur la charge totale (assistance relevée, DEP-01)', () => {
    const first = prescribe(input({ exercise: ASSISTED_BODY, bodyweightKg: 80, equipment: ASSIST_GYM, history: [session(2, 30, [8, 8, 8])] }));
    const second = prescribe(input({ exercise: ASSISTED_BODY, bodyweightKg: 80, equipment: ASSIST_GYM, history: [session(2, 30, [8, 8, 8])], positionRank: 2, lastPositionRank: 1 }));
    expect(second.loadKg as number).toBeGreaterThan(first.loadKg as number);
    expect(second.reasons).toContain('position-discount');
  });
  it('critère 6 : fatigue → aucun choix « −5 % » sur l’assistance ; « −2 répétitions » reste', () => {
    const fatigued = [session(2, 30, [10, 7, 6]), session(5, 30, [10, 10, 9])];
    const p = prescribe(input({ exercise: ASSISTED, equipment: ASSIST_GYM, history: fatigued }));
    expect(p.reasons).toContain('fatigue-drop');
    expect((p.options ?? []).map((o) => o.kind)).not.toContain('fatigue-load');
    expect((p.options ?? []).map((o) => o.kind)).toContain('fatigue-reps');
    for (const o of p.options ?? []) if (o.loadKg !== null) expect(o.loadKg).toBeGreaterThanOrEqual(30);
  });
  it('critère 6 : stagnation → aucun mini-deload qui baisse l’assistance ; variante et autre plage restent', () => {
    const stalled = [session(2, 30, [8, 8, 8]), session(5, 30, [8, 8, 8]), session(8, 30, [8, 8, 8]), session(11, 30, [8, 8, 8])];
    const p = prescribe(input({ exercise: ASSISTED, equipment: ASSIST_GYM, history: stalled }));
    expect(p.reasons).toContain('stall');
    const kinds = (p.options ?? []).map((o) => o.kind);
    expect(kinds).toEqual(['stall-variant', 'stall-range']);
  });
  it('critère 7 : journée rouge acceptée, poids de corps inconnu → 30 kg, « redDayHeld »', () => {
    const p = prescribe(input({ exercise: ASSISTED, equipment: ASSIST_GYM, history: [session(2, 30, [8, 8, 8])], recovery: redDaySnapshot(20, 'accepted', input().config) }));
    expect(p.loadKg).toBe(30);
    expect(explainPrescription(p)).toEqual({ key: 'redDayHeld', params: {} });
  });
  it('critère 7 : Recovery basse (sommeil < 6 h) → 30 kg, « recoveryLowAssistHeld »', () => {
    const p = prescribe(input({ exercise: ASSISTED, equipment: ASSIST_GYM, history: [session(2, 30, [8, 8, 8])], recovery: { recovery: null, sleepHours: 5, restingHrDelta: null } }));
    expect(p.loadKg).toBe(30);
    expect(explainPrescription(p).key).toBe('recoveryLowAssistHeld');
  });
  it('critère 12 : moteur en version 3 (aucune constante modifiée)', () => {
    expect(ENGINE_VERSION).toBe(3);
  });
});

describe('FIX-ASSIST (c) échauffement', () => {
  it('critère 9 : assisté (drapeau ou matériel) → aucune rampe ; non assisté inchangé', () => {
    expect(warmupForExercise(ASSISTED, 30, ASSIST_GYM)).toEqual([]);
    expect(warmupForExercise({ metric: 'load-reps', equipment: ['assisted-pull-up-machine'] }, 30, ASSIST_GYM)).toEqual([]);
    expect(warmupForExercise({ metric: 'load-reps', equipment: ['barbell'] }, 100, FITNESS_PARK_ANTONY).length).toBeGreaterThan(0);
  });
});

describe('FIX-ASSIST (d) tonnage, records et fiche', () => {
  const iso = (v: string): IsoDateTime => v as IsoDateTime;
  const ws = (index: number, exerciseId: string, loadKg: number, reps = 8): WorkoutSet => setRow(index, { done: true, reps, loadKg, exerciseId, exerciseName: exerciseId });
  const workout = (sets: WorkoutSet[]): WorkoutWithSets => ({ ...workoutRow({ startedAt: iso('2026-11-02T17:00:00.000Z'), endedAt: iso('2026-11-02T18:00:00.000Z') }), sets });

  it('identifiants assistés du catalogue = exercices du catalogue avec la machine d’assistance', () => {
    const raw = JSON.parse(readFileSync(new URL('../../../content/exercises/exercises.json', import.meta.url), 'utf8')) as { exercises?: { id: string; equipment: string[] }[] } | { id: string; equipment: string[] }[];
    const list = Array.isArray(raw) ? raw : (raw.exercises ?? []);
    expect([...CATALOG_ASSISTED_IDS].sort()).toEqual(list.filter((e) => isAssistedEquipment(e.equipment)).map((e) => e.id).sort());
  });
  it('critère 10 : tonnage hors assistance (catalogue par défaut, personnalisé passé par l’appelant)', () => {
    const sets = [ws(0, 'bench-press-barbell', 60), ws(1, 'pull-up-assisted', 30), ws(2, 'custom-assisted', 30)];
    expect(tonnageKg(sets, new Set(['custom-assisted']))).toBe(480);
    expect(tonnageKg(sets)).toBe(480 + 240);
  });
  it('critère 10 : plus d’assistance n’est jamais un record de charge ni de volume', () => {
    const history = [ws(0, 'custom-assisted', 20), ws(1, 'pull-up-assisted', 20)];
    const now = [ws(0, 'custom-assisted', 40), ws(1, 'pull-up-assisted', 40)];
    expect(personalRecords(now, history, new Set(['custom-assisted']))).toEqual([]);
    const summary = summarizeWorkout(workout(now), history, new Set(['custom-assisted']));
    expect(summary.records).toEqual([]);
    expect(summary.tonnageKg).toBe(0);
  });
  it('critère 10 : fiche d’un assisté → ni 1RM ni record de charge', () => {
    const history = [session(2, 30, [8, 8, 8]), session(5, 20, [8, 8, 8])];
    const stats = sheetStats(history, { metric: 'load-reps', bodyweightFraction: null, equipment: ['assisted-pull-up-machine'] }, iso('2026-11-07T18:00:00.000Z'));
    expect(stats.oneRm).toEqual({ kind: 'none', reason: 'assisted' });
    expect(stats.record).toBeNull();
    expect(stats.sessions).toHaveLength(2);
  });
  it('critère 12 : target par défaut 8-10 utilisé ci-dessus', () => {
    expect(target(8, 10)).toEqual({ sets: 3, repMin: 8, repMax: 10, rir: null });
  });
});

describe('FIX-ASSIST passe qa-test : cas limites', () => {
  const CATALOG = { id: 'pull-up-assisted', metric: 'bodyweight-reps', equipment: ['assisted-pull-up-machine', 'resistance-band', 'pull-up-bar'] } as const;
  it('assisté du catalogue en bodyweight-reps : non prescrit, aucune rampe, hors tonnage par défaut', () => {
    const p = prescribe(input({ exercise: CATALOG, equipment: ASSIST_GYM, history: [session(2, 30, [10, 10, 10])] }));
    expect(p.status).toBe('unsupported');
    expect(warmupForExercise(CATALOG, 30, ASSIST_GYM)).toEqual([]);
    expect(tonnageKg([setRow(0, { done: true, reps: 8, loadKg: 30, exerciseId: 'pull-up-assisted' })])).toBe(0);
  });
  it('assistance juste au-dessus du minimum (10 kg, pile de 5 kg) → 5 kg, puis 5 kg → maintien', () => {
    const first = prescribe(input({ exercise: ASSISTED, equipment: ASSIST_GYM, history: [session(2, 10, [10, 10, 10])] }));
    expect(first.loadKg).toBe(5);
    const second = prescribe(input({ exercise: ASSISTED, equipment: ASSIST_GYM, history: [session(2, 5, [10, 10, 10])] }));
    expect(second.loadKg).toBe(5);
    expect(second.ladderSetIndex).not.toBeNull();
  });
  it('poids de corps connu, cran et rang 2 : la décote de position relève l’assistance, jamais au-dessus de la référence comme une « hausse »', () => {
    const p = prescribe(input({ exercise: ASSISTED_BODY, bodyweightKg: 80, equipment: ASSIST_GYM, history: [session(2, 30, [10, 10, 10])], positionRank: 2, lastPositionRank: 1 }));
    expect(p.loadKg as number).toBeGreaterThanOrEqual(25);
    if ((p.loadKg as number) >= 30) expect(p.headline).toBe('position');
    else expect(explainPrescription(p).key).toBe('assistDecrease');
  });
  it('sans grille, 3 kg d’assistance → 0,5 kg ; 2,6 kg → maintenue (jamais 0 kg d’assistance)', () => {
    expect(prescribe(input({ exercise: ASSISTED, equipment: null, history: [session(2, 3, [10, 10, 10])] })).loadKg).toBe(0.5);
    expect(prescribe(input({ exercise: ASSISTED, equipment: null, history: [session(2, 2.6, [10, 10, 10])] })).loadKg).toBe(2.6);
  });
  it('« Dur » au haut de plage : assistance maintenue (aucun cran), comme un exercice ordinaire', () => {
    const p = prescribe(input({ exercise: ASSISTED, equipment: ASSIST_GYM, history: [session(2, 30, [10, 10, 10], { difficulty: 'hard' })] }));
    expect(p.loadKg).toBe(30);
    expect(p.headline).toBe('hold-hard');
  });
});
