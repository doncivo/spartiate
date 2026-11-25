import { isTauri } from '@tauri-apps/api/core';

/**
 * Environnement d'exécution. Seul src/platform le détecte ; le reste du code
 * reçoit des abstractions (ADR 0001).
 * - 'tauri' : app installée (Windows ou iOS) ;
 * - 'web'   : navigateur de développement (npm run dev, Playwright) ou Vitest.
 */
export type Runtime = 'tauri' | 'web';

/** Système cible, utile pour les écarts PC / iPhone non couverts par la mise en page. */
export type OsFamily = 'windows' | 'ios' | 'other';

export function detectRuntime(): Runtime {
  return isTauri() ? 'tauri' : 'web';
}

/**
 * Système cible. L'agent utilisateur d'abord, puis `navigator.platform` quand il ne dit rien (C-163) ; « other » seulement si les deux
 * sont muets. Dans l'app installée, `osUnknownInApp` demande de le journaliser : la synchro et les sauvegardes ne sont plus masquées sans trace.
 */
export function detectOs(userAgent: string = globalThis.navigator?.userAgent ?? '', platform: string = globalThis.navigator?.platform ?? ''): OsFamily {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  if (/Windows/i.test(userAgent)) return 'windows';
  if (/iPhone|iPad|iPod/i.test(platform)) return 'ios';
  if (/^Win/i.test(platform)) return 'windows';
  return 'other';
}

/** Vrai quand l'app installée ne reconnaît pas son système (synchro et sauvegardes indisponibles) : à journaliser, jamais en silence. */
export function osUnknownInApp(runtime: Runtime, os: OsFamily): boolean {
  return runtime === 'tauri' && os === 'other';
}
