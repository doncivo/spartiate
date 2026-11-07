import { describe, expect, it, vi } from 'vitest';
import type { Clock } from '../domain/clock';
import type { SyncReason } from '../platform/sync/types';
import { PENDING_RETRY_MAX, PENDING_RETRY_MS, startSyncScheduler, SYNC_FOREGROUND_INTERVAL_MS, SYNC_POLL_MS } from './scheduler';

/**
 * 0.2.4 point 5 : quand le scan trouve un fichier iCloud pas encore téléchargé, un nouveau cycle 10 s plus tard au lieu d'attendre
 * l'échéance normale (25 s) ; borné à 3 essais rapprochés, puis rythme normal.
 */
function rig(pending: () => number) {
  let now = 1_000_000;
  let poll: (() => void) | undefined;
  const calls: { reason: SyncReason; at: number }[] = [];
  const clock = { nowMs: () => now } as unknown as Clock;
  const service = {
    syncNow: vi.fn((reason: SyncReason) => (calls.push({ reason, at: now }), Promise.resolve())),
    status: () => ({ phase: 'idle', pendingFiles: Array.from({ length: pending() }, (_, i) => `f${String(i)}`) }) as never,
  };
  const scheduler = startSyncScheduler(service, {
    document: { visibilityState: 'visible', addEventListener: () => undefined, removeEventListener: () => undefined } as unknown as Document,
    clock,
    setInterval: (handler) => ((poll = handler), 1),
    clearInterval: () => undefined,
  });
  const advance = async (ms: number): Promise<void> => {
    const end = now + ms;
    while (now < end) {
      now = Math.min(end, now + SYNC_POLL_MS);
      poll?.();
      for (let i = 0; i < 6; i += 1) await Promise.resolve();
    }
  };
  return { calls, advance, scheduler, start: () => now };
}

describe('planificateur : fichiers iCloud attendus', () => {
  it('constantes : 10 s, 3 essais, plus court que l’échéance normale', () => {
    expect(PENDING_RETRY_MS).toBe(10_000);
    expect(PENDING_RETRY_MAX).toBe(3);
    expect(PENDING_RETRY_MS).toBeLessThan(SYNC_FOREGROUND_INTERVAL_MS);
  });

  it('fichier attendu : nouveau cycle 10 s après le cycle d’ouverture, puis deux autres, puis le rythme normal', async () => {
    const r = rig(() => 2);
    await r.advance(0);
    const open = r.calls.length;
    expect(open).toBe(1);
    await r.advance(5_000);
    expect(r.calls).toHaveLength(open);
    await r.advance(5_000);
    expect(r.calls).toHaveLength(open + 1);
    await r.advance(10_000);
    await r.advance(10_000);
    expect(r.calls).toHaveLength(open + 3);
    // Quatrième essai : plus d’essai rapproché ; le cycle normal vient à 25 s du dernier.
    await r.advance(20_000);
    expect(r.calls).toHaveLength(open + 3);
    await r.advance(10_000);
    expect(r.calls.length).toBeGreaterThanOrEqual(open + 4);
  });

  it('rien d’attendu : pas d’essai rapproché, rythme normal de 25 s', async () => {
    const r = rig(() => 0);
    await r.advance(0);
    await r.advance(20_000);
    expect(r.calls).toHaveLength(1);
    await r.advance(10_000);
    expect(r.calls).toHaveLength(2);
  });

  it('le compteur repart quand les fichiers sont arrivés', async () => {
    let waiting = 1;
    const r = rig(() => waiting);
    await r.advance(0);
    await r.advance(10_000);
    await r.advance(10_000);
    await r.advance(10_000);
    const before = r.calls.length;
    waiting = 0;
    await r.advance(25_000);
    waiting = 1;
    await r.advance(25_000);
    const afterArrival = r.calls.length;
    expect(afterArrival).toBeGreaterThan(before);
    await r.advance(10_000);
    expect(r.calls.length).toBe(afterArrival + 1);
  });
});
