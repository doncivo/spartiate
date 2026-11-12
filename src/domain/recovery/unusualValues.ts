import { RECOVERY_CONFIG } from './config';
import { shiftDay } from './daySummary';
import type { RecoveryDaySummary } from './types';

/**
 * Valeurs inhabituelles (§ 16.7, I6-01 point A, D-95). Fonction pure : elle lit les résumés `recovery_day` du jour le plus récent et de la veille.
 *
 * - Une nuit est « inhabituelle » si la FC de repos est à au moins 2 σ AU-DESSUS de sa base ou la HRV à au moins 2 σ EN DESSOUS. Les
 *   contributeurs du résumé portent des z-scores ORIENTÉS (positif = favorable, voir `recoveryScore`) : les deux cas valent donc `z <= -2`.
 *   Borne INCLUSIVE (« au moins 2 σ ») : choix prudent consigné en D-95 ; le z du résumé est arrondi à 0,01.
 * - La carte demande deux jours CONSÉCUTIFS (le plus récent et sa veille), chacun avec une nuit valide (niveau C, score présent, sommeil au
 *   moins égal au seuil de nuit valide) et les deux contributeurs. Baseline incomplète, contributeur absent, niveau sans score, jours non
 *   consécutifs : jamais de carte. Un jour est inhabituel dès que l'une OU l'autre des deux mesures l'est (choix consigné en D-95).
 * - La carte disparaît d'elle-même : seul le jour le plus récent est jugé, un retour à la normale la retire.
 * - Aucun texte ni diagnostic ici : les raisons sont des codes, les phrases vivent dans src/i18n.
 */

/** Seuil en écarts-types (§ 16.7). */
export const UNUSUAL_SIGMA = 2;

export type UnusualReason = 'hrv_low' | 'resting_hr_high';

export type UnusualDayInput = Pick<RecoveryDaySummary, 'day' | 'level' | 'recovery' | 'sleepMinutes' | 'contributors'>;

export interface UnusualValues {
  /** Jour le plus récent des deux. */
  readonly day: string;
  /** Raisons du jour le plus récent (au moins une). */
  readonly reasons: readonly UnusualReason[];
}

/** Raisons d'une nuit valide, `null` si la nuit n'est pas exploitable (baseline incomplète, contributeur absent ou illisible, sommeil trop court). */
function reasonsOf(row: UnusualDayInput): readonly UnusualReason[] | null {
  if (row.level !== 'C' || row.recovery === null) return null;
  if (row.sleepMinutes === null || row.sleepMinutes < RECOVERY_CONFIG.validNightMinAsleepMinutes) return null;
  const hrv = row.contributors.find((c) => c.key === 'hrv');
  const rhr = row.contributors.find((c) => c.key === 'resting_hr');
  if (hrv === undefined || rhr === undefined || !Number.isFinite(hrv.value) || !Number.isFinite(rhr.value)) return null;
  const reasons: UnusualReason[] = [];
  if (hrv.value <= -UNUSUAL_SIGMA) reasons.push('hrv_low');
  if (rhr.value <= -UNUSUAL_SIGMA) reasons.push('resting_hr_high');
  return reasons;
}

/**
 * `options.today` : le résumé le plus récent doit dater d'aujourd'hui ou d'hier (un résumé plus ancien ne conseille plus rien) ; sans lui,
 * seule la paire de jours consécutifs compte.
 */
export function unusualValues(rows: readonly UnusualDayInput[], options: { readonly today?: string } = {}): UnusualValues | null {
  let latest: UnusualDayInput | null = null;
  for (const row of rows) if (latest === null || row.day > latest.day) latest = row;
  if (latest === null) return null;
  if (options.today !== undefined && latest.day < shiftDay(options.today, -1)) return null;
  const previous = rows.find((row) => row.day === shiftDay(latest.day, -1));
  if (previous === undefined) return null;
  const now = reasonsOf(latest);
  const before = reasonsOf(previous);
  if (now === null || before === null || now.length === 0 || before.length === 0) return null;
  return { day: latest.day, reasons: now };
}
