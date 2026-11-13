import { ACTION_TYPE_ID, enqueueActions, trimApplied, type ActionError, type ActionQueueEntry, type NotificationActionQueueV1, type RawNotificationAction } from './notificationActions';
import { dueIntakes, type Supplement, type SupplementIntake } from './nutrition/supplements';
import { isLocalDate, isLocalTime, type LocalDate, type LocalTime } from './types';

/**
 * Action « Pris » de la notification de complément (FIX-0221, D-250 à D-253, révise D-213) : règles pures. La notification `supplement:<jour>T<heure>`
 * regroupe les compléments dus à cette heure (D-212) ; « Pris » coche, ce jour-là, les prises de cette heure encore à cocher. La file locale
 * `notifications.actionQueue` (réglage LOCAL, jamais synchronisé) garde les clés appliquées : une ligne relue ou rejouée n'est jamais appliquée deux
 * fois ; l'identifiant naturel de la prise (complément + jour + heure) écarte de toute façon un doublon en base.
 */
export const SUPPLEMENT_ACTION_TYPE_ID = ACTION_TYPE_ID.supplement;

const PREFIX = 'supplement:';

/** Jour et heure d'une notification de complément ; null pour tout autre identifiant (répétition comprise : aucune n'existe pour les compléments). */
export function parseSupplementNotificationId(sid: string | null): { readonly day: LocalDate; readonly moment: LocalTime } | null {
  if (sid === null || !sid.startsWith(PREFIX)) return null;
  const rest = sid.slice(PREFIX.length);
  const [day, moment, ...extra] = rest.split('T');
  if (extra.length > 0 || day === undefined || moment === undefined || !isLocalDate(day) || !isLocalTime(moment)) return null;
  return { day, moment };
}

/** Compléments dus ce jour à ce moment et pas encore cochés (configuration courante, comme la carte d'Aujourd'hui). */
export function intakesToTake(supplements: readonly Supplement[], intakes: readonly SupplementIntake[], day: LocalDate, moment: LocalTime): readonly string[] {
  return dueIntakes(supplements, intakes, day)
    .filter((item) => item.moment === moment && !item.taken)
    .map((item) => item.supplement.id);
}

const isSupplementDone = (action: RawNotificationAction): boolean => action.actionId === 'done' && parseSupplementNotificationId(action.sid) !== null;

/** Inscrit les « Pris » reçus ; toute autre ligne (aucune autre action n'est proposée par Spartiate) est ignorée et comptée. */
export function receiveSupplementActions(
  queue: NotificationActionQueueV1,
  received: readonly RawNotificationAction[],
  lost: number,
  nowMs: number,
): { readonly queue: NotificationActionQueueV1; readonly duplicates: number; readonly ignored: number } {
  const relevant = received.filter(isSupplementDone);
  const result = enqueueActions(queue, relevant, lost, nowMs);
  return { queue: result.queue, duplicates: result.duplicates, ignored: received.length - relevant.length };
}

/** Entrées de la file à appliquer, avec leur cible. */
export function supplementActionTodo(queue: NotificationActionQueueV1): readonly { readonly entry: ActionQueueEntry; readonly day: LocalDate; readonly moment: LocalTime }[] {
  return queue.entries.flatMap((entry) => {
    const target = entry.action === 'done' ? parseSupplementNotificationId(entry.sid) : null;
    return target === null ? [] : [{ entry, ...target }];
  });
}

/** Appliquée : retirée de la file, clé gardée (30 jours, 200 au plus). Échec : gardée, essai compté, erreur notée (rejouée au passage suivant). */
export function settleSupplementAction(queue: NotificationActionQueueV1, key: string, outcome: 'applied' | ActionError, nowMs: number): NotificationActionQueueV1 {
  if (outcome === 'applied') {
    return { ...queue, entries: queue.entries.filter((entry) => entry.key !== key), applied: trimApplied([...queue.applied, { key, at: nowMs }], nowMs) };
  }
  return { ...queue, entries: queue.entries.map((entry) => (entry.key === key ? { ...entry, tries: entry.tries + 1, lastError: outcome } : entry)) };
}
