import { invoke } from '@tauri-apps/api/core';
import { readAppVersion } from '../appVersion';
import { listen } from '@tauri-apps/api/event';
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart';
import { openUrl } from '@tauri-apps/plugin-opener';
import { relaunchApp } from '../relaunch';
import { check } from '@tauri-apps/plugin-updater';
import {
  CONFIRM_QUIT_COMMAND,
  LATEST_RELEASE_URL,
  QUITTING_EVENT,
  TRAY_SYNC_NOW_EVENT,
  SET_TRAY_LABELS_COMMAND,
} from './releases';

/** Événement émis par Rust vers `main` à l'association d'un appareil (src-tauri/src/sync/commands.rs, PAIRED_EVENT ; Y-06). */
export const SYNC_PAIRED_EVENT = 'sync-paired';
import {
  UpdateInstallError,
  type DesktopPlatform,
  type PendingUpdate,
  type UpdateFailureKind,
} from './types';


/**
 * Classe une erreur du plugin updater. Les erreurs de signature viennent de minisign
 * (« Signature verification failed », « Invalid encoding… ») ou du contrôle de la version
 * signée (« signed version »).
 */
export function classifyUpdateError(error: unknown): UpdateFailureKind {
  const text = error instanceof Error ? error.message : String(error);
  return /signature|minisign|signed version|public key|base64/i.test(text) ? 'signature' : 'other';
}

/** Implémentation Tauri (Windows). Ne s'importe que via `openDesktopPlatform`. */
export function createTauriDesktop(): DesktopPlatform {
  return {
    setTrayLabels: async (labels) => {
      await invoke(SET_TRAY_LABELS_COMMAND, { labels });
    },

    onTraySyncNow: async (handler) => listen(TRAY_SYNC_NOW_EVENT, () => handler()),

    onSyncPaired: async (handler) => listen(SYNC_PAIRED_EVENT, () => handler()),

    onQuitting: async (handler) =>
      listen(QUITTING_EVENT, () => {
        void handler()
          .catch(() => undefined)
          .finally(() => invoke(CONFIRM_QUIT_COMMAND).catch(() => undefined));
      }),

    getAutostart: () => isEnabled(),

    setAutostart: async (enabled) => {
      if (enabled) await enable();
      else await disable();
    },

    // I-06 : seul lecteur de la version, commun au PC et à l'iPhone (src/platform/appVersion.ts) ; illisible : rejet (jamais 0.0.0).
    getVersion: async () => {
      const read = await readAppVersion();
      if (!read.ok) throw new Error('app-version-unreadable');
      return read.version;
    },

    // SPA-002 : bloc plugins.updater, enregistrement Rust et permissions rétablis ensemble (D-30 clos).
    updaterConfigured: true,

    checkForUpdate: async () => {
      const update = await check();
      if (!update) return null;
      const pending: PendingUpdate = {
        version: update.version,
        notes: update.body?.trim() ? update.body : null,
        install: async (onProgress) => {
          let downloadedBytes = 0;
          let totalBytes: number | null = null;
          try {
            await update.downloadAndInstall((event) => {
              if (event.event === 'Started') totalBytes = event.data.contentLength ?? null;
              else if (event.event === 'Progress') downloadedBytes += event.data.chunkLength;
              onProgress({ downloadedBytes, totalBytes });
            });
          } catch (error) {
            throw new UpdateInstallError(classifyUpdateError(error), error);
          }
          await relaunchApp();
        },
        dispose: async () => {
          try {
            await update.close();
          } catch {
            // Ressource déjà libérée : sans conséquence.
          }
        },
      };
      return pending;
    },

    openLatestRelease: () => openUrl(LATEST_RELEASE_URL),
  };
}
