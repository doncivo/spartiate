import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createManualClock, type ManualClock } from '../../domain/clock';
import { useLocalDay } from './ShellChrome';

/** SHELL-0294c (C-074, C-124) : le jour local est relu à minuit (et au retour au premier plan), jamais figé au premier rendu. */
describe('useLocalDay', () => {
  let clock: ManualClock;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 25, 23, 59, 30));
    clock = createManualClock(Date.now());
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  function Probe() {
    return <p data-testid="day">{useLocalDay(clock)}</p>;
  }

  it('passe au jour suivant quand minuit est franchi', () => {
    render(<Probe />);
    expect(screen.getByTestId('day')).toHaveTextContent('2026-11-25');
    act(() => {
      clock.advance(31_000);
      vi.advanceTimersByTime(31_000);
    });
    expect(screen.getByTestId('day')).toHaveTextContent('2026-11-26');
  });

  it('relit le jour au retour au premier plan (veille longue de l’appareil)', () => {
    render(<Probe />);
    act(() => {
      clock.advance(8 * 3_600_000);
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.getByTestId('day')).toHaveTextContent('2026-11-26');
  });
});
