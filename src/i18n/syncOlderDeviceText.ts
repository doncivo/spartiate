import { syncOlderDeviceFr } from './fr.syncOlderDevice';

/**
 * SYNC-01 (D-275) : texte de l'avertissement `older-device`, à part du catalogue principal ; importé seulement par des modules chargés à la
 * demande (`startSync.ts` par `import()`, écran Détails).
 */
export function olderDeviceText(): string {
  return syncOlderDeviceFr.banner;
}
