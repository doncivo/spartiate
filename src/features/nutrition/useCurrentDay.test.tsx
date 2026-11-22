import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createManualClock } from '../../domain/clock';
import { useCurrentDay } from './useCurrentDay';

/**
 * BL-103 (revue FIX-SAISIE-NUTRI) : minuteur de minuit de `useCurrentDay` en fausses horloges, et démontage sans fuite (ni minuteur ni
 * écouteur restants). Heures locales construites par `new Date(a, m, j, h)` : le test vaut dans tout fuseau.
 */
const local = (d: number, h: number, m = 0): number => new Date(2026, 10, d, h, m, 0, 0).getTime();

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useCurrentDay', () => {
  it('à 23:59 le 18, puis minuit passé : le jour devient le 19 sans action (minuteur), puis le 20 le lendemain (réarmé)', () => {
    vi.setSystemTime(local(18, 23, 59));
    const clock = createManualClock(local(18, 23, 59));
    const { result } = renderHook(() => useCurrentDay(clock));
    expect(result.current).toBe('2026-11-18');
    act(() => {
      clock.set(local(19, 0, 1));
      vi.advanceTimersByTime(2 * 60_000);
    });
    expect(result.current).toBe('2026-11-19');
    act(() => {
      clock.set(local(20, 0, 1));
      vi.advanceTimersByTime(24 * 60 * 60_000 + 2_000);
    });
    expect(result.current).toBe('2026-11-20');
  });

  it('démontage : aucun minuteur ni écouteur ne reste', () => {
    vi.setSystemTime(local(18, 12));
    const clock = createManualClock(local(18, 12));
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useCurrentDay(clock));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    const added = add.mock.calls.filter(([type]) => type === 'focus').length;
    const removed = remove.mock.calls.filter(([type]) => type === 'focus').length;
    expect(removed).toBe(added);
    add.mockRestore();
    remove.mockRestore();
  });
});
