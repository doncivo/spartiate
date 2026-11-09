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
  | 'inactivityHeld'
  | 'deload'
  | 'recoveryLow'
  | 'recoveryLowSet'
  | 'outlierHold'
  | 'position'
  | 'positionHeld';

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
      // B1 : la dernière séance dépasse nettement l'historique sans confirmation : on le dit, avec la charge, pour qu'Ali vérifie.
      if (p.reasons.includes('outlier-excluded') && p.loadKg !== null) return { key: 'outlierHold', params: { load: p.loadKg, set } };
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
    case 'inactivity': {
      // I4-08 : l'écart dit est celui de la charge appliquée (arrondie au matériel), jamais la décote théorique ; aucun écart : charge maintenue.
      const ref = p.reference?.loadKg ?? 0;
      const delta = -(p.deltaKg ?? 0);
      if (!(delta > 0) || !(ref > 0)) return { key: 'inactivityHeld', params: { cut: percent(p.inactivityCut ?? 0) } };
      return { key: 'inactivity', params: { delta: Math.round(delta * 100) / 100, cut: Math.round((delta / ref) * 1000) / 10 } };
    }
    case 'deload':
      return { key: 'deload', params: { sets: p.sets.length, rir: p.rirTarget ?? 0 } };
    case 'position':
    {
      // L'écart dit est celui de la charge appliquée (arrondie au matériel), jamais la décote théorique (comme l'inactivité, I4-08).
      const ref = p.positionBasisKg ?? p.reference?.loadKg ?? 0;
      const delta = Math.abs(p.deltaKg ?? 0);
      const rank = p.positionRank ?? 1;
      if (!(delta > 0) || !(ref > 0)) return { key: 'positionHeld', params: { rank } };
      return { key: 'position', params: { delta: Math.round(delta * 100) / 100, rank, cut: Math.round((delta / ref) * 1000) / 10 } };
    }
    case 'recovery-low':
      return { key: p.reasons.includes('recovery-set-removed') ? 'recoveryLowSet' : 'recoveryLow', params: { cut: recoveryCut(p) } };
  }
}

export type ExplanationNoteKey = 'notePartialIgnored' | 'noteGridToVerify' | 'notePosition' | 'noteBodyweightUnknown';

/**
 * I2-04 : précisions ajoutées à la phrase, dans cet ordre : dernière séance ignorée (moins de 50 % des séries faites), puis grille de charges
 * tirée d'un matériel « à vérifier ». Information seulement. Aucune note pour une décision d'Ali (reprise telle quelle) ni hors moteur.
 */
export function explanationNotes(p: Prescription): { readonly key: ExplanationNoteKey; readonly params: Readonly<Record<string, number>> }[] {
  if (p.headline === 'decision' || p.headline === 'unsupported') return [];
  const notes: { readonly key: ExplanationNoteKey; readonly params: Readonly<Record<string, number>> }[] = [];
  if (p.reasons.includes('partial-session-ignored')) notes.push({ key: 'notePartialIgnored', params: {} });
  if (p.reasons.includes('grid-to-verify')) notes.push({ key: 'noteGridToVerify', params: {} });
  // Poids du corps inconnu (REV-01) : le 1RM et les écarts sont calculés sur le seul lest, ce que la phrase dit.
  if (p.reasons.includes('bodyweight-unknown')) notes.push({ key: 'noteBodyweightUnknown', params: {} });
  // Position (REV-01 constat 6) : dite en note quand la raison principale est autre (la charge reste au-dessus de la référence).
  if (p.reasons.includes('position-discount') && p.headline !== 'position') notes.push({ key: 'notePosition', params: { rank: p.positionRank ?? 1, cut: percent(p.positionCut ?? 0) } });
  return notes;
}

const percent = (fraction: number): number => Math.round(fraction * 100);
/** Baisse de charge Recovery en %, tirée de la configuration active (`lowRecoveryLoad`). */
const recoveryCut = (p: Prescription): number => percent(1 - p.activeConfig.lowRecoveryLoad);

// -----------------------------------------------------------------------------------------------------------------------------------
// Contraintes (I2-02) : une alerte par contrainte active hors raison principale, une phrase par choix facultatif.
// -----------------------------------------------------------------------------------------------------------------------------------

export type ConstraintAlertKey = 'alertFatigue' | 'alertStall' | 'alertInactivity' | 'alertDeload' | 'alertRecoveryLow' | 'alertRecoveryLowSet';
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
  return ALERTS.filter((a) => p.reasons.includes(a.reason) && a.headline !== p.headline).map((a) => {
    if (a.key === 'alertStall') return { key: a.key, params: { sessions: p.activeConfig.stallSessions } };
    if (a.key === 'alertInactivity') return { key: a.key, params: { cut: percent(p.inactivityCut ?? 0) } };
    if (a.key === 'alertRecoveryLow') return { key: p.reasons.includes('recovery-set-removed') ? 'alertRecoveryLowSet' : a.key, params: { cut: recoveryCut(p) } };
    return { key: a.key, params: {} };
  });
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
