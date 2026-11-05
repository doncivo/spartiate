import { describe, expect, it, vi } from 'vitest';
import type { Clock } from '../domain/clock';
import type { SyncReason } from '../platform/sync/types';
import { startSyncScheduler, SYNC_POLL_MS } from './scheduler';

/**
 * 0.1.3 (k), SPA-008 : une pesée saisie sur l'iPhone doit arriver sur le PC en moins de 60 s, sans toucher aux invariants de la synchro.
 * Synchro peu après une écriture locale publiable (regroupement de quelques secondes) ; interrogation toutes les 20 à 30 s quand l'app
 * est visible au premier plan, jamais en arrière-plan ; synchro au retour au premier plan. Horloge et minuteur contrôlés.
 */
function rig(options: { readonly ios?: boolean } = {}) {
  let now = 1_000_000;
  let visibility: 'visible' | 'hidden' = 'visible';
  const listeners = new Set<() => void>();
  const writes = new Set<() => void>();
  let poll: (() => void) | undefined;
  const calls: SyncReason[] = [];
  const clock = { nowMs: () => now } as unknown as Clock;
  const service = { syncNow: vi.fn((reason: SyncReason) => (calls.push(reason), Promise.resolve())) };
  const scheduler = startSyncScheduler(service, {
    document: {
      get visibilityState() {
        return visibility;
      },
      addEventListener: (_: string, listener: () => void) => void listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => void listeners.delete(listener),
    } as unknown as Document,
    clock,
    setInterval: (handler) => ((poll = handler), 1),
    clearInterval: () => undefined,
    localWrites: (listener) => (writes.add(listener), () => writes.delete(listener)),
    ...(options.ios ? { hideDeadlineMs: 25_000 } : {}),
  });
  const advance = async (ms: number): Promise<void> => {
    // Le minuteur sonde toutes les SYNC_POLL_MS ; l'horloge injectée décide.
    const end = now + ms;
    while (now < end) {
      now = Math.min(end, now + SYNC_POLL_MS);
      poll?.();
      await Promise.resolve();
      await Promise.resolve();
    }
  };
  return {
    calls,
    scheduler,
    advance,
    tickClock: (ms: number) => void (now += ms),
    localWrite: () => writes.forEach((listener) => listener()),
    setVisibility: (value: 'visible' | 'hidden') => {
      visibility = value;
      listeners.forEach((listener) => listener());
    },
    reset: () => void calls.splice(0),
  };
}

describe('planificateur de synchro : latence moins de 60 s (0.1.3 k)', () => {
  it('le sondage est assez fin pour une échéance de 20 à 30 s', () => {
    expect(SYNC_POLL_MS).toBeLessThanOrEqual(10_000);
  });

  it('premier plan : pas de cycle avant 20 s, un cycle au plus 30 s après le précédent', async () => {
    const r = rig();
    await r.advance(0);
    r.reset();
    await r.advance(15_000);
    expect(r.calls).toEqual([]);
    await r.advance(15_000);
    expect(r.calls).toEqual(['timer']);
  });

  it('premier plan : le rythme se maintient (un cycle toutes les 20 à 30 s)', async () => {
    const r = rig();
    r.reset();
    await r.advance(120_000);
    expect(r.calls.length).toBeGreaterThanOrEqual(4);
    expect(r.calls.length).toBeLessThanOrEqual(6);
  });

  it('écriture locale : un cycle quelques secondes après, regroupé (plusieurs écritures = un cycle)', async () => {
    const r = rig();
    await r.advance(1_000);
    r.reset();
    r.localWrite();
    await r.advance(1_000);
    r.localWrite();
    await r.advance(1_000);
    r.localWrite();
    expect(r.calls).toEqual([]);
    await r.advance(8_000);
    expect(r.calls).toEqual(['timer']);
    await r.advance(5_000);
    expect(r.calls).toEqual(['timer']);
  });

  it('écriture locale : le regroupement est borné (rafale continue : un cycle quand même)', async () => {
    const r = rig();
    r.reset();
    for (let i = 0; i < 14; i += 1) {
      r.localWrite();
      await r.advance(1_000);
    }
    expect(r.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('arrière-plan : aucun cycle périodique ni cycle d’écriture (invariant : jamais en arrière-plan)', async () => {
    const r = rig();
    r.setVisibility('hidden');
    await Promise.resolve();
    r.reset();
    r.localWrite();
    await r.advance(10 * 60_000);
    expect(r.calls).toEqual([]);
  });

  it('retour au premier plan : un cycle tout de suite (PC et iPhone)', async () => {
    for (const ios of [false, true]) {
      const r = rig({ ios });
      await r.advance(2_000);
      r.setVisibility('hidden');
      await r.advance(60_000);
      r.reset();
      r.setVisibility('visible');
      await Promise.resolve();
      expect(r.calls.length, ios ? 'iPhone' : 'PC').toBe(1);
    }
  });

  it('retour au premier plan : pas de rafale si la bascule se répète en quelques secondes', async () => {
    const r = rig();
    r.setVisibility('hidden');
    await r.advance(30_000);
    r.reset();
    r.setVisibility('visible');
    r.setVisibility('hidden');
    r.setVisibility('visible');
    await Promise.resolve();
    expect(r.calls.filter((c) => c === 'open' || c === 'timer')).toHaveLength(1);
  });

  it('en pause (restauration) : aucune synchro, même après une écriture', async () => {
    const r = rig();
    r.scheduler.pause();
    r.reset();
    r.localWrite();
    await r.advance(60_000);
    expect(r.calls).toEqual([]);
  });

  it('après dispose : l’écoute des écritures est retirée', async () => {
    const r = rig();
    r.scheduler.dispose();
    r.reset();
    r.localWrite();
    await r.advance(60_000);
    expect(r.calls).toEqual([]);
  });
});
