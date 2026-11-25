import { tTraining } from '../../../i18n/trainingText';
import { liveActivity } from '../../../platform/liveActivity';
import { systemNotificationClock } from '../../../platform/notifications/notificationClock';
import { openTimerNotifier } from '../../../platform/notifications/timerNotification';
import type { AppContainer } from '../../app/container';
import { createRestTimer, type RestTimerController } from './restTimer';

/**
 * SHELL-0294b (§ 13.3 b) : contrôleur du minuteur de repos pour les actions de la notification de fin de repos. Exporté par le bloc de
 * l'Entraînement (`TrainingScreen.tsx`) et chargé avec lui à la demande au premier « +30 s » ou « Passer » : aucun bloc partagé de plus
 * dans les listes de préchargement du départ (D-604). Mêmes adaptateurs et mêmes textes que l'écran de séance (`SessionScreen`), sauf le libellé de la Live Activity :
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
