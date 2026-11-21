import type { AppleIntelligence, AppleIntelligenceResult } from './types';

export interface FakeAppleIntelligence extends AppleIntelligence {
  /** Nombre d'essais lancés. */
  calls(): number;
}

/** Faux pour les tests : rend les résultats programmés dans l'ordre, puis `unsupported`. */
export function createFakeAppleIntelligence(results: readonly AppleIntelligenceResult[] = []): FakeAppleIntelligence {
  const queue = [...results];
  let count = 0;
  return {
    probe: () => {
      count += 1;
      return Promise.resolve(queue.shift() ?? { kind: 'unsupported' });
    },
    calls: () => count,
  };
}
