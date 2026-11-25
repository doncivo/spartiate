// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { preloadScreens } from './lazyScreens';

describe('SHELL-0294d, BL-036 : préchargement des écrans', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('le moment d’inactivité suivant n’est programmé qu’une fois le chargement en cours terminé', () => {
    vi.useFakeTimers();
    const stop = preloadScreens();
    // Premier moment d'inactivité : le premier écran commence à charger (import asynchrone, donc encore en cours à cet instant).
    vi.advanceTimersByTime(200);
    expect(vi.getTimerCount()).toBe(0);
    stop();
  });

  it('arrêt pendant un chargement en cours : aucun moment d’inactivité n’est programmé ensuite', async () => {
    vi.useFakeTimers();
    const stop = preloadScreens();
    vi.advanceTimersByTime(200);
    stop();
    expect(vi.getTimerCount()).toBe(0);
    await vi.dynamicImportSettled();
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
  });
});
