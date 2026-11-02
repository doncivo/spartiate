import { type DesktopPlatform, type PendingUpdate, type TrayLabels, type UpdateProgress } from './types';

/** Faux `PendingUpdate` pour les tests. */
export interface FakePendingUpdate extends PendingUpdate {
  readonly installMock: { calls: number };
  readonly disposed: { count: number };
}

export function fakePendingUpdate(
  version: string,
  options: { notes?: string | null; install?: (onProgress: (p: UpdateProgress) => void) => Promise<void> } = {},
): FakePendingUpdate {
  const installMock = { calls: 0 };
  const disposed = { count: 0 };
  return {
    version,
    notes: options.notes === undefined ? 'Notes de test' : options.notes,
    install: (onProgress) => {
      installMock.calls += 1;
      return options.install ? options.install(onProgress) : Promise.resolve();
    },
    dispose: () => {
      disposed.count += 1;
      return Promise.resolve();
    },
    installMock,
    disposed,
  };
}

/** Faux `DesktopPlatform` en mémoire (tests de features, aucun IPC). */
export interface FakeDesktop extends DesktopPlatform {
  trayLabels: TrayLabels | null;
  autostart: boolean;
  version: string;
  /** Résultat de la prochaine vérification : mise à jour, null, ou erreur à lever. */
  nextCheck: PendingUpdate | null | Error;
  checks: number;
  /** Vrai par défaut : les tests de mise à jour supposent un updater configuré ; mettre faux pour l'état D-30. */
  updaterConfigured: boolean;
  openedReleases: number;
  /** Déclenche « Synchroniser maintenant » comme le fait le menu (Y-03). */
  emitTraySyncNow(): void;
  traySyncListeners: number;
  /** Déclenche `sync-paired` comme le fait Rust (Y-06). */
  emitSyncPaired(): void;
  syncPairedListeners: number;
  /** Déclenche « Quitter » ; résout quand le handler a fini et que la sortie est confirmée. */
  emitQuitting(): Promise<void>;
  quitConfirmed: boolean;
  quittingHandler: (() => Promise<void>) | null;
  failAutostart: boolean;
}

export function createFakeDesktop(initial: Partial<Pick<FakeDesktop, 'autostart' | 'version' | 'nextCheck'>> = {}): FakeDesktop {
  const syncHandlers = new Set<() => void>();
  const pairedHandlers = new Set<() => void>();
  const fake: FakeDesktop = {
    trayLabels: null,
    autostart: initial.autostart ?? false,
    version: initial.version ?? '0.1.0',
    nextCheck: initial.nextCheck ?? null,
    checks: 0,
    openedReleases: 0,
    traySyncListeners: 0,
    syncPairedListeners: 0,
    emitSyncPaired: () => pairedHandlers.forEach((handler) => handler()),
    onSyncPaired: (handler) => {
      pairedHandlers.add(handler);
      fake.syncPairedListeners = pairedHandlers.size;
      return Promise.resolve(() => {
        pairedHandlers.delete(handler);
        fake.syncPairedListeners = pairedHandlers.size;
      });
    },
    emitTraySyncNow: () => syncHandlers.forEach((handler) => handler()),
    onTraySyncNow: (handler) => {
      syncHandlers.add(handler);
      fake.traySyncListeners = syncHandlers.size;
      return Promise.resolve(() => {
        syncHandlers.delete(handler);
        fake.traySyncListeners = syncHandlers.size;
      });
    },
    quitConfirmed: false,
    quittingHandler: null,
    emitQuitting: async () => {
      await fake.quittingHandler?.().catch(() => undefined);
      fake.quitConfirmed = true;
    },
    onQuitting: (handler) => {
      fake.quittingHandler = handler;
      return Promise.resolve(() => {
        fake.quittingHandler = null;
      });
    },
    failAutostart: false,
    setTrayLabels: (labels) => {
      fake.trayLabels = labels;
      return Promise.resolve();
    },
    getAutostart: () => Promise.resolve(fake.autostart),
    setAutostart: (enabled) => {
      if (fake.failAutostart) return Promise.reject(new Error('registre inaccessible'));
      fake.autostart = enabled;
      return Promise.resolve();
    },
    getVersion: () => Promise.resolve(fake.version),
    updaterConfigured: true,
    checkForUpdate: () => {
      fake.checks += 1;
      return fake.nextCheck instanceof Error ? Promise.reject(fake.nextCheck) : Promise.resolve(fake.nextCheck);
    },
    openLatestRelease: () => {
      fake.openedReleases += 1;
      return Promise.resolve();
    },
  };
  return fake;
}
