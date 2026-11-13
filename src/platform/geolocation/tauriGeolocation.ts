import type { GeoEvent, GeoPermission, Geolocation } from './types';

/**
 * I6-06 (D-222) : façade réelle sur le plugin officiel `@tauri-apps/plugin-geolocation` 2.5.0 (iPhone seulement ; crate `tauri-plugin-geolocation`
 * enregistrée dans le bloc iOS de `lib.rs`, capability `geolocation-ios.json`). Premier plan seulement : le plugin demande l'autorisation « pendant
 * l'utilisation » (`requestWhenInUseAuthorization`) et l'app n'a aucun mode d'arrière-plan. Aucune position n'est journalisée ici : seuls des codes
 * sortent en cas d'erreur, le texte d'erreur du système n'est jamais relayé.
 */

/** Sous-ensemble du module du plugin (injecté par les tests ; chargé à la demande en production). */
export interface GeolocationPluginModule {
  checkPermissions(): Promise<{ readonly location: string }>;
  requestPermissions(permissions: ('location' | 'coarseLocation')[] | null): Promise<{ readonly location: string }>;
  watchPosition(
    options: { enableHighAccuracy: boolean; timeout: number; maximumAge: number },
    cb: (position: { readonly timestamp: number; readonly coords: { readonly latitude: number; readonly longitude: number; readonly accuracy: number } } | null, error?: string) => void,
  ): Promise<number>;
  clearWatch(id: number): Promise<void>;
}

const toPermission = (state: string): GeoPermission => (state === 'granted' ? 'granted' : state === 'denied' ? 'denied' : 'prompt');

/** Délai d'attente d'une mesure (ignoré par iOS, gardé pour la forme de l'appel). */
const WATCH_TIMEOUT_MS = 10_000;

export async function createTauriGeolocation(load: () => Promise<GeolocationPluginModule> = () => import('@tauri-apps/plugin-geolocation')): Promise<Geolocation> {
  const plugin = await load();
  return {
    available: true,
    permission: async () => {
      try {
        return toPermission((await plugin.checkPermissions()).location);
      } catch {
        // Service de localisation coupé sur l'appareil : le plugin rejette ; dit « refusé » (l'écran propose la saisie manuelle).
        return 'denied';
      }
    },
    request: async () => {
      try {
        return toPermission((await plugin.requestPermissions(['location'])).location);
      } catch {
        return 'denied';
      }
    },
    watch: async (onEvent: (event: GeoEvent) => void) => {
      const id = await plugin.watchPosition({ enableHighAccuracy: true, timeout: WATCH_TIMEOUT_MS, maximumAge: 0 }, (position, error) => {
        if (position === null || error !== undefined) {
          onEvent({ kind: 'error', code: /denied|authori[sz]/i.test(error ?? '') ? 'denied' : 'unavailable' });
          return;
        }
        onEvent({ kind: 'fix', fix: { lat: position.coords.latitude, lon: position.coords.longitude, accuracyM: position.coords.accuracy, at: position.timestamp } });
      });
      return async () => {
        try {
          await plugin.clearWatch(id);
        } catch {
          /* suivi déjà arrêté par le système : rien à faire */
        }
      };
    },
  };
}
