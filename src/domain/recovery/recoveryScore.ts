import { buildBaseline } from './baseline';
import { RECOVERY_CONFIG } from './config';
import type { AbstainReason, NightRecord, TargetZone } from './types';

export interface RecoveryScoreInput {
  readonly today: string;
  readonly nights: readonly NightRecord[];
  /** Durée dormie / besoin de la nuit ; null (ou ≤ 0) si la durée de sommeil est inconnue : pas de score (§ 16.1, niveau C), jamais un facteur neutre inventé. */
  readonly sleepRatio: number | null;
}

export interface RecoveryScoreResult {
  readonly score: number | null;
  readonly reason: AbstainReason | null;
  readonly raw: number | null;
  readonly zHrv: number | null;
  readonly zRhr: number | null;
  readonly sleepFactor: number;
  /** Nuits valides de baseline (la plus courte des deux mesures). */
  readonly baselineNights: number;
  readonly excludedOutliers: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Recovery 0–100 (§ 16.3), ou null avec une raison : mesure ou durée de sommeil absente, < `minNights` nuits, σ = 0. */
export function recoveryScore(input: RecoveryScoreInput): RecoveryScoreResult {
  const cfg = RECOVERY_CONFIG;
  const hrv = buildBaseline(input.nights, input.today, 'hrvMs');
  const rhr = buildBaseline(input.nights, input.today, 'restingHr');
  const sleepFactor = input.sleepRatio === null ? cfg.sleepFactorMax : clamp(input.sleepRatio, cfg.sleepFactorMin, cfg.sleepFactorMax);
  const common = {
    sleepFactor,
    baselineNights: Math.min(hrv.validNights, rhr.validNights),
    excludedOutliers: hrv.stats.excluded + rhr.stats.excluded,
  };
  const abstain = (reason: AbstainReason): RecoveryScoreResult => ({ score: null, reason, raw: null, zHrv: null, zRhr: null, ...common });

  const tonight = input.nights.find((n) => n.day === input.today);
  if (tonight === undefined || tonight.hrvMs === null) return abstain('measure_missing_hrv');
  if (tonight.restingHr === null) return abstain('measure_missing_rhr');
  if (input.sleepRatio === null || !(input.sleepRatio > 0)) return abstain('measure_missing_sleep');
  if (hrv.stats.used < cfg.minNights || rhr.stats.used < cfg.minNights) return abstain('baseline_incomplete');
  const { mean: muH, sd: sdH } = hrv.stats;
  const { mean: muR, sd: sdR } = rhr.stats;
  if (muH === null || muR === null || sdH === null || sdR === null || sdH === 0 || sdR === 0) return abstain('zero_variance');

  const zHrv = (tonight.hrvMs - muH) / sdH;
  const zRhr = (muR - tonight.restingHr) / sdR;
  const raw = clamp(cfg.hrvWeight * zHrv + cfg.rhrWeight * zRhr, -cfg.zClamp, cfg.zClamp);
  const score = Math.round(clamp((cfg.scoreCenter + cfg.scoreScale * raw) * sleepFactor, 0, 100));
  return { score, reason: null, raw, zHrv, zRhr, ...common };
}

/**
 * Seuil des valeurs inhabituelles (§ 16.7 ; FIX-0172, décision d'Ali du 12/11/2026, D-134, révise D-95) : un z ORIENTÉ (positif = favorable)
 * est inhabituel s'il est STRICTEMENT au-delà de `unusualSigma` du côté défavorable, jugé sur la valeur NON arrondie ; −2 exactement ne l'est pas.
 * Partagé par `summarizeRecoveryDay` (qui décide et publie) et `unusualValues` (qui lit la décision).
 */
export function beyondUnusualSigma(z: number): boolean {
  return Number.isFinite(z) && z < -RECOVERY_CONFIG.unusualSigma;
}

/** Zone d'Exertion cible (§ 16.3) ; null si pas de score. */
export function targetZone(score: number | null): TargetZone | null {
  if (score === null) return null;
  const z = RECOVERY_CONFIG.zones;
  const [from, to] = score >= z.high.from ? z.high.target : score >= z.mid.from ? z.mid.target : z.low.target;
  return { from, to };
}
