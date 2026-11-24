import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { tTraining } from '../../i18n/trainingText';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../app/navigation';
import { TrainingScreen } from './TrainingScreen';

/**
 * SEANCE-0292b (BL-111, § 14.2 b) : carte du corps de la bibliothèque. Un toucher sur une zone choisit le groupe musculaire (même filtre que
 * la liste « Groupe musculaire », qui reste la saisie accessible) ; un second toucher le retire. Les silhouettes sont masquées aux
 * technologies d'assistance, le groupe choisi est dit en texte.
 */
const DEVICE = '60000000-0000-4000-8000-0000000002c2' as DeviceId;
let db: TestDb;
const open = () => {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'library' } as Route));
  return render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <TrainingScreen />
    </AppContainerProvider>,
  );
};

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-06T08:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('BL-111 : carte du corps de la bibliothèque', () => {
  it('toucher les biceps filtre la liste sur ce groupe ; un second toucher retire le filtre', async () => {
    const { container } = open();
    await screen.findByRole('switch', { name: tTraining('compatibleOnly') });
    const map = container.querySelector('.ct-training__bodymap');
    expect(map).not.toBeNull();
    expect(map?.getAttribute('aria-hidden')).toBe('true');
    const zone = map?.querySelector('[data-group="biceps"]');
    if (!zone) throw new Error('zone absente');
    fireEvent.click(zone);
    const select = screen.getByLabelText<HTMLSelectElement>(tTraining('groupFilter'));
    expect(select.value).toBe('biceps');
    expect(zone.getAttribute('data-state')).toBe('selected');
    expect(screen.getByRole('button', { name: 'Curl à la barre' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hip thrust à la barre' })).toBeNull();
    fireEvent.click(zone);
    expect(select.value).toBe('');
    expect(zone.getAttribute('data-state')).toBe('normal');
  });
});
