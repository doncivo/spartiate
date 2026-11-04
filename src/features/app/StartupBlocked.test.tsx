import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { StartupBlocked } from './StartupBlocked';
import { StartupWatchdog } from './StartupWatchdog';
import { createStartupTracker } from './startupSteps';

/** Écran « Démarrage bloqué » : étape nommée, « Réessayer », « Partager le journal » (feuille de partage, sans donnée personnelle). */
describe('écran « Démarrage bloqué »', () => {
  it('nomme l’étape et propose Réessayer et Partager le journal', () => {
    render(<StartupBlocked step="openSyncPlatform" seconds={9} onRetry={() => undefined} onShare={() => Promise.resolve('shared')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Démarrage bloqué : openSyncPlatform');
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Partager le journal' })).toBeVisible();
  });

  it('Réessayer appelle onRetry ; Partager appelle onShare et annonce le résultat', async () => {
    const onRetry = vi.fn();
    const onShare = vi.fn(() => Promise.resolve('shared' as const));
    render(<StartupBlocked step="x" seconds={9} onRetry={onRetry} onShare={onShare} />);
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Partager le journal' }));
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('status')).toHaveTextContent('Journal partagé.');
  });

  it('partage impossible : message clair, l’écran reste', async () => {
    render(<StartupBlocked step="x" seconds={9} onRetry={() => undefined} onShare={() => Promise.resolve('failed')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Partager le journal' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Le partage n’a pas pu s’ouvrir.');
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeVisible();
  });
});

describe('chien de garde du démarrage', () => {
  it('reste muet avant 8 secondes, puis affiche l’écran bloqué avec l’étape en cours', async () => {
    vi.useFakeTimers();
    let clock = 0;
    const tracker = createStartupTracker(() => clock, () => undefined);
    tracker.begin('bootAppLock');
    render(<StartupWatchdog tracker={tracker} now={() => clock} />);
    expect(screen.queryByRole('alert')).toBeNull();
    clock = 8500;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Démarrage bloqué : bootAppLock'));
  });
});
