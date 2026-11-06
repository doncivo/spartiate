import type { LiveActivity } from './types';

/** PC, navigateur, tests : pas de Live Activity, aucune erreur. */
export const unsupportedLiveActivity: LiveActivity = {
  isAvailable: async () => ({ available: false, reason: 'unsupported', error: null }),
  start: async () => ({ started: false, reason: 'unsupported', error: null }),
  end: async () => ({ ended: true, count: 0 }),
};
