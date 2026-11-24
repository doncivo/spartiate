import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';

/** C-101 (§ 18.3) : l'interrupteur des rappels ne reste jamais muet quand l'écriture échoue. */
const DEVICE = '60000000-0000-4000-8000-0000000000e8' as DeviceId;
vi.mock('../../notifications', () => ({
  supplementNotificationsFor: () => ({
    readPrefs: () => Promise.resolve({ enabled: false }),
    replan: () => Promise.resolve({ status: 'scheduled' }),
    requestPermissionAndReplan: () => Promise.reject(new Error('refusé')),
  }),
}));
vi.mock('../../../platform/desktop/log', async (importOriginal) => ({ ...(await importOriginal<object>()), logFailure: vi.fn() }));

let db: TestDb;
beforeEach(async () => {
  db = await openBaseDb(DEVICE, '2026-11-13T06:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('C-101 : rappels des compléments', () => {
  it('échec du changement : message dit, interrupteur resté sur l’état réel', async () => {
    const { SupplementsView } = await import('./SupplementsView');
    render(
      <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
        <SupplementsView today={'2026-11-13' as LocalDate} />
      </AppContainerProvider>,
    );
    const toggle = await screen.findByRole('switch', { name: 'Rappels sur cet iPhone' });
    fireEvent.click(toggle);
    expect(await screen.findByRole('alert')).toHaveTextContent('Les rappels n’ont pas pu être modifiés.');
    expect(screen.getByRole('switch', { name: 'Rappels sur cet iPhone' })).toHaveAttribute('aria-checked', 'false');
  });
});
