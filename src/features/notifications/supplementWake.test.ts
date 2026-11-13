import { describe, expect, it } from 'vitest';
import { ALL_DAYS, type Supplement } from '../../domain/nutrition/supplements';
import type { LocalDate, LocalTime } from '../../domain/types';
import { createFakeNotificationActionSource } from '../../platform/notifications';
import { applyRemoteChanges } from '../sync/remoteChanges';
import type { AppContainer } from '../app/container';
import { useNoticeStore } from '../app/notice';
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
    const stop = startSupplementReminders({} as AppContainer, { document: doc as unknown as Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>, replan: async () => void (calls += 1), actions: null });
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

  it('FIX-0221 : action « Pris » reçue (réveil du plugin) → prise cochée par le dépôt, bandeau de confirmation, rappels replanifiés', async () => {
    const doc = fakeDocument();
    const source = createFakeNotificationActionSource();
    const D = '2026-11-13' as LocalDate;
    const T = '08:00' as LocalTime;
    const sup: Supplement = { id: '30000000-0000-4000-8000-000000000001', name: 'Créatine', dose: null, unit: null, times: [T], days: ALL_DAYS, active: true, since: '2026-11-01' as LocalDate };
    const writes: string[] = [];
    const store = new Map<string, unknown>();
    const container = {
      platform: { runtime: 'tauri', os: 'ios' },
      notificationClock: { nowMs: () => Date.parse('2026-11-13T07:30:00Z'), zone: () => 'Europe/Paris' },
      data: {
        repos: {
          settings: { get: async (key: string) => store.get(key) ?? null, set: async (key: string, value: unknown) => void store.set(key, value) },
          supplements: async () => ({ list: async () => [sup], intakes: async () => [], setTaken: async (id: string, day: string, moment: string, taken: boolean) => void writes.push(`${id}|${day}|${moment}|${String(taken)}`) }),
        },
      },
    } as unknown as AppContainer;
    let replans = 0;
    useNoticeStore.getState().clear();
    const stop = startSupplementReminders(container, { document: doc as unknown as Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>, replan: async () => void (replans += 1), actions: source });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(source.registered.map((t) => t.id)).toEqual(['sp.supplement']);
    const before = replans;
    source.push({ numericId: 70001, actionId: 'done', receivedAtMs: Date.parse('2026-11-13T07:01:00Z'), sid: `supplement:${D}T${T}`, deliveredAt: Date.parse('2026-11-13T07:00:00Z') });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(writes).toEqual([`${sup.id}|${D}|${T}|true`]);
    expect(useNoticeStore.getState().notice?.text).toBe('Prise cochée depuis la notification.');
    expect(replans).toBeGreaterThan(before);
    expect(source.file).toEqual([]);
    stop();
  });
});
