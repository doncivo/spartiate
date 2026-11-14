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

/**
 * FIX-0242 : état DURABLE des échecs de l'action « Pris » (réglage local `notifications.supplementActionTrouble`, jamais publié). Un échec n'est plus
 * seulement dit par un bandeau bref : la carte des compléments d'Aujourd'hui le montre tant qu'il n'est pas levé.
 * - `failed` : une action n'a pas pu être appliquée, lue, enregistrée ou acquittée ; `days` : jours des actions en échec (vide : jour inconnu) ;
 *   levé par un passage suivant sans échec, ou par une prise cochée à la main ce jour-là (ou après).
 * - `lost` : lignes illisibles ou non écrites par le natif ; rien ne peut être rejoué, levé seulement par une prise cochée à la main.
 */
export interface SupplementActionTrouble {
  readonly v: 1;
  readonly failed: boolean;
  readonly days: readonly LocalDate[];
  readonly lost: boolean;
}

export const NO_SUPPLEMENT_ACTION_TROUBLE: SupplementActionTrouble = { v: 1, failed: false, days: [], lost: false };

export const hasSupplementActionTrouble = (trouble: SupplementActionTrouble): boolean => trouble.failed || trouble.lost;

/** Valeur brute du réglage ; illisible : traitée comme une perte (jamais effacée en silence). */
export function parseSupplementActionTrouble(raw: unknown): SupplementActionTrouble {
  if (raw === null || raw === undefined) return NO_SUPPLEMENT_ACTION_TROUBLE;
  if (typeof raw !== 'object' || Array.isArray(raw)) return { ...NO_SUPPLEMENT_ACTION_TROUBLE, lost: true };
  const r = raw as Record<string, unknown>;
  if (r['v'] !== 1 || typeof r['failed'] !== 'boolean' || typeof r['lost'] !== 'boolean' || !Array.isArray(r['days']) || !r['days'].every((d) => typeof d === 'string' && isLocalDate(d))) {
    return { ...NO_SUPPLEMENT_ACTION_TROUBLE, lost: true };
  }
  return { v: 1, failed: r['failed'], days: r['days'] as LocalDate[], lost: r['lost'] };
}

/** État après un passage : `failedDays` = jours des entrées encore en échec ; un statut autre que `done` est un échec de jour inconnu (jours déjà notés gardés). */
export function troubleAfterPass(
  prev: SupplementActionTrouble,
  pass: { readonly status: 'done' | 'source-failed' | 'queue-failed' | 'ack-failed'; readonly failedDays: readonly LocalDate[]; readonly lost: boolean },
): SupplementActionTrouble {
  const failed = pass.status !== 'done' || pass.failedDays.length > 0;
  const days = pass.status === 'done' ? pass.failedDays : [...prev.days, ...pass.failedDays];
  return { v: 1, failed, days: failed ? [...new Set(days)].sort() : [], lost: prev.lost || pass.lost };
}

/** Prise cochée à la main pour `day` : lève les échecs de ce jour ou d'avant (la carte ne montre que le jour courant) et les pertes. */
export function troubleAfterManualTake(prev: SupplementActionTrouble, day: LocalDate): SupplementActionTrouble {
  const days = prev.days.filter((d) => d > day);
  return { v: 1, failed: days.length > 0, days, lost: false };
}
