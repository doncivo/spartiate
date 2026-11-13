import { logFailure } from '../../platform/desktop/log';
import type { LocalDate } from '../../domain/types';
import type { AppContainer } from '../app/container';
import { createRecoveryNotificationService, type RecoveryNotificationService } from './recoveryNotifications';
import { createSerialQueue, createSupplementNotificationService, type SupplementNotificationService } from './supplementNotifications';

export * from './recoveryNotifications';
export * from './supplementNotifications';

const services = new WeakMap<AppContainer, RecoveryNotificationService>();
const supplementServices = new WeakMap<AppContainer, SupplementNotificationService>();
/** I6-05 : une file de passages par conteneur, partagée par les deux services (chacun lit puis remplace tout le plan). */
const queues = new WeakMap<AppContainer, <T>(task: () => Promise<T>) => Promise<T>>();
function queueFor(container: AppContainer): <T>(task: () => Promise<T>) => Promise<T> {
  let queue = queues.get(container);
  if (queue === undefined) {
    queue = createSerialQueue();
    queues.set(container, queue);
  }
  return queue;
}

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
    // Journal des échecs seulement : un succès (`-planned`) n'y est pas rangé ; jamais de valeur corporelle.
    log: (code, data) => {
      if (code.endsWith('-planned')) return;
      logFailure('notifications', `${code} ${JSON.stringify(data ?? {})}`);
    },
    serial: queueFor(container),
  });
  services.set(container, service);
  return service;
}

/** I6-05 (D-212) : service des rappels de compléments du conteneur ; même file que la récupération. Journal : codes seulement, jamais un nom. */
export function supplementNotificationsFor(container: AppContainer): SupplementNotificationService {
  const existing = supplementServices.get(container);
  if (existing !== undefined) return existing;
  const service = createSupplementNotificationService({
    scheduler: container.notifications,
    clock: container.notificationClock,
    settings: container.data.repos.settings,
    load: async (from, to) => {
      const repo = await container.data.repos.supplements();
      const [supplements, intakes] = await Promise.all([repo.list(), repo.intakes(from, to)]);
      return { supplements, intakes };
    },
    log: (code) => logFailure('notifications', code),
    serial: queueFor(container),
  });
  supplementServices.set(container, service);
  return service;
}
