import { describe, expect, it, vi } from 'vitest';
import type { AppContainer } from '../app/container';
import { startSupplementReminders } from './supplementWake';

/** BLESSURES-b : le passage par défaut des rappels replanifie aussi le check-in des gênes (même file). */
const calls: string[] = [];
vi.mock('./index', () => ({
  supplementNotificationsFor: () => ({ replan: async () => void calls.push('supplement') }),
  injuryNotificationsFor: () => ({ replan: async () => void calls.push('injury') }),
}));

describe('startSupplementReminders : replanification par défaut', () => {
  it('à l’ouverture : compléments et gênes', async () => {
    const doc = { visibilityState: 'visible', addEventListener: () => undefined, removeEventListener: () => undefined };
    const stop = startSupplementReminders({} as AppContainer, { document: doc as unknown as Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>, actions: null });
    await vi.waitFor(() => expect(calls.sort()).toEqual(['injury', 'supplement']));
    stop();
  });
});
