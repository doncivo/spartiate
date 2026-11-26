import { describe, expect, it, vi } from 'vitest';
import type { AppContainer } from '../app/container';
import { announceLocalChanges } from '../sync/remoteChanges';
import { startSupplementReminders } from './supplementWake';

/** CORPS-0301d (BL-180) : le passage par défaut replanifie aussi le rappel des mesures, et un lot qui touche `measurement` le relance. */
const calls: string[] = [];
vi.mock('./index', () => ({
  supplementNotificationsFor: () => ({ replan: async () => void calls.push('supplement') }),
  injuryNotificationsFor: () => ({ replan: async () => void calls.push('injury') }),
  measurementNotificationsFor: () => ({ replan: async () => void calls.push('measurement') }),
}));

describe('startSupplementReminders : rappel des mesures', () => {
  it('à l’ouverture puis après un lot qui touche les mesures', async () => {
    const doc = { visibilityState: 'visible', addEventListener: () => undefined, removeEventListener: () => undefined };
    const stop = startSupplementReminders({} as AppContainer, { document: doc as unknown as Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>, actions: null });
    await vi.waitFor(() => expect([...calls].sort()).toEqual(['injury', 'measurement', 'supplement']));
    calls.length = 0;
    announceLocalChanges(['measurement']);
    await vi.waitFor(() => expect(calls).toContain('measurement'));
    stop();
  });
});
