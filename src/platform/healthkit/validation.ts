import type {
  HealthKitAvailability,
  HealthKitBodyMass,
  HealthKitDiagnostic,
  HealthKitNativeError,
  HealthKitPermission,
  HealthKitRead,
  HealthKitSource,
  HealthKitStepCount,
} from './types';

export function isHealthKitAvailability(value: unknown): value is HealthKitAvailability {
  return value === 'available' || value === 'unavailable' || value === 'unsupported' || value === 'error';
}

export function isHealthKitPermission(value: unknown): value is HealthKitPermission {
  return value === 'unknown' || value === 'denied' || value === 'granted' || value === 'unavailable' || value === 'unsupported' || value === 'error';
}

export function readResult<T>(value: unknown, isValue: (candidate: unknown) => candidate is T): HealthKitRead<T> {
  if (typeof value !== 'object' || value === null || !('state' in value)) return { state: 'error' };
  const result = value as { state: unknown; value?: unknown; code?: unknown };
  if (result.state === 'granted' && isValue(result.value)) return { state: 'granted', value: result.value };
  if (result.state === 'empty' || result.state === 'denied' || result.state === 'unavailable' || result.state === 'unsupported') {
    return { state: result.state };
  }
  if (result.state === 'error') {
    const code = typeof result.code === 'string' && /^[a-z0-9-]{1,60}$/.test(result.code) ? result.code : undefined;
    return { state: 'error', ...(code ? { code } : {}) };
  }
  return { state: 'error' };
}

export function isHealthKitBodyMass(value: unknown): value is HealthKitBodyMass {
  if (typeof value !== 'object' || value === null) return false;
  const sample = value as Record<string, unknown>;
  return (
    typeof sample.kg === 'number' &&
    Number.isFinite(sample.kg) &&
    typeof sample.measuredAt === 'string' &&
    Number.isFinite(Date.parse(sample.measuredAt)) &&
    typeof sample.timezone === 'string' &&
    sample.timezone.length > 0 &&
    typeof sample.uuid === 'string' &&
    sample.uuid.length > 0 &&
    isHealthKitSource(sample.source)
  );
}

export function isHealthKitStepCount(value: unknown): value is HealthKitStepCount {
  if (typeof value !== 'object' || value === null) return false;
  const total = value as Record<string, unknown>;
  return (
    typeof total.count === 'number' &&
    Number.isFinite(total.count) &&
    total.count >= 0 &&
    total.unit === 'count' &&
    typeof total.start === 'string' &&
    Number.isFinite(Date.parse(total.start)) &&
    typeof total.end === 'string' &&
    Number.isFinite(Date.parse(total.end)) &&
    Date.parse(total.start) < Date.parse(total.end) &&
    typeof total.timezone === 'string' &&
    total.timezone.length > 0 &&
    Array.isArray(total.sources) &&
    total.sources.every(isHealthKitSource)
  );
}

function isHealthKitSource(value: unknown): value is HealthKitSource {
  if (typeof value !== 'object' || value === null) return false;
  const source = value as Record<string, unknown>;
  return typeof source.name === 'string' && typeof source.bundleIdentifier === 'string';
}

const MAX_DESCRIPTION = 200;

function nativeErrorOf(value: unknown): HealthKitNativeError | null {
  if (typeof value !== 'object' || value === null) return null;
  const error = value as Record<string, unknown>;
  if (typeof error.domain !== 'string' || error.domain.length === 0 || typeof error.code !== 'number' || !Number.isInteger(error.code)) return null;
  const description = typeof error.description === 'string' ? error.description.slice(0, MAX_DESCRIPTION) : '';
  return { domain: error.domain.slice(0, 120), code: error.code, description };
}

/** Lit la réponse de `healthkit_status` ; tout champ absent ou mal formé reste inconnu (null). */
export function parseHealthKitDiagnostic(value: unknown): HealthKitDiagnostic {
  if (typeof value !== 'object' || value === null) return UNKNOWN_DIAGNOSTIC;
  const status = value as Record<string, unknown>;
  return {
    available: typeof status.available === 'boolean' ? status.available : null,
    usageDescription: typeof status.usageDescription === 'boolean' ? status.usageDescription : null,
    error: nativeErrorOf(status.lastError),
  };
}

export const UNKNOWN_DIAGNOSTIC: HealthKitDiagnostic = { available: null, usageDescription: null, error: null };
