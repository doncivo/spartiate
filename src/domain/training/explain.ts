import type { ProgressionConfig } from './config';
import type { Prescription, PrescriptionHeadline, ProposalOption, ReasonCode } from './types';

/**
 * Explication d'une prescription (PRD § 11.4 ; I2-01 PR 2/2, critères 10 et 11) : UNE phrase, choisie par la raison principale (`headline`)
 * et précisée par les raisons qui la qualifient (cran supposé, plafond, maximum du matériel). Module pur : il rend une clé et des nombres,
 * les textes sont dans `src/i18n/fr.progression.ts`.
 */

export type ExplanationKey =
  | 'toEnter'
  | 'unsupported'
  | 'decision'
  | 'increase'
  | 'increaseUnknownStep'
  | 'repLadder'
  | 'recalibration'
  | 'holdHard'
  | 'extraRep'
  | 'extraRepCapped'
  | 'extraRepMax'
  | 'fatigue'
  | 'inactivity'
  | 'deload'
  | 'recoveryLow';

export interface Explanation {
  readonly key: ExplanationKey;
  readonly params: Readonly<Record<string, number>>;
}

export type ConfidenceBand = 'low' | 'medium' | 'high';

/** Seuils du mot de confiance : « faible » sous 40 % (proposition provisoire, `provisionalBelow`), « moyenne » sous 70 %, « bonne » au-delà. */
const MEDIUM_FROM = 0.4;
const HIGH_FROM = 0.7;

export const confidencePercent = (confidence: number): number => Math.round(Math.min(1, Math.max(0, confidence)) * 100);

export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence < MEDIUM_FROM) return 'low';
  return confidence < HIGH_FROM ? 'medium' : 'high';
}

export function explainPrescription(p: Prescription): Explanation {
  const set = (p.ladderSetIndex ?? 0) + 1;
  switch (p.headline) {
    case 'to-enter':
      return { key: 'toEnter', params: {} };
    case 'unsupported':
      return { key: 'unsupported', params: {} };
    case 'decision':
      // Une décision sans charge retenue ne fixe rien : « à saisir » (relecture de la #61, point C).
      return p.loadKg === null ? { key: 'toEnter', params: {} } : { key: 'decision', params: { load: p.loadKg } };
    case 'increase': {
      const reps = p.reference?.reps ?? [];
      const params = { delta: p.deltaKg ?? 0, sets: reps.length, reps: reps.length > 0 ? Math.min(...reps) : 0 };
      return { key: p.reasons.includes('increment-unknown') ? 'increaseUnknownStep' : 'increase', params };
    }
    case 'rep-ladder':
      return { key: 'repLadder', params: { set } };
    case 'recalibration':
      return { key: 'recalibration', params: { delta: p.deltaKg ?? 0 } };
    case 'hold-hard':
      return { key: 'holdHard', params: {} };
    case 'extra-rep':
      if (p.reasons.includes('gain-capped')) return { key: 'extraRepCapped', params: { set } };
      if (p.reasons.includes('equipment-max')) return { key: 'extraRepMax', params: { set } };
      return { key: 'extraRep', params: { set } };
    case 'fatigue':
      return { key: 'fatigue', params: {} };
    case 'inactivity':
      return { key: 'inactivity', params: { cut: percent(p.inactivityCut) } };
    case 'deload':
      return { key: 'deload', params: { sets: p.sets.length, rir: p.rirTarget ?? 0 } };
    case 'recovery-low':
      return { key: 'recoveryLow', params: {} };
  }
}

const percent = (fraction: number): number => Math.round(fraction * 100);

// -----------------------------------------------------------------------------------------------------------------------------------
// Contraintes (I2-02) : une alerte par contrainte active hors raison principale, une phrase par choix facultatif.
// -----------------------------------------------------------------------------------------------------------------------------------

export type ConstraintAlertKey = 'alertFatigue' | 'alertStall' | 'alertInactivity' | 'alertDeload' | 'alertRecoveryLow';
export type OptionKey = 'optionFatigueLoad' | 'optionFatigueReps' | 'optionStallVariant' | 'optionStallRange' | 'optionStallMiniDeload';

/** Contraintes dans l'ordre de `REASON_ORDER`, avec la raison principale qu'elles portent quand elles réduisent. */
const ALERTS: readonly { readonly reason: ReasonCode; readonly headline: PrescriptionHeadline | null; readonly key: ConstraintAlertKey }[] = [
  { reason: 'fatigue-drop', headline: 'fatigue', key: 'alertFatigue' },
  { reason: 'stall', headline: null, key: 'alertStall' },
  { reason: 'inactivity-discount', headline: 'inactivity', key: 'alertInactivity' },
  { reason: 'deload', headline: 'deload', key: 'alertDeload' },
  { reason: 'recovery-low', headline: 'recovery-low', key: 'alertRecoveryLow' },
];

/** Alertes des contraintes actives autres que la raison principale (déjà dite par la phrase), dans l'ordre normatif. */
export function constraintAlerts(p: Prescription): { readonly key: ConstraintAlertKey; readonly params: Readonly<Record<string, number>> }[] {
  return ALERTS.filter((a) => p.reasons.includes(a.reason) && a.headline !== p.headline).map((a) => ({
    key: a.key,
    params: a.key === 'alertStall' ? { sessions: p.activeConfig.stallSessions } : a.key === 'alertInactivity' ? { cut: percent(p.inactivityCut) } : {},
  }));
}

export function explainOption(o: ProposalOption, config: ProgressionConfig): { readonly key: OptionKey; readonly params: Readonly<Record<string, number>> } {
  switch (o.kind) {
    case 'fatigue-load':
      return { key: 'optionFatigueLoad', params: { cut: percent(config.fatigueLoadCut) } };
    case 'fatigue-reps':
      return { key: 'optionFatigueReps', params: { reps: config.fatigueRepsCut } };
    case 'stall-variant':
      return { key: 'optionStallVariant', params: {} };
    case 'stall-range':
      return { key: 'optionStallRange', params: {} };
    case 'stall-mini-deload':
      return { key: 'optionStallMiniDeload', params: { cut: percent(config.miniDeloadCut) } };
  }
}
