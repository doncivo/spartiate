import { addDays } from './localDate';
import { NOTIFICATION_LIMIT_DEFAULT } from './notificationPlan';
import { dueIntakes, type Supplement, type SupplementIntake } from './nutrition/supplements';
import { isLocalDateTime, type LocalDate, type LocalDateTime, type LocalTime } from './types';

/**
 * Plan des rappels de compléments (I6-05, § 15.3, D-212) : fonction pure, sortie SANS texte ni nom (le texte neutre est composé côté feature :
 * l'écran verrouillé ne dit jamais quel complément). Heure locale flottante, aucune horloge ni fuseau. Ne lève jamais.
 *
 * - Une notification par heure de prise et par jour, qui regroupe les compléments dus à cette heure ; `count` = prises encore à cocher.
 * - Horizon `SUPPLEMENT_HORIZON_DAYS` jours (aujourd'hui compris) : sobre dans la fenêtre des 64, qui est partagée avec les autres rappels.
 * - Heure entièrement cochée, heure passée, complément en pause ou jour non prévu : rien.
 * - `limit` (place restante sur les 64, calculée par le service) coupe la fin du plan ; `total` = candidats avant le plafond.
 */
export const SUPPLEMENT_HORIZON_DAYS = 3;

export interface SupplementNotificationPlanInput {
  readonly now: LocalDateTime;
  readonly enabled: boolean;
  readonly supplements: readonly Supplement[];
  readonly intakes: readonly SupplementIntake[];
  readonly limit?: number;
}

export interface PlannedSupplementNotification {
  readonly kind: 'supplement';
  readonly id: string;
  readonly fireAt: LocalDateTime;
  /** Prises encore à cocher à cette heure (au moins 1). */
  readonly count: number;
}

export interface SupplementNotificationPlan {
  readonly items: readonly PlannedSupplementNotification[];
  readonly total: number;
}

export const supplementNotificationId = (day: LocalDate, moment: LocalTime): string => `supplement:${day}T${moment}`;

export function planSupplementNotifications(input: SupplementNotificationPlanInput): SupplementNotificationPlan {
  const empty: SupplementNotificationPlan = { items: [], total: 0 };
  const nowMinute = String(input.now).slice(0, 16);
  if (!input.enabled || !isLocalDateTime(nowMinute)) return empty;
  const today = nowMinute.slice(0, 10) as LocalDate;
  const candidates: PlannedSupplementNotification[] = [];
  for (let k = 0; k < SUPPLEMENT_HORIZON_DAYS; k += 1) {
    const day = addDays(today, k);
    const open = new Map<LocalTime, number>();
    for (const item of dueIntakes(input.supplements, input.intakes, day)) {
      if (!item.taken) open.set(item.moment, (open.get(item.moment) ?? 0) + 1);
    }
    for (const [moment, count] of open) {
      const fireAt = `${day}T${moment}` as LocalDateTime;
      if (fireAt > nowMinute) candidates.push({ kind: 'supplement', id: supplementNotificationId(day, moment), fireAt, count });
    }
  }
  candidates.sort((a, b) => (a.fireAt < b.fireAt ? -1 : a.fireAt > b.fireAt ? 1 : 0));
  const raw = input.limit;
  const limit = raw === undefined || !Number.isFinite(raw) ? NOTIFICATION_LIMIT_DEFAULT : Math.min(NOTIFICATION_LIMIT_DEFAULT, Math.max(0, Math.floor(raw)));
  return { items: candidates.slice(0, limit), total: candidates.length };
}
