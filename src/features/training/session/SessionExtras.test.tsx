import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { RoutineInput } from '../../../domain/training';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { tSession } from '../../../i18n/trainingSessionText';
import { tTrainingMedia } from '../../../i18n/trainingMediaText';
import { tTraining } from '../../../i18n/trainingText';
import type { LiveActivity } from '../../../platform/liveActivity';
import type { TimerNotifier } from '../../../platform/notifications/timerNotification';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';

/**
 * SESS-01c (§ 13.2) : image et notes (consignes) de l'exercice dans son bloc, type de série « Échec » (série de travail à RIR 0, aucune migration),
 * calculateur de disques par côté (barre du profil réglable, disques du profil actif, sinon jeu standard).
 */

const DEVICE = '60000000-0000-4000-8000-0000000000f5' as DeviceId;
const u = (n: number): string => `5e5a0501-0000-4000-8000-${String(n).padStart(12, '0')}`;
const BENCH = 'Développé couché à la barre';
const ROUTINE: RoutineInput = {
  id: u(1),
  name: 'Haut',
  mode: 'programme',
  days: [{ id: u(2), name: 'Haut A', dayOrder: 1, exercises: [{ id: u(3), exerciseId: 'bench-press-barbell', exerciseName: BENCH, sets: 2, repMin: 6, repMax: 10, rir: 2, restSec: 150, position: 0 }] }],
};
const notifier: TimerNotifier = { permission: async () => 'granted', requestPermission: async () => 'granted', isPending: async () => false, schedule: async () => true, cancel: async () => undefined };
const liveActivity: LiveActivity = { isAvailable: async () => ({ available: true }), start: async () => ({ started: true }), end: async () => ({ ended: true, count: 1 }) };

let db: TestDb;
const openAndStart = async (): Promise<HTMLElement> => {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'session' } as Route));
  const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
  render(
    <AppContainerProvider container={container}>
      <TrainingScreen session={{ os: 'other', notifier, liveActivity }} />
    </AppContainerProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /^Démarrer « Haut A »/ }));
  return screen.findByRole('region', { name: BENCH });
};
const plateText = (kgs: readonly string[]): string => tSession('platesSide', { plates: kgs.map((kg) => tSession('plateItem', { kg })).join(tSession('plateJoin')) });

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-21T17:00:00.000Z');
  await (await db.data.repos.trainingRoutines()).create(ROUTINE);
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('SESS-01c', () => {
  it('image de l’exercice et notes (mise en place, exécution, erreurs) dans le bloc', async () => {
    const block = await openAndStart();
    expect(await within(block).findByRole('img', { name: tTrainingMedia('mediaAlt', { name: BENCH }) })).toBeInTheDocument();
    const notes = within(block).getByText(tSession('notes'));
    expect(notes.closest('details')).not.toBeNull();
    expect(within(block).getByText(/^Prépare le matériel/)).toBeInTheDocument();
  });

  it('type « Échec » : série de travail à RIR 0, dit dans le sélecteur ; retour à « Travail » efface le RIR', async () => {
    const block = await openAndStart();
    const [first] = within(block).getAllByRole('group', { name: /^Série/ });
    if (!first) throw new Error('aucune série');
    const select = within(first).getByLabelText(tTraining('sessionSetKind'));
    expect(within(select).getByRole('option', { name: tSession('kindFailure') })).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'failure' } });
    await screen.findByDisplayValue(tSession('kindFailure'));
    expect(await db.driver.select('SELECT set_kind, rir FROM workout_set ORDER BY position LIMIT 1')).toEqual([{ set_kind: 'work', rir: 0 }]);
    fireEvent.change(within(first).getByLabelText(tTraining('sessionSetKind')), { target: { value: 'work' } });
    await screen.findAllByDisplayValue(tTraining('kindWork'));
    expect(await db.driver.select('SELECT set_kind, rir FROM workout_set ORDER BY position LIMIT 1')).toEqual([{ set_kind: 'work', rir: null }]);
  });

  it('calculateur de disques : 100 kg sur la barre olympique du profil → 30 + 10 par côté ; barre de 8 kg ; reste dit', async () => {
    const block = await openAndStart();
    fireEvent.click(within(block).getByRole('button', { name: tSession('plates') }));
    const calc = await within(block).findByRole('group', { name: tSession('platesTitle') });
    fireEvent.change(within(calc).getByLabelText(tSession('platesTotal')), { target: { value: '100' } });
    expect(within(calc).getByText(plateText(['30', '10']))).toBeInTheDocument();
    fireEvent.change(within(calc).getByLabelText(tSession('platesBar')), { target: { value: '8' } });
    expect(within(calc).getByText(plateText(['30', '15']))).toBeInTheDocument();
    expect(within(calc).getByText(tSession('platesRemainder', { loaded: '98', rest: '2' }))).toBeInTheDocument();
  });
});
