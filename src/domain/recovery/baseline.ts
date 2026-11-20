import { RECOVERY_CONFIG } from './config';
import type { NightRecord } from './types';

export interface BaselineStats {
  /** Moyenne après exclusion des valeurs aberrantes ; null sans aucune valeur. */
  readonly mean: number | null;
  /** σ échantillon (n − 1) ; null sous 2 valeurs. */
  readonly sd: number | null;
  /** Valeurs retenues. */
  readonly used: number;
  readonly excluded: number;
}

export function meanOf(values: readonly number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** σ échantillon (n − 1) ; null sous 2 valeurs. */
export function sdOf(values: readonly number[], mean: number = meanOf(values)): number | null {
  if (values.length < 2) return null;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1));
}

/**
 * Moyenne et σ sur les valeurs fournies ; une valeur à plus de `outlierSigma` σ est exclue de la baseline (§ 16.3).
 * FIX-RECUP (C-049) : chaque valeur est jugée contre la moyenne et le σ des AUTRES valeurs (une passe, sur l'échantillon d'origine). Jugée contre
 * l'échantillon complet, qui la contient, aucune valeur ne pouvait dépasser (n − 1)/√n σ (2,27 σ sur 7 nuits) : rien n'était exclu en début
 * d'apprentissage. σ des autres nul ou indéfini (moins de 2 autres) : la valeur est gardée (jamais une baseline à σ = 0 fabriquée par l'exclusion).
 * Limite connue : deux aberrantes proches se masquent l'une l'autre.
 */
export function baselineStats(values: readonly number[]): BaselineStats {
  if (values.length === 0) return { mean: null, sd: null, used: 0, excluded: 0 };
  const kept = values.filter((v, i) => {
    const others = values.filter((_, j) => j !== i);
    if (others.length < 2) return true;
    const m = meanOf(others);
    const sd = sdOf(others, m);
    return sd === null || sd === 0 || Math.abs(v - m) <= RECOVERY_CONFIG.outlierSigma * sd;
  });
  const mean = meanOf(kept);
  return { mean, sd: sdOf(kept, mean), used: kept.length, excluded: values.length - kept.length };
}

export interface Baseline {
  /** Nuits valides trouvées dans la fenêtre (avant exclusion des aberrantes), 0 à `baselineDays`. */
  readonly validNights: number;
  readonly stats: BaselineStats;
}

/** Baseline d'une mesure : les `baselineDays` dernières nuits VALIDES (sommeil ≥ seuil, mesure présente) strictement avant `today`. */
export function buildBaseline(nights: readonly NightRecord[], today: string, metric: 'hrvMs' | 'restingHr'): Baseline {
  const values = nights
    .filter((n) => n.day < today && n[metric] !== null && n.asleepMinutes !== null && n.asleepMinutes >= RECOVERY_CONFIG.validNightMinAsleepMinutes)
    .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0))
    .slice(0, RECOVERY_CONFIG.baselineDays)
    .map((n) => n[metric] as number);
  return { validNights: values.length, stats: baselineStats(values) };
}
