import type { OsFamily, Runtime } from '../runtime';
import type { QrScanner } from '../sync/tauriSync';

/**
 * Scanner de code-barres alimentaire (I4-05) : même plugin officiel que l'appairage (façade `sync/barcodeScanner.ts`, seul fichier qui
 * le nomme), chargé à la demande, sur iPhone installé seulement. PC et navigateur : `null` (aucun bouton de scan).
 */
export type BarcodeScannerLoader = () => Promise<QrScanner>;

let injected: BarcodeScannerLoader | null = null;

/** Branche un chargeur (faux scanner dans les tests, e2e). `null` le retire. */
export function setBarcodeScanner(loader: BarcodeScannerLoader | null): void {
  injected = loader;
}

export function resolveBarcodeScanner(runtime: Runtime, os: OsFamily): BarcodeScannerLoader | null {
  if (injected) return injected;
  if (runtime !== 'tauri' || os !== 'ios') return null;
  return async () => (await import('../sync/barcodeScanner')).loadBarcodeScanner()();
}
