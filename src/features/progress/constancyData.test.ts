import { describe, expect, it } from 'vitest';
import type { DataAccess } from '../../db/repositories/dataAccess';
import { readConstancy } from './constancyData';

/**
 * CI de PROGRES (Vitest dom 2/3, run 44876091575) : base fermée pendant la lecture de la constance. La lecture des séances ne doit jamais
 * rester sans gestionnaire pendant qu'on attend le repository des cycles : un seul rejet, rendu à l'appelant, aucun rejet non géré.
 */
describe('readConstancy : base fermée pendant la lecture', () => {
  it('rejette une fois, sans rejet non géré', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      const closed = new Error('closed');
      const access = {
        repos: {
          workouts: () => Promise.resolve({ closedStarts: () => Promise.reject(closed) }),
          mesocycles: () => new Promise((resolve) => setTimeout(() => resolve({ current: () => Promise.reject(closed) }), 20)),
          trainingRoutines: () => Promise.resolve({ get: () => Promise.resolve(null) }),
        },
      } as unknown as DataAccess;
      await expect(readConstancy(access)).rejects.toBe(closed);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
