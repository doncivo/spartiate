import type { RecoveryDifficulty } from './config';

/**
 * Types du moteur de récupération (§ 16). Domaine pur : la forme persistée (tables `recovery_day`, `muscle_recovery`, § 16.4)
 * est fixée par la migration ; les noms de champs ci-dessous sont proposés pour être simples et stables.
 */

/** Une nuit prête pour le moteur. `null` = non mesuré (jamais 0). Les heures sont des minutes depuis minuit, heure locale. */
export interface NightRecord {
  /** Jour local du réveil, `yyyy-MM-dd`. */
  readonly day: string;
  readonly hrvMs: number | null;
  readonly restingHr: number | null;
  readonly asleepMinutes: number | null;
  readonly bedtimeMinutes: number | null;
  readonly wakeMinutes: number | null;
}

export type RecoveryLevel = 'A' | 'B' | 'C';
export type RecoveryQuality = 'good' | 'partial' | 'insufficient';
/** Raison pour laquelle `recovery` vaut null (§ 16.3 : mesure absente, < 7 nuits, σ = 0). */
export type AbstainReason = 'measure_missing_hrv' | 'measure_missing_rhr' | 'baseline_incomplete' | 'zero_variance';
/** Clés d'explication : des codes, les phrases vivent dans src/i18n. Aucune ne porte de diagnostic. */
export type RecoveryExplanationKey =
  | 'exertion_cardio_not_counted'
  | 'sleep_short'
  | 'sleep_debt'
  | 'baseline_outliers_excluded'
  | 'level_b_absolute_thresholds';

export interface TargetZone {
  readonly from: number;
  readonly to: number;
}

/** Série de musculation vue par le moteur (sous-ensemble d'une série de séance close). */
export interface RecoverySet {
  readonly kg: number | null;
  readonly reps: number | null;
  readonly difficulty: RecoveryDifficulty | null;
  readonly isWarmup: boolean;
  readonly completed: boolean;
  /** Muscles sollicités par l'exercice, poids 0 < w ≤ 1. */
  readonly muscles: readonly { readonly id: string; readonly weight: number }[];
}

export interface RecoveryWorkout {
  /** Fin de séance, instant ISO 8601 avec fuseau. */
  readonly endedAt: string;
  readonly sets: readonly RecoverySet[];
}

export interface Contributor {
  readonly key: 'hrv' | 'resting_hr' | 'sleep';
  /** z-score borné (hrv, resting_hr) ou facteur de sommeil (sleep). */
  readonly value: number;
  /** Poids dans `raw` ; null pour le facteur de sommeil. */
  readonly weight: number | null;
}

/** Résumé du jour, prêt pour `recovery_day`. */
export interface RecoveryDaySummary {
  readonly day: string;
  readonly level: RecoveryLevel;
  readonly recovery: number | null;
  readonly abstainReason: AbstainReason | null;
  readonly quality: RecoveryQuality;
  /** Exertion du jour (musculation seule, D-88). */
  readonly exertion: number;
  readonly exertionPrevDay: number;
  readonly sleepMinutes: number | null;
  readonly sleepNeedMinutes: number;
  readonly sleepScore: number | null;
  readonly bedtimeSigmaMinutes: number | null;
  readonly targetZone: TargetZone | null;
  readonly hrvMs: number | null;
  readonly restingHr: number | null;
  /** Nuits valides de baseline (0 à 14), pour « en apprentissage J+x/14 ». */
  readonly learningNights: number;
  readonly contributors: readonly Contributor[];
  readonly explanationKeys: readonly RecoveryExplanationKey[];
  /** Instant de calcul (paramètre `now`). */
  readonly computedAt: string;
}

/** Ligne prête pour `muscle_recovery` (le résumé du jour y ajoute `day`). */
export interface MuscleRecoveryRow {
  readonly muscleId: string;
  readonly group: string;
  /** 0 à 100, entier. */
  readonly percent: number;
  /** Durée de récupération retenue pour cette séance, en heures. */
  readonly hours: number;
  readonly lastWorkedAt: string;
  readonly readyAt: string;
}
