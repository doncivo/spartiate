/**
 * SUIVIS-029a/b (lot 0.29.0, PROG-02) : objectifs de suivi, réglage LOCAL `today.prefs` (les réglages ne sont pas publiés, D-55). Valeur brute
 * relue par `parseTrackingGoals` : un champ illisible ou hors bornes reprend sa valeur par défaut, jamais une erreur d'affichage. Module pur.
 */

export interface TrackingGoals {
  /** Objectif quotidien de pas. */
  readonly stepsDaily: number;
  /** Objectif hebdomadaire de minutes de cardio en zone 2. */
  readonly zone2WeeklyMin: number;
  /** FC max saisie (bpm) ; null : 220 − âge du profil. */
  readonly hrMax: number | null;
}

export type GoalField = keyof TrackingGoals;

/** Bornes incluses de chaque objectif (entiers). */
export const TRACKING_GOAL_BOUNDS: Readonly<Record<GoalField, { readonly min: number; readonly max: number }>> = {
  stepsDaily: { min: 1000, max: 50000 },
  zone2WeeklyMin: { min: 10, max: 1200 },
  hrMax: { min: 100, max: 230 },
};

/** Valeurs par défaut (choix prudents, décisions proposées dans docs/SUIVIS-029.md). */
export const TRACKING_DEFAULTS: TrackingGoals = { stepsDaily: 8000, zone2WeeklyMin: 150, hrMax: null };

const inBounds = (field: GoalField, v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= TRACKING_GOAL_BOUNDS[field].min && v <= TRACKING_GOAL_BOUNDS[field].max;

export function parseTrackingGoals(raw: unknown): TrackingGoals {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return TRACKING_DEFAULTS;
  const r = raw as Readonly<Record<string, unknown>>;
  if (r['v'] !== 1) return TRACKING_DEFAULTS;
  return {
    stepsDaily: inBounds('stepsDaily', r['stepsDaily']) ? r['stepsDaily'] : TRACKING_DEFAULTS.stepsDaily,
    zone2WeeklyMin: inBounds('zone2WeeklyMin', r['zone2WeeklyMin']) ? r['zone2WeeklyMin'] : TRACKING_DEFAULTS.zone2WeeklyMin,
    hrMax: inBounds('hrMax', r['hrMax']) ? r['hrMax'] : null,
  };
}

export function serializeTrackingGoals(goals: TrackingGoals): { readonly v: 1 } & TrackingGoals {
  return { v: 1, stepsDaily: goals.stepsDaily, zone2WeeklyMin: goals.zone2WeeklyMin, hrMax: goals.hrMax };
}

export type GoalTextIssue = 'empty' | 'format' | 'range';
export type GoalTextResult = { readonly ok: true; readonly value: number | null } | { readonly ok: false; readonly issue: GoalTextIssue };

/** Saisie d'un objectif : entier (espaces de milliers admis) dans ses bornes ; FC max vide = non saisie (null). */
export function parseGoalText(field: GoalField, text: string): GoalTextResult {
  const t = text.replace(/\s/g, '');
  if (t === '') return field === 'hrMax' ? { ok: true, value: null } : { ok: false, issue: 'empty' };
  if (!/^\d{1,6}$/.test(t)) return { ok: false, issue: 'format' };
  const v = Number(t);
  return inBounds(field, v) ? { ok: true, value: v } : { ok: false, issue: 'range' };
}
