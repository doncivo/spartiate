/**
 * Live Activity du compteur (SPA-007, H-4). iPhone seulement : sur PC et dans le navigateur, le stub répond « non disponible » sans erreur.
 * Une erreur native d'ActivityKit remonte en clair (domaine, code, description), jamais perdue (même principe que le diagnostic Santé 0.1.3).
 */

/** Pourquoi la Live Activity n'est pas disponible. `disabled` : coupée dans Réglages, ou clé / extension absente. */
export type LiveActivityReason = 'unsupported' | 'disabled' | 'unknown';

export interface LiveActivityNativeError {
  readonly domain: string;
  readonly code: number;
  readonly description: string;
}

export type LiveActivityAvailability =
  | { readonly available: true }
  | { readonly available: false; readonly reason: LiveActivityReason; readonly error: LiveActivityNativeError | null };

export interface LiveActivityStartInput {
  /** Fin du compteur, ms depuis 1970 (UTC). */
  readonly endDateMs: number;
  readonly label: string;
  /** Texte de l'état final (« Terminé »), rendu par le widget quand l'activité est périmée. */
  readonly finishedLabel?: string;
}

export type LiveActivityStart =
  | { readonly started: true }
  | { readonly started: false; readonly reason: LiveActivityReason | 'failed'; readonly error: LiveActivityNativeError | null };

export type LiveActivityEnd = { readonly ended: true; readonly count: number } | { readonly ended: false; readonly error: LiveActivityNativeError | null };

export interface LiveActivity {
  isAvailable(): Promise<LiveActivityAvailability>;
  /** Ne rejette jamais. */
  start(input: LiveActivityStartInput): Promise<LiveActivityStart>;
  /** Ferme toutes les activités du compteur sans délai. Ne rejette jamais. */
  end(): Promise<LiveActivityEnd>;
}
