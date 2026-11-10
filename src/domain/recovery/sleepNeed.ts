import { sdOf } from './baseline';
import { RECOVERY_CONFIG } from './config';

export interface SleepNeed {
  readonly baseMinutes: number;
  readonly exertionMinutes: number;
  readonly debtMinutes: number;
  readonly needMinutes: number;
}

/**
 * Besoin de sommeil (§ 16.3) : 7 h 30 + 0,2 h × max(0, Exertion veille − 5) + dette.
 * Dette (proposition, le PRD donne « 7 j, plafond 3 h ») : somme sur les nuits CONNUES des 7 derniers jours de max(0, 7 h 30 − dormi),
 * plafonnée à 3 h ; une nuit absente n'ajoute rien (jamais un faux zéro de sommeil). `previousAsleepMinutes` : de la plus ancienne à la plus récente.
 */
export function sleepNeed(input: { readonly exertionPrevDay: number; readonly previousAsleepMinutes: readonly number[] }): SleepNeed {
  const cfg = RECOVERY_CONFIG.sleep;
  const baseMinutes = Math.round(cfg.baseSleepHours * 60);
  const exertionMinutes = Math.round(cfg.hoursPerExertionPoint * 60 * Math.max(0, input.exertionPrevDay - cfg.exertionBaseline));
  const deficit = input.previousAsleepMinutes.slice(-cfg.debtDays).reduce((s, m) => s + Math.max(0, baseMinutes - m), 0);
  const debtMinutes = Math.min(Math.round(cfg.debtCapHours * 60), deficit);
  return { baseMinutes, exertionMinutes, debtMinutes, needMinutes: baseMinutes + exertionMinutes + debtMinutes };
}

const DAY = 1440;

/** Minutes depuis midi de la veille : 23 h → 1380, 1 h → 1500 (un coucher après minuit ne casse pas l'écart-type). */
export const shiftedBedtime = (minutes: number): number => (minutes < DAY / 2 ? minutes + DAY : minutes);

/** Régularité du coucher : σ (minutes) des couchers donnés ; null sous `regularityMinNights` valeurs. */
export function bedtimeRegularity(bedtimeMinutes: readonly number[]): number | null {
  if (bedtimeMinutes.length < RECOVERY_CONFIG.sleep.regularityMinNights) return null;
  return sdOf(bedtimeMinutes.map(shiftedBedtime));
}

function median(values: readonly number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
}

/** Heure de coucher cible (§ 16.7) : besoin − médiane de l'heure de lever (14 j) ; null avec raison sous 7 levers connus. */
export function bedtimeTarget(input: {
  readonly needMinutes: number;
  readonly wakeMinutes: readonly number[];
}): { readonly time: string | null; readonly reason: 'wake_history_incomplete' | null } {
  const cfg = RECOVERY_CONFIG.bedtime;
  const wakes = input.wakeMinutes.filter((m) => Number.isFinite(m)).slice(-cfg.wakeDays);
  if (wakes.length < cfg.minWakeNights || !Number.isFinite(input.needMinutes)) return { time: null, reason: 'wake_history_incomplete' };
  const target = Math.round((((median(wakes) - input.needMinutes) % DAY) + DAY) % DAY) % DAY;
  const hh = String(Math.floor(target / 60)).padStart(2, '0');
  const mm = String(target % 60).padStart(2, '0');
  return { time: `${hh}:${mm}`, reason: null };
}
