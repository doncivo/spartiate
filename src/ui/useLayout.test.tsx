import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PC_MEDIA_QUERY, PC_MIN_WIDTH_PX, useLayout } from './useLayout';

/** SPA-009 critère 1 : la rupture est à 1 024 px (D-47), les mêmes composants changent de coquille de part et d'autre. */
function viewport(width: number): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === PC_MEDIA_QUERY && width >= PC_MIN_WIDTH_PX,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe('useLayout : frontière 1 023 / 1 024', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rupture déclarée à 1 024 px', () => {
    expect(PC_MIN_WIDTH_PX).toBe(1024);
    expect(PC_MEDIA_QUERY).toBe('(min-width: 1024px)');
  });

  it.each([
    [440, 'mobile'],
    [1023, 'mobile'],
    [1024, 'pc'],
    [1440, 'pc'],
  ] as const)('%i px → %s', (width, expected) => {
    viewport(width);
    expect(renderHook(() => useLayout()).result.current).toBe(expected);
  });
});
