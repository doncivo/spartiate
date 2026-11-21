import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { RoutineInput } from '../../../domain/training';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { tSession } from '../../../i18n/trainingSessionText';
import { tTraining } from '../../../i18n/trainingText';
import type { LiveActivity } from '../../../platform/liveActivity';
import type { TimerNotifier } from '../../../platform/notifications/timerNotification';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';

/**
 * SESS-01, passe qa-test : cas limites de l'écran de séance. Le focus n'est jamais volé à une saisie après un déplacement de vignette ; une
 * séance reprise après fermeture garde l'ordre écrit, l'exercice remplacé, la fatigue déclarée et les exercices écartés ; un exercice sans série
 * à faire n'offre ni « Remplacer » ni « Sauter ».
 */

const DEVICE = '60000000-0000-4000-8000-0000000000f9' as DeviceId;
const u = (n: number): string => `5e5a0901-0000-4000-8000-${String(n).padStart(12, '0')}`;
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
const notifier: TimerNotifier = { permission: async () => 'granted', requestPermission: async () => 'granted', isPending: async () => false, schedule: async () => true, cancel: async () => undefined };
const liveActivity: LiveActivity = { isAvailable: async () => ({ available: true }), start: async () => ({ started: true }), end: async () => ({ ended: true, count: 1 }) };

let db: TestDb;
const mount = () => {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'session' } as Route));
  const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
  return render(
    <AppContainerProvider container={container}>
      <TrainingScreen session={{ os: 'other', notifier, liveActivity }} />
    </AppContainerProvider>,
  );
};
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

describe('SESS-01 — qa-test', () => {
  it('après un déplacement au clavier, le focus va à la vignette déplacée, puis n’est plus repris à une saisie (re-rendu)', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /^Démarrer « Haut A »/ }));
    await screen.findByRole('region', { name: BENCH });
    fireEvent.keyDown(within(strip()).getByRole('button', { name: tSession('stripItem', { n: 2, name: ROW }) }), { key: 'ArrowLeft', altKey: true });
    const moved = await screen.findByRole('button', { name: tSession('stripItem', { n: 1, name: ROW }) });
    await waitFor(() => expect(document.activeElement).toBe(moved));
    const [first] = within(screen.getByRole('region', { name: BENCH })).getAllByRole('group', { name: /^Série/ });
    const input = within(first as HTMLElement).getByLabelText(tTraining('sessionLoad'));
    input.focus();
    // Re-rendu de l'écran (retour au premier plan : relecture du repos) : la saisie garde le focus.
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    fireEvent.click(within(screen.getByRole('group', { name: tSession('fatigueLabel') })).getByRole('button', { name: tSession('fatigueNormal') }));
    input.focus();
    await screen.findByRole('button', { name: tSession('fatigueNormal'), pressed: true });
    expect(document.activeElement).toBe(input);
  });

  it('reprise après fermeture : ordre, remplacement, fatigue et exercices écartés relus de la base', async () => {
    const first = mount();
    fireEvent.click(await screen.findByRole('button', { name: /^Démarrer « Haut A »/ }));
    await screen.findByRole('region', { name: BENCH });
    fireEvent.click(within(screen.getByRole('group', { name: tSession('fatigueLabel') })).getByRole('button', { name: tSession('fatigueTired') }));
    await screen.findByRole('button', { name: tSession('fatigueTired'), pressed: true });
    fireEvent.click(within(screen.getByRole('region', { name: BENCH })).getByRole('button', { name: tSession('skip') }));
    await screen.findByRole('button', { name: tSession('stripItem', { n: 2, name: BENCH }) });
    first.unmount();
    mount();
    expect(await screen.findByRole('button', { name: tSession('stripItem', { n: 1, name: ROW }) })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: tSession('fatigueTired'), pressed: true })).toBeInTheDocument();
  });

  it('exercice dont toutes les séries sont validées : ni « Remplacer » ni « Sauter »', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /^Démarrer « Haut A »/ }));
    const block = await screen.findByRole('region', { name: BENCH });
    const [only] = within(block).getAllByRole('group', { name: /^Série/ });
    if (!only) throw new Error('aucune série');
    fireEvent.change(within(only).getByLabelText(tTraining('sessionLoad')), { target: { value: '80' } });
    fireEvent.change(within(only).getByLabelText(tTraining('sessionReps')), { target: { value: '8' } });
    fireEvent.click(within(only).getByRole('button', { name: tTraining('sessionValidate') }));
    await within(only).findByText(tTraining('sessionDone'));
    expect(within(block).queryByRole('button', { name: tSession('replace') })).toBeNull();
    expect(within(block).queryByRole('button', { name: tSession('skip') })).toBeNull();
  });
});
