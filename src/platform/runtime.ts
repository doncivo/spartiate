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

/** Système cible : l'agent utilisateur d'abord, puis `navigator.platform` quand il ne dit rien (C-163) ; « other » si les deux sont muets (journalisé, D-616). */
export function detectOs(userAgent: string = globalThis.navigator?.userAgent ?? '', platform: string = globalThis.navigator?.platform ?? ''): OsFamily {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  if (/Windows/i.test(userAgent)) return 'windows';
  if (/iPhone|iPad|iPod/i.test(platform)) return 'ios';
  return /^Win/i.test(platform) ? 'windows' : 'other';
}
