import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { RoutineInput } from '../../../domain/training';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { tSession } from '../../../i18n/trainingSessionText';
import { tTraining } from '../../../i18n/trainingText';
import type { LiveActivity, LiveActivityStartInput } from '../../../platform/liveActivity';
import type { TimerNotifier } from '../../../platform/notifications/timerNotification';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';
import { createRestTimer } from './restTimer';

/**
 * SESS-01f (§ 13.3 « étendu : exercice suivant, charge ») : la Live Activity du repos dit l'exercice suivant et sa charge dans son libellé (vue
 * étendue et écran verrouillé, plugin existant, aucun changement Swift) ; le libellé suit les « +30 s » et la reprise. Boutons « +30 s » et
 * « Passer » dans la Live Activity : reportés (App Intents, ios-mobile).
 */

const DEVICE = '60000000-0000-4000-8000-0000000000f8' as DeviceId;
const u = (n: number): string => `5e5a0801-0000-4000-8000-${String(n).padStart(12, '0')}`;
const BENCH = 'Développé couché à la barre';
const ROW = 'Rowing à la barre';
const ROUTINE: RoutineInput = {
  id: u(1),
  name: 'Haut',
  mode: 'programme',
  days: [
    {
      id: u(2),
      name: 'Haut A',
      dayOrder: 1,
      exercises: [
        { id: u(3), exerciseId: 'bench-press-barbell', exerciseName: BENCH, sets: 1, repMin: 6, repMax: 10, rir: 2, restSec: 150, position: 0 },
        { id: u(4), exerciseId: 'row-barbell', exerciseName: ROW, sets: 2, repMin: 8, repMax: 12, rir: null, restSec: 120, position: 1 },
      ],
    },
  ],
};
const TEXTS = { label: 'Repos', finishedLabel: 'Terminé', notificationTitle: 'Repos terminé', notificationBody: 'Suite.' };

function fakes() {
  const starts: LiveActivityStartInput[] = [];
  const notifier: TimerNotifier = { permission: async () => 'granted', requestPermission: async () => 'granted', isPending: async () => true, schedule: async () => true, cancel: async () => undefined };
  const liveActivity: LiveActivity = { isAvailable: async () => ({ available: true }), start: async (input) => (starts.push(input), { started: true }), end: async () => ({ ended: true, count: 1 }) };
  return { notifier, liveActivity, starts };
}

let db: TestDb;
beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-21T17:00:00.000Z');
  await (await db.data.repos.trainingRoutines()).create(ROUTINE);
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('SESS-01f — libellé de la Live Activity', () => {
  it('minuteur : libellé donné au départ, gardé aux « +30 s » et à la reprise, borné à 80 caractères ; sans libellé : celui par défaut', async () => {
    await db.data.transaction(async (repos) => (await repos.workouts()).start({ source: 'empty' }));
    const f = fakes();
    const timer = createRestTimer({ clock: db.clock, store: () => db.data.repos.workouts(), liveActivity: f.liveActivity, notifier: f.notifier, os: 'ios', texts: TEXTS });
    await timer.start(90, 'Repos · ensuite : Rowing, 60 kg');
    await timer.extend();
    db.clock.advance(5_000);
    await timer.resume();
    expect(f.starts.map((s) => s.label)).toEqual(['Repos · ensuite : Rowing, 60 kg', 'Repos · ensuite : Rowing, 60 kg', 'Repos · ensuite : Rowing, 60 kg']);
    await timer.start(90, 'x'.repeat(120));
    expect(f.starts.at(-1)?.label).toHaveLength(80);
    await timer.start(90);
    expect(f.starts.at(-1)?.label).toBe('Repos');
  });

  it('séance : après la dernière série du développé, la Live Activity annonce le rowing et sa charge saisie', async () => {
    const f = fakes();
    act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'session' } as Route));
    const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
    render(
      <AppContainerProvider container={container}>
        <TrainingScreen session={{ os: 'ios', notifier: f.notifier, liveActivity: f.liveActivity }} />
      </AppContainerProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /^Démarrer « Haut A »/ }));
    const r = await db.data.repos.workouts();
    const open = await r.getOpen();
    const row = open?.sets.find((s) => s.exerciseId === 'row-barbell');
    await r.updateSet(row?.id ?? '', { targetLoadKg: 60 });
    const [first] = within(await screen.findByRole('region', { name: BENCH })).getAllByRole('group', { name: /^Série/ });
    if (!first) throw new Error('aucune série');
    fireEvent.change(within(first).getByLabelText(tTraining('sessionLoad')), { target: { value: '80' } });
    fireEvent.change(within(first).getByLabelText(tTraining('sessionReps')), { target: { value: '8' } });
    fireEvent.click(within(first).getByRole('button', { name: tTraining('sessionValidate') }));
    await waitFor(() => expect(f.starts.at(-1)?.label).toBe(tSession('restLiveNext', { rest: tTraining('restLiveLabel'), name: ROW, load: tTraining('loadSingle', { load: '60' }) })));
  });
});
