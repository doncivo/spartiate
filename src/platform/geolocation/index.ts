import type { OsFamily, Runtime } from '../runtime';
import type { Geolocation } from './types';
import { unavailableGeolocation } from './unavailable';

export type { GeoErrorCode, GeoEvent, GeoFix, GeoPermission, Geolocation } from './types';
export { unavailableGeolocation } from './unavailable';

/** Chargeur de la façade : le plugin n'est importé qu'à l'usage (bloc à la demande, hors du départ). */
export type GeolocationLoader = () => Promise<Geolocation>;

let injected: Geolocation | null = null;

/** Branche une façade (faux GPS dans les tests et les e2e). `null` la retire. */
export function setGeolocation(geo: Geolocation | null): void {
  injected = geo;
}

/**
 * I6-06 (D-222) : GPS sur l'iPhone installé seulement. PC (Windows) et navigateur : stub sans GPS (saisie manuelle seule). La façade réelle est
 * chargée à la demande avec le plugin (`tauriGeolocation.ts`).
 */
export function resolveGeolocation(runtime: Runtime, os: OsFamily): GeolocationLoader {
  if (injected) {
    const geo = injected;
    return async () => geo;
  }
  if (runtime !== 'tauri' || os !== 'ios') return async () => unavailableGeolocation;
  return async () => (await import('./tauriGeolocation')).createTauriGeolocation();
}

/** Sans plugin chargé : le GPS est-il possible ici (bouton montré) ? */
export function geolocationExpected(runtime: Runtime, os: OsFamily): boolean {
  return injected ? injected.available : runtime === 'tauri' && os === 'ios';
}
