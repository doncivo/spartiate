/**
 * I6-06 (D-222) : façade de la géolocalisation (plugin officiel `@tauri-apps/plugin-geolocation`, iPhone seulement, premier plan seulement). Le PC n'a
 * pas de GPS : stub `unavailableGeolocation` (saisie manuelle seule). Aucune position n'est écrite dans un journal ni envoyée à une API : la façade ne
 * journalise rien, elle rend des codes.
 */
export type GeoPermission = 'granted' | 'denied' | 'prompt';

/** Une mesure de position (degrés décimaux, précision en m, instant en ms). */
export interface GeoFix {
  readonly lat: number;
  readonly lon: number;
  readonly accuracyM: number;
  readonly at: number;
}

/** Codes d'erreur, sans aucune valeur : `denied` (permission retirée), `unavailable` (pas de signal ou service coupé). */
export type GeoErrorCode = 'denied' | 'unavailable';

export type GeoEvent = { readonly kind: 'fix'; readonly fix: GeoFix } | { readonly kind: 'error'; readonly code: GeoErrorCode };

export interface Geolocation {
  /** Faux : pas de GPS sur cet appareil (PC, navigateur) ; aucun bouton GPS n'est montré. */
  readonly available: boolean;
  permission(): Promise<GeoPermission>;
  /** Demande « pendant l'utilisation de l'app » (jamais « toujours ») ; rend l'état obtenu. */
  request(): Promise<GeoPermission>;
  /** Suit la position au premier plan ; rend la fonction d'arrêt. */
  watch(onEvent: (event: GeoEvent) => void): Promise<() => Promise<void>>;
}
