import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { RoutineInput } from '../../../domain/training';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { tSession } from '../../../i18n/trainingSessionText';
import type { LiveActivity } from '../../../platform/liveActivity';
import type { TimerNotifier } from '../../../platform/notifications/timerNotification';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';

/**
 * SESS-01b (§ 13.2) : bandeau de vignettes réordonnables (clavier : Alt + flèche), « Sauter » (l'exercice passe en fin de séance), « Retirer, ne
 * plus proposer » (retrait + réglage local des exercices écartés), « Proposer à nouveau » depuis la feuille de remplacement.
 */

const DEVICE = '60000000-0000-4000-8000-0000000000f4' as DeviceId;
const u = (n: number): string => `5e5a0401-0000-4000-8000-${String(n).padStart(12, '0')}`;
const BENCH = 'Développé couché à la barre';
const ROW = 'Rowing à la barre';
const CURL = 'Curl à la barre';
const ROUTINE: RoutineInput = {
  id: u(1),
  name: 'Haut / Bas',
  mode: 'programme',
  days: [
    {
      id: u(2),
      name: 'Haut A',
      dayOrder: 1,
      exercises: [
        { id: u(3), exerciseId: 'bench-press-barbell', exerciseName: BENCH, sets: 2, repMin: 6, repMax: 10, rir: 2, restSec: 150, position: 0 },
        { id: u(4), exerciseId: 'row-barbell', exerciseName: ROW, sets: 2, repMin: 8, repMax: 12, rir: null, restSec: 120, position: 1 },
        { id: u(5), exerciseId: 'curl-barbell', exerciseName: CURL, sets: 1, repMin: 8, repMax: 12, rir: null, restSec: 60, position: 2 },
      ],
    },
  ],
};
const notifier: TimerNotifier = { permission: async () => 'granted', requestPermission: async () => 'granted', isPending: async () => false, schedule: async () => true, cancel: async () => undefined };
const liveActivity: LiveActivity = { isAvailable: async () => ({ available: true }), start: async () => ({ started: true }), end: async () => ({ ended: true, count: 1 }) };

let db: TestDb;
const openAndStart = async () => {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'session' } as Route));
  const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
  render(
    <AppContainerProvider container={container}>
      <TrainingScreen session={{ os: 'other', notifier, liveActivity }} />
    </AppContainerProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /^Démarrer « Haut A »/ }));
  await screen.findByRole('region', { name: BENCH });
};
const order = async (): Promise<string[]> =>
  [...new Set((await db.driver.select<{ exercise_id: string }>('SELECT exercise_id FROM workout_set WHERE deleted_at IS NULL ORDER BY position')).map((r) => r.exercise_id))];
const strip = () => screen.getByRole('list', { name: tSession('stripLabel') });

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-21T17:00:00.000Z');
  await (await db.data.repos.trainingRoutines()).create(ROUTINE);
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('SESS-01b — vignettes, sauter, ne plus proposer', () => {
  it('vignettes : une par exercice, dans l’ordre ; Alt + flèche déplace l’exercice, l’ordre est écrit en base', async () => {
    await openAndStart();
    const items = within(strip()).getAllByRole('button');
    expect(items.map((b) => b.textContent)).toEqual([BENCH, ROW, CURL].map((name, i) => tSession('stripItem', { n: i + 1, name })));
    fireEvent.keyDown(within(strip()).getByRole('button', { name: tSession('stripItem', { n: 3, name: CURL }) }), { key: 'ArrowLeft', altKey: true });
    await screen.findByRole('button', { name: tSession('stripItem', { n: 2, name: CURL }) });
    expect(await order()).toEqual(['bench-press-barbell', 'curl-barbell', 'row-barbell']);
  });

  it('« Sauter » : l’exercice en cours passe en fin de séance, le suivant devient courant', async () => {
    await openAndStart();
    fireEvent.click(within(screen.getByRole('region', { name: BENCH })).getByRole('button', { name: tSession('skip') }));
    await screen.findByRole('button', { name: tSession('stripItem', { n: 3, name: BENCH }) });
    expect(await order()).toEqual(['row-barbell', 'curl-barbell', 'bench-press-barbell']);
  });

  it('« Retirer, ne plus proposer » : retiré de la séance, écarté (réglage local) ; « Proposer à nouveau » le rétablit', async () => {
    await openAndStart();
    fireEvent.click(within(screen.getByRole('region', { name: BENCH })).getByRole('button', { name: tSession('removeExclude') }));
    fireEvent.click(await screen.findByRole('button', { name: tSession('removeExcludeConfirm') }));
    await screen.findByRole('button', { name: tSession('stripItem', { n: 2, name: CURL }) });
    expect(await order()).toEqual(['row-barbell', 'curl-barbell']);
    expect(await db.data.repos.settings.get('training.excludedExercises')).toEqual({ v: 1, ids: ['bench-press-barbell'] });
    fireEvent.click(within(screen.getByRole('region', { name: ROW })).getByRole('button', { name: tSession('replace') }));
    const sheet = await screen.findByRole('region', { name: tSession('replaceTitle', { name: ROW }) });
    fireEvent.click(within(sheet).getByRole('button', { name: tSession('restoreExcluded', { name: BENCH }) }));
    await within(sheet).findByText(tSession('restoredExcluded', { name: BENCH }));
    expect(await db.data.repos.settings.get('training.excludedExercises')).toEqual({ v: 1, ids: [] });
  });
});
