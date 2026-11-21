import { DEFAULT_PROGRESSION_CONFIG, ENGINE_VERSION, type ProgressionConfig } from './config';
import type { IsoDateTime } from '../types';
import type { ExerciseMetric, Prescription } from './types';

/**
 * Retour à une prescription antérieure (PRD § 11.5 ; MOTEUR-0281b, C-189). Module pur.
 *
 * Les décisions d'Ali (`recommendation_decision`, séances closes) donnent la suite des valeurs retenues, une par séance (la dernière de la
 * séance). La « dernière hausse » est la dernière décision plus dure que celle d'avant : charge plus lourde (assisté : assistance plus
 * faible) ; exercice sans charge à lest égal (poids du corps, chronométré) : plus de répétitions ou de secondes au total. Le retour propose
 * les valeurs de la décision d'avant cette hausse ; il est tracé comme une décision (`revertDecisionPrescription`), jamais en effaçant.
 */

/** Décision lue par la fiche : valeurs retenues, séance, date, et marque d'une décision de retour (raison `revert-previous`). */
export interface DecisionStep {
  readonly workoutId: string | null;
  readonly decidedAt: IsoDateTime;
  /** Null : refus (rien retenu). */
  readonly loadKg: number | null;
  readonly reps: readonly number[];
  readonly revert: boolean;
}

export interface RevertTarget {
  readonly loadKg: number;
  readonly reps: readonly number[];
  /** Date de la décision reprise. */
  readonly decidedAt: IsoDateTime;
}

export interface RevertOptions {
  readonly metric: ExerciseMetric;
  readonly assisted: boolean;
}

export type RevertProposal = { readonly kind: 'available'; readonly target: RevertTarget } | { readonly kind: 'none' } | { readonly kind: 'already' };

const EPS = 1e-9;
const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);
const sameValues = (a: { readonly loadKg: number | null; readonly reps: readonly number[] }, b: RevertTarget): boolean =>
  a.loadKg !== null && Math.abs(a.loadKg - b.loadKg) <= EPS && a.reps.length === b.reps.length && a.reps.every((r, i) => r === b.reps[i]);

/** Décision `next` plus dure que `previous` (voir l'en-tête). */
export function isHarder(next: { readonly loadKg: number; readonly reps: readonly number[] }, previous: { readonly loadKg: number; readonly reps: readonly number[] }, options: RevertOptions): boolean {
  const delta = next.loadKg - previous.loadKg;
  if (Math.abs(delta) > EPS) return options.assisted ? delta < 0 : delta > 0;
  return options.metric !== 'load-reps' && sum(next.reps) > sum(previous.reps);
}

const chronological = (a: DecisionStep, b: DecisionStep): number => (a.decidedAt < b.decidedAt ? -1 : a.decidedAt > b.decidedAt ? 1 : 0);

/**
 * Proposition de retour : `available` avec les valeurs à reprendre ; `none` sans hausse dans les décisions ; `already` si la décision la plus
 * récente retient déjà ces valeurs (retour déjà fait, ou séance déjà refaite à ces valeurs) : rien à reproposer.
 */
export function revertProposal(decisions: readonly DecisionStep[], options: RevertOptions): RevertProposal {
  const ordered = [...decisions].sort(chronological);
  // Une valeur retenue par séance : la dernière décision non « retour » de chaque séance ; les refus ne retiennent rien.
  const perWorkout = new Map<string, DecisionStep>();
  const steps: (DecisionStep & { readonly loadKg: number })[] = [];
  for (const d of ordered) {
    if (d.revert || d.loadKg === null || d.reps.length === 0) continue;
    if (d.workoutId === null) steps.push(d as DecisionStep & { readonly loadKg: number });
    else perWorkout.set(d.workoutId, d);
  }
  for (const d of perWorkout.values()) steps.push(d as DecisionStep & { readonly loadKg: number });
  steps.sort(chronological);
  let target: RevertTarget | null = null;
  for (let i = steps.length - 1; i >= 1; i -= 1) {
    const next = steps[i];
    const previous = steps[i - 1];
    if (next !== undefined && previous !== undefined && isHarder(next, previous, options)) {
      target = { loadKg: previous.loadKg, reps: previous.reps, decidedAt: previous.decidedAt };
      break;
    }
  }
  if (target === null) return { kind: 'none' };
  const latest = ordered[ordered.length - 1];
  if (latest !== undefined && sameValues(latest, target)) return { kind: 'already' };
  return { kind: 'available', target };
}

/**
 * Prescription tracée avec la décision de retour : raison principale « décision », raisons `decision-reference` et `revert-previous`, valeurs
 * reprises. Rien d'autre (ni 1RM, ni deload, ni choix) : elle ne fait que porter la trace (§ 11.2 point 9).
 */
export function revertDecisionPrescription(target: RevertTarget, metric: ExerciseMetric, config: ProgressionConfig = DEFAULT_PROGRESSION_CONFIG): Prescription {
  return {
    status: 'prescribed',
    headline: 'decision',
    reasons: ['decision-reference', 'revert-previous'],
    sets: target.reps.map((reps) => ({ reps, loadKg: target.loadKg })),
    loadKg: target.loadKg,
    deltaKg: null,
    reference: null,
    ladderSetIndex: null,
    estimated1rmKg: null,
    confidence: 0,
    recalibration: null,
    options: [],
    deload: false,
    rirTarget: null,
    inactivityCut: 0,
    ...(metric === 'bodyweight-reps' || metric === 'time' ? { metric } : {}),
    engineVersion: ENGINE_VERSION,
    activeConfig: config,
  };
}

/** Décision de retour : prescription tracée qui porte la raison `revert-previous`. */
export const isRevertPrescription = (p: Pick<Prescription, 'reasons'>): boolean => p.reasons.includes('revert-previous');
