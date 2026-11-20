import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { StartupWatchdog } from './StartupWatchdog';
import { createStartupTracker } from './startupSteps';

vi.mock('./StartupBlocked', () => {
  throw new Error('bloc illisible (synthétique)');
});

/** C-114 : si le bloc « Démarrage bloqué » ne se charge pas, un message statique remplace le rejet qui effaçait toute l'app. */
describe('« Démarrage bloqué » illisible', () => {
  it('affiche le message statique au lieu de démonter l’app', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.useFakeTimers();
    let clock = 0;
    const tracker = createStartupTracker(() => clock, () => undefined);
    tracker.begin('bootAppLock');
    render(<StartupWatchdog tracker={tracker} now={() => clock} />);
    clock = 9000;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(t('app.crashFallback')));
  });
});
