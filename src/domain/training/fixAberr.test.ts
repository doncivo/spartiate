// FIX-ABERR (lot 0.28.0) : charge aberrante (§ 11.2 point 1, § 11.5). Preuves de l'audit Claude 0.27.0, describe « C-005 » de
// preuves/partie4-moteur.test.ts et preuves/partie7a-ecrans.test.ts, copiées ici (jamais branchées depuis docs/). Données synthétiques (D-292).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NOW, input, session, set } from '../../../tests/fixtures/training/progression';
import { setRow, workoutRow } from '../../../tests/fixtures/training/workout';
import * as assistedModule from './assisted';
import { personalRecords } from './closure';
import { DEFAULT_PROGRESSION_CONFIG as CFG, ENGINE_VERSION } from './config';
import { analyzeHistory } from './estimate1rm';
import { explanationNotes } from './explain';
import { sheetStats } from './exerciseSheet';
import { prescribe } from './prescribe';
import type { WorkoutSet } from './session';
import type { ExerciseSession } from './types';
import type { IsoDateTime } from '../types';

const CATALOG_BODYWEIGHT_LOAD_IDS = (assistedModule as { CATALOG_BODYWEIGHT_LOAD_IDS?: ReadonlySet<string> }).CATALOG_BODYWEIGHT_LOAD_IDS;

const base = (): ExerciseSession[] => [session(14, 100, [8, 8, 8]), session(11, 100, [8, 8, 8]), session(8, 100, [8, 8, 8])];
const partial = (days: number, load: number): ExerciseSession => ({
  ...session(days, load, []),
  sets: [set(load, 8, { position: 0 }), set(load, null, { position: 1, done: false }), set(load, null, { position: 2, done: false })],
});

describe('C-005 moteur : une séance aberrante non confirmée ne devient jamais la référence', () => {
  it('preuve partie 7a : 200 kg après trois séances à 100 kg × 8 → prescription < 150 kg', () => {
    const p = prescribe(input({ history: [session(2, 200, [8, 8, 8]), session(5, 100, [8, 8, 8]), session(8, 100, [8, 8, 8]), session(11, 100, [8, 8, 8])] }));
    expect(p.loadKg as number).toBeLessThan(150);
  });
  it('preuve partie 4 : 1 000 kg (faute de frappe) après 100 kg → prescription < 150 kg', () => {
    const p = prescribe(input({ history: [session(2, 1000, [8, 8, 8]), session(9, 100, [8, 8, 8])] }));
    expect(p.loadKg as number).toBeLessThan(150);
  });
  it('la référence est la dernière séance non aberrante (100 kg), la progression en part ; une note le dit', () => {
    const p = prescribe(input({ history: [...base(), session(2, 200, [8, 8, 8])] }));
    expect(p.reference?.loadKg).toBe(100);
    expect(p.loadKg).toBe(100);
    expect(p.sets.map((s) => s.reps)).toEqual([9, 8, 8]);
    expect(p.reasons).toContain('outlier-excluded');
    expect(explanationNotes(p).map((n) => n.key as string)).toContain('noteOutlierHeld');
    expect(p.estimated1rmKg as number).toBeLessThan(150);
  });
  it('ENGINE_VERSION inchangé (aucune constante modifiée, D-284)', () => {
    expect(ENGINE_VERSION).toBe(3);
  });
});

describe('C-005 / C-028 : confirmation par une deuxième séance COMPLÈTE hors décharge', () => {
  it('deux séances complètes à 200 kg : la première est confirmée, 200 kg devient la référence et le 1RM la prend', () => {
    const p = prescribe(input({ history: [...base(), session(5, 200, [8, 8, 8]), session(2, 200, [8, 8, 8])] }));
    expect(p.reference?.loadKg).toBe(200);
    expect(p.loadKg as number).toBeGreaterThanOrEqual(200);
    expect(p.estimated1rmKg as number).toBeGreaterThan(200);
    expect(p.reasons).not.toContain('outlier-excluded');
  });
  it('point 2 (décision d’Ali du 20/11) : une hausse > 150 % confirmée à la saisie ne devient la référence qu’après une deuxième séance complète', () => {
    // Une seule séance complète à 200 kg (confirmée à la saisie, aucun indicateur persistant) : la référence reste 100 kg.
    const once = prescribe(input({ history: [...base(), session(2, 200, [8, 8, 8])] }));
    expect(once.reference?.loadKg).toBe(100);
    expect(once.reasons).toContain('outlier-excluded');
    // Deuxième séance complète à 200 kg : 200 kg devient la référence.
    const twice = prescribe(input({ history: [...base(), session(5, 200, [8, 8, 8]), session(2, 200, [8, 8, 8])] }));
    expect(twice.reference?.loadKg).toBe(200);
    expect(twice.reasons).not.toContain('outlier-excluded');
  });
  it('C-028 une séance partielle (< 50 % des séries faites) à 200 kg ne confirme pas', () => {
    const history = [...base(), session(5, 200, [8, 8, 8]), partial(2, 200)];
    const p = prescribe(input({ history }));
    expect(p.loadKg as number).toBeLessThan(150);
    expect(analyzeHistory(history, CFG).estimates.every((e) => e.e1rmKg < 150)).toBe(true);
  });
  it('C-028 une séance de décharge à 200 kg ne confirme pas', () => {
    const history = [...base(), session(5, 200, [8, 8, 8]), session(2, 200, [8, 8, 8], { deload: true })];
    const p = prescribe(input({ history }));
    expect(p.loadKg as number).toBeLessThan(150);
    expect(analyzeHistory(history, CFG).estimates.every((e) => e.e1rmKg < 150)).toBe(true);
  });
});

describe('C-005 records et 1RM affichés', () => {
  const exercise = { metric: 'load-reps', bodyweightFraction: null } as const;
  it('fiche : le record et le 1RM ignorent une séance aberrante non confirmée', () => {
    const stats = sheetStats([...base(), session(2, 200, [8, 8, 8])], exercise, NOW);
    expect(stats.record?.loadKg).toBe(100);
    expect(stats.oneRm.kind === 'value' ? stats.oneRm.kg : 0).toBeLessThan(150);
  });
  it('fiche : confirmée par une deuxième séance complète, 200 kg devient le record', () => {
    expect(sheetStats([...base(), session(5, 200, [8, 8, 8]), session(2, 200, [8, 8, 8])], exercise, NOW).record?.loadKg).toBe(200);
  });
  it('fiche : une aberrante d’une séance partielle n’est pas non plus un record', () => {
    expect(sheetStats([...base(), partial(2, 1000)], exercise, NOW).record?.loadKg).toBe(100);
  });

  const at = (day: number): IsoDateTime => `2026-10-${String(day).padStart(2, '0')}T18:00:00.000Z` as IsoDateTime;
  let n = 0;
  const pastSets = (day: number, load: number): WorkoutSet[] =>
    [0, 1, 2].map((position) => setRow(0, { id: `s-${String(++n)}`, workoutId: `past-${String(day)}`, position, done: true, reps: 8, loadKg: load, doneAt: at(day) }));
  const current = (load: number): WorkoutSet[] =>
    [0, 1, 2].map((position) => setRow(0, { id: `c-${String(position)}`, workoutId: workoutRow().id, position, done: true, reps: 8, loadKg: load, doneAt: at(28) }));

  it('résumé de fin : 200 kg après trois séances à 100 kg n’est pas présenté comme un record', () => {
    const history = [...pastSets(10, 100), ...pastSets(14, 100), ...pastSets(18, 100)];
    expect(personalRecords(current(200), history)).toEqual([]);
  });
  it('résumé de fin : une aberrante passée (1 000 kg) n’empêche pas un vrai record à 105 kg', () => {
    const history = [...pastSets(10, 100), ...pastSets(14, 100), ...pastSets(18, 1000)];
    expect(personalRecords(current(105), history).map((r) => [r.kind, r.value])).toContainEqual(['load', 105]);
  });
});

describe('FIX-ABERR passe qa-test : cas limites du moteur', () => {
  const ASSISTED = { id: 'custom-assisted', metric: 'load-reps', equipment: ['assisted-pull-up-machine'], kind: 'compound', assisted: true } as const;
  it('assisté, poids de corps inconnu : une assistance très haute n’est pas « aberrante » (aucune exclusion, aucune note)', () => {
    const p = prescribe(input({ exercise: ASSISTED, equipment: null, history: [session(9, 20, [8, 8, 8]), session(2, 50, [8, 8, 8])] }));
    expect(p.reasons).not.toContain('outlier-excluded');
    expect(p.reference?.loadKg).toBe(50);
  });
  it('assisté, poids de corps connu : une assistance anormalement BASSE (charge totale > 150 %) est écartée de la référence', () => {
    const p = prescribe(input({ exercise: { ...ASSISTED, bodyweightFraction: 1 }, bodyweightKg: 80, equipment: null, history: [...[14, 11, 8].map((d) => session(d, 40, [8, 8, 8])), session(2, 2, [8, 8, 8])] }));
    expect(p.reasons).toContain('outlier-excluded');
    expect(p.reference?.loadKg).toBe(40);
  });
  it('séance mixte : seules les séries aberrantes sont écartées, la séance reste la référence avec ses séries plausibles', () => {
    const mixed = { ...session(2, 100, []), sets: [set(1000, 8, { position: 0 }), set(100, 9, { position: 1 }), set(100, 9, { position: 2 })] };
    const p = prescribe(input({ history: [...base(), mixed] }));
    expect(p.reference?.loadKg).toBe(100);
    expect(p.loadKg as number).toBeLessThan(150);
    expect(analyzeHistory([...base(), mixed], CFG).unconfirmed).toEqual([{ workoutId: mixed.workoutId, position: 0 }]);
  });
});

describe('FIX-ABERR revue 1 : exercice lesté, le repérage des aberrantes ne se fait pas sur le lest seul', () => {
  // Tractions lestées 5 kg puis 10 kg × 8 : aucune question à la saisie (charge totale), donc 10 kg est un vrai record (résumé et fiche).
  const LESTE = 'pull-up-weighted';
  const at = (day: number): IsoDateTime => `2026-10-${String(day).padStart(2, '0')}T18:00:00.000Z` as IsoDateTime;
  let n = 0;
  const sets = (workoutId: string, day: number, load: number, exerciseId = LESTE): WorkoutSet[] =>
    [0, 1, 2].map((position) => setRow(0, { id: `l-${String(++n)}`, workoutId, exerciseId, exerciseName: exerciseId, position, done: true, reps: 8, loadKg: load, doneAt: at(day) }));
  it('résumé de fin (catalogue, tractions lestées) : 10 kg après 5 kg est un record de charge', () => {
    const history = [...sets('past-10', 10, 5), ...sets('past-14', 14, 5)];
    expect(personalRecords(sets(workoutRow().id, 28, 10), history).map((r) => [r.kind, r.value])).toContainEqual(['load', 10]);
  });
  it('résumé de fin (exercice personnalisé lesté, fourni par l’appelant) : 10 kg après 5 kg est un record', () => {
    const custom = 'custom-weighted-dip';
    const history = [...sets('past-10', 10, 5, custom), ...sets('past-14', 14, 5, custom)];
    expect(personalRecords(sets(workoutRow().id, 28, 10, custom), history, new Set(), new Set([custom])).map((r) => [r.kind, r.value])).toContainEqual(['load', 10]);
  });
  it('fiche d’un exercice lesté : 10 kg après 5 kg est le record', () => {
    const history = [session(14, 5, [8, 8, 8]), session(10, 5, [8, 8, 8]), session(2, 10, [8, 8, 8])];
    expect(sheetStats(history, { metric: 'load-reps', bodyweightFraction: 1 }, NOW).record?.loadKg).toBe(10);
  });
  it('exercice à charge externe : inchangé, 10 kg après 5 kg reste une aberrante non confirmée', () => {
    const history = [session(14, 5, [8, 8, 8]), session(10, 5, [8, 8, 8]), session(2, 10, [8, 8, 8])];
    expect(sheetStats(history, { metric: 'load-reps', bodyweightFraction: null }, NOW).record?.loadKg).toBe(5);
  });
  it('identifiants lestés du catalogue = exercices du catalogue avec une fraction de poids de corps', () => {
    const raw = JSON.parse(readFileSync(new URL('../../../content/exercises/exercises.json', import.meta.url), 'utf8')) as { exercises?: { id: string; bodyweightFraction: number | null }[] } | { id: string; bodyweightFraction: number | null }[];
    const list = Array.isArray(raw) ? raw : (raw.exercises ?? []);
    expect([...(CATALOG_BODYWEIGHT_LOAD_IDS ?? [])].sort()).toEqual(list.filter((e) => (e.bodyweightFraction ?? 0) > 0).map((e) => e.id).sort());
  });
});
