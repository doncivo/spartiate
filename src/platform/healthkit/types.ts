export type HealthKitAvailability = 'available' | 'unavailable' | 'unsupported' | 'error';

/** Une demande HealthKit terminée ne révèle pas à elle seule l'autorisation de lecture. */
export type HealthKitPermission = 'unknown' | 'denied' | 'granted' | 'unavailable' | 'unsupported' | 'error';

export interface HealthKitSource {
  readonly name: string;
  readonly bundleIdentifier: string;
}

export interface HealthKitBodyMass {
  readonly kg: number;
  readonly measuredAt: string;
  readonly timezone: string;
  readonly uuid: string;
  readonly source: HealthKitSource;
}

export interface HealthKitStepCount {
  readonly count: number;
  readonly unit: 'count';
  readonly start: string;
  readonly end: string;
  readonly timezone: string;
  readonly sources: readonly HealthKitSource[];
}

export type HealthKitRead<T> =
  | { readonly state: 'granted'; readonly value: T }
  | { readonly state: 'empty' | 'denied' | 'unavailable' | 'unsupported' }
  | { readonly state: 'error'; readonly code?: string };

/** Erreur native d'un NSError : domaine, code, description. Aucune donnée de santé. */
export interface HealthKitNativeError {
  readonly domain: string;
  readonly code: number;
  readonly description: string;
}

/** Diagnostic technique (0.1.3). `null` = inconnu (hors iPhone ou statut illisible), jamais une valeur inventée. */
export interface HealthKitDiagnostic {
  readonly available: boolean | null;
  /** NSHealthShareUsageDescription présente dans l'Info.plist du bundle. */
  readonly usageDescription: boolean | null;
  readonly error: HealthKitNativeError | null;
}

export interface HealthKit {
  availability(): Promise<HealthKitAvailability>;
  requestAuthorization(): Promise<HealthKitPermission>;
  bodyMassToday(): Promise<HealthKitRead<HealthKitBodyMass>>;
  stepCountToday(): Promise<HealthKitRead<HealthKitStepCount>>;
  /** Statut natif détaillé : disponibilité, texte d'usage, dernière erreur de la demande. Ne rejette jamais. */
  diagnostic(): Promise<HealthKitDiagnostic>;
}
