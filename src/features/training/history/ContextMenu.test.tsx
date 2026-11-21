import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { seedPastWorkout } from '../../../../tests/fixtures/training/workout';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';

/** COQUILLE-PC-a (§ 18.1, C-192) : clic droit et double-clic sur une séance de l'historique (jsdom : mise en page PC). */
const DEVICE = '60000000-0000-4000-8000-0000000000f2' as DeviceId;
let db: TestDb;
const show = () => {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'history' } as Route));
  const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
  return render(
    <AppContainerProvider container={container}>
      <TrainingScreen />
    </AppContainerProvider>,
  );
};
const firstRow = async (): Promise<HTMLElement> => {
  const list = await screen.findByRole('list', { name: 'Séances terminées' });
  const row = list.querySelector('button');
  if (!row) throw new Error('ligne introuvable');
  return row;
};

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T17:00:00.000Z');
  await seedPastWorkout(db.driver);
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('historique : menu contextuel d’une séance', () => {
  it('clic droit : « Ouvrir » ouvre le détail, comme le clic', async () => {
    show();
    fireEvent.contextMenu(await firstRow());
    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(1);
    fireEvent.click(items[0] as HTMLElement);
    expect(await screen.findByRole('region', { name: 'Détail de la séance' })).toBeInTheDocument();
  });

  it('double-clic : ouvre aussi le détail', async () => {
    show();
    fireEvent.doubleClick(await firstRow());
    expect(await screen.findByRole('region', { name: 'Détail de la séance' })).toBeInTheDocument();
  });
});
