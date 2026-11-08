/**
 * Check-in hebdomadaire (PRD § 15.2 ; D-74). Le moteur PROPOSE : une proposition n'est jamais appliquée (`applied: false`) ; Ali accepte,
 * personnalise ou refuse (relançable), et sa modification est conservée avec sa source. Aucun ajustement sans couverture de 2 semaines ;
 * ± 150 kcal / semaine ; protéines 1,6–2,2 g/kg (± 2 g par check-in) ; lipides ≥ 0,6 g/kg ; l'énergie passe par les glucides ;
 * plancher 1 200 kcal (800 sur confirmation) ; perte ≤ 1 %/semaine ; cible hors de ± 25 % de la dépense : alerte et révision manuelle.
 */

import type { LocalDate } from '../types';
import { twoWeekCoverage, type TwoWeekCoverage } from './coverage';
import { KCAL_PER_G, NUTRITION_CONFIG, NUTRITION_ENGINE_VERSION } from './config';
import type { DayTotals, Target, WeighIn } from './types';

export type CheckInStyle = 'guided' | 'collaborative' | 'manual';
export type CheckInAction = 'accept' | 'customize' | 'refuse';

export type Goal =
  | { readonly kind: 'maintain' }
  | { readonly kind: 'loss' | 'gain'; readonly weeklyRateKg: number };

export interface CheckInInput {
  readonly style: CheckInStyle;
  readonly weekEnd: LocalDate;
  readonly days: readonly DayTotals[];
  readonly weighIns: readonly WeighIn[];
  /** Dépense retenue (`estimateTdee().value`). */
  readonly tdee: number | null;
  /** Poids de tendance. */
  readonly weightKg: number | null;
  readonly goal: Goal;
  readonly currentTarget: Target | null;
  /** Ali a confirmé explicitement que la cible peut descendre sous 1 200 kcal (jamais sous 800). */
  readonly lowFloorConfirmed: boolean;
}

export type CheckInReason = 'manual-style' | 'insufficient-coverage' | 'no-tdee' | 'no-weight';
export type Clamp = 'max-weekly-delta' | 'max-loss-rate' | 'floor';

export interface Proposal {
  readonly target: Target;
  readonly previousTarget: Target | null;
  readonly deltaKcal: number | null;
  readonly initial: boolean;
  readonly clampedBy: readonly Clamp[];
  /** Cible sous 1 200 kcal : n'existe que sur confirmation explicite d'Ali. */
  readonly belowStandardFloor: boolean;
  readonly options: readonly CheckInAction[];
  readonly alternatives: readonly { readonly kind: 'hold'; readonly target: Target }[];
  /** Toujours faux : le moteur ne modifie aucune cible. */
  readonly applied: false;
  readonly trace: {
    readonly engineVersion: number;
    readonly tdee: number;
    readonly desiredKcal: number;
    readonly weeklyRateKg: number;
    readonly weightKg: number;
  };
}

export type CheckInAlert =
  | { readonly kind: 'below-floor'; readonly currentKcal: number }
  | { readonly kind: 'target-vs-tdee'; readonly ratio: number }
  | { readonly kind: 'macros-infeasible'; readonly kcal: number; readonly minimumKcal: number };

export interface CheckInResult {
  readonly engineVersion: number;
  readonly style: CheckInStyle;
  readonly status: 'proposal' | 'suspended' | 'alert' | 'manual';
  readonly reasons: readonly CheckInReason[];
  readonly coverage: TwoWeekCoverage | null;
  readonly proposal: Proposal | null;
  readonly alert: CheckInAlert | null;
}

const EPS = 1e-9;
const ceilEps = (x: number): number => Math.ceil(x - EPS);
const floorEps = (x: number): number => Math.floor(x + EPS);
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

const proteinRange = (kg: number): { min: number; max: number } => ({
  min: ceilEps(NUTRITION_CONFIG.proteinMinPerKg * kg),
  max: floorEps(NUTRITION_CONFIG.proteinMaxPerKg * kg),
});
const fatMin = (kg: number): number => ceilEps(NUTRITION_CONFIG.fatMinPerKg * kg);

function result(
  input: CheckInInput,
  status: CheckInResult['status'],
  extra: Partial<Pick<CheckInResult, 'reasons' | 'coverage' | 'proposal' | 'alert'>> = {},
): CheckInResult {
  return {
    engineVersion: NUTRITION_ENGINE_VERSION,
    style: input.style,
    status,
    reasons: extra.reasons ?? [],
    coverage: extra.coverage ?? null,
    proposal: extra.proposal ?? null,
    alert: extra.alert ?? null,
  };
}

export function proposeCheckIn(input: CheckInInput): CheckInResult {
  const cfg = NUTRITION_CONFIG;
  const current = input.currentTarget;
  const coverage = current === null ? null : twoWeekCoverage(input.days, input.weighIns, input.weekEnd);

  if (input.style === 'manual') return result(input, 'manual', { reasons: ['manual-style'], coverage });

  const reasons: CheckInReason[] = [];
  if (input.weightKg === null || !(input.weightKg > 0)) reasons.push('no-weight');
  if (input.tdee === null || !(input.tdee > 0)) reasons.push('no-tdee');
  if (coverage !== null && !coverage.sufficient) reasons.push('insufficient-coverage');
  if (reasons.length > 0 || input.tdee === null || input.weightKg === null) {
    return result(input, 'suspended', { reasons, coverage });
  }
  const { tdee, weightKg } = input;

  const floor = input.lowFloorConfirmed ? cfg.confirmedFloorKcal : cfg.floorKcal;
  if (current !== null && current.kcal < floor) {
    return result(input, 'alert', { coverage, alert: { kind: 'below-floor', currentKcal: current.kcal } });
  }

  const clampedBy: Clamp[] = [];
  let rate = input.goal.kind === 'maintain' || !Number.isFinite(input.goal.weeklyRateKg) ? 0 : Math.max(0, input.goal.weeklyRateKg);
  if (input.goal.kind === 'loss' && rate > cfg.maxLossPerWeekFraction * weightKg) {
    rate = cfg.maxLossPerWeekFraction * weightKg;
    clampedBy.push('max-loss-rate');
  }
  const sign = input.goal.kind === 'loss' ? -1 : 1;
  const desiredKcal = Math.round(tdee + (sign * rate * cfg.kcalPerKg) / 7);

  let kcal: number;
  if (current === null) {
    kcal = desiredKcal;
  } else {
    const step = clamp(desiredKcal - current.kcal, -cfg.maxWeeklyDelta, cfg.maxWeeklyDelta);
    if (step !== desiredKcal - current.kcal) clampedBy.push('max-weekly-delta');
    kcal = current.kcal + step;
  }
  if (kcal < floor) {
    kcal = floor;
    clampedBy.push('floor');
  }

  const ratio = (kcal - tdee) / tdee;
  if (Math.abs(ratio) > cfg.alertTdeeFraction) {
    return result(input, 'alert', { coverage, alert: { kind: 'target-vs-tdee', ratio } });
  }

  const { min: pMin, max: pMax } = proteinRange(weightKg);
  const fMin = fatMin(weightKg);
  let proteinG: number;
  let fatG: number;
  if (current === null) {
    proteinG = Math.round(cfg.initialProteinPerKg * weightKg);
    fatG = Math.round(cfg.initialFatPerKg * weightKg);
  } else {
    proteinG = current.proteinG;
    if (proteinG < pMin) proteinG = Math.min(proteinG + cfg.proteinStepG, pMin);
    else if (proteinG > pMax) proteinG = Math.max(proteinG - cfg.proteinStepG, pMax);
    fatG = Math.max(current.fatG, fMin);
  }
  const remainder = kcal - KCAL_PER_G.protein * proteinG - KCAL_PER_G.fat * fatG;
  if (remainder < 0) {
    const minimumKcal = KCAL_PER_G.protein * proteinG + KCAL_PER_G.fat * fatG;
    return result(input, 'alert', { coverage, alert: { kind: 'macros-infeasible', kcal, minimumKcal } });
  }

  const proposal: Proposal = {
    target: { kcal, proteinG, fatG, carbG: Math.round(remainder / KCAL_PER_G.carb) },
    previousTarget: current,
    deltaKcal: current === null ? null : kcal - current.kcal,
    initial: current === null,
    clampedBy,
    belowStandardFloor: kcal < cfg.floorKcal,
    options: ['accept', 'customize', 'refuse'],
    alternatives: input.style === 'collaborative' && current !== null ? [{ kind: 'hold', target: current }] : [],
    applied: false,
    trace: { engineVersion: NUTRITION_ENGINE_VERSION, tdee, desiredKcal, weeklyRateKg: rate, weightKg },
  };
  return result(input, 'proposal', { coverage, proposal });
}

export type CheckInDecision =
  | { readonly action: 'accept' }
  | { readonly action: 'customize'; readonly target: Target }
  | { readonly action: 'refuse' };

export type CheckInWarning = 'below-floor' | 'protein-out-of-range' | 'fat-below-min' | 'beyond-weekly-delta';

export interface CheckInOutcome {
  readonly action: CheckInAction | 'rejected';
  /** Cible à enregistrer ; `null` si la décision est rejetée ou s'il n'y a pas de cible. */
  readonly target: Target | null;
  /** `nutrition_target.source` : `accepted` (proposition telle quelle) ou `manual` (modifiée par Ali) ; `null` si rien n'est enregistré. */
  readonly source: 'accepted' | 'manual' | null;
  /** Refus : la proposition peut être relancée. */
  readonly retryable: boolean;
  readonly proposedTarget: Target;
  readonly warnings: readonly CheckInWarning[];
}

const validTarget = (t: Target): boolean =>
  Number.isFinite(t.kcal) &&
  t.kcal > 0 &&
  [t.proteinG, t.fatG, t.carbG].every((g) => Number.isFinite(g) && g >= 0);

/** Applique la décision d'Ali : il a le dernier mot, ses valeurs hors règles sont conservées et signalées, jamais corrigées. */
export function resolveCheckIn(input: {
  readonly proposal: Proposal;
  readonly currentTarget: Target | null;
  readonly weightKg: number;
  readonly decision: CheckInDecision;
}): CheckInOutcome {
  const { proposal, currentTarget, decision } = input;
  const proposedTarget = proposal.target;
  if (decision.action === 'accept') {
    return { action: 'accept', target: proposedTarget, source: 'accepted', retryable: false, proposedTarget, warnings: [] };
  }
  if (decision.action === 'refuse') {
    return { action: 'refuse', target: currentTarget, source: null, retryable: true, proposedTarget, warnings: [] };
  }
  if (!validTarget(decision.target)) {
    return { action: 'rejected', target: null, source: null, retryable: true, proposedTarget, warnings: [] };
  }
  const t = decision.target;
  const { min, max } = proteinRange(input.weightKg);
  const warnings: CheckInWarning[] = [];
  if (t.kcal < NUTRITION_CONFIG.floorKcal) warnings.push('below-floor');
  if (t.proteinG < min || t.proteinG > max) warnings.push('protein-out-of-range');
  if (t.fatG < fatMin(input.weightKg)) warnings.push('fat-below-min');
  if (currentTarget !== null && Math.abs(t.kcal - currentTarget.kcal) > NUTRITION_CONFIG.maxWeeklyDelta) {
    warnings.push('beyond-weekly-delta');
  }
  return { action: 'customize', target: t, source: 'manual', retryable: false, proposedTarget, warnings };
}
