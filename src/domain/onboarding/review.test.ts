import { describe, expect, it } from 'vitest';
import { emptyDraft, type OnboardingDraft } from './draft';
import { NO_CURRENT, onboardingChanges, planChanged, reviewStart, type CurrentSettings } from './review';

/**
 * FIX-0171 (constat 6, D-124) : « Revoir mes réglages » part des données actuelles, n'écrit que ce qui a changé et signale les remplacements.
 * Fixtures synthétiques.
 */
const ANSWERS: OnboardingDraft = {
  ...emptyDraft(),
  step: 'result',
  sex: 'male',
  birthYear: 1996,
  heightCm: 180,
  weightKg: 80,
  activity: 'moderate',
  goal: 'muscle',
  weeklyRatePct: 0.25,
  experience: 'intermediate',
  sessionsPerWeek: 3,
  durationMin: 60,
  equipmentProfileId: 'fitness-park-antony',
  priorities: ['chest'],
};
const CURRENT: CurrentSettings = {
  sex: 'male',
  birthYear: 1996,
  heightCm: 181,
  goal: 'gain',
  experience: 'intermediate',
  weightKg: 75,
  activity: 'moderate',
  equipmentProfileId: 'fitness-park-antony',
  nutritionGoal: { kind: 'gain', weeklyRateKg: 0.3 },
};

describe('reviewStart : préremplissage depuis les données actuelles', () => {
  it('profil, dernière pesée, activité et matériel ACTUELS ; le reste des réponses de l’assistant terminé ; premier écran', () => {
    const start = reviewStart(ANSWERS, CURRENT);
    expect(start).toMatchObject({ step: 'you', heightCm: 181, weightKg: 75, sex: 'male', activity: 'moderate', goal: 'muscle', weeklyRatePct: 0.25, sessionsPerWeek: 3, priorities: ['chest'] });
  });
  it('objectif de profil changé ailleurs : l’objectif affiché suit le profil', () => {
    expect(reviewStart(ANSWERS, { ...CURRENT, goal: 'loss' }).goal).toBe('fat-loss');
    expect(reviewStart({ ...ANSWERS, goal: 'strength' }, { ...CURRENT, goal: 'maintain' }).goal).toBe('strength');
  });
  it('valeur absente des données actuelles : vide, jamais l’ancienne réponse', () => {
    expect(reviewStart(ANSWERS, NO_CURRENT)).toMatchObject({ heightCm: null, weightKg: null, sex: null, goal: null, equipmentProfileId: null });
    expect(reviewStart(null, NO_CURRENT)).toEqual(emptyDraft());
  });
});

describe('onboardingChanges : seulement ce qui a changé', () => {
  it('revue terminée sans rien toucher : aucun changement, aucune routine', () => {
    const start = reviewStart(ANSWERS, CURRENT);
    expect(onboardingChanges(start, CURRENT, start)).toEqual([]);
    expect(planChanged(start, start)).toBe(false);
  });
  it('taille et poids modifiés : deux remplacements, avant et après', () => {
    const start = reviewStart(ANSWERS, CURRENT);
    expect(onboardingChanges({ ...start, heightCm: 185, weightKg: 76 }, CURRENT, start)).toEqual([
      { field: 'heightCm', before: 181, after: 185, replaces: true },
      { field: 'weightKg', before: 75, after: 76, replaces: true },
    ]);
  });
  it('ancien brouillon resté prioritaire (80 kg, 180 cm) face aux données actuelles : remplacements signalés, jamais silencieux', () => {
    const changes = onboardingChanges(ANSWERS, CURRENT, null);
    expect(changes.filter((c) => c.replaces).map((c) => c.field)).toEqual(['heightCm', 'weightKg', 'nutritionGoal']);
  });
  it('champ vide ou passé : jamais un effacement ; valeur nouvelle sur base vide : ajout, pas un remplacement', () => {
    expect(onboardingChanges({ ...emptyDraft() }, CURRENT, null)).toEqual([]);
    expect(onboardingChanges({ ...emptyDraft(), heightCm: 180 }, NO_CURRENT, null)).toEqual([{ field: 'heightCm', before: null, after: 180, replaces: false }]);
  });
  it('cible de nutrition : réécrite seulement si objectif, rythme ou poids (objectif à rythme) changent pendant la revue', () => {
    const start = reviewStart(ANSWERS, CURRENT);
    expect(onboardingChanges({ ...start, weeklyRatePct: 0.5 }, CURRENT, start).map((c) => c.field)).toEqual(['nutritionGoal']);
    expect(onboardingChanges({ ...start, goal: 'maintenance' }, CURRENT, start).map((c) => c.field)).toEqual(['goal', 'nutritionGoal']);
  });
  it('plan d’entraînement modifié : la proposition est reconsidérée', () => {
    const start = reviewStart(ANSWERS, CURRENT);
    expect(planChanged({ ...start, sessionsPerWeek: 4 }, start)).toBe(true);
    expect(planChanged(start, null)).toBe(true);
  });
});
