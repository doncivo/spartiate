import { t } from '../../i18n';
import { logDesktopFailure, type TrayLabels } from '../../platform';
import { startUpdateChecks } from '../updater/updateChecks';
import type { AppContainer } from './container';
import { useNavigationStore } from './navigation';
import { syncBeforeQuit } from '../sync/startSync';
import { syncStore } from '../sync/syncStore';

/** Textes du menu de la zone de notification (D-01) : seule source, src/i18n. */
export function trayLabels(syncConfigured = false): TrayLabels {
  return {
    open: t('desktop.tray.open'),
    sync: t('desktop.tray.sync'),
    quit: t('desktop.tray.quit'),
    // Y-03 : synchro configurée → cycle silencieux ; sinon l'entrée ouvre Réglages › Synchronisation (D1). Jamais grisée.
    syncEnabled: syncConfigured,
  };
}

/**
 * BL-118 : échéance du minuteur de repos (ms, horloge du conteneur) ou null ; poussée par le contrôleur de repos de la séance, lue ici pour le titre
 * de la fenêtre PC. État de la coquille seulement : la séance reste la source de vérité (échéance persistée).
 */
let restEndMs: number | null = null;
const restListeners = new Set<() => void>();

export function setRestBadge(endMs: number | null): void {
  restEndMs = endMs;
  for (const listener of restListeners) listener();
}

/** « Repos 1:23 · Spartiate » : le reste arrondi à la seconde supérieure (jamais 0:00 tant que le repos court). */
export function restBadgeTitle(remainingMs: number): string {
  const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return t('desktop.restBadge', { time });
}

/** Titre de la fenêtre PC selon l'échéance du repos ; repos échu ou absent : le nom de l'app. */
function startWindowTitleBadge(container: AppContainer, desktop: NonNullable<AppContainer['desktop']>): () => void {
  let timer: ReturnType<typeof setInterval> | null = null;
  let last: string | null = null;
  const push = (title: string): void => {
    if (title === last) return;
    last = title;
    desktop.setWindowTitle(title).catch((error: unknown) => logDesktopFailure('window-title', error));
  };
  const refresh = (): void => {
    const remaining = restEndMs === null ? 0 : restEndMs - container.clock.nowMs();
    if (restEndMs === null || remaining <= 0) {
      if (timer !== null) clearInterval(timer);
      timer = null;
      if (last !== null) push(t('app.name'));
      return;
    }
    push(restBadgeTitle(remaining));
    timer ??= setInterval(refresh, 1000);
  };
  restListeners.add(refresh);
  refresh();
  return () => {
    restListeners.delete(refresh);
    if (timer !== null) clearInterval(timer);
    timer = null;
    if (last !== null && last !== t('app.name')) push(t('app.name'));
  };
}

export interface DesktopIntegration {
  /** Retire les écouteurs et minuteries ; sûr avant la fin de l'initialisation et idempotent. */
  dispose(): void;
}

/**
 * Branche l'app PC sur le système (D-01, D-03) : menu de la zone de notification avec les
 * textes de l'interface, vérifications de mise à jour. Sans
 * intégration PC (navigateur, iPhone), ne fait rien. Aucune erreur ne remonte : l'échec
 * d'un branchement est journalisé et l'app reste utilisable.
 */
export function startDesktopIntegration(container: AppContainer): DesktopIntegration {
  const desktop = container.desktop;
  if (!desktop) return { dispose: () => undefined };

  let disposed = false;
  let unlistenQuit: (() => void) | null = null;
  let unlistenSync: (() => void) | null = null;
  let unlistenPaired: (() => void) | null = null;
  const sync = syncStore.get(container);
  const syncConfigured = (): boolean => sync.getState().available && sync.getState().status.phase !== 'not-configured';

  // Menu de la zone de notification (textes de l'interface) ; réécrit quand l'état de la synchro change.
  const pushLabels = (): void => {
    desktop.setTrayLabels(trayLabels(syncConfigured())).catch((error: unknown) => logDesktopFailure('tray-labels', error));
  };
  pushLabels();
  // Y-03 : le libellé et l'effet de « Synchroniser maintenant » suivent la configuration de la synchro.
  let lastConfigured = syncConfigured();
  const stopSyncLabels = sync.subscribe(() => {
    const configured = syncConfigured();
    if (configured !== lastConfigured) {
      lastConfigured = configured;
      pushLabels();
    }
  });
  desktop
    .onTraySyncNow(() => {
      // Synchro configurée : cycle silencieux (la fenêtre ne s'affiche pas) ; sinon Rust a affiché la fenêtre : Réglages › Synchronisation.
      if (syncConfigured()) void sync.getState().syncNow('tray');
      else useNavigationStore.getState().navigate({ tab: 'more', screen: 'sync' });
    })
    .then((stop) => {
      if (disposed) stop();
      else unlistenSync = stop;
    })
    .catch((error: unknown) => logDesktopFailure('tray-sync', error));
  // Y-06 : appareil associé (`sync-paired`, sans clé) : la fenêtre `pairing` est déjà détruite par Rust ; cycle et lignes rafraîchies.
  desktop
    .onSyncPaired(
      () =>
        void import('../sync/pairingStatus')
          .then(({ handleSyncPaired }) => handleSyncPaired(container))
          .catch((error: unknown) => logDesktopFailure('sync-paired', error)),
    )
    .then((stop) => {
      if (disposed) stop();
      else unlistenPaired = stop;
    })
    .catch((error: unknown) => logDesktopFailure('sync-paired', error));
  // « Quitter » : on laisse les écritures en cours se terminer. Le pilote SQL sérialise ses appels :
  // une lecture ne rend la main qu'après les écritures déjà en file.
  desktop
    .onQuitting(async () => {
      await container.data.repos.settings.get('device.id');
      // Y-02 : dernier cycle de synchro avant de quitter, par le planificateur (4,5 s au plus, minuteur annulé à la fin du cycle).
      await syncBeforeQuit(container);
    })
    .then((stop) => {
      if (disposed) stop();
      else unlistenQuit = stop;
    })
    .catch((error: unknown) => logDesktopFailure('quitting', error));
  const stopBadge = startWindowTitleBadge(container, desktop);
  const checks = startUpdateChecks(container);

  return {
    dispose: () => {
      if (disposed) return;
      disposed = true;
      unlistenQuit?.();
      unlistenSync?.();
      unlistenPaired?.();
      stopSyncLabels();
      stopBadge();
      checks.dispose();
    },
  };
}
