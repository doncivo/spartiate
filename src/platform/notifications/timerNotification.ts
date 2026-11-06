import { pluginDate } from '../../domain/notificationInstant';
import { TIMER_NOTIFICATION_ID } from '../../domain/syntheticTimer';
import type { OsFamily, Runtime } from '../runtime';
import { SEND_MARGIN_MS, type IosNotificationBridge } from './tauriNotifications';
import type { NotificationClock } from './notificationClock';

/**
 * Notification locale de l'échéance du minuteur de test (SPA-007). Envoi par le plugin officiel (pont `IosNotificationBridge`) ; la réception
 * est celle du délégué de notification-actions, sans catégorie d'action. Identifiant FIXE hors plan (`TIMER_NOTIFICATION_ID`) : annulé avant
 * chaque envoi, donc jamais de doublon après une reprise. La date garde les secondes (le plan des rappels est à la minute, pas ce minuteur).
 */
export type TimerNotifierPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

/** Notification de l'échéance : adaptateur iOS ci-dessous, vide ailleurs. */
export interface TimerNotifier {
  permission(): Promise<TimerNotifierPermission>;
  requestPermission(): Promise<TimerNotifierPermission>;
  /** Vrai si la notification du minuteur est encore en attente dans iOS. */
  isPending(): Promise<boolean>;
  /** Programme (ou remplace) la notification à `endMs` ; faux = échec. */
  schedule(input: { readonly endMs: number; readonly title: string; readonly body: string }): Promise<boolean>;
  cancel(): Promise<void>;
}

const UNAVAILABLE_MESSAGE = /window is not defined|__TAURI|reading 'invoke'|not allowed|plugin .*not found|command .*not found|not registered|unknown command|no such plugin/i;

/** Heure murale locale avec les secondes de l'instant (`YYYY-MM-DDTHH:mm:ss.000Z`, `Z` littéral, constat 7 de l'ADR 0012). */
function dateWithSeconds(endMs: number, zone: string | null): string {
  const seconds = Math.floor((endMs % 60_000) / 1000);
  return pluginDate(endMs, zone).replace(':00.000Z', `:${String(seconds).padStart(2, '0')}.000Z`);
}

export function createIosTimerNotifier(deps: { readonly bridge: IosNotificationBridge; readonly clock: NotificationClock }): TimerNotifier {
  const { bridge, clock } = deps;
  const permissionOf = async (read: () => Promise<'granted' | 'denied' | 'undetermined'>) => {
    try {
      return await read();
    } catch (error) {
      return UNAVAILABLE_MESSAGE.test(error instanceof Error ? error.message : String(error)) ? ('unavailable' as const) : ('denied' as const);
    }
  };
  return {
    permission: () => permissionOf(() => bridge.permission()),
    requestPermission: () => permissionOf(() => bridge.requestPermission()),
    async isPending() {
      try {
        return (await bridge.pending()).some((item) => item.id === TIMER_NOTIFICATION_ID);
      } catch {
        return false;
      }
    },
    async schedule({ endMs, title, body }) {
      if (endMs - clock.nowMs() < SEND_MARGIN_MS) return false;
      try {
        await bridge.cancel([TIMER_NOTIFICATION_ID]);
        await bridge.show({
          id: TIMER_NOTIFICATION_ID,
          title,
          body,
          sound: 'default',
          extra: { sid: 'timer:test', at: String(endMs) },
          schedule: { at: { date: dateWithSeconds(endMs, clock.zone()), repeating: false, allowWhileIdle: false } },
        });
        return true;
      } catch {
        return false;
      }
    },
    async cancel() {
      await bridge.cancel([TIMER_NOTIFICATION_ID]);
    },
  };
}

/** PC, navigateur, tests : aucune notification système (le PC n'en émet aucune, CLAUDE.md). */
export function createUnavailableTimerNotifier(): TimerNotifier {
  return {
    permission: async () => 'unavailable',
    requestPermission: async () => 'unavailable',
    isPending: async () => false,
    schedule: async () => false,
    cancel: async () => undefined,
  };
}

/** Adaptateur réel pour (`tauri`, `ios`) seulement, chargé à la demande ; le vide partout ailleurs. */
export function openTimerNotifier(runtime: Runtime, os: OsFamily, clock: NotificationClock): TimerNotifier {
  if (runtime !== 'tauri' || os !== 'ios') return createUnavailableTimerNotifier();
  let loaded: Promise<TimerNotifier> | null = null;
  const load = (): Promise<TimerNotifier> =>
    (loaded ??= import('./tauriNotifications').then(({ createIosNotificationBridge }) => createIosTimerNotifier({ bridge: createIosNotificationBridge(), clock })));
  return {
    permission: async () => (await load()).permission(),
    requestPermission: async () => (await load()).requestPermission(),
    isPending: async () => (await load()).isPending(),
    schedule: async (input) => (await load()).schedule(input),
    cancel: async () => (await load()).cancel(),
  };
}
