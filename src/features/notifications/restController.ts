import { tTraining } from '../../i18n/trainingText';
import { liveActivity } from '../../platform/liveActivity';
import { systemNotificationClock } from '../../platform/notifications/notificationClock';
import { openTimerNotifier } from '../../platform/notifications/timerNotification';
import type { AppContainer } from '../app/container';
import { createRestTimer, type RestTimerController } from '../training/session/restTimer';

/**
 * SHELL-0294b (§ 13.3 b) : contrôleur du minuteur de repos pour les actions de la notification de fin de repos, chargé à la demande au premier
 * « +30 s » ou « Passer ». Mêmes adaptateurs et mêmes textes que l'écran de séance (`SessionScreen`), sauf le libellé de la Live Activity :
 * celui par défaut (l'exercice suivant n'est connu que de l'écran de séance, D-599).
 */
export function restControllerFor(container: AppContainer): RestTimerController {
  return createRestTimer({
    clock: container.clock,
    store: () => container.data.repos.workouts(),
    liveActivity,
    notifier: openTimerNotifier(container.platform.runtime, container.platform.os, systemNotificationClock, 'rest'),
    os: container.platform.os === 'ios' ? 'ios' : 'other',
    texts: {
      label: tTraining('restLiveLabel'),
      finishedLabel: tTraining('restLiveFinished'),
      notificationTitle: tTraining('restNotificationTitle'),
      notificationBody: tTraining('restNotificationBody'),
    },
  });
}
