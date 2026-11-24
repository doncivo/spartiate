import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import type { LiveActivity } from '../../../platform/liveActivity';
import type { TimerNotifier } from '../../../platform/notifications/timerNotification';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { loadTrainingContent } from '../content';
import { TrainingScreen } from '../TrainingScreen';

/** SEANCE-0292 (C-078) : saisie d’une série non validée gardée en base (séance ouverte, jamais publiée) ; relue si la WebView est tuée. */
const DEVICE = '60000000-0000-4000-8000-0000000000f8' as DeviceId;
const W = '2b4c6d8e-0000-4000-8000-000000000078';
const notifier: TimerNotifier = { permission: async () => 'granted', requestPermission: async () => 'granted', isPending: async () => false, schedule: async () => true, cancel: async () => undefined };
const liveActivity: LiveActivity = { isAvailable: async () => ({ available: false }) as never, start: async () => ({ started: false }) as never, end: async () => ({ ended: true, count: 0 }) };

let db: TestDb;
const open = (screenId: 'session' | 'routines' | 'equipment') => {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: screenId } as Route));
  return render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <TrainingScreen session={{ os: 'other', notifier, liveActivity }} />
    </AppContainerProvider>,
  );
};

beforeAll(async () => {
  await loadTrainingContent();
});
beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-20T17:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('C-078 : saisie non validée', () => {
  it('charge et répétitions tapées sans valider : gardées après fermeture et réouverture de l’écran, la série reste à faire', async () => {
    const r = await db.data.repos.workouts();
    await r.start({ source: 'empty', id: W, name: 'Séance' });
    await r.addExercise(W, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché à la barre', sets: 2, targetRepsMin: 8, targetRepsMax: 10 });
    open('session');
    const region = await screen.findByRole('region', { name: 'Développé couché à la barre' });
    const [first] = within(region).getAllByRole('group', { name: /^Série \d+$/ });
    if (!first) throw new Error('série absente');
    const load = within(first).getByLabelText('Charge (kg)');
    fireEvent.change(load, { target: { value: '77,5' } });
    fireEvent.blur(load);
    const reps = within(first).getByLabelText('Répétitions');
    fireEvent.change(reps, { target: { value: '9' } });
    fireEvent.blur(reps);
    await waitFor(async () => expect(await db.driver.select(`SELECT load_kg, reps, done FROM workout_set WHERE workout_id = '${W}' ORDER BY position LIMIT 1`)).toEqual([{ load_kg: 77.5, reps: 9, done: 0 }]));
    cleanup();
    open('session');
    const again = await screen.findByRole('region', { name: 'Développé couché à la barre' });
    const [row] = within(again).getAllByRole('group', { name: /^Série \d+$/ });
    if (!row) throw new Error('série absente');
    expect(within(row).getByLabelText('Charge (kg)')).toHaveValue('77,5');
    expect(within(row).getByLabelText('Répétitions')).toHaveValue('9');
    expect(within(row).getByText('À faire')).toBeInTheDocument();
  });

  it('saisie illisible (« 7x ») : rien d’écrit pour ce champ', async () => {
    const r = await db.data.repos.workouts();
    await r.start({ source: 'empty', id: W, name: 'Séance' });
    await r.addExercise(W, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché à la barre', sets: 1, targetRepsMin: 8, targetRepsMax: 10 });
    open('session');
    const region = await screen.findByRole('region', { name: 'Développé couché à la barre' });
    const load = within(region).getByLabelText('Charge (kg)');
    fireEvent.change(load, { target: { value: '7x' } });
    fireEvent.blur(load);
    act(() => undefined);
    expect(await db.driver.select(`SELECT load_kg FROM workout_set WHERE workout_id = '${W}'`)).toEqual([{ load_kg: null }]);
  });
});
