import { shiftDay } from './daySummary';

/**
 * Journal de facteurs (§ 16.7, I6-01 point B, D-95). Fonction pure : écart moyen de Recovery avec et sans chaque facteur.
 *
 * - Le facteur du jour J (saisi le matin du jour J+1, pour la veille) est rapproché de la Recovery du jour J+1 (le lendemain matin) :
 *   choix prudent consigné en D-95.
 * - Seuls les jours dont la Recovery de J+1 existe (score non nul) comptent ; « rien de particulier » (`none`) compte comme un jour sans
 *   facteur ; un jour non renseigné (aucune ligne, ou ligne sans facteur ni « rien de particulier ») est exclu.
 * - Affiché après `FACTOR_MIN_DAYS` jours exploitables et, pour un facteur, au moins `FACTOR_MIN_OCCURRENCES` jours avec et
 *   `FACTOR_MIN_WITHOUT` jours sans. Association observée, jamais une cause : le texte est dans src/i18n.
 */

export const FACTOR_CODES = ['alcohol', 'caffeine_late', 'late_meal', 'stress', 'soreness', 'illness', 'travel', 'late_training'] as const;
export type FactorCode = (typeof FACTOR_CODES)[number];

/** Jours exploitables (renseignés, avec la Recovery du lendemain) avant d'afficher la moindre association. */
export const FACTOR_MIN_DAYS = 30;
/** Jours avec le facteur au minimum. */
export const FACTOR_MIN_OCCURRENCES = 5;
/** Jours sans le facteur au minimum (sinon il n'y a rien à comparer). */
export const FACTOR_MIN_WITHOUT = 5;

export const isFactorCode = (value: string): value is FactorCode => (FACTOR_CODES as readonly string[]).includes(value);

/** Un jour renseigné du journal : facteurs cochés, ou `none` (« rien de particulier »). */
export interface FactorDay {
  readonly day: string;
  readonly factors: readonly FactorCode[];
  readonly none: boolean;
}

export interface FactorRecovery {
  readonly day: string;
  readonly recovery: number | null;
}

export interface FactorAssociation {
  readonly factor: FactorCode;
  readonly withDays: number;
  readonly withoutDays: number;
  /** Moyenne de la Recovery du lendemain, arrondie à 0,1. */
  readonly withMean: number;
  readonly withoutMean: number;
  /** avec − sans, arrondi à 0,1 : négatif = Recovery plus basse le lendemain. */
  readonly difference: number;
}

export interface FactorAnalysis {
  /** Jours renseignés dont la Recovery du lendemain existe. */
  readonly pairedDays: number;
  /** `pairedDays >= FACTOR_MIN_DAYS`. */
  readonly enough: boolean;
  /** Facteurs qui passent les seuils, du plus grand écart absolu au plus petit (ordre des codes à égalité). */
  readonly associations: readonly FactorAssociation[];
}

/** `yyyy-MM-dd` décalé de `delta` jours (calendrier civil). */
export const shiftFactorDay = shiftDay;

const round1 = (value: number): number => Math.round(value * 10) / 10;
const mean = (values: readonly number[]): number => values.reduce((sum, v) => sum + v, 0) / values.length;

export function factorAnalysis(journal: readonly FactorDay[], recoveries: readonly FactorRecovery[]): FactorAnalysis {
  const scoreByDay = new Map<string, number>();
  for (const r of recoveries) if (r.recovery !== null) scoreByDay.set(r.day, r.recovery);
  const paired: { readonly factors: readonly FactorCode[]; readonly score: number }[] = [];
  for (const entry of journal) {
    if (!entry.none && entry.factors.length === 0) continue;
    const score = scoreByDay.get(shiftDay(entry.day, 1));
    if (score === undefined) continue;
    paired.push({ factors: entry.none ? [] : entry.factors, score });
  }
  const enough = paired.length >= FACTOR_MIN_DAYS;
  if (!enough) return { pairedDays: paired.length, enough, associations: [] };
  const associations: FactorAssociation[] = [];
  for (const factor of FACTOR_CODES) {
    const withFactor = paired.filter((p) => p.factors.includes(factor)).map((p) => p.score);
    const without = paired.filter((p) => !p.factors.includes(factor)).map((p) => p.score);
    if (withFactor.length < FACTOR_MIN_OCCURRENCES || without.length < FACTOR_MIN_WITHOUT) continue;
    const withMean = mean(withFactor);
    const withoutMean = mean(without);
    associations.push({ factor, withDays: withFactor.length, withoutDays: without.length, withMean: round1(withMean), withoutMean: round1(withoutMean), difference: round1(withMean - withoutMean) });
  }
  associations.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
  return { pairedDays: paired.length, enough, associations };
}
