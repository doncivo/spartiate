import type { AppContainer } from '../app/container';
import { onSyncedDataApplied } from '../sync/remoteChanges';

/** Tables dont un lot reçu change le plan des rappels de compléments. */
const SUPPLEMENT_TABLES = ['supplement', 'supplement_intake'];

export interface SupplementWakeEnv {
  readonly document: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>;
  /** Passage de planification (défaut : le service du conteneur, chargé à la demande). */
  readonly replan?: () => Promise<unknown>;
}

/**
 * I6-05 (D-212) : déclencheurs des rappels de compléments, sur le modèle d'ADR 0012 N1.3 (`open`, `resume`, `sync`) : un passage à l'ouverture,
 * à chaque retour au premier plan, et après un lot reçu qui touche les compléments ou les prises (prise cochée sur l'autre appareil : sa
 * notification disparaît). Sur le PC, le service rend `unsupported` sans rien lire. Rend la fonction d'arrêt.
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
  return () => {
    env.document.removeEventListener('visibilitychange', onVisible);
    offSync();
  };
}
