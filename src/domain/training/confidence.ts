import type { ProgressionConfig } from './config';
import type { SessionEstimate } from './estimate1rm';
import type { IsoDateTime } from '../types';

/**
 * Confiance d'une estimation (PRD § 11.3 ; D-72 points 3 et 4). Module pur.
 *
 * `0,4 × min(séries / 6, 1) + 0,3 × (1 − dispersion) + 0,3 × récence`, sur les séances de la fenêtre d'estimation (trois dernières
 * séances valides). Dispersion = coefficient de variation (écart type de population / moyenne) des 1RM de séance, borné à [0, 1] ; avec
 * moins de deux séances il est inconnu et vaut 1 (prudent). Récence : 1 jusqu'à 14 jours, linéaire, 0 à partir de 60 jours.
 */

const DAY_MS = 86_400_000;
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

export function recencyFactor(days: number, config: ProgressionConfig): number {
  if (days <= config.recencyFullDays) return 1;
  if (days >= config.recencyZeroDays) return 0;
  return 1 - (days - config.recencyFullDays) / (config.recencyZeroDays - config.recencyFullDays);
}

export function dispersion(values: readonly number[]): number {
  if (values.length < 2) return 1;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (!(mean > 0)) return 1;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  return clamp01(Math.sqrt(variance) / mean);
}

export function confidenceScore(parts: { readonly validSets: number; readonly dispersion: number; readonly recency: number }, config: ProgressionConfig): number {
  const w = config.confidenceWeights;
  return clamp01(w.sets * Math.min(parts.validSets / config.setsForFullConfidence, 1) + w.dispersion * (1 - clamp01(parts.dispersion)) + w.recency * clamp01(parts.recency));
}

/** Confiance des séances valides (de la plus récente à la plus ancienne) à l'instant `now` ; 0 sans séance. */
export function confidenceOf(estimates: readonly SessionEstimate[], now: IsoDateTime, config: ProgressionConfig): number {
  const window = estimates.slice(0, config.recencyWeights.length);
  const latest = window[0];
  if (latest === undefined) return 0;
  const days = Math.max(0, (Date.parse(now) - Date.parse(latest.endedAt)) / DAY_MS);
  return confidenceScore(
    {
      validSets: window.reduce((n, e) => n + e.validSets, 0),
      dispersion: dispersion(window.map((e) => e.e1rmKg)),
      recency: recencyFactor(days, config),
    },
    config,
  );
}
