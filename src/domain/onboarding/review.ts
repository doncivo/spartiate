/**
 * Revue de l'onboarding (FIX-0171, constat 6, D-124). Pur : aucun import Tauri ni React.
 *
 * - Un assistant TERMINÉ n'a plus de brouillon : « Revoir mes réglages » repart des données actuelles (profil, dernière pesée, activité déclarée,
 *   matériel actif) et des seules réponses qui n'ont pas d'autre place (rythme, disponibilité, priorités…), gardées à part (`answersOf`).
 * - À la fin, seuls les champs réellement modifiés s'écrivent ; une valeur qui en remplace une autre déjà enregistrée est un REMPLACEMENT, à
 *   confirmer (ou refuser) avant l'écriture. Un champ vide ou passé n'efface jamais rien.
 */

import type { BodyGoal, Experience, Sex } from '../bodyProfile';
import type { Goal } from '../nutrition/checkIn';
import type { ActivityLevel } from '../nutrition/config';
import { emptyDraft, RATE_GOALS, type OnboardingDraft, type OnboardingGoal } from './draft';
import { weeklyRateKg } from './expenditure';

/** Ce qui est enregistré aujourd'hui, hors brouillon : profil, dernière pesée, préférences de nutrition, matériel actif. */
export interface CurrentSettings {
  readonly sex: Sex | null;
  readonly birthYear: number | null;
  readonly heightCm: number | null;
  readonly goal: BodyGoal | null;
  readonly experience: Experience | null;
  /** Dernière pesée (kg), toute source. */
  readonly weightKg: number | null;
  readonly activity: ActivityLevel | null;
  readonly equipmentProfileId: string | null;
  /** Cible de nutrition enregistrée (Stratégie), qui peut avoir été changée depuis par le check-in. */
  readonly nutritionGoal: Goal | null;
}

export const NO_CURRENT: CurrentSettings = { sex: null, birthYear: null, heightCm: null, goal: null, experience: null, weightKg: null, activity: null, equipmentProfileId: null, nutritionGoal: null };

export const GOAL_FROM_PROFILE: Readonly<Record<BodyGoal, OnboardingGoal>> = { gain: 'muscle', loss: 'fat-loss', maintain: 'maintenance' };
export const PROFILE_GOAL: Readonly<Record<OnboardingGoal, BodyGoal>> = { muscle: 'gain', strength: 'maintain', recomposition: 'maintain', 'fat-loss': 'loss', maintenance: 'maintain' };

/** Cible de nutrition déduite des réponses (objectif, rythme, poids) ; `null` sans objectif. */
export function nutritionGoalOf(draft: OnboardingDraft): Goal | null {
  if (draft.goal === null) return null;
  const pct = draft.weeklyRatePct;
  if (RATE_GOALS.includes(draft.goal) && pct !== null && pct !== 0) {
    const kg = weeklyRateKg(draft.weightKg, pct);
    if (kg !== null && kg !== 0) return { kind: kg > 0 ? 'gain' : 'loss', weeklyRateKg: Math.abs(kg) };
  }
  return { kind: 'maintain' };
}

const sameGoal = (a: Goal | null, b: Goal | null): boolean =>
  a === null || b === null ? a === b : a.kind === b.kind && (a.kind === 'maintain' || (b.kind !== 'maintain' && a.weeklyRateKg === b.weeklyRateKg));

/** Réponses gardées après un assistant terminé : celles qui n'ont pas d'autre place (les autres se relisent dans leurs tables). */
export function answersOf(draft: OnboardingDraft): OnboardingDraft {
  return { ...draft, step: 'you', sex: null, birthYear: null, heightCm: null, weightKg: null, activity: null, experience: null, equipmentProfileId: null };
}

/** Point de départ de « Revoir mes réglages » : données actuelles d'abord, réponses de l'assistant terminé pour le reste ; premier écran. */
export function reviewStart(answers: OnboardingDraft | null, current: CurrentSettings): OnboardingDraft {
  const base = answers ? answersOf(answers) : emptyDraft();
  const goal = current.goal === null ? null : base.goal !== null && PROFILE_GOAL[base.goal] === current.goal ? base.goal : GOAL_FROM_PROFILE[current.goal];
  return {
    ...base,
    step: 'you',
    sex: current.sex,
    birthYear: current.birthYear,
    heightCm: current.heightCm,
    weightKg: current.weightKg,
    activity: current.activity,
    experience: current.experience,
    equipmentProfileId: current.equipmentProfileId,
    goal,
  };
}

export type ChangeField = 'sex' | 'birthYear' | 'heightCm' | 'weightKg' | 'activity' | 'goal' | 'experience' | 'equipmentProfileId' | 'nutritionGoal';
export type ChangeValue = string | number | Goal;

export interface OnboardingChange {
  readonly field: ChangeField;
  /** Valeur enregistrée aujourd'hui ; `null` : rien d'enregistré (ajout). */
  readonly before: ChangeValue | null;
  readonly after: ChangeValue;
  /** Vrai quand une valeur déjà enregistrée serait remplacée : à confirmer. Pour le poids : nouvelle pesée du jour face à la dernière. */
  readonly replaces: boolean;
}

/** Champs du plan d'entraînement : la routine proposée n'est reconsidérée que s'ils changent pendant la revue. */
const PLAN_FIELDS = ['goal', 'experience', 'sessionsPerWeek', 'durationMin', 'days', 'equipmentProfileId', 'priorities', 'avoided', 'painfulPatterns', 'variety', 'acceptProposal', 'skipped'] as const;

/** La proposition de routine est-elle à reconsidérer ? Sans point de départ (premier lancement) : oui. */
export function planChanged(draft: OnboardingDraft, baseline: OnboardingDraft | null): boolean {
  if (baseline === null) return true;
  return PLAN_FIELDS.some((f) => JSON.stringify(draft[f]) !== JSON.stringify(baseline[f]));
}

/**
 * Ce que la fin de l'assistant écrirait, champ par champ, face aux données actuelles. `baseline` : point de départ de la revue (`null` au premier
 * lancement ou à la reprise d'un brouillon inachevé) ; la cible de nutrition n'est réécrite que si objectif, rythme ou poids (objectif à rythme)
 * ont changé depuis ce point de départ, jamais par le seul fait de terminer.
 */
export function onboardingChanges(draft: OnboardingDraft, current: CurrentSettings, baseline: OnboardingDraft | null): OnboardingChange[] {
  const out: OnboardingChange[] = [];
  const push = (field: ChangeField, after: ChangeValue | null, before: ChangeValue | null): void => {
    if (after === null || after === before) return;
    out.push({ field, before, after, replaces: before !== null });
  };
  push('sex', draft.sex, current.sex);
  push('birthYear', draft.birthYear, current.birthYear);
  push('heightCm', draft.heightCm, current.heightCm);
  push('weightKg', draft.weightKg, current.weightKg);
  push('activity', draft.activity, current.activity);
  push('goal', draft.goal === null ? null : PROFILE_GOAL[draft.goal], current.goal);
  push('experience', draft.experience, current.experience);
  push('equipmentProfileId', draft.equipmentProfileId, current.equipmentProfileId);
  const goal = nutritionGoalOf(draft);
  // Une pesée corrigée seule ne réécrit pas la cible (le check-in a pu l'ajuster depuis) : seuls l'objectif et le rythme la redemandent.
  const asked = baseline === null || draft.goal !== baseline.goal || draft.weeklyRatePct !== baseline.weeklyRatePct;
  if (goal !== null && asked && !sameGoal(goal, current.nutritionGoal)) out.push({ field: 'nutritionGoal', before: current.nutritionGoal, after: goal, replaces: current.nutritionGoal !== null });
  return out;
}
