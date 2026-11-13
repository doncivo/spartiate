import type { Geolocation } from './types';

/** Stub du PC (Windows) et du navigateur : pas de GPS, saisie manuelle seule (D-222). Aucune permission demandée, aucun suivi. */
export const unavailableGeolocation: Geolocation = {
  available: false,
  permission: async () => 'denied',
  request: async () => 'denied',
  watch: async (onEvent) => {
    onEvent({ kind: 'error', code: 'unavailable' });
    return async () => undefined;
  },
};
