import type { HealthKit } from './types';

/** Le service Santé n'est pas applicable hors de l'app iPhone native. */
export const unsupportedHealthKit: HealthKit = {
  availability: async () => 'unsupported',
  requestAuthorization: async () => 'unsupported',
  bodyMassToday: async () => ({ state: 'unsupported' }),
  stepCountToday: async () => ({ state: 'unsupported' }),
};
