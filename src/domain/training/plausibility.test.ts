// FIX-ABERR suite (décision d'Ali du 20/11, lot 0.28.0) : vraisemblance d'une charge à la première séance d'un exercice SANS historique, en
// multiple du poids de corps (PDC) selon le type d'exercice (§ 11.5 « aberrantes signalées avant enregistrement »). Données synthétiques (D-292).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { session, set } from '../../../tests/fixtures/training/progression';
import { PLAUSIBILITY_CONFIG as P } from './config';
import { entryImplausible, plausibilityClass, type PlausibilityExercise, type PlausibilityOptions } from './outlierEntry';
import type { ExerciseSession, MuscleWeight } from './types';

const work = (loadKg: number | null, reps: number | null = 5) => ({ loadKg, reps });
const PDC = { bodyweightKg: 80 } as const;
const check = (load: number, opts: Partial<PlausibilityOptions> & Pick<PlausibilityOptions, 'exerciseClass'>, history: readonly ExerciseSession[] = []) => entryImplausible(work(load), 'work', history, opts);
const flagged = (load: number, opts: Partial<PlausibilityOptions> & Pick<PlausibilityOptions, 'exerciseClass'>): boolean => check(load, opts) !== null;

describe('FIX-ABERR vraisemblance : constantes proposées (révisables par Ali, D-325)', () => {
  it('multiples du PDC, plafonds absolus et part par haltère', () => {
    expect(P.bodyweightMultiple).toEqual({ 'lower-compound': 3.5, 'upper-compound': 2.5, isolation: 1.2, assisted: 1 });
    expect(P.absoluteKg).toEqual({ 'lower-compound': 300, 'upper-compound': 200, isolation: 100, assisted: 120 });
    expect(P.dumbbellShare).toBe(0.5);
  });
});

describe('FIX-ABERR vraisemblance : type d’exercice', () => {
  const m = (...ids: [string, number][]): MuscleWeight[] => ids.map(([id, weight]) => ({ id, weight }));
  it('assisté prioritaire, isolation, bas (muscle principal ou pattern), haut', () => {
    expect(plausibilityClass({ kind: 'compound', pattern: 'pull-vertical', muscles: m(['lats', 1]), equipment: ['assisted-pull-up-machine'] })).toBe('assisted');
    expect(plausibilityClass({ kind: 'isolation', pattern: 'isolation', muscles: m(['quads', 1]), equipment: ['leg-extension-machine'] })).toBe('isolation');
    expect(plausibilityClass({ kind: 'compound', pattern: 'squat', muscles: m(['quads', 1], ['glutes', 0.6]), equipment: ['barbell'] })).toBe('lower-compound');
    expect(plausibilityClass({ kind: 'compound', pattern: 'hinge', muscles: m(['erector-spinae', 1], ['glutes', 0.8]), equipment: ['barbell'] })).toBe('lower-compound');
    expect(plausibilityClass({ kind: 'compound', pattern: 'push-horizontal', muscles: m(['glutes', 1]), equipment: ['cable-machine'] })).toBe('lower-compound');
    expect(plausibilityClass({ kind: 'compound', pattern: 'push-horizontal', muscles: m(['chest', 1], ['triceps', 0.5]), equipment: ['barbell'] })).toBe('upper-compound');
  });
  it('catalogue embarqué : quelques exercices de chaque type', () => {
    const raw = JSON.parse(readFileSync(new URL('../../../content/exercises/exercises.json', import.meta.url), 'utf8')) as { exercises?: unknown[] } | unknown[];
    const list = (Array.isArray(raw) ? raw : (raw.exercises ?? [])) as (PlausibilityExercise & { readonly id: string })[];
    const of = (id: string) => {
      const e = list.find((x) => x.id === id);
      if (!e) throw new Error(id);
      return plausibilityClass(e);
    };
    for (const id of ['squat-barbell', 'deadlift-barbell', 'rack-pull', 'leg-press', 'hip-thrust-barbell', 'romanian-deadlift-dumbbell']) expect(of(id), id).toBe('lower-compound');
    for (const id of ['bench-press-barbell', 'row-barbell', 'overhead-press-dumbbell', 'pull-up-weighted', 'dips']) expect(of(id), id).toBe('upper-compound');
    for (const id of ['curl-dumbbell', 'calf-raise-standing', 'leg-extension-machine', 'lateral-raise-dumbbell']) expect(of(id), id).toBe('isolation');
    expect(of('pull-up-assisted')).toBe('assisted');
  });
});

describe('FIX-ABERR vraisemblance : PDC connu (80 kg), juste au plafond et juste au-dessus', () => {
  it('bas du corps : 280 kg passe, 280,5 kg signalé (plus de 3,5 fois le PDC)', () => {
    expect(flagged(280, { exerciseClass: 'lower-compound', ...PDC })).toBe(false);
    expect(check(280.5, { exerciseClass: 'lower-compound', ...PDC })).toEqual({ loadKg: 280.5, capKg: 280, multiple: 3.5, bodyweightKg: 80, perDumbbell: false, exerciseClass: 'lower-compound' });
  });
  it('haut du corps : 200 kg passe, 200,5 kg signalé (2,5 fois)', () => {
    expect(flagged(200, { exerciseClass: 'upper-compound', ...PDC })).toBe(false);
    expect(check(200.5, { exerciseClass: 'upper-compound', ...PDC })).toMatchObject({ capKg: 200, multiple: 2.5 });
  });
  it('isolation : 96 kg passe, 96,5 kg signalé (1,2 fois)', () => {
    expect(flagged(96, { exerciseClass: 'isolation', ...PDC })).toBe(false);
    expect(check(96.5, { exerciseClass: 'isolation', ...PDC })).toMatchObject({ capKg: 96, multiple: 1.2 });
  });
  it('assisté : assistance 79,5 kg passe, 80 kg (≥ PDC, absurde) signalé ; 0 kg passe', () => {
    expect(flagged(79.5, { exerciseClass: 'assisted', ...PDC })).toBe(false);
    expect(flagged(0, { exerciseClass: 'assisted', ...PDC })).toBe(false);
    expect(check(80, { exerciseClass: 'assisted', ...PDC })).toEqual({ loadKg: 80, capKg: 80, multiple: 1, bodyweightKg: 80, perDumbbell: false, exerciseClass: 'assisted' });
  });
});

describe('FIX-ABERR vraisemblance : PDC inconnu, plafonds absolus', () => {
  it('bas 300 kg, haut 200 kg, isolation 100 kg : au plafond rien, au-dessus signalé', () => {
    for (const [cls, cap] of [['lower-compound', 300], ['upper-compound', 200], ['isolation', 100]] as const) {
      expect(flagged(cap, { exerciseClass: cls }), cls).toBe(false);
      expect(check(cap + 0.5, { exerciseClass: cls }), cls).toEqual({ loadKg: cap + 0.5, capKg: cap, multiple: null, bodyweightKg: null, perDumbbell: false, exerciseClass: cls });
    }
  });
  it('assisté : assistance 120 kg passe, 120,5 kg signalée', () => {
    expect(flagged(120, { exerciseClass: 'assisted' })).toBe(false);
    expect(check(120.5, { exerciseClass: 'assisted' })).toMatchObject({ capKg: 120, multiple: null });
  });
  it('PDC nul ou négatif : traité comme inconnu', () => {
    expect(check(200.5, { exerciseClass: 'upper-compound', bodyweightKg: 0 })).toMatchObject({ capKg: 200, multiple: null });
  });
});

describe('FIX-ABERR vraisemblance : haltères, par haltère, moitié du plafond du type', () => {
  it('PDC 80 kg : 140 / 100 / 48 kg par haltère passent, 0,5 kg au-dessus signalé', () => {
    for (const [cls, cap, multiple] of [['lower-compound', 140, 1.75], ['upper-compound', 100, 1.25], ['isolation', 48, 0.6]] as const) {
      expect(flagged(cap, { exerciseClass: cls, ...PDC, perDumbbell: true }), cls).toBe(false);
      expect(check(cap + 0.5, { exerciseClass: cls, ...PDC, perDumbbell: true }), cls).toEqual({ loadKg: cap + 0.5, capKg: cap, multiple, bodyweightKg: 80, perDumbbell: true, exerciseClass: cls });
    }
  });
  it('PDC inconnu : 150 / 100 / 50 kg par haltère', () => {
    for (const [cls, cap] of [['lower-compound', 150], ['upper-compound', 100], ['isolation', 50]] as const) {
      expect(flagged(cap, { exerciseClass: cls, perDumbbell: true }), cls).toBe(false);
      expect(check(cap + 0.5, { exerciseClass: cls, perDumbbell: true }), cls).toMatchObject({ capKg: cap, multiple: null, perDumbbell: true });
    }
  });
});

describe('FIX-ABERR vraisemblance : lesté (PDC × fraction + lest)', () => {
  it('PDC connu : charge totale comparée ; plafond rendu en lest', () => {
    const opts = { exerciseClass: 'upper-compound', ...PDC, bodyweightFraction: 1 } as const;
    expect(flagged(120, opts)).toBe(false);
    expect(check(120.5, opts)).toMatchObject({ loadKg: 120.5, capKg: 120, multiple: 2.5 });
    expect(flagged(0, opts)).toBe(false);
  });
  it('PDC inconnu : le lest contre le plafond absolu', () => {
    expect(flagged(200, { exerciseClass: 'upper-compound', bodyweightFraction: 1 })).toBe(false);
    expect(flagged(200.5, { exerciseClass: 'upper-compound', bodyweightFraction: 1 })).toBe(true);
  });
});

describe('FIX-ABERR vraisemblance : seulement sans historique, série de travail, une question par charge', () => {
  it('historique avec une série de travail retenue : rien (le contrôle relatif s’applique)', () => {
    expect(check(500, { exerciseClass: 'upper-compound', ...PDC }, [session(5, 100, [5, 5, 5])])).toBeNull();
  });
  it('historique sans série de travail retenue (échauffements seulement) : contrôle appliqué', () => {
    const warmups: ExerciseSession = { ...session(5, 40, []), sets: [set(40, 10, { position: 0, setKind: 'warmup' }), set(60, 5, { position: 1, setKind: 'warmup' })] };
    expect(check(500, { exerciseClass: 'upper-compound', ...PDC }, [warmups])).not.toBeNull();
  });
  it('hors série de travail, charge ou répétitions vides : rien', () => {
    for (const kind of ['warmup', 'drop', 'partial', 'timed'] as const) expect(entryImplausible(work(500), kind, [], { exerciseClass: 'upper-compound' }), kind).toBeNull();
    expect(entryImplausible(work(null), 'work', [], { exerciseClass: 'upper-compound' })).toBeNull();
    expect(entryImplausible(work(500, null), 'work', [], { exerciseClass: 'upper-compound' })).toBeNull();
  });
  it('charge déjà validée dans la séance, égale ou plus forte : rien ; plus forte encore : question', () => {
    expect(check(250, { exerciseClass: 'upper-compound', ...PDC, doneInSessionKg: 250 })).toBeNull();
    expect(check(240, { exerciseClass: 'upper-compound', ...PDC, doneInSessionKg: 250 })).toBeNull();
    expect(check(260, { exerciseClass: 'upper-compound', ...PDC, doneInSessionKg: 250 })).not.toBeNull();
    expect(check(90, { exerciseClass: 'assisted', ...PDC, doneInSessionKg: 90 })).toBeNull();
  });
  it('déterministe : mêmes entrées, même résultat', () => {
    expect(check(300, { exerciseClass: 'lower-compound', ...PDC })).toEqual(check(300, { exerciseClass: 'lower-compound', ...PDC }));
  });
});
