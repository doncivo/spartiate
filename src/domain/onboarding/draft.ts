/**
 * Brouillon de l'onboarding en 8 écrans (PRD § 10.1) : étapes, valeurs, relecture stricte d'une valeur non fiable, validation par écran et
 * décision de premier lancement. Pur : aucun import Tauri ni React ; l'écriture passe par les dépôts (src/features/onboarding).
 * Toute question non essentielle est ignorable : un champ vide est `null`, jamais zéro.
 */

import { BIRTH_YEAR_MIN, EXPERIENCES, HEIGHT_MAX_CM, HEIGHT_MIN_CM, MIN_AGE_YEARS, SEXES, WEIGHT_MAX_KG, type Experience, type Sex } from '../bodyProfile';
import { ACTIVITY_LEVELS, type ActivityLevel } from '../nutrition/config';
import { EXERCISE_PATTERNS, type ExercisePattern } from '../training/types';
import { VARIETY_LEVELS, type VarietyLevel } from '../training/generationTypes';
import type { Weekday } from '../types';
import { GOAL_RATE_MAX_PCT, GOAL_RATE_MIN_PCT } from './expenditure';

export const ONBOARDING_STEPS = ['you', 'goal', 'experience', 'availability', 'equipment', 'priorities', 'split', 'result'] as const;
export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number];

export const ONBOARDING_GOALS = ['muscle', 'strength', 'recomposition', 'fat-loss', 'maintenance'] as const;
export type OnboardingGoal = (typeof ONBOARDING_GOALS)[number];

/** Objectifs qui portent un rythme de poids (prise ou perte) : les autres visent un poids stable. */
export const RATE_GOALS: readonly OnboardingGoal[] = ['muscle', 'fat-loss'];

export const SESSIONS_MIN = 1;
export const SESSIONS_MAX = 7;
export const DURATION_MIN = 20;
export const DURATION_MAX = 180;
export const PRIORITIES_MAX = 2;
export const AVOIDED_MAX = 4;

export interface OnboardingDraft {
  readonly v: 1;
  readonly step: OnboardingStepId;
  /** Écrans passés sans réponse (« Passer ») : sert à dire ce qui reste à renseigner. */
  readonly skipped: readonly OnboardingStepId[];
  readonly sex: Sex | null;
  readonly birthYear: number | null;
  readonly heightCm: number | null;
  readonly weightKg: number | null;
  readonly activity: ActivityLevel | null;
  readonly goal: OnboardingGoal | null;
  readonly weeklyRatePct: number | null;
  readonly experience: Experience | null;
  readonly sessionsPerWeek: number | null;
  readonly durationMin: number | null;
  readonly days: readonly Weekday[];
  readonly equipmentProfileId: string | null;
  readonly priorities: readonly string[];
  readonly avoided: readonly string[];
  readonly painfulPatterns: readonly ExercisePattern[];
  readonly variety: VarietyLevel;
  /** Écran 7 : ajouter le programme proposé comme NOUVELLE routine à la fin (jamais en remplacement). */
  readonly acceptProposal: boolean;
  /** Écran 8 : dépense de départ modifiée par Ali (kcal par jour) ; `null` : l'estimation de la formule (D-111). */
  readonly expenditureKcal: number | null;
}

export const EXPENDITURE_MIN_KCAL = 800;
export const EXPENDITURE_MAX_KCAL = 6000;

export function emptyDraft(): OnboardingDraft {
  return {
    v: 1,
    step: 'you',
    skipped: [],
    sex: null,
    birthYear: null,
    heightCm: null,
    weightKg: null,
    activity: null,
    goal: null,
    weeklyRatePct: null,
    experience: null,
    sessionsPerWeek: null,
    durationMin: null,
    days: [],
    equipmentProfileId: null,
    priorities: [],
    avoided: [],
    painfulPatterns: [],
    variety: 'consistent',
    acceptProposal: true,
    expenditureKcal: null,
  };
}

export function nextStep(step: OnboardingStepId): OnboardingStepId | null {
  return ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf(step) + 1] ?? null;
}

export function previousStep(step: OnboardingStepId): OnboardingStepId | null {
  const index = ONBOARDING_STEPS.indexOf(step);
  return index > 0 ? (ONBOARDING_STEPS[index - 1] ?? null) : null;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : null);
const positive = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
const integer = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null);
const strings = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string'))] : []);

/** Relecture stricte du brouillon enregistré : valeur illisible = brouillon vide, champ illisible = son défaut, les autres champs restent. */
export function parseDraft(raw: unknown): OnboardingDraft {
  if (!isObject(raw) || raw['v'] !== 1) return emptyDraft();
  const base = emptyDraft();
  const days = Array.isArray(raw['days']) ? [...new Set(raw['days'].filter((d): d is Weekday => typeof d === 'number' && Number.isInteger(d) && d >= 1 && d <= 7))].sort((a, b) => a - b) : [];
  const rate = raw['weeklyRatePct'];
  return {
    v: 1,
    step: oneOf(ONBOARDING_STEPS, raw['step']) ?? base.step,
    skipped: strings(raw['skipped']).filter((s): s is OnboardingStepId => (ONBOARDING_STEPS as readonly string[]).includes(s)),
    sex: oneOf(SEXES, raw['sex']),
    birthYear: integer(raw['birthYear']),
    heightCm: positive(raw['heightCm']),
    weightKg: positive(raw['weightKg']),
    activity: oneOf(ACTIVITY_LEVELS, raw['activity']),
    goal: oneOf(ONBOARDING_GOALS, raw['goal']),
    weeklyRatePct: typeof rate === 'number' && Number.isFinite(rate) ? rate : null,
    experience: oneOf(EXPERIENCES, raw['experience']),
    sessionsPerWeek: integer(raw['sessionsPerWeek']),
    durationMin: integer(raw['durationMin']),
    days,
    equipmentProfileId: typeof raw['equipmentProfileId'] === 'string' && raw['equipmentProfileId'] !== '' ? raw['equipmentProfileId'] : null,
    priorities: strings(raw['priorities']),
    avoided: strings(raw['avoided']),
    painfulPatterns: strings(raw['painfulPatterns']).filter((p): p is ExercisePattern => (EXERCISE_PATTERNS as readonly string[]).includes(p)),
    variety: oneOf(VARIETY_LEVELS, raw['variety']) ?? base.variety,
    acceptProposal: typeof raw['acceptProposal'] === 'boolean' ? raw['acceptProposal'] : base.acceptProposal,
    expenditureKcal: positive(raw['expenditureKcal']),
  };
}

export type StepIssueCode =
  | 'birth-year-range'
  | 'height-range'
  | 'weight-range'
  | 'rate-range'
  | 'sessions-range'
  | 'duration-range'
  | 'days-fewer-than-sessions'
  | 'priorities-max'
  | 'avoided-max'
  | 'priority-avoided-overlap'
  | 'expenditure-range';

export interface StepIssue {
  readonly code: StepIssueCode;
}

/** Règles bloquantes d'un écran ; un champ vide n'est jamais une erreur (tout est ignorable). `year` : année courante. */
export function validateStep(step: OnboardingStepId, draft: OnboardingDraft, year: number): StepIssue[] {
  const issues: StepIssueCode[] = [];
  if (step === 'you') {
    const { birthYear, heightCm, weightKg } = draft;
    if (birthYear !== null && (!Number.isInteger(birthYear) || birthYear < BIRTH_YEAR_MIN || birthYear > year - MIN_AGE_YEARS)) issues.push('birth-year-range');
    if (heightCm !== null && !(heightCm >= HEIGHT_MIN_CM && heightCm <= HEIGHT_MAX_CM)) issues.push('height-range');
    if (weightKg !== null && !(weightKg > 0 && weightKg <= WEIGHT_MAX_KG)) issues.push('weight-range');
  } else if (step === 'goal') {
    const rate = draft.weeklyRatePct;
    if (rate !== null && !(rate >= GOAL_RATE_MIN_PCT && rate <= GOAL_RATE_MAX_PCT)) issues.push('rate-range');
  } else if (step === 'availability') {
    const { sessionsPerWeek, durationMin, days } = draft;
    if (sessionsPerWeek !== null && !(sessionsPerWeek >= SESSIONS_MIN && sessionsPerWeek <= SESSIONS_MAX)) issues.push('sessions-range');
    if (durationMin !== null && !(durationMin >= DURATION_MIN && durationMin <= DURATION_MAX)) issues.push('duration-range');
    if (sessionsPerWeek !== null && days.length > 0 && days.length < sessionsPerWeek) issues.push('days-fewer-than-sessions');
  } else if (step === 'priorities') {
    if (draft.priorities.length > PRIORITIES_MAX) issues.push('priorities-max');
    if (draft.avoided.length > AVOIDED_MAX) issues.push('avoided-max');
    if (draft.priorities.some((p) => draft.avoided.includes(p))) issues.push('priority-avoided-overlap');
  } else if (step === 'result') {
    const kcal = draft.expenditureKcal;
    if (kcal !== null && !(kcal >= EXPENDITURE_MIN_KCAL && kcal <= EXPENDITURE_MAX_KCAL)) issues.push('expenditure-range');
  }
  return issues.map((code) => ({ code }));
}

export interface MuscleSelection {
  readonly priorities: readonly string[];
  readonly avoided: readonly string[];
}

/**
 * Body map (§ 10.1 écran 6) : un toucher fait passer le muscle de normal à prioritaire, puis évité, puis normal. Une liste pleine (2 à
 * prioriser, 4 à éviter) est sautée : jamais de dépassement, jamais de muscle des deux côtés.
 */
export function cycleMuscle(state: MuscleSelection, group: string): MuscleSelection {
  const without = (list: readonly string[]): string[] => list.filter((g) => g !== group);
  if (state.priorities.includes(group)) {
    return { priorities: without(state.priorities), avoided: state.avoided.length < AVOIDED_MAX ? [...state.avoided, group] : state.avoided };
  }
  if (state.avoided.includes(group)) return { priorities: state.priorities, avoided: without(state.avoided) };
  if (state.priorities.length < PRIORITIES_MAX) return { priorities: [...state.priorities, group], avoided: state.avoided };
  if (state.avoided.length < AVOIDED_MAX) return { priorities: state.priorities, avoided: [...state.avoided, group] };
  return state;
}

export type OnboardingDecision = 'show' | 'mark-done' | 'skip';

/**
 * Faut-il ouvrir l'onboarding ? Demandé (« Revoir mes réglages ») : oui. Déjà terminé : jamais tout seul. Sinon : base VIDE (premier lancement)
 * oui ; base qui contient déjà des données (mise à jour d'une installation existante) : on pose « terminé » sans rien montrer.
 */
export function decideOnboarding(input: { readonly completed: boolean; readonly empty: boolean; readonly requested: boolean }): OnboardingDecision {
  if (input.requested) return 'show';
  if (input.completed) return 'skip';
  return input.empty ? 'show' : 'mark-done';
}

/**
 * Domaines de données de l'utilisateur pris en compte pour reconnaître une base vide (FIX-0173, constat 10) : profil, routines, pesées, séances, repas,
 * résumés de récupération (jour et muscles), échantillons importés, facteurs, mensurations et mesures importées, photos de progression.
 */
export const USER_DATA_DOMAINS = ['profile', 'routines', 'weights', 'workouts', 'meals', 'recoveryDays', 'recoverySamples', 'recoveryFactors', 'measurements', 'photos'] as const;
export type UserDataDomain = (typeof USER_DATA_DOMAINS)[number];

/** Présence d'au moins une ligne vivante par domaine (requête d'existence bornée, jamais un comptage). */
export type BasePresence = Readonly<Record<UserDataDomain, boolean>>;

/** Base vide : aucune donnée dans aucun domaine utilisateur. */
export function isEmptyBase(presence: BasePresence): boolean {
  return USER_DATA_DOMAINS.every((domain) => !presence[domain]);
}
