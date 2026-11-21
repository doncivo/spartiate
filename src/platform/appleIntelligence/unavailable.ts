import type { AppleIntelligence } from './types';

/** PC, navigateur : aucun modèle local d'Apple ; aucun appel, aucune erreur. */
export const unsupportedAppleIntelligence: AppleIntelligence = {
  probe: () => Promise.resolve({ kind: 'unsupported' }),
};
