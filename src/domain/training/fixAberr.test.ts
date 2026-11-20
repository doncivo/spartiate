// FIX-ABERR (lot 0.28.0) : charge aberrante (§ 11.2 point 1, § 11.5). Preuves de l'audit Claude 0.27.0, describe « C-005 » de
// preuves/partie4-moteur.test.ts et preuves/partie7a-ecrans.test.ts, copiées ici (jamais branchées depuis docs/). Données synthétiques (D-292).
import { describe, expect, it } from 'vitest';
import { NOW, input, session, set } from '../../../tests/fixtures/training/progression';
import { setRow, workoutRow } from '../../../tests/fixtures/training/workout';
import { personalRecords } from './closure';
import { DEFAULT_PROGRESSION_CONFIG as CFG, ENGINE_VERSION } from './config';
import { analyzeHistory } from './estimate1rm';
import { explanationNotes } from './explain';
import { sheetStats } from './exerciseSheet';
import { prescribe } from './prescribe';
import type { WorkoutSet } from './session';
import type { ExerciseSession } from './types';
import type { IsoDateTime } from '../types';

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
