import type { PrescriptionHeadline, ReasonCode } from './types';

/**
 * Constantes du moteur de prescription (PRD § 11.3 ; I2-01 ; D-72). Module pur. Toute modification d'une valeur qui change une
 * prescription incrémente `ENGINE_VERSION` (la version est jointe à chaque prescription et à chaque décision tracée).
 */

export const ENGINE_VERSION = 1;

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
  'increment-unknown',
  'equipment-max',
  'snap-extra-rep',
  'gain-capped',
  'unsupported-metric',
];

export const PRESCRIPTION_HEADLINES: readonly PrescriptionHeadline[] = ['to-enter', 'decision', 'increase', 'rep-ladder', 'recalibration', 'hold-hard', 'extra-rep', 'unsupported'];
