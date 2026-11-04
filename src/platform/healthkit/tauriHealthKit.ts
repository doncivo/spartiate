import {
  isHealthKitAvailability,
  isHealthKitBodyMass,
  isHealthKitPermission,
  isHealthKitStepCount,
  readResult,
} from './validation';
import type { HealthKit, HealthKitAvailability, HealthKitPermission, HealthKitRead, HealthKitBodyMass, HealthKitStepCount } from './types';

export type HealthKitInvoker = (command: string) => Promise<unknown>;

const STATUS_COMMAND = 'healthkit_status';
const AUTHORIZE_COMMAND = 'healthkit_authorize';
const BODY_MASS_COMMAND = 'healthkit_body_mass_today';
const STEP_COUNT_COMMAND = 'healthkit_step_count_today';

function codeOf(error: unknown): string | undefined {
  if (typeof error === 'string' && /^[a-z0-9-]{1,60}$/.test(error)) return error;
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = error.code;
    if (typeof code === 'string' && /^[a-z0-9-]{1,60}$/.test(code)) return code;
  }
  return undefined;
}

function defaultInvoker(): HealthKitInvoker {
  return async (command) => {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke(command);
  };
}

export function createTauriHealthKit(options: { readonly invoke?: HealthKitInvoker } = {}): HealthKit {
  const invoke = options.invoke ?? defaultInvoker();

  return {
    async availability(): Promise<HealthKitAvailability> {
      try {
        const result = await invoke(STATUS_COMMAND);
        if (typeof result === 'object' && result !== null && 'available' in result) {
          const availability = result.available === true ? 'available' : result.available === false ? 'unavailable' : 'error';
          return isHealthKitAvailability(availability) ? availability : 'error';
        }
        return 'error';
      } catch (error) {
        return codeOf(error) === 'healthkit-unavailable' ? 'unavailable' : 'error';
      }
    },

    async requestAuthorization(): Promise<HealthKitPermission> {
      try {
        const result = await invoke(AUTHORIZE_COMMAND);
        if (typeof result !== 'object' || result === null || !('permission' in result)) return 'error';
        if (!isHealthKitPermission(result.permission) || result.permission === 'granted') return 'error';
        return result.permission;
      } catch (error) {
        const code = codeOf(error);
        if (code === 'healthkit-denied') return 'denied';
        if (code === 'healthkit-unavailable') return 'unavailable';
        return 'error';
      }
    },

    async bodyMassToday(): Promise<HealthKitRead<HealthKitBodyMass>> {
      try {
        return readResult(await invoke(BODY_MASS_COMMAND), isHealthKitBodyMass);
      } catch (error) {
        return readError(error, 'healthkit-body-mass-failed');
      }
    },

    async stepCountToday(): Promise<HealthKitRead<HealthKitStepCount>> {
      try {
        return readResult(await invoke(STEP_COUNT_COMMAND), isHealthKitStepCount);
      } catch (error) {
        return readError(error, 'healthkit-step-count-failed');
      }
    },
  };
}

function readError(error: unknown, fallbackCode: string): HealthKitRead<never> {
  const code = codeOf(error);
  if (code === 'healthkit-denied') return { state: 'denied' };
  if (code === 'healthkit-unavailable') return { state: 'unavailable' };
  return { state: 'error', code: code ?? fallbackCode };
}
