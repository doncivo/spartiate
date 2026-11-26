import { describe, expect, it } from 'vitest';
import { daysAgo, session } from '../../../tests/fixtures/training/progression';
import type { WeighIn } from '../nutrition/types';
import { currentBodyweightKg } from './bodyweight';
import type { LocalDate } from '../types';
import {
  STRENGTH_GROUP_REFERENCE,
  STRENGTH_LEVELS,
  STRENGTH_LIFT_THRESHOLDS,
  STRENGTH_SCORE_VERSION,
  STRENGTH_THRESHOLD_METHOD,
  deriveStrengthThresholds,
  type StrengthThresholds,
} from './config';
import { deloadFreeze, levelOfScore, relativeStrength, scoreFromThresholds, strengthScore, STRENGTH_GROUPS, type ReferenceLift, type StrengthExercise, type StrengthInput } from './strengthScore';
import type { ExerciseSession } from './types';

/**
 * STR-0300 (BL-174, D-675, D-741, D-742) : Strength Score maison. Vecteurs calculés à la main sur des seuils SYNTHÉTIQUES (les seuils
 * proposés sont dans config.ts, en attente de Q-42) ; valeurs inventées uniquement. Repères de score : 20, 40, 60, 80, 100.
 */

const M = [40, 60, 80, 100, 120] as const;
const F = [20, 30, 40, 50, 60] as const;
const THRESHOLDS: StrengthThresholds = {
  bench: { male: M, female: F },
  'incline-bench': { male: [30, 40, 50, 60, 70], female: F },
  'pull-up': { male: M, female: F },
  'chin-up': { male: M, female: F },
};
const LIFTS: readonly ReferenceLift[] = [
  { key: 'bench', groups: ['chest'], totalLoad: false },
  { key: 'incline-bench', groups: ['chest'], totalLoad: false },
  { key: 'pull-up', groups: ['back'], totalLoad: true },
  { key: 'chin-up', groups: ['back', 'biceps'], totalLoad: true },
  { key: 'sans-seuil', groups: ['quads'], totalLoad: false },
];

const kg = (date: string, value: number): WeighIn => ({ date: date as LocalDate, kg: value });
const W80 = [kg('2026-10-01', 80)];
const ex = (id: string, key: string, history: readonly ExerciseSession[] = []): StrengthExercise => ({ id, nameFr: `Nom ${id}`, key, history });
const input = (over: Partial<StrengthInput>): StrengthInput => ({ sex: 'male', weighIns: W80, lifts: LIFTS, thresholds: THRESHOLDS, exercises: [], ...over });
const group = (result: ReturnType<typeof strengthScore>, id: string) => {
  const g = result.groups.find((x) => x.group === id);
  if (g === undefined) throw new Error(`groupe ${id} absent`);
  return g;
};

describe('force relative : e1RM × (80 / poids de corps)^(2/3)', () => {
  it('à 80 kg, l’e1RM lui-même ; à 640 kg (valeur inventée), un quart ; à 64 kg, × 1,1604', () => {
    expect(relativeStrength(90, 80)).toBe(90);
    expect(relativeStrength(90, 640)).toBeCloseTo(22.5, 9);
    expect(relativeStrength(90, 64)).toBeCloseTo(104.436, 3);
  });
});

describe('score 0–100 interpolé entre deux seuils (repères 20, 40, 60, 80, 100), arrondi vers le bas', () => {
  it('90 entre Intermédiaire (80) et Avancé (100) : 60 + 20 × 10 / 20 = 70, Intermédiaire', () => {
    expect(scoreFromThresholds(90, M)).toEqual({ score: 70, level: 'intermediate' });
  });
  it('seuil exact : son repère (40 → 20 Débutant ; 60 → 40 Novice ; 80 → 60 ; 100 → 80 Avancé ; 120 → 100 Élite)', () => {
    expect(scoreFromThresholds(40, M)).toEqual({ score: 20, level: 'beginner' });
    expect(scoreFromThresholds(60, M)).toEqual({ score: 40, level: 'novice' });
    expect(scoreFromThresholds(80, M)).toEqual({ score: 60, level: 'intermediate' });
    expect(scoreFromThresholds(100, M)).toEqual({ score: 80, level: 'advanced' });
    expect(scoreFromThresholds(120, M)).toEqual({ score: 100, level: 'elite' });
  });
  it('juste sous un seuil : le niveau d’en dessous et un score cohérent (79,99 → 59 Novice, jamais 60 Novice)', () => {
    expect(scoreFromThresholds(79.99, M)).toEqual({ score: 59, level: 'novice' });
  });
  it('au-delà d’Élite : 100 ; sous Débutant : de 0 kg à 20 points, au moins 1 (20 → 10 ; 1 → 1)', () => {
    expect(scoreFromThresholds(500, M)).toEqual({ score: 100, level: 'elite' });
    expect(scoreFromThresholds(20, M)).toEqual({ score: 10, level: 'beginner' });
    expect(scoreFromThresholds(1, M)).toEqual({ score: 1, level: 'beginner' });
  });
  it('niveau d’un score (global) : < 40 Débutant, 40 Novice, 60 Intermédiaire, 80 Avancé, 100 Élite', () => {
    expect([0, 39, 40, 59, 60, 79, 80, 99, 100].map(levelOfScore)).toEqual(['beginner', 'beginner', 'novice', 'novice', 'intermediate', 'intermediate', 'advanced', 'advanced', 'elite']);
  });
});

describe('strengthScore', () => {
  it('homme de 80 kg, développé couché 75 × 6 (Epley 90) : Pectoraux 70 Intermédiaire ; mouvement, e1RM et force relative dits', () => {
    const r = strengthScore(input({ exercises: [ex('b', 'bench', [session(2, 75, [6])])] }));
    expect(group(r, 'chest')).toMatchObject({ kind: 'value', score: 70, level: 'intermediate', lift: { key: 'bench', exerciseId: 'b', nameFr: 'Nom b', e1rmKg: 90, relativeKg: 90 } });
    expect(r.global).toEqual({ score: 70, level: 'intermediate', counted: 1 });
    expect(r.bodyweightKg).toBe(80);
    expect(r.version).toBe(STRENGTH_SCORE_VERSION);
  });

  it('normalisé au poids : à 64 kg, le même e1RM vaut 104,4 kg de force relative → 84, Avancé', () => {
    const r = strengthScore(input({ weighIns: [kg('2026-10-01', 64)], exercises: [ex('b', 'bench', [session(2, 75, [6])])] }));
    expect(group(r, 'chest')).toMatchObject({ kind: 'value', score: 84, level: 'advanced' });
  });

  it('seuils du sexe : une femme de 80 kg au même e1RM dépasse son Élite (60) → 100', () => {
    const r = strengthScore(input({ sex: 'female', exercises: [ex('b', 'bench', [session(2, 75, [6])])] }));
    expect(group(r, 'chest')).toMatchObject({ kind: 'value', score: 100, level: 'elite' });
  });

  it('tractions : charge totale = poids de corps + lest (80 × 6 → 96 : 76 ; lest 10 × 6 → 108 : 88)', () => {
    const back = (lest: number) => group(strengthScore(input({ exercises: [ex('p', 'pull-up', [session(2, lest, [6])])] })), 'back');
    expect(back(0)).toMatchObject({ kind: 'value', score: 76, lift: { e1rmKg: 96 } });
    expect(back(10)).toMatchObject({ kind: 'value', score: 88, lift: { e1rmKg: 108 } });
  });

  it('meilleur mouvement du groupe : incliné 52,5 × 6 (63 sur ses seuils 30…70 → 86) l’emporte sur le couché (70)', () => {
    const r = strengthScore(input({ exercises: [ex('b', 'bench', [session(2, 75, [6])]), ex('i', 'incline-bench', [session(2, 52.5, [6])])] }));
    expect(group(r, 'chest')).toMatchObject({ kind: 'value', score: 86, lift: { key: 'incline-bench' } });
  });

  it('même clé sur deux exercices : le meilleur e1RM compte', () => {
    const r = strengthScore(input({ exercises: [ex('p1', 'pull-up', [session(2, 0, [6])]), ex('p2', 'pull-up', [session(2, 10, [6])])] }));
    expect(group(r, 'back')).toMatchObject({ kind: 'value', lift: { exerciseId: 'p2' } });
  });

  it('un mouvement à deux groupes (traction supination) chiffre les deux', () => {
    const r = strengthScore(input({ exercises: [ex('c', 'chin-up', [session(2, 10, [6])])] }));
    expect(group(r, 'back')).toMatchObject({ kind: 'value', score: 88 });
    expect(group(r, 'biceps')).toMatchObject({ kind: 'value', score: 88 });
  });

  it('détail par mouvement : chaque mouvement chiffré une fois, dans l’ordre des mouvements de référence', () => {
    const r = strengthScore(input({ exercises: [ex('c', 'chin-up', [session(2, 10, [6])]), ex('b', 'bench', [session(2, 75, [6])])] }));
    expect(r.lifts.map((l) => [l.key, l.score, l.level, l.groups])).toEqual([
      ['bench', 70, 'intermediate', ['chest']],
      ['chin-up', 88, 'advanced', ['back', 'biceps']],
    ]);
  });

  it('global : moyenne des groupes connus, arrondie vers le bas, avec leur nombre (70, 88, 88 → 82, Avancé, 3 sur 8)', () => {
    const r = strengthScore(input({ exercises: [ex('c', 'chin-up', [session(2, 10, [6])]), ex('b', 'bench', [session(2, 75, [6])])] }));
    expect(r.global).toEqual({ score: 82, level: 'advanced', counted: 3 });
  });

  it('8 groupes dans l’ordre ; groupe sans séance : « inconnu » avec ses mouvements de référence, jamais 0', () => {
    const r = strengthScore(input({ exercises: [ex('b', 'bench'), ex('p', 'pull-up')] }));
    expect(r.groups.map((g) => g.group)).toEqual([...STRENGTH_GROUPS]);
    expect(group(r, 'chest')).toEqual({ group: 'chest', kind: 'unknown', reason: 'noSession', references: ['Nom b'] });
    expect(group(r, 'shoulders')).toEqual({ group: 'shoulders', kind: 'unknown', reason: 'noReference', references: [] });
    expect(r.groups.some((g) => 'score' in g)).toBe(false);
    expect(r.global).toBeNull();
  });

  it('sexe non renseigné : chaque groupe inconnu (noSex), aucun global, aucun mouvement chiffré', () => {
    const r = strengthScore(input({ sex: null, exercises: [ex('b', 'bench', [session(2, 75, [6])])] }));
    expect(r.groups.every((g) => g.kind === 'unknown' && g.reason === 'noSex')).toBe(true);
    expect(r.global).toBeNull();
    expect(r.lifts).toEqual([]);
  });

  it('sans poids de corps connu (aucune pesée, ou pesée non valide) : pas de score (noBodyweight), jamais 0', () => {
    for (const weighIns of [[], [kg('2026-10-01', 0)], [kg('2026-10-01', -5)], [kg('2026-10-01', Number.NaN)]]) {
      const r = strengthScore(input({ weighIns, exercises: [ex('b', 'bench', [session(2, 75, [6])])] }));
      expect(r.groups.every((g) => g.kind === 'unknown' && g.reason === 'noBodyweight')).toBe(true);
      expect(r.global).toBeNull();
      expect(r.bodyweightKg).toBeNull();
    }
  });

  it('mouvement sans seuil pour ce sexe : ignoré (aucun score inventé) ; son groupe reste inconnu', () => {
    const r = strengthScore(input({ exercises: [ex('q', 'sans-seuil', [session(2, 100, [5])])] }));
    expect(group(r, 'quads')).toEqual({ group: 'quads', kind: 'unknown', reason: 'noSession', references: [] });
    expect(r.lifts).toEqual([]);
  });

  it('relecture : seuils non strictement croissants, non finis, ou force relative non finie : erreur, jamais un score faux', () => {
    expect(() => scoreFromThresholds(90, [40, 60, 60, 100, 120])).toThrow();
    expect(() => scoreFromThresholds(90, [40, 60, Number.NaN, 100, 120])).toThrow();
    expect(() => scoreFromThresholds(90, [0, 60, 80, 100, 120])).toThrow();
    expect(() => scoreFromThresholds(Number.NaN, M)).toThrow();
  });

  it('séance partielle ou séries non faites : pas d’e1RM, groupe inconnu', () => {
    const partial = session(2, 75, [6, 6, 6], { sets: [{ position: 0, setKind: 'work', done: true, reps: 6, loadKg: 75, rir: null }, { position: 1, setKind: 'work', done: false, reps: 6, loadKg: 75, rir: null }, { position: 2, setKind: 'work', done: false, reps: 6, loadKg: 75, rir: null }] });
    expect(group(strengthScore(input({ exercises: [ex('b', 'bench', [partial])] })), 'chest')).toMatchObject({ kind: 'unknown', reason: 'noSession' });
  });
});

describe('figé pendant une semaine de décharge (D-742)', () => {
  // Pesées : 80 kg le 26/10, 64 kg le 05/11 (NOW des fixtures : 07/11 18:00 UTC).
  const weighIns = [kg('2026-10-26', 80), kg('2026-11-05', 64)];
  const normal = session(10, 75, [6]);
  const deload = session(3, 100, [6], { deload: true });

  it('dernière séance de référence en décharge : figé depuis le début de la décharge, poids de corps des pesées d’avant', () => {
    const exercises = [ex('b', 'bench', [normal, deload])];
    expect(deloadFreeze(exercises)).toBe(daysAgo(3));
    const r = strengthScore(input({ weighIns, exercises }));
    expect(r.frozenSince).toBe(daysAgo(3));
    expect(r.bodyweightKg).toBe(80);
    expect(r.bodyweightFrozen).toBe(true);
    expect(group(r, 'chest')).toMatchObject({ kind: 'value', score: 70, lift: { e1rmKg: 90 } });
  });

  it('plusieurs séances de décharge de suite, sur deux exercices : figé depuis la première', () => {
    const exercises = [ex('b', 'bench', [normal, session(4, 60, [6], { deload: true })]), ex('p', 'pull-up', [session(2, 0, [6], { deload: true })])];
    expect(deloadFreeze(exercises)).toBe(daysAgo(4));
  });

  it('une séance ordinaire après la décharge : plus figé, poids de corps courant', () => {
    const exercises = [ex('b', 'bench', [normal, deload, session(1, 75, [6])])];
    expect(deloadFreeze(exercises)).toBeNull();
    const r = strengthScore(input({ weighIns, exercises }));
    expect(r.frozenSince).toBeNull();
    expect(r.bodyweightKg).toBe(currentBodyweightKg(weighIns));
    expect(r.bodyweightKg).not.toBe(80);
    expect(r.bodyweightFrozen).toBe(false);
  });

  it('relecture : pesée du jour même du début de la décharge exclue (pesées d’avant ce jour seulement)', () => {
    const r = strengthScore(input({ weighIns: [kg('2026-10-26', 80), kg('2026-11-04', 64)], exercises: [ex('b', 'bench', [normal, deload])] }));
    expect(r.bodyweightKg).toBe(80);
    expect(r.bodyweightFrozen).toBe(true);
  });

  it('aucune pesée d’avant la décharge : le poids de corps courant sert (jamais « inconnu » par la seule décharge)', () => {
    const r = strengthScore(input({ weighIns: [kg('2026-11-05', 64)], exercises: [ex('b', 'bench', [normal, deload])] }));
    expect(r.frozenSince).toBe(daysAgo(3));
    expect(r.bodyweightKg).toBe(64);
    expect(r.bodyweightFrozen).toBe(false);
  });

  it('aucune séance : rien à figer', () => {
    expect(deloadFreeze([ex('b', 'bench')])).toBeNull();
  });
});

describe('seuils proposés dans config.ts (proposition non validée, Q-42)', () => {
  it('5 niveaux dans l’ordre ; version du score 1', () => {
    expect([...STRENGTH_LEVELS]).toEqual(['beginner', 'novice', 'intermediate', 'advanced', 'elite']);
    expect(STRENGTH_SCORE_VERSION).toBe(1);
  });
  it('chaque mouvement : 5 seuils finis, positifs, strictement croissants, pour chaque sexe', () => {
    for (const [key, bySex] of Object.entries(STRENGTH_LIFT_THRESHOLDS)) {
      for (const t of [bySex.male, bySex.female]) {
        expect(t, key).toHaveLength(5);
        expect(t.every((v, i) => Number.isFinite(v) && v > 0 && (i === 0 || v > (t[i - 1] as number))), key).toBe(true);
      }
    }
  });
  it('chaque groupe a un mouvement de référence qui a des seuils', () => {
    expect(Object.keys(STRENGTH_GROUP_REFERENCE)).toEqual([...STRENGTH_GROUPS]);
    for (const key of Object.values(STRENGTH_GROUP_REFERENCE)) expect(STRENGTH_LIFT_THRESHOLDS[key], key).toBeDefined();
  });
  it('le tableau suit la méthode écrite (docs/STR-0300-seuils.md) : 80 kg × multiple × coefficient du sexe × échelle, au 0,5 kg', () => {
    expect(deriveStrengthThresholds(STRENGTH_THRESHOLD_METHOD)).toEqual(STRENGTH_LIFT_THRESHOLDS);
  });
});
