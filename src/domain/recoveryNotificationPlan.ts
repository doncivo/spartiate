import { addDays } from './localDate';
import { NOTIFICATION_LIMIT_DEFAULT } from './notificationPlan';
import { isLocalDateTime, isLocalTime, type LocalDate, type LocalDateTime } from './types';

/**
 * Plan des notifications de récupération (I5-02 point 2.3, § 16.4, § 16.7) : fonction pure, sortie structurée SANS texte (le texte est composé
 * côté feature, jamais de valeur corporelle ; écran verrouillé). Aucune horloge ni fuseau : heure locale flottante (ADR 0005). Ne lève jamais.
 *
 * - Coucher : une notification 30 min avant l'heure proposée, un soir sur `BEDTIME_HORIZON_DAYS` ; aucune sans proposition (« pas encore »).
 * - Matin : au plus UNE par jour, pour AUJOURD'HUI seulement et seulement si le score existe déjà (`morningReady`) : sans réveil en fond,
 *   le score de demain est inconnu, et une abstention (score null) ne notifie jamais.
 * - Désactivées par défaut : les deux interrupteurs viennent des réglages locaux.
 * - L'envoi (iPhone seulement) et le plafond restant sur les 64 sont du service ; ici `limit` coupe la fin du plan.
 */
export const BEDTIME_LEAD_MINUTES = 30;
export const BEDTIME_HORIZON_DAYS = 7;
/** Heure du matin : proposition (D-93), jamais réglable dans cette version. */
export const MORNING_NOTIFICATION_TIME = '08:00';

export interface RecoveryNotificationPlanInput {
  readonly now: LocalDateTime;
  readonly bedtime: boolean;
  readonly morning: boolean;
  /** `HH:mm` proposé (`bedtimeProposal`) ou null. */
  readonly bedtimeTime: string | null;
  /** Le résumé du jour a un score (pas d'abstention). */
  readonly morningReady: boolean;
  readonly limit?: number;
}

export interface PlannedRecoveryNotification {
  readonly kind: 'bedtime' | 'morning';
  readonly id: string;
  readonly fireAt: LocalDateTime;
}

export interface RecoveryNotificationPlan {
  readonly items: readonly PlannedRecoveryNotification[];
  /** Candidats avant le plafond. */
  readonly total: number;
}

export const bedtimeNotificationId = (evening: LocalDate): string => `bedtime:${evening}`;
export const morningNotificationId = (day: LocalDate): string => `morning:${day}`;

const pad = (n: number): string => String(n).padStart(2, '0');

/** Date + minutes (arithmétique civile pure, sans fuseau). */
function shiftMinutes(date: LocalDate, minutes: number): LocalDateTime {
  const day = Math.floor(minutes / 1440);
  const rest = ((minutes % 1440) + 1440) % 1440;
  return `${addDays(date, day)}T${pad(Math.floor(rest / 60))}:${pad(rest % 60)}` as LocalDateTime;
}

export function planRecoveryNotifications(input: RecoveryNotificationPlanInput): RecoveryNotificationPlan {
  const empty: RecoveryNotificationPlan = { items: [], total: 0 };
  const nowMinute = String(input.now).slice(0, 16);
  if (!isLocalDateTime(nowMinute)) return empty;
  const today = nowMinute.slice(0, 10) as LocalDate;
  const candidates: PlannedRecoveryNotification[] = [];

  if (input.morning && input.morningReady) {
    const fireAt = `${today}T${MORNING_NOTIFICATION_TIME}` as LocalDateTime;
    if (fireAt > nowMinute) candidates.push({ kind: 'morning', id: morningNotificationId(today), fireAt });
  }

  if (input.bedtime && input.bedtimeTime !== null && isLocalTime(input.bedtimeTime)) {
    const [h, m] = input.bedtimeTime.split(':').map(Number);
    const minutes = (h ?? 0) * 60 + (m ?? 0);
    // Un coucher avant midi est celui de la nuit qui commence ce soir-là : il tombe le jour civil suivant.
    const offset = minutes < 720 ? 1440 : 0;
    for (let k = 0; k < BEDTIME_HORIZON_DAYS; k += 1) {
      const evening = addDays(today, k);
      const fireAt = shiftMinutes(evening, offset + minutes - BEDTIME_LEAD_MINUTES);
      if (fireAt > nowMinute) candidates.push({ kind: 'bedtime', id: bedtimeNotificationId(evening), fireAt });
    }
  }

  candidates.sort((a, b) => (a.fireAt < b.fireAt ? -1 : a.fireAt > b.fireAt ? 1 : a.id < b.id ? -1 : 1));
  const raw = input.limit;
  const limit = raw === undefined || !Number.isFinite(raw) ? NOTIFICATION_LIMIT_DEFAULT : Math.min(NOTIFICATION_LIMIT_DEFAULT, Math.max(0, Math.floor(raw)));
  return { items: candidates.slice(0, limit), total: candidates.length };
}
