import { planInjuryNotifications } from '../../domain/injuryNotificationPlan';
import { localDateTimeAt } from '../../domain/notificationInstant';
import { activeInjuries, parseInjuries } from '../../domain/training/injuries';
import type { SettingsRepository } from '../../db/repositories/settingsRepository';
import { NOTIFICATION_LIMIT, NotificationSchedulerError, type NotificationClock, type NotificationFailure, type NotificationRequest, type NotificationScheduler } from '../../platform/notifications';
import { createSerialQueue } from './supplementNotifications';

/**
 * Rappel de check-in des gênes sur l'iPhone (BLESSURES-b, ADR 0012) : une notification neutre par jour d'échéance. Pas de réglage propre : le
 * rappel existe tant qu'une gêne est active et que l'autorisation est accordée (jamais demandée ici). Le PC n'émet rien (planificateur vide :
 * `unsupported`, rien n'est lu). Les notifications d'autres natures sont REPOSÉES telles quelles ; le journal ne reçoit que des codes.
 */
export type InjuryNotificationStatus = 'unsupported' | 'off' | 'permission' | 'no-zone' | 'planned' | 'failed';

export interface InjuryNotificationResult {
  readonly status: InjuryNotificationStatus;
  readonly planned: number;
  readonly reason?: NotificationFailure | 'unknown';
}

export interface InjuryNotificationDeps {
  readonly scheduler: NotificationScheduler;
  readonly clock: NotificationClock;
  readonly settings: Pick<SettingsRepository, 'get'>;
  readonly log: (code: string) => void;
  /** File partagée des passages de planification (défaut : file propre). */
  readonly serial?: <T>(task: () => Promise<T>) => Promise<T>;
}

export interface InjuryNotificationService {
  replan(): Promise<InjuryNotificationResult>;
}

const isOurs = (request: Pick<NotificationRequest, 'kind'>): boolean => request.kind === 'injury';

export function createInjuryNotificationService(deps: InjuryNotificationDeps): InjuryNotificationService {
  const serial = deps.serial ?? createSerialQueue();

  async function pass(): Promise<InjuryNotificationResult> {
    try {
      const { scheduler, clock } = deps;
      if ((await scheduler.availability()) === 'unavailable') return { status: 'unsupported', planned: 0 };
      const pending = await scheduler.pending();
      const others = pending.filter((request) => !isOurs(request));
      const hasOurs = pending.length !== others.length;
      const injuries = parseInjuries(await deps.settings.get('training.injuries'));
      const any = activeInjuries(injuries).length > 0;
      if (!any && !hasOurs) return { status: 'off', planned: 0 };
      if ((await scheduler.permission()) !== 'granted') {
        deps.log('injury-notifications-permission');
        return { status: 'permission', planned: 0 };
      }
      const zone = clock.zone();
      if (zone === null) return { status: 'no-zone', planned: 0 };
      const now = localDateTimeAt(clock.nowMs(), zone);
      const room = NOTIFICATION_LIMIT - (await scheduler.reservedCount()) - others.length;
      const plan = planInjuryNotifications({ now, injuries, limit: room });
      let ours: NotificationRequest[] = [];
      if (plan.items.length > 0) {
        const { injuryNotificationsFr: fr } = await import('../../i18n/fr.injuryNotifications');
        ours = plan.items.map((item) => ({ id: item.id, fireAt: item.fireAt, kind: 'injury', title: fr.title, body: fr.body }));
      }
      await scheduler.replace([...others, ...ours]);
      return { status: 'planned', planned: ours.length };
    } catch (error) {
      deps.log('injury-notifications-failed');
      return { status: 'failed', planned: 0, reason: error instanceof NotificationSchedulerError ? error.reason : 'unknown' };
    }
  }

  return { replan: () => serial(pass) };
}
