import { localDateTimeAt } from '../../domain/notificationInstant';
import { addDays } from '../../domain/localDate';
import { parseSupplementNotificationPrefs, type Supplement, type SupplementIntake, type SupplementNotificationPrefs } from '../../domain/nutrition/supplements';
import { planSupplementNotifications, SUPPLEMENT_HORIZON_DAYS } from '../../domain/supplementNotificationPlan';
import type { LocalDate } from '../../domain/types';
import type { SettingsRepository } from '../../db/repositories/settingsRepository';
import {
  NOTIFICATION_LIMIT,
  NotificationSchedulerError,
  type NotificationClock,
  type NotificationFailure,
  type NotificationRequest,
  type NotificationScheduler,
} from '../../platform/notifications';

/**
 * Rappels de compléments sur l'iPhone (I6-05, § 15.3, D-212, ADR 0012) : une notification par heure de prise, horizon 3 jours, texte neutre sans
 * nom. DÉSACTIVÉS par défaut (réglage local `supplements.notificationPrefs`, jamais synchronisé) ; l'iPhone seul envoie (le planificateur vide du
 * PC rend `unsupported`, rien n'est lu).
 *
 * - `replace` remplace tout le plan : les notifications d'autres natures en attente (coucher, matin) sont REPOSÉES telles quelles ; le plafond de
 *   64 (moins les réservées) est partagé, ce sont les nôtres qui se réduisent, jamais les autres.
 * - Les passages se suivent un à un, dans la file `serial` partagée avec les rappels de récupération (deux services qui liraient puis
 *   remplaceraient le plan en même temps s'effaceraient l'un l'autre) ; aucune méthode ne rejette ; le journal ne reçoit que des codes.
 */
export type SupplementNotificationStatus = 'unsupported' | 'off' | 'permission' | 'no-zone' | 'planned' | 'failed';

export interface SupplementNotificationResult {
  readonly status: SupplementNotificationStatus;
  readonly planned: number;
  readonly reason?: NotificationFailure | 'unknown';
}

export interface SupplementNotificationDeps {
  readonly scheduler: NotificationScheduler;
  readonly clock: NotificationClock;
  readonly settings: Pick<SettingsRepository, 'get' | 'set'>;
  /** Compléments vivants et prises cochées des jours `from` à `to`. */
  readonly load: (from: LocalDate, to: LocalDate) => Promise<{ readonly supplements: readonly Supplement[]; readonly intakes: readonly SupplementIntake[] }>;
  readonly log: (code: string) => void;
  /** File partagée des passages de planification (défaut : file propre). */
  readonly serial?: <T>(task: () => Promise<T>) => Promise<T>;
}

export interface SupplementNotificationService {
  replan(): Promise<SupplementNotificationResult>;
  setPrefs(prefs: SupplementNotificationPrefs): Promise<SupplementNotificationResult>;
  /** Même chose, mais demande d'abord l'autorisation à iOS si elle n'est pas décidée (geste de l'utilisateur seulement). */
  requestPermissionAndReplan(prefs: SupplementNotificationPrefs): Promise<SupplementNotificationResult>;
  readPrefs(): Promise<SupplementNotificationPrefs>;
}

const isOurs = (request: Pick<NotificationRequest, 'kind'>): boolean => request.kind === 'supplement';
const FAILED: SupplementNotificationResult = { status: 'failed', planned: 0, reason: 'unknown' };

export function createSerialQueue(): <T>(task: () => Promise<T>) => Promise<T> {
  let queue: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(task, task);
    queue = next.catch(() => undefined);
    return next;
  };
}

export function createSupplementNotificationService(deps: SupplementNotificationDeps): SupplementNotificationService {
  const serial = deps.serial ?? createSerialQueue();

  async function readPrefs(): Promise<SupplementNotificationPrefs> {
    try {
      return parseSupplementNotificationPrefs(await deps.settings.get('supplements.notificationPrefs'));
    } catch {
      return parseSupplementNotificationPrefs(null);
    }
  }

  async function pass(askPermission: boolean): Promise<SupplementNotificationResult> {
    try {
      const { scheduler, clock } = deps;
      if ((await scheduler.availability()) === 'unavailable') return { status: 'unsupported', planned: 0 };
      const prefs = await readPrefs();
      const pending = await scheduler.pending();
      const others = pending.filter((request) => !isOurs(request));
      const hasOurs = pending.length !== others.length;
      if (!prefs.enabled && !hasOurs) return { status: 'off', planned: 0 };

      let permission = await scheduler.permission();
      if (permission === 'undetermined' && askPermission && prefs.enabled) permission = await scheduler.requestPermission();
      if (permission !== 'granted') {
        deps.log('supplement-notifications-permission');
        return { status: 'permission', planned: 0 };
      }
      const zone = clock.zone();
      if (zone === null) return { status: 'no-zone', planned: 0 };
      const now = localDateTimeAt(clock.nowMs(), zone);
      const today = now.slice(0, 10) as LocalDate;
      const { supplements, intakes } = prefs.enabled ? await deps.load(today, addDays(today, SUPPLEMENT_HORIZON_DAYS - 1)) : { supplements: [], intakes: [] };
      const room = NOTIFICATION_LIMIT - (await scheduler.reservedCount()) - others.length;
      const plan = planSupplementNotifications({ now, enabled: prefs.enabled, supplements, intakes, limit: room });
      let ours: NotificationRequest[] = [];
      if (plan.items.length > 0) {
        const { supplementNotificationsFr: fr } = await import('../../i18n/fr.supplementNotifications');
        ours = plan.items.map((item) => ({ id: item.id, fireAt: item.fireAt, kind: 'supplement', category: 'supplement', title: fr.title, body: item.count === 1 ? fr.bodyOne : fr.bodyMany.replace('{n}', String(item.count)) }));
      }
      await scheduler.replace([...others, ...ours]);
      return { status: 'planned', planned: ours.length };
    } catch (error) {
      deps.log('supplement-notifications-failed');
      return { status: 'failed', planned: 0, reason: error instanceof NotificationSchedulerError ? error.reason : 'unknown' };
    }
  }

  async function savePrefs(prefs: SupplementNotificationPrefs): Promise<boolean> {
    try {
      await deps.settings.set('supplements.notificationPrefs', { v: 1, enabled: prefs.enabled });
      return true;
    } catch {
      return false;
    }
  }

  return {
    replan: () => serial(() => pass(false)),
    readPrefs,
    setPrefs: (prefs) => serial(async () => ((await savePrefs(prefs)) ? pass(false) : FAILED)),
    requestPermissionAndReplan: (prefs) => serial(async () => ((await savePrefs(prefs)) ? pass(true) : FAILED)),
  };
}
