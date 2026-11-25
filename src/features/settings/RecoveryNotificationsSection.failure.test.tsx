import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppContainerProvider } from '../app/AppContainerContext';
import type { AppContainer } from '../app/container';
import { RecoveryNotificationsSection } from './RecoveryNotificationsSection';

const service = {
  readPrefs: vi.fn(),
  readProposal: vi.fn(),
  requestPermissionAndReplan: vi.fn(),
};
vi.mock('../notifications', () => ({ recoveryNotificationsFor: () => service }));
const logFailure = vi.fn();
vi.mock('../../platform/desktop/log', async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), logFailure: (...a: unknown[]) => logFailure(...a) }));

/** SHELL-0294d, C-129 : promesses sans catch des réglages « Sommeil et rappels » ; l'état « en cours » n'est annoncé qu'à la réponse. */
const container = { platform: { runtime: 'tauri', os: 'ios' } } as unknown as AppContainer;
const renderSection = () =>
  render(
    <AppContainerProvider container={container}>
      <RecoveryNotificationsSection />
    </AppContainerProvider>,
  );

describe('Section « Sommeil et rappels » : échecs', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('lecture des réglages en échec : message « Impossible de lire », journal, aucun rejet non géré', async () => {
    service.readPrefs.mockRejectedValue(new Error('lecture'));
    service.readProposal.mockResolvedValue(null);
    renderSection();
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de lire les réglages');
    expect(logFailure).toHaveBeenCalledWith('recovery-notifications', expect.any(Error));
  });

  it('planification qui rejette : l’interrupteur revient à son état, message d’échec, bouton libéré', async () => {
    service.readPrefs.mockResolvedValue({ bedtime: false, morning: false });
    service.readProposal.mockResolvedValue(null);
    service.requestPermissionAndReplan.mockRejectedValue(new Error('plan'));
    renderSection();
    const bedtime = await screen.findByRole('switch', { name: 'Rappel de coucher' });
    fireEvent.click(bedtime);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('n’ont pas pu être planifiées'));
    expect(screen.getByRole('switch', { name: 'Rappel de coucher' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('switch', { name: 'Rappel de coucher' })).not.toBeDisabled();
  });
});
