import { NOTIFICATION_LIMIT_DEFAULT } from './notificationPlan';
import { activeInjuries, checkinDueOn, type InjuriesValue } from './training/injuries';
import { isLocalDateTime, type LocalDate, type LocalDateTime } from './types';

/**
 * Plan du rappel de check-in des gênes (BLESSURES-b, ADR 0012) : fonction pure, sortie SANS texte (le texte neutre est composé côté feature :
 * l'écran verrouillé ne dit jamais « gêne »). Heure locale flottante. Une notification par jour d'échéance, à 09:00 ; une échéance dépassée est
 * rappelée aujourd'hui à 09:00 si cette heure n'est pas passée (sinon la carte d'Aujourd'hui suffit). Ne lève jamais.
 */
export const INJURY_FIRE_TIME = '09:00';

export interface InjuryNotificationPlanInput {
  readonly now: LocalDateTime;
  readonly injuries: InjuriesValue;
  readonly limit?: number;
}

export interface PlannedInjuryNotification {
  readonly kind: 'injury';
  readonly id: string;
  readonly fireAt: LocalDateTime;
}

export interface InjuryNotificationPlan {
  readonly items: readonly PlannedInjuryNotification[];
  readonly total: number;
}

export const injuryNotificationId = (day: LocalDate): string => `injury:${day}`;

export function planInjuryNotifications(input: InjuryNotificationPlanInput): InjuryNotificationPlan {
  const empty: InjuryNotificationPlan = { items: [], total: 0 };
  const nowMinute = String(input.now).slice(0, 16);
  if (!isLocalDateTime(nowMinute)) return empty;
  const today = nowMinute.slice(0, 10) as LocalDate;
  const days = new Set<LocalDate>();
  for (const injury of activeInjuries(input.injuries)) {
    const due = checkinDueOn(injury);
    days.add(due < today ? today : due);
  }
  const candidates: PlannedInjuryNotification[] = [...days]
    .sort()
    .map((day) => ({ kind: 'injury' as const, id: injuryNotificationId(day), fireAt: `${day}T${INJURY_FIRE_TIME}` as LocalDateTime }))
    .filter((c) => c.fireAt > nowMinute);
  const raw = input.limit;
  const limit = raw === undefined || !Number.isFinite(raw) ? NOTIFICATION_LIMIT_DEFAULT : Math.min(NOTIFICATION_LIMIT_DEFAULT, Math.max(0, Math.floor(raw)));
  return { items: candidates.slice(0, limit), total: candidates.length };
}
