import type { PrescriptionHeadline, ProposalOptionKind, ReasonCode } from './types';

/**
 * Constantes du moteur de prescription (PRD § 11.3 ; I2-01 ; D-72). Module pur. Toute modification d'une valeur qui change une
 * prescription incrémente `ENGINE_VERSION` (la version est jointe à chaque prescription et à chaque décision tracée).
 */

export const ENGINE_VERSION = 3;

export interface ProgressionConfig {
  /** Au-delà, une série pèse `lowQualityWeight` dans l'estimation (§ 11.3). */
  readonly maxRepsForEstimate: number;
  /** Sous cette fraction du 1RM courant, une série pèse `lowQualityWeight`. */
  readonly lowLoadRatio: number;
  readonly lowQualityWeight: number;
  /** Poids de récence des séances, de la plus récente à la plus ancienne ; leur nombre borne la fenêtre d'estimation. */
  readonly recencyWeights: readonly number[];
  /** Série aberrante : e1RM au-delà de ce multiple du 1RM courant, non confirmée (§ 11.2 point 1). */
  readonly outlierRatio: number;
  /** Une séance sous cette fraction de séries faites ne met pas à jour le 1RM (§ 11.5). */
  readonly minCompletedFraction: number;
  /** Confiance : poids des séries, de la dispersion et de la récence ; séries au-delà desquelles le terme est plein. */
  readonly confidenceWeights: { readonly sets: number; readonly dispersion: number; readonly recency: number };
  readonly setsForFullConfidence: number;
  /** Récence 1 jusqu'à `recencyFullDays`, linéaire, 0 à partir de `recencyZeroDays` (D-72 point 3). */
  readonly recencyFullDays: number;
  readonly recencyZeroDays: number;
  /** Confiance strictement sous ce seuil : prescription provisoire. */
  readonly provisionalBelow: number;
  /** Confiance strictement sous ce seuil : « Facile » peut recalibrer. */
  readonly easyRecalibrationBelow: number;
  readonly easyRecalibrationGain: number;
  /** « Une fois par exercice et par mois » : 30 jours glissants. */
  readonly easyRecalibrationCooldownDays: number;
  /** RIR ≤ : bloque la hausse ; RIR ≥ : confirme le cran (§ 11.2 point 5). */
  readonly hardRirAtMost: number;
  readonly easyRirAtLeast: number;
  /** Plafond de hausse du 1RM implicite par séance (D-72 point 7). */
  readonly maxGainPerSession: number;
  /** Écart au cran inférieur au-delà duquel une répétition est ajoutée (D-72 point 6). */
  readonly snapTolerance: number;
  /** Cran supposé quand le matériel n'a pas de palier connu (machine ou poulie « à vérifier »), signalé par `increment-unknown`. */
  readonly unknownIncrementKg: number;
  /** Arrondi inférieur d'une charge sans grille. */
  readonly unknownGridRoundingKg: number;
  /** Multiplicateurs de position par muscle principal (§ 11.3), appliqués par la génération (I3). */
  readonly positionDiscount: readonly number[];
  // Contraintes (I2-02, § 11.3 ; D-72 points 7 à 10) : maintien ou réduction seulement.
  /** Baisse de répétitions à charge égale strictement au-delà : fatigue (D-72 point 7). */
  readonly fatigueDrop: number;
  /** Choix de fatigue : charge × (1 − `fatigueLoadCut`) ou `fatigueRepsCut` répétitions de moins par série. */
  readonly fatigueLoadCut: number;
  readonly fatigueRepsCut: number;
  /** Séances consécutives sans progrès qui ouvrent les trois choix de stagnation (D-72 point 8). */
  readonly stallSessions: number;
  /** Mini-deload de stagnation : charge × (1 − `miniDeloadCut`). */
  readonly miniDeloadCut: number;
  /** Inactivité (D-72 point 10) : seuil en jours, −`detrainWeeklyCut` par semaine complète au-delà (dès J21), plancher `detrainFloor`. */
  readonly detrainStartDays: number;
  readonly detrainWeeklyCut: number;
  readonly detrainFloor: number;
  /** Deload manuel : séries ÷ 2 arrondi en dessous, au moins une (D-72 point 9) ; charge × `deloadLoad` ; RIR cible au moins `deloadRirAtLeast`. */
  readonly deloadLoad: number;
  readonly deloadRirAtLeast: number;
  /** Récupération basse : Recovery ≤ `lowRecovery`, sommeil < `lowSleepHours` ou FC repos > +`highRestingHrDelta` → charge × `lowRecoveryLoad`. */
  readonly lowRecovery: number;
  readonly lowSleepHours: number;
  readonly highRestingHrDelta: number;
  readonly lowRecoveryLoad: number;
}

export const DEFAULT_PROGRESSION_CONFIG: ProgressionConfig = Object.freeze({
  maxRepsForEstimate: 15,
  lowLoadRatio: 0.6,
  lowQualityWeight: 0.25,
  recencyWeights: Object.freeze([1, 0.6, 0.3]),
  outlierRatio: 1.5,
  minCompletedFraction: 0.5,
  confidenceWeights: Object.freeze({ sets: 0.4, dispersion: 0.3, recency: 0.3 }),
  setsForFullConfidence: 6,
  recencyFullDays: 14,
  recencyZeroDays: 60,
  provisionalBelow: 0.4,
  easyRecalibrationBelow: 0.6,
  easyRecalibrationGain: 0.05,
  easyRecalibrationCooldownDays: 30,
  hardRirAtMost: 1,
  easyRirAtLeast: 4,
  maxGainPerSession: 0.1,
  snapTolerance: 0.03,
  unknownIncrementKg: 2.5,
  unknownGridRoundingKg: 0.5,
  positionDiscount: Object.freeze([1, 0.93, 0.88]),
  fatigueDrop: 0.2,
  fatigueLoadCut: 0.05,
  fatigueRepsCut: 2,
  stallSessions: 3,
  miniDeloadCut: 0.1,
  detrainStartDays: 14,
  detrainWeeklyCut: 0.01,
  detrainFloor: 0.1,
  deloadLoad: 0.8,
  deloadRirAtLeast: 4,
  lowRecovery: 33,
  lowSleepHours: 6,
  highRestingHrDelta: 0.08,
  lowRecoveryLoad: 0.95,
});

/** Séances closes chargées par exercice pour le moteur (fenêtre d'estimation et séances ignorées ou aberrantes comprises). */
export const HISTORY_SESSIONS_LOADED = 12;

/** Ordre normatif des raisons (§ 11.2) : validation, référence, double progression, difficulté, contraintes (I2-02), arrondi. */
export const REASON_ORDER: readonly ReasonCode[] = [
  'partial-session-ignored',
  'outlier-excluded',
  'no-history',
  'decision-reference',
  'history-reference',
  'provisional',
  'top-reached',
  'rep-ladder',
  'hard-blocks-increase',
  'easy-confirms',
  'easy-recalibration',
  'fatigue-drop',
  'stall',
  'inactivity-discount',
  'deload',
  'recovery-low',
  'recovery-set-removed',
  'increment-unknown',
  'grid-to-verify',
  'equipment-max',
  'snap-extra-rep',
  'gain-capped',
  'unsupported-metric',
];

export const PRESCRIPTION_HEADLINES: readonly PrescriptionHeadline[] = [
  'to-enter',
  'decision',
  'increase',
  'rep-ladder',
  'recalibration',
  'hold-hard',
  'extra-rep',
  'unsupported',
  'fatigue',
  'inactivity',
  'deload',
  'recovery-low',
];

/** Étape d'une rampe d'échauffement : fraction de la charge de travail et répétitions (arrondies en dessous à l'usage). */
export interface WarmupStep {
  readonly ratio: number;
  readonly reps: number;
}

/**
 * Rampe d'échauffement (PRD § 13.8 ; I2-03 ; D-72 point 11) : 40 % × 8, 60 % × 5, 80 % × 2 de la charge de travail. Hors moteur de
 * prescription (aucune proposition de travail n'en dépend) : la modifier ne change pas `ENGINE_VERSION`.
 */
export const WARMUP_STEPS: readonly WarmupStep[] = Object.freeze([Object.freeze({ ratio: 0.4, reps: 8 }), Object.freeze({ ratio: 0.6, reps: 5 }), Object.freeze({ ratio: 0.8, reps: 2 })]);

/** Ordre stable des choix facultatifs : fatigue (charge, puis répétitions), puis stagnation (variante, plage, mini-deload). */
export const PROPOSAL_OPTION_ORDER: readonly ProposalOptionKind[] = ['fatigue-load', 'fatigue-reps', 'stall-variant', 'stall-range', 'stall-mini-deload'];
