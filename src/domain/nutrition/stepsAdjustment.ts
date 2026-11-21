/**
 * Dépense du jour ajustée aux pas (PRD § 15.2 « modificateurs » ; REPAS-029b). Module pur, AFFICHAGE SEUL.
 *
 * Ne pas compter les pas deux fois : la dépense MESURÉE (TDEE par tendance, § 15.1) intègre déjà l'activité réelle. Seule la part « formule »
 * de la dépense retenue (`1 − weightMeasured`, Mifflin-St Jeor × activité déclarée) reçoit l'ajustement ; mesure seule : aucun ajustement.
 * Le check-in, le lissage et les cibles n'appellent jamais cette fonction. Aucun jour absent n'est un zéro : pas à 0 ou invalides = inconnus.
 */

import { addDays } from '../localDate';
import type { LocalDate } from '../types';
import { STEPS_ADJUSTMENT } from './config';

export interface StepsDay {
  readonly day: LocalDate;
  readonly steps: number;
}

export type StepsAdjustmentReason = 'no-steps' | 'unreadable' | 'day-unknown' | 'baseline-short' | 'no-estimate' | 'measured-only';

export type StepsAdjustment =
  | { readonly status: 'none'; readonly reason: StepsAdjustmentReason }
  | {
      readonly status: 'adjusted';
      readonly date: LocalDate;
      readonly steps: number;
      readonly baseline: number;
      readonly baselineDays: number;
      /** Écart brut (pas − base) × coût par pas, borné ; avant la part de formule. */
      readonly rawKcal: number;
      readonly capped: boolean;
      readonly formulaShare: number;
      readonly appliedKcal: number;
      readonly adjusted: number;
    };

const known = (s: number): boolean => Number.isFinite(s) && s > 0;

/**
 * `steps` : `null` = lecture impossible, `[]` = aucun pas importé. `date` : jour de référence COMPLET (la veille : les pas du jour en cours sont
 * partiels). `estimate` : dépense retenue du jour et poids de la mesure (0 = formule seule, 1 = mesure seule).
 */
export function adjustForSteps(input: {
  readonly date: LocalDate;
  readonly steps: readonly StepsDay[] | null;
  readonly estimate: { readonly value: number | null; readonly weightMeasured: number };
}): StepsAdjustment {
  const { date, steps, estimate } = input;
  if (steps === null) return { status: 'none', reason: 'unreadable' };
  if (steps.length === 0) return { status: 'none', reason: 'no-steps' };
  if (estimate.value === null) return { status: 'none', reason: 'no-estimate' };
  if (!(estimate.weightMeasured < 1)) return { status: 'none', reason: 'measured-only' };
  const today = steps.find((s) => s.day === date);
  if (today === undefined || !known(today.steps)) return { status: 'none', reason: 'day-unknown' };
  const from = addDays(date, -STEPS_ADJUSTMENT.baselineWindowDays);
  const byDay = new Map<string, number>();
  for (const s of steps) if (s.day >= from && s.day < date && known(s.steps)) byDay.set(s.day, s.steps);
  if (byDay.size < STEPS_ADJUSTMENT.minBaselineDays) return { status: 'none', reason: 'baseline-short' };
  const baseline = [...byDay.values()].reduce((a, b) => a + b, 0) / byDay.size;
  const exact = (today.steps - baseline) * STEPS_ADJUSTMENT.kcalPerStep;
  const max = STEPS_ADJUSTMENT.maxAdjustKcal;
  const rawKcal = Math.round(Math.max(-max, Math.min(max, exact)));
  const formulaShare = Math.max(0, Math.min(1, 1 - estimate.weightMeasured));
  const appliedKcal = Math.round(rawKcal * formulaShare);
  return {
    status: 'adjusted',
    date,
    steps: today.steps,
    baseline: Math.round(baseline),
    baselineDays: byDay.size,
    rawKcal,
    capped: Math.abs(exact) > max,
    formulaShare,
    appliedKcal,
    adjusted: Math.round(estimate.value) + appliedKcal,
  };
}
