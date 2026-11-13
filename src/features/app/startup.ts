import type { TimeZoneChange } from '../../domain/timeZone';
import type { BackupScheduler } from '../settings/backupScheduler';
import { noteBackupSchedulerLoadFailed } from '../settings/backupSchedulerStatus';
import { logFailure } from '../../platform/desktop/log';
import { useAppStore } from './appStore';
import type { AppContainer } from './container';
import { createTimeZoneWatcher } from './timeZoneWatcher';
import { announcePendingRestore } from '../settings/restoreMemoPeek';

export interface AppStartup {
  /** Premier rendu possible : fuseau lu. Ne rejette jamais. */
  readonly ready: Promise<void>;
  /** Arrête minuterie et écouteurs ; sûr avant la fin de `ready` (aucun réarmement ensuite) et idempotent. */
  dispose(): void;
}

/** Minuteries injectables (tests : horloge simulée). */
export interface StartupTimers {
  setInterval(handler: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

/** Cibles d'événements injectables (tests). */
export interface StartupEnv {
  readonly document: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>;
  readonly window: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  /** Détection du fuseau (tests) ; défaut : fuseau du système. */
  readonly detectTimeZone?: () => string | null;
  /** Point d'extension : réaction à un changement de fuseau. */
  readonly onTimeZoneChange?: (change: TimeZoneChange) => void | Promise<void>;
  /** Minuteur de la sauvegarde quotidienne (tests : horloge simulée) ; défaut : minuteur du système. */
  readonly timers?: StartupTimers;
}

/**
 * Orchestration de démarrage : détection du fuseau au démarrage et au retour au premier plan (T-11, `general.timeZone`) et sauvegarde
 * quotidienne P-04 (à l'ouverture, au retour au premier plan, après minuit ; module chargé à la demande, sans bloquer `ready`).
 * SPA-001b : le report des tâches, la corbeille, les agendas externes et les objectifs sont retirés avec leurs features.
 */
export function startAppStartup(container: AppContainer, env: StartupEnv = { document, window }): AppStartup {
  announcePendingRestore({ actionQueue: false });
  const timeZone = createTimeZoneWatcher(container, {
    ...(env.detectTimeZone ? { detect: env.detectTimeZone } : {}),
    onCurrent: (tz) => useAppStore.getState().setTimeZone(tz),
    onChange: async (change) => {
      await env.onTimeZoneChange?.(change);
    },
  });
  let disposed = false;
  let backups: BackupScheduler | null = null;
  void import('../settings/backupScheduler').then(
    (module) => {
      if (!disposed) backups = module.startBackupScheduler(container, { document: env.document, window: env.window, ...(env.timers ?? {}) });
    },
    (error: unknown) => {
      noteBackupSchedulerLoadFailed();
      logFailure('backup-daily', error);
    },
  );
  // I6-05 (D-212) : rappels de compléments (iPhone) replanifiés à l'ouverture, à la reprise et après un lot reçu ; module à la demande.
  let stopSupplements: (() => void) | null = null;
  void import('../notifications/supplementWake').then(
    (module) => {
      if (!disposed) stopSupplements = module.startSupplementReminders(container, { document: env.document });
    },
    (error: unknown) => logFailure('notifications', error),
  );
  const onCheck = (): void => {
    if (env.document.visibilityState !== 'hidden') void timeZone.check();
  };
  env.document.addEventListener('visibilitychange', onCheck);
  env.window.addEventListener('focus', onCheck);
  const ready = timeZone.check().then(() => undefined);
  return {
    ready,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      backups?.dispose();
      stopSupplements?.();
      env.document.removeEventListener('visibilitychange', onCheck);
      env.window.removeEventListener('focus', onCheck);
    },
  };
}
