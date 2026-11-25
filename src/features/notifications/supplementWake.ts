import { supplementNotificationsFr as fr } from '../../i18n/fr.supplementNotifications';
import { logFailure } from '../../platform/desktop/log';
import { openNotificationActionSource, type NotificationActionSource } from '../../platform/notifications';
import type { DataAccess } from '../../db/repositories/dataAccess';
import type { AppContainer } from '../app/container';
import { useNoticeStore } from '../app/notice';
import { announceLocalChanges, onSyncedDataApplied } from '../sync/remoteChanges';
import { createActionDispatcher } from './actionDispatcher';
import { createRestActionHandler, restActionTypes } from './restActions';
import { createSupplementActionProcessor, startSupplementActions, type SupplementActionDeps } from './supplementActions';

const TROUBLE_KEY = 'notifications.actionTrouble';
/** SHELL-0294b (D-604) : événement écouté par l'écran de séance (`ActiveSession.tsx`, même nom) : le repos a changé, relire l'échéance. */
const REST_CHANGED_EVENT = 'ct-rest-changed';

/** FIX-0242 : mise à jour de l'état durable, lecture et écriture dans UNE transaction (BEGIN IMMEDIATE : deux mises à jour concurrentes ne se perdent pas). */
export function makeTroubleUpdater(data: DataAccess): SupplementActionDeps['updateTrouble'] {
  return (change) =>
    data.transaction(async (repos) => {
      const next = change(await repos.settings.get(TROUBLE_KEY));
      if (next === null) return false;
      await repos.settings.set(TROUBLE_KEY, next);
      return true;
    });
}

/** Tables dont un lot reçu change le plan des rappels de compléments. */
const SUPPLEMENT_TABLES = ['supplement', 'supplement_intake'];

export interface SupplementWakeEnv {
  /** `dispatchEvent` (facultatif pour les faux) : signal « repos changé » vers l'écran de séance (SHELL-0294b, D-604). */
  readonly document: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'> & Partial<Pick<Document, 'dispatchEvent'>>;
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
        // BLESSURES-b : le rappel de check-in des gênes se replanifie aux mêmes moments (même file de passages).
        (m) => Promise.all([m.supplementNotificationsFor(container).replan(), m.injuryNotificationsFor(container).replan()]),
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
    // SHELL-0294b (§ 13.3 b, D-541, D-599) : un seul lecteur du fichier natif, le répartiteur ; les compléments en reçoivent une vue, les
    // actions « +30 s » et « Passer » de la notification de fin de repos vont au gestionnaire du repos.
    makeProcessor: (actions) =>
      createActionDispatcher({
        source: actions,
        restTypes: restActionTypes(),
        log: (code) => logFailure('notifications', code),
        rest: createRestActionHandler({
          restEndMs: async () => {
            const rest = await (await container.data.repos.workouts()).getRest();
            return rest === null ? null : Date.parse(rest.endAt);
          },
          // D-604 : le contrôleur vient du bloc de l'Entraînement (déjà à la demande), jamais d'un bloc partagé de plus.
          controller: () => import('../training/TrainingScreen').then((m) => m.restControllerFor(container)),
          nowMs: () => container.notificationClock.nowMs(),
          onChanged: () => void env.document.dispatchEvent?.(new Event(REST_CHANGED_EVENT)),
          notice: (text) => useNoticeStore.getState().show(text),
          log: (code) => logFailure('notifications', code),
        }),
        supplement: (view) =>
          createSupplementActionProcessor({
            source: view,
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
            // FIX-0242 : état durable des échecs changé (posé ou levé) : la carte d'Aujourd'hui le relit.
            updateTrouble: makeTroubleUpdater(container.data),
            onTroubleChange: () => announceLocalChanges(['supplement_intake']),
          }),
      }),
  });
  return () => {
    env.document.removeEventListener('visibilitychange', onVisible);
    offSync();
    stopActions();
  };
}
