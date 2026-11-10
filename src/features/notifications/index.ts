import { logFailure } from '../../platform/desktop/log';
import type { LocalDate } from '../../domain/types';
import type { AppContainer } from '../app/container';
import { createRecoveryNotificationService, type RecoveryNotificationService } from './recoveryNotifications';

export * from './recoveryNotifications';

const services = new WeakMap<AppContainer, RecoveryNotificationService>();

/**
 * Service des notifications de récupération du conteneur (un seul : les passages se suivent un à un). Sur le PC, le planificateur du
 * conteneur est l'implémentation vide : toute opération rend `unsupported`, rien n'est envoyé.
 */
export function recoveryNotificationsFor(container: AppContainer): RecoveryNotificationService {
  const existing = services.get(container);
  if (existing !== undefined) return existing;
  const service = createRecoveryNotificationService({
    scheduler: container.notifications,
    clock: container.notificationClock,
    settings: container.data.repos.settings,
    todayScore: async (day: LocalDate) => (await (await container.data.repos.recovery()).getDay(day))?.summary.recovery ?? null,
    log: (code, data) => logFailure('notifications', `${code} ${JSON.stringify(data ?? {})}`),
  });
  services.set(container, service);
  return service;
}
