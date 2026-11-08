import type { Runtime } from '../runtime';
import type { OffClient } from './parse';
import { createTauriOff } from './tauriOff';

export { OffError, OFF_ERROR_KINDS, type OffClient, type OffErrorKind, type OffResponse } from './parse';

/**
 * Client Open Food Facts de l'app (I4-05, H-12) : module chargé à la demande par Nutrition (import dynamique). Rust fait l'appel
 * (HTTPS, délai, cache de requêtes) ; ici : validation de la forme et résolution par environnement.
 */
let injected: OffClient | null = null;

/** Branche un client (faux dans les tests, e2e). `null` le retire. */
export function setOffClient(client: OffClient | null): void {
  injected = client;
}

/** Client injecté, sinon le client Rust (app installée), sinon `null` (navigateur : aucun réseau par ce chemin). Aucun appel au chargement. */
export function resolveOffClient(runtime: Runtime): OffClient | null {
  if (injected) return injected;
  return runtime === 'tauri' ? createTauriOff() : null;
}
