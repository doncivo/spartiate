import { supplementNotificationsFr as fr } from '../../i18n/fr.supplementNotifications';
import { logFailure } from '../../platform/desktop/log';
import { openNotificationActionSource, type NotificationActionSource } from '../../platform/notifications';
import type { AppContainer } from '../app/container';
import { useNoticeStore } from '../app/notice';
import { announceLocalChanges, onSyncedDataApplied } from '../sync/remoteChanges';
import { createSupplementActionProcessor, startSupplementActions } from './supplementActions';

/** Tables dont un lot reçu change le plan des rappels de compléments. */
const SUPPLEMENT_TABLES = ['supplement', 'supplement_intake'];

export interface SupplementWakeEnv {
  readonly document: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>;
  /** Passage de planification (défaut : le service du conteneur, chargé à la demande). */
  readonly replan?: () => Promise<unknown>;
  /** FIX-0221 : source des actions « Pris » (défaut : le plugin sur l'iPhone, `null` ailleurs). */
  readonly actions?: NotificationActionSource | null;
}

/**
 * I6-05 (D-212) : déclencheurs des rappels de compléments, sur le modèle d'ADR 0012 N1.3 (`open`, `resume`, `sync`) : un passage à l'ouverture,
 * à chaque retour au premier plan, et après un lot reçu qui touche les compléments ou les prises (prise cochée sur l'autre appareil : sa
 * notification disparaît). Sur le PC, le service rend `unsupported` sans rien lire. FIX-0221 (D-250) : sur l'iPhone, l'action « Pris » est
 * enregistrée et tirée aux mêmes moments et à chaque réveil du plugin ; une prise cochée ainsi est confirmée par un bandeau bref, relue par la
 * carte d'Aujourd'hui et replanifiée. Rend la fonction d'arrêt.
 */
export function startSupplementReminders(container: AppContainer, env: SupplementWakeEnv): () => void {
  const replan =
    env.replan ??
    (() =>
      import('./index').then(
        (m) => m.supplementNotificationsFor(container).replan(),
        () => undefined,
      ));
  const run = (): void => void replan().catch(() => undefined);
  const onVisible = (): void => {
    if (env.document.visibilityState !== 'hidden') run();
  };
  env.document.addEventListener('visibilitychange', onVisible);
  const offSync = onSyncedDataApplied((tables) => {
    if (SUPPLEMENT_TABLES.some((t) => tables.has(t))) run();
  });
  run();
  const source = env.actions === undefined ? openNotificationActionSource(container.platform.runtime, container.platform.os) : env.actions;
  const stopActions = startSupplementActions({
    document: env.document,
    source,
    makeProcessor: (actions) =>
      createSupplementActionProcessor({
        source: actions,
        settings: container.data.repos.settings,
        supplements: () => container.data.repos.supplements(),
        nowMs: () => container.notificationClock.nowMs(),
        texts: { action: fr.actionTaken, placeholder: fr.hiddenPlaceholder },
        onTaken: (count) => {
          useNoticeStore.getState().show(count === 1 ? fr.noticeTakenOne : fr.noticeTakenMany.replace('{n}', String(count)));
          // Carte d'Aujourd'hui relue ; l'abonnement ci-dessus replanifie les rappels.
          announceLocalChanges(['supplement_intake']);
        },
        onTrouble: (kind) => useNoticeStore.getState().show(kind === 'failed' ? fr.noticeFailed : fr.noticeLost),
        log: (code) => logFailure('notifications', code),
      }),
  });
  return () => {
    env.document.removeEventListener('visibilitychange', onVisible);
    offSync();
    stopActions();
  };
}
