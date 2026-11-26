import { measurementSchedule, type MeasurementRhythmDays } from './bodyProgress/measurementSchedule';
import type { BodySample } from './bodyProgress/period';
import { NOTIFICATION_LIMIT_DEFAULT } from './notificationPlan';
import { isLocalDateTime, type LocalDate, type LocalDateTime } from './types';

/**
 * Plan du rappel des mesures (CORPS-0301d, BL-180, D-714, ADR 0012) : fonction pure, sortie SANS texte (le texte neutre, sans zone ni valeur, est
 * composé côté feature). Heure locale flottante. Une seule notification, à 09:00 le jour prévu (dernière séance + rythme, D-713) ; une échéance
 * dépassée est rappelée aujourd'hui à 09:00 si cette heure n'est pas passée, sinon rien. Ne lève jamais.
 */
export const MEASUREMENT_FIRE_TIME = '09:00';

export interface MeasurementNotificationPlanInput {
  readonly now: LocalDateTime;
  /** Rappel actif (réglage local, `parseMeasurementReminder`). */
  readonly enabled: boolean;
  readonly rhythm: MeasurementRhythmDays;
  /** Lignes de `measurement` : seules les 11 zones saisies comptent (D-713). */
  readonly samples: readonly Pick<BodySample, 'kind' | 'date'>[];
  readonly limit?: number;
}

export interface PlannedMeasurementNotification {
  readonly kind: 'measurement';
  readonly id: string;
  readonly fireAt: LocalDateTime;
}

export interface MeasurementNotificationPlan {
  readonly items: readonly PlannedMeasurementNotification[];
  readonly total: number;
}

export const measurementNotificationId = (day: LocalDate): string => `measurement:${day}`;

/** Rappel lu du réglage local : actif par défaut (D-713) ; seule la valeur `false` le coupe. */
export function parseMeasurementReminder(value: unknown): boolean {
  return value !== false;
}

export function planMeasurementNotifications(input: MeasurementNotificationPlanInput): MeasurementNotificationPlan {
  const empty: MeasurementNotificationPlan = { items: [], total: 0 };
  const nowMinute = String(input.now).slice(0, 16);
  if (!input.enabled || !isLocalDateTime(nowMinute)) return empty;
  const today = nowMinute.slice(0, 10) as LocalDate;
  const schedule = measurementSchedule(input.samples, input.rhythm, today);
  if (schedule.status === 'none') return empty;
  const fireAt = `${schedule.nextDate}T${MEASUREMENT_FIRE_TIME}` as LocalDateTime;
  if (fireAt <= nowMinute) return empty;
  const candidates: PlannedMeasurementNotification[] = [{ kind: 'measurement', id: measurementNotificationId(schedule.nextDate), fireAt }];
  const raw = input.limit;
  const limit = raw === undefined || !Number.isFinite(raw) ? NOTIFICATION_LIMIT_DEFAULT : Math.min(NOTIFICATION_LIMIT_DEFAULT, Math.max(0, Math.floor(raw)));
  return { items: candidates.slice(0, limit), total: candidates.length };
}
