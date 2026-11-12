import { describe, expect, it } from 'vitest';
import {
  ONBOARDING_STEPS,
  decideOnboarding,
  emptyDraft,
  isEmptyBase,
  nextStep,
  parseDraft,
  previousStep,
  validateStep,
  type OnboardingDraft,
} from './draft';

const YEAR = 2026;
const draft = (patch: Partial<OnboardingDraft>): OnboardingDraft => ({ ...emptyDraft(), ...patch });
const codes = (step: Parameters<typeof validateStep>[0], d: OnboardingDraft): string[] => validateStep(step, d, YEAR).map((i) => i.code);

describe('Les 8 écrans (§ 10.1)', () => {
  it('dans l’ordre du PRD : toi, objectif, expérience, disponibilité, matériel, priorités, split, résultat', () => {
    expect(ONBOARDING_STEPS).toEqual(['you', 'goal', 'experience', 'availability', 'equipment', 'priorities', 'split', 'result']);
  });

  it('suivant et précédent, bornés aux extrémités', () => {
    expect(nextStep('you')).toBe('goal');
    expect(nextStep('split')).toBe('result');
    expect(nextStep('result')).toBeNull();
    expect(previousStep('goal')).toBe('you');
    expect(previousStep('you')).toBeNull();
  });
});

describe('Brouillon persisté (§ 10.1 : « Brouillon persisté »)', () => {
  it('vide : premier écran, rien de renseigné, aucun zéro', () => {
    const d = emptyDraft();
    expect(d.step).toBe('you');
    expect(d.sex).toBeNull();
    expect(d.weightKg).toBeNull();
    expect(d.sessionsPerWeek).toBeNull();
    expect(d.priorities).toEqual([]);
    expect(d.variety).toBe('consistent');
    expect(d.skipped).toEqual([]);
  });

  it('relit un brouillon enregistré à l’identique (aller-retour JSON)', () => {
    const d = draft({ step: 'availability', sex: 'male', birthYear: 1996, heightCm: 180, weightKg: 80.5, activity: 'moderate', goal: 'muscle', weeklyRatePct: 0.25, experience: 'intermediate', sessionsPerWeek: 4, durationMin: 60, days: [1, 3, 4, 6], priorities: ['chest'], avoided: ['calves'], painfulPatterns: ['squat'], skipped: ['equipment'] });
    expect(parseDraft(JSON.parse(JSON.stringify(d)) as unknown)).toEqual(d);
  });

  it('valeur illisible : brouillon vide ; champ illisible : ce champ seul retombe sur son défaut', () => {
    expect(parseDraft(null)).toEqual(emptyDraft());
    expect(parseDraft('x')).toEqual(emptyDraft());
    expect(parseDraft({ v: 2 })).toEqual(emptyDraft());
    const parsed = parseDraft({ v: 1, step: 'nope', sex: 'robot', heightCm: 'grand', weightKg: -3, birthYear: 1996.5, goal: 'muscle', priorities: ['chest', 7, 'chest'], days: [1, 9, 3, 3], sessionsPerWeek: 4 });
    expect(parsed.step).toBe('you');
    expect(parsed.sex).toBeNull();
    expect(parsed.heightCm).toBeNull();
    expect(parsed.weightKg).toBeNull();
    expect(parsed.birthYear).toBeNull();
    expect(parsed.goal).toBe('muscle');
    expect(parsed.priorities).toEqual(['chest']);
    expect(parsed.days).toEqual([1, 3]);
    expect(parsed.sessionsPerWeek).toBe(4);
  });
});

describe('Validation par écran', () => {
  it('toi : bornes de l’année, de la taille et du poids ; tout vide est permis (ignorable)', () => {
    expect(codes('you', draft({}))).toEqual([]);
    expect(codes('you', draft({ birthYear: 1900 }))).toEqual(['birth-year-range']);
    expect(codes('you', draft({ birthYear: YEAR }))).toEqual(['birth-year-range']);
    expect(codes('you', draft({ heightCm: 99 }))).toEqual(['height-range']);
    expect(codes('you', draft({ heightCm: 251 }))).toEqual(['height-range']);
    expect(codes('you', draft({ weightKg: 0 }))).toEqual(['weight-range']);
    expect(codes('you', draft({ weightKg: 501 }))).toEqual(['weight-range']);
    expect(codes('you', draft({ sex: 'female', birthYear: 1990, heightCm: 168, weightKg: 61.2 }))).toEqual([]);
  });

  it('objectif : rythme borné de −1 % à +0,5 % par semaine', () => {
    expect(codes('goal', draft({ goal: 'fat-loss', weeklyRatePct: -1 }))).toEqual([]);
    expect(codes('goal', draft({ goal: 'muscle', weeklyRatePct: 0.5 }))).toEqual([]);
    expect(codes('goal', draft({ goal: 'fat-loss', weeklyRatePct: -1.01 }))).toEqual(['rate-range']);
    expect(codes('goal', draft({ goal: 'muscle', weeklyRatePct: 0.51 }))).toEqual(['rate-range']);
  });

  it('disponibilité : 1 à 7 séances, durée de 20 à 180 min, jours au moins aussi nombreux que les séances', () => {
    expect(codes('availability', draft({ sessionsPerWeek: 0 }))).toEqual(['sessions-range']);
    expect(codes('availability', draft({ sessionsPerWeek: 8 }))).toEqual(['sessions-range']);
    expect(codes('availability', draft({ durationMin: 10 }))).toEqual(['duration-range']);
    expect(codes('availability', draft({ durationMin: 200 }))).toEqual(['duration-range']);
    expect(codes('availability', draft({ sessionsPerWeek: 4, days: [1, 3] }))).toEqual(['days-fewer-than-sessions']);
    expect(codes('availability', draft({ sessionsPerWeek: 3, days: [1, 3, 5] }))).toEqual([]);
    expect(codes('availability', draft({ sessionsPerWeek: 3, days: [] }))).toEqual([]);
  });

  it('priorités : au plus 2 à prioriser, 4 à éviter, jamais le même muscle des deux côtés', () => {
    expect(codes('priorities', draft({ priorities: ['chest', 'back'], avoided: ['calves', 'forearms', 'abs', 'glutes'] }))).toEqual([]);
    expect(codes('priorities', draft({ priorities: ['chest', 'back', 'biceps'] }))).toEqual(['priorities-max']);
    expect(codes('priorities', draft({ avoided: ['calves', 'forearms', 'abs', 'glutes', 'biceps'] }))).toEqual(['avoided-max']);
    expect(codes('priorities', draft({ priorities: ['chest'], avoided: ['chest'] }))).toEqual(['priority-avoided-overlap']);
  });

  it('les autres écrans n’ont pas de règle bloquante', () => {
    for (const step of ['experience', 'equipment', 'split', 'result'] as const) expect(codes(step, draft({}))).toEqual([]);
  });
});

describe('Quand afficher l’onboarding ? (premier lancement sur base vide)', () => {
  it('base vide, jamais terminé : afficher', () => {
    expect(decideOnboarding({ completed: false, empty: true, requested: false })).toBe('show');
  });

  it('base qui contient déjà des données (mise à jour d’une installation) : ne rien montrer, marquer terminé', () => {
    expect(decideOnboarding({ completed: false, empty: false, requested: false })).toBe('mark-done');
  });

  it('déjà terminé : jamais tout seul', () => {
    expect(decideOnboarding({ completed: true, empty: true, requested: false })).toBe('skip');
  });

  it('demandé par « Revoir mes réglages » : afficher, quelle que soit la base', () => {
    expect(decideOnboarding({ completed: true, empty: false, requested: true })).toBe('show');
  });

  it('base vide : aucun profil, aucune routine, aucune pesée, aucune séance, aucun repas', () => {
    const none = { profile: false, routines: 0, weights: 0, workouts: 0, meals: 0 };
    expect(isEmptyBase(none)).toBe(true);
    expect(isEmptyBase({ ...none, profile: true })).toBe(false);
    expect(isEmptyBase({ ...none, routines: 1 })).toBe(false);
    expect(isEmptyBase({ ...none, weights: 1 })).toBe(false);
    expect(isEmptyBase({ ...none, workouts: 1 })).toBe(false);
    expect(isEmptyBase({ ...none, meals: 1 })).toBe(false);
  });
});
