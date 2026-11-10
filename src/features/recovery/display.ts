import { RECOVERY_CONFIG, type AbstainReason, type Contributor, type RecoveryDaySummary } from '../../domain/recovery';

/**
 * Affichage pur des cadrans de récupération (I5-02 point 2.1, § 16.5) : aucune lecture, aucun texte (les phrases vivent dans
 * `src/i18n/fr.recovery.ts`). Règle de fond : jamais de faux zéro. Une valeur nulle garde sa raison ; « 0 » n'est montré que s'il est mesuré.
 */

export type RecoveryDialView =
  | { readonly kind: 'value'; readonly value: number }
  | { readonly kind: 'learning'; readonly nights: number; readonly of: number }
  | { readonly kind: 'abstained'; readonly reason: AbstainReason };

export function recoveryDial(s: RecoveryDaySummary): RecoveryDialView {
  if (s.recovery !== null) return { kind: 'value', value: s.recovery };
  if (s.abstainReason === null || s.abstainReason === 'baseline_incomplete') return { kind: 'learning', nights: s.learningNights, of: RECOVERY_CONFIG.baselineDays };
  return { kind: 'abstained', reason: s.abstainReason };
}

export type ExertionDialView = { readonly kind: 'value'; readonly value: number } | { readonly kind: 'none' };

/** Exertion = musculation seule (D-88) : 0 veut dire « aucune séance comptée », pas un score de zéro. */
export function exertionDial(s: RecoveryDaySummary): ExertionDialView {
  return s.exertion > 0 ? { kind: 'value', value: Math.round(s.exertion * 10) / 10 } : { kind: 'none' };
}

export type SleepDialView =
  | { readonly kind: 'value'; readonly minutes: number; readonly needMinutes: number; readonly scorePct: number | null }
  | { readonly kind: 'unmeasured'; readonly needMinutes: number };

export function sleepDial(s: RecoveryDaySummary): SleepDialView {
  if (s.sleepMinutes === null) return { kind: 'unmeasured', needMinutes: s.sleepNeedMinutes };
  return { kind: 'value', minutes: s.sleepMinutes, needMinutes: s.sleepNeedMinutes, scorePct: s.sleepScore };
}

/** « 7 h 12 », « 8 h 00 », « 45 min ». */
export function formatDuration(minutes: number): string {
  const total = Math.round(minutes);
  if (total < 60) return `${String(total)} min`;
  return `${String(Math.floor(total / 60))} h ${String(total % 60).padStart(2, '0')}`;
}

/** Score avec virgule française, sans décimale inutile (« 3,5 », « 10 »). */
export function formatScore(value: number): string {
  return (Math.round(value * 10) / 10).toString().replace('.', ',');
}

/** Part remplie d'un anneau, bornée à [0, 1]. */
export function ringFraction(value: number, max: number): number {
  return Math.min(1, Math.max(0, value / max));
}

export type ContributorTone = 'up' | 'flat' | 'down';

const Z_NEUTRAL = 0.5;
const SLEEP_FACTOR_ENOUGH = 0.95;

/** Effet du contributeur sur le score (z-scores déjà orientés par le moteur : positif = favorable ; sommeil : facteur 0,8 à 1). */
export function contributorTone(c: Contributor): ContributorTone {
  if (c.key === 'sleep') return c.value >= SLEEP_FACTOR_ENOUGH ? 'up' : 'down';
  if (c.value > Z_NEUTRAL) return 'up';
  if (c.value < -Z_NEUTRAL) return 'down';
  return 'flat';
}

export interface StepsSummary {
  readonly today: number | null;
  /** Moyenne des jours connus de la fenêtre de 7 jours (arrondie) ; jours absents non comptés, jamais remplis par 0. */
  readonly average: number | null;
  readonly knownDays: number;
}

const DAY_MS = 86_400_000;

function addDays(day: string, delta: number): string {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + delta * DAY_MS).toISOString().slice(0, 10);
}

/** Pas : un total par jour (`startAt` = jour à midi UTC, cf. service d'import) ; fenêtre = aujourd'hui et les 6 jours précédents. */
export function stepsSummary(samples: readonly { readonly startAt: string; readonly value: number | null }[], today: string): StepsSummary {
  const from = addDays(today, -6);
  const byDay = new Map<string, number>();
  for (const s of samples) {
    const day = s.startAt.slice(0, 10);
    if (s.value !== null && day >= from && day <= today) byDay.set(day, s.value);
  }
  const values = [...byDay.values()];
  if (values.length === 0) return { today: null, average: null, knownDays: 0 };
  return { today: byDay.get(today) ?? null, average: Math.round(values.reduce((a, b) => a + b, 0) / values.length), knownDays: values.length };
}

export const STALE_AFTER_HOURS = 48;

export interface Staleness {
  readonly known: boolean;
  readonly stale: boolean;
  readonly days: number;
}

export function stalenessOf(latestIso: string | null, nowMs: number): Staleness {
  const at = latestIso === null ? Number.NaN : Date.parse(latestIso);
  if (Number.isNaN(at)) return { known: false, stale: false, days: 0 };
  const age = Math.max(0, nowMs - at);
  return { known: true, stale: age > STALE_AFTER_HOURS * 3_600_000, days: Math.floor(age / DAY_MS) };
}
