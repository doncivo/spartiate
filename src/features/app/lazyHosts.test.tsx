import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShortcutsHelp, UpdateBanner } from './lazyScreens';

/**
 * BUNDLE-01 (critères 10 et 15) : le bloc d'un hôte de la coquille ou de la fiche de tâche est illisible : message et « Réessayer » de la
 * frontière d'erreur, échec journalisé `screen-load`, jamais un hôte absent sans trace. Les deux modules sont remplacés par des chargements
 * qui échouent (vi.mock, hissé : fabriques en ligne) ; les composants paresseux testés sont ceux d'App.tsx.
 */
vi.mock('../shortcuts/ShortcutsHelp', () => Promise.reject(new Error('bloc illisible')));
vi.mock('../updater/UpdateBanner', () => Promise.reject(new Error('bloc illisible')));

describe('hôtes à la demande : bloc illisible', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ['ShortcutsHelp', ShortcutsHelp],
    ['UpdateBanner', UpdateBanner],
  ])('%s : message, « Réessayer », puis « Recharger », échec journalisé', async (_name, Host) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { unmount } = render(<Host />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible d’afficher cet écran.');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[desktop:screen-load]'));
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('button', { name: 'Recharger' })).toBeInTheDocument();
    unmount();
  });
});
