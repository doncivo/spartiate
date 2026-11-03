import { createStore } from 'zustand';
import { nowIso } from '../../domain/clock';
import { logDesktopFailure, UpdateInstallError, type PendingUpdate, type UpdateFailureKind, type UpdateProgress } from '../../platform';
import { defineFeatureStore, type AppContainer } from '../app/container';

/**
 * États de la mise à jour PC (D-03) :
 * - `idle` : aucune vérification terminée ;
 * - `notConfigured` : updater non configuré (D-30, jusqu'à SPA-002) : aucune requête n'est émise ;
 * - `checking` : vérification en cours ;
 * - `upToDate` : la version publiée n'est pas plus récente (rien à afficher, critère 3) ;
 * - `available` : version plus récente trouvée (bandeau, sauf après « Plus tard ») ;
 * - `downloading` : téléchargement, vérification de signature et installation en cours ;
 * - `checkFailed` : `latest.json` inaccessible ou illisible (critère 6), jamais bloquant ;
 * - `installFailed` : installation refusée ou échouée, l'app actuelle continue (critère 5).
 */
export type UpdaterStatus = 'idle' | 'notConfigured' | 'checking' | 'upToDate' | 'available' | 'downloading' | 'checkFailed' | 'installFailed';

export interface UpdaterState {
  readonly status: UpdaterStatus;
  readonly version: string | null;
  readonly notes: string | null;
  readonly notesOpen: boolean;
  readonly progress: UpdateProgress | null;
  readonly failure: UpdateFailureKind | null;
  /** Faux après « Plus tard » ; relevé à la vérification suivante (QB-16). */
  readonly bannerVisible: boolean;
  /**
   * Interroge `latest.json`. Renvoie `ok` (même sans nouvelle version) ou `failed`.
   * Ne rejette jamais ; sans intégration PC, ne fait rien et renvoie `ok`.
   */
  check(): Promise<'ok' | 'failed'>;
  /** Relit l'échec durable enregistré (après redémarrage) ; sans effet si un état plus récent existe. */
  restore(): Promise<void>;
  /** « Plus tard » : ferme le bandeau ; la même version sera reproposée à la vérification suivante. */
  later(): void;
  /** « Voir les notes ». */
  toggleNotes(): void;
  /** « Installer et redémarrer ». Ne rejette jamais ; l'app redémarre en cas de succès. */
  install(): Promise<void>;
}

export const updaterStore = defineFeatureStore<UpdaterState>((container: AppContainer) => {
  let pending: PendingUpdate | null = null;
  const release = (): void => {
    const old = pending;
    pending = null;
    if (old) void old.dispose();
  };

  return createStore<UpdaterState>()((set, get) => ({
    status: 'idle',
    version: null,
    notes: null,
    notesOpen: false,
    progress: null,
    failure: null,
    bannerVisible: false,

    async restore() {
      if (get().status !== 'idle') return;
      try {
        const failure = (await container.data.repos.settings.get('desktop.updater')).lastFailure;
        if (!failure || get().status !== 'idle') return;
        if (failure.stage === 'check') set({ status: 'checkFailed', bannerVisible: false });
        else set({ status: 'installFailed', failure: failure.kind, bannerVisible: true });
      } catch (error) {
        logDesktopFailure('updater-restore', error);
      }
    },

    async check() {
      const desktop = container.desktop;
      if (!desktop) return 'ok';
      if (!desktop.updaterConfigured) {
        set({ status: 'notConfigured', bannerVisible: false });
        return 'ok';
      }
      // Pas de vérification pendant une installation.
      if (get().status === 'downloading') return 'ok';
      set({ status: 'checking' });
      try {
        const found = await desktop.checkForUpdate();
        release();
        pending = found;
        if (found) {
          set({
            status: 'available',
            version: found.version,
            notes: found.notes,
            notesOpen: false,
            progress: null,
            failure: null,
            bannerVisible: true,
          });
        } else {
          set({ status: 'upToDate', version: null, notes: null, notesOpen: false, bannerVisible: false, failure: null });
        }
        await recordCheck(container, null);
        return 'ok';
      } catch (error) {
        logDesktopFailure('updater-check', error);
        set({ status: 'checkFailed', bannerVisible: false });
        await recordCheck(container, { stage: 'check', kind: 'other' }, false);
        return 'failed';
      }
    },

    later() {
      set({ bannerVisible: false, notesOpen: false });
    },

    toggleNotes() {
      set((s) => ({ notesOpen: !s.notesOpen }));
    },

    async install() {
      const current = pending;
      if (!current || get().status === 'downloading') return;
      set({ status: 'downloading', progress: { downloadedBytes: 0, totalBytes: null }, failure: null });
      try {
        await current.install((progress) => set({ progress }));
        // Succès : l'app redémarre ; si le redémarrage tarde, l'état reste « téléchargement ».
      } catch (error) {
        logDesktopFailure('updater-install', error);
        const failure: UpdateFailureKind = error instanceof UpdateInstallError ? error.kind : 'other';
        set({ status: 'installFailed', progress: null, failure, bannerVisible: true });
        await recordCheck(container, { stage: 'install', kind: failure }, false);
      }
    },
  }));
});

/**
 * Écrit `desktop.updater` : l'échec durable (ou son effacement au succès) et, si `stamp`, la date de vérification.
 * Un échec d'écriture est journalisé et sans conséquence sur la mise à jour.
 */
async function recordCheck(
  container: AppContainer,
  lastFailure: { stage: 'check' | 'install'; kind: UpdateFailureKind } | null,
  stamp = true,
): Promise<void> {
  try {
    const settings = container.data.repos.settings;
    const previous = await settings.get('desktop.updater');
    await settings.set('desktop.updater', {
      lastCheckAt: stamp ? nowIso(container.clock) : previous.lastCheckAt,
      lastFailure,
    });
  } catch (error) {
    logDesktopFailure('updater-last-check', error);
  }
}
