import { afterEach, describe, expect, it, vi } from 'vitest';
import { layoutFor, setDesktopLayout } from './useLayout';

/**
 * BL-119 (décision d'Ali du 21/11, D-450, D-459) : au zoom Windows de 150 %, le PC garde sa disposition PC, jamais celle de l'iPhone :
 * sur un PC Windows, la disposition est 'pc' à toute largeur effective (853, 911, 1 280 px CSS) ; ailleurs, la rupture de 1 024 px reste.
 */
afterEach(() => {
  setDesktopLayout(false);
  vi.unstubAllGlobals();
});

describe('layoutFor (BL-119)', () => {
  it('PC Windows : disposition PC aux largeurs effectives du zoom de 150 %', () => {
    for (const width of [853, 911, 1280, 1440]) expect(layoutFor(width, true), String(width)).toBe('pc');
  });

  it('iPhone et navigateur : rupture de 1 024 px inchangée', () => {
    expect(layoutFor(440, false)).toBe('mobile');
    expect(layoutFor(1023, false)).toBe('mobile');
    expect(layoutFor(1024, false)).toBe('pc');
  });

  it('setDesktopLayout(true) : le relevé courant reste PC sous 1 024 px', async () => {
    vi.stubGlobal('window', { innerWidth: 853, matchMedia: (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }) });
    const { currentLayout } = await import('./useLayout');
    expect(currentLayout()).toBe('mobile');
    setDesktopLayout(true);
    expect(currentLayout()).toBe('pc');
  });
});
