import { describe, expect, it } from 'vitest';
import { applyRemoteChanges } from '../sync/remoteChanges';
import type { AppContainer } from '../app/container';
import { startSupplementReminders } from './supplementWake';

/** I6-05 (D-212) : replanification des rappels de compléments à l'ouverture, au retour au premier plan et après un lot reçu qui touche les compléments. */
function fakeDocument() {
  const listeners = new Set<() => void>();
  return {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
    fire() {
      for (const l of listeners) l();
    },
    listeners,
  };
}

describe('startSupplementReminders', () => {
  it('ouverture, reprise (visible seulement) et lot reçu sur supplement ou supplement_intake ; arrêt : plus rien', async () => {
    const doc = fakeDocument();
    let calls = 0;
    const stop = startSupplementReminders({} as AppContainer, { document: doc as unknown as Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>, replan: async () => void (calls += 1) });
    expect(calls).toBe(1);
    doc.fire();
    expect(calls).toBe(2);
    doc.visibilityState = 'hidden';
    doc.fire();
    expect(calls).toBe(2);
    await applyRemoteChanges({} as AppContainer, { tables: new Set(['meal_entry']) } as never);
    expect(calls).toBe(2);
    await applyRemoteChanges({} as AppContainer, { tables: new Set(['supplement_intake']) } as never);
    expect(calls).toBe(3);
    stop();
    doc.visibilityState = 'visible';
    doc.fire();
    await applyRemoteChanges({} as AppContainer, { tables: new Set(['supplement']) } as never);
    expect(calls).toBe(3);
    expect(doc.listeners.size).toBe(0);
  });
});
