import { RECOVERY_CONFIG } from './config';
import { shiftDay } from './daySummary';
import { bedtimeTarget, sleepNeed } from './sleepNeed';
import type { NightRecord } from './types';

export interface BedtimeProposal {
  /** `HH:mm` (heure locale flottante) ou null : « pas encore de proposition ». */
  readonly time: string | null;
  readonly reason: 'wake_history_incomplete' | null;
  /** Besoin de sommeil de la nuit à venir (minutes), § 16.3. */
  readonly needMinutes: number;
  /** Levers connus dans les 14 derniers jours civils. */
  readonly wakeNights: number;
}

/**
 * Heure de coucher cible de la nuit à venir (§ 16.7). Besoin = `sleepNeed` avec l'exertion d'AUJOURD'HUI (la nuit qui suit) et la dette des
 * 7 derniers jours ; lever habituel = médiane des levers connus des 14 derniers jours civils (aujourd'hui compris). Sous 7 levers connus :
 * aucune heure (jamais un calcul sur un historique trop court). Pur.
 */
export function bedtimeProposal(input: { readonly nights: readonly NightRecord[]; readonly today: string; readonly exertionToday: number }): BedtimeProposal {
  const cfg = RECOVERY_CONFIG;
  const sorted = [...input.nights].filter((n) => n.day <= input.today).sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  const debtFrom = shiftDay(input.today, -(cfg.sleep.debtDays - 1));
  const asleep = sorted.filter((n) => n.day >= debtFrom && n.asleepMinutes !== null && Number.isFinite(n.asleepMinutes)).map((n) => n.asleepMinutes as number);
  const need = sleepNeed({ exertionPrevDay: input.exertionToday, previousAsleepMinutes: asleep });
  const wakeFrom = shiftDay(input.today, -(cfg.bedtime.wakeDays - 1));
  const wakes = sorted.filter((n) => n.day >= wakeFrom && n.wakeMinutes !== null && Number.isFinite(n.wakeMinutes)).map((n) => n.wakeMinutes as number);
  const target = bedtimeTarget({ needMinutes: need.needMinutes, wakeMinutes: wakes });
  return { time: target.time, reason: target.reason, needMinutes: need.needMinutes, wakeNights: wakes.length };
}
