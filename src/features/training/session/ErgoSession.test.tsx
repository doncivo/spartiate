import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { RoutineInput } from '../../../domain/training';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import type { LiveActivity } from '../../../platform/liveActivity';
import type { TimerNotifier } from '../../../platform/notifications/timerNotification';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';

/**
 * ERGO-01 (volet esthétique validé par Ali le 12/11, Seance-apres.dc.html) : série en cours en bloc central, position dans la séance, repos en
 * barre de progression accessible. Base SQLite réelle (wasm), horloge manuelle : le repos commence à 0 s écoulée.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000e9' as DeviceId;
const u = (n: number): string => `3c2b1a00-0000-4000-8000-${String(n).padStart(12, '0')}`;
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
        { id: u(3), exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché à la barre', sets: 2, repMin: 6, repMax: 10, rir: 2, restSec: 150, position: 0 },
        { id: u(4), exerciseId: 'row-barbell', exerciseName: 'Rowing à la barre', sets: 2, repMin: 8, repMax: 12, rir: null, restSec: 120, position: 1 },
      ],
    },
  ],
};
const notifier: TimerNotifier = {
  permission: async () => 'granted',
  requestPermission: async () => 'granted',
  isPending: async () => false,
  schedule: async () => true,
  cancel: async () => undefined,
};
const liveActivity: LiveActivity = {
  isAvailable: async () => ({ available: true }),
  start: async () => ({ started: true }),
  end: async () => ({ ended: true, count: 1 }),
};

let db: TestDb;
const openSession = () => {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'session' } as Route));
  return render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <TrainingScreen session={{ os: 'ios', notifier, liveActivity }} />
    </AppContainerProvider>,
  );
};
const start = async () => {
  openSession();
  fireEvent.click(await screen.findByRole('button', { name: /^Démarrer « Haut A »/ }));
  await screen.findByRole('heading', { level: 2, name: 'Haut A' });
};
const current = () => screen.getByRole('group', { current: 'step' });

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T17:00:00.000Z');
  await (await db.data.repos.trainingRoutines()).create(ROUTINE);
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('ERGO-01 : série en cours en bloc central', () => {
  it('une seule série en cours (aria-current), la première à faire, annoncée « Série en cours » et mise en avant par sa classe', async () => {
    await start();
    expect(screen.getAllByRole('group', { current: 'step' })).toHaveLength(1);
    const set = current();
    expect(set).toHaveAccessibleName('Série 1');
    expect(set).toHaveClass('ct-session__set--current');
    expect(within(set).getByText('Série en cours')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Développé couché à la barre' })).getByRole('group', { current: 'step' })).toBe(set);
  });

  it('la validation fait avancer la série en cours ; l’en-tête dit la position dans la séance', async () => {
    await start();
    expect(screen.getByText('Exercice 1 sur 2')).toBeInTheDocument();
    const set = current();
    fireEvent.change(within(set).getByLabelText('Charge (kg)'), { target: { value: '80' } });
    fireEvent.change(within(set).getByLabelText('Répétitions'), { target: { value: '8' } });
    fireEvent.click(within(set).getByRole('button', { name: 'Valider la série' }));
    await within(set).findByText('Validée');
    expect(current()).toHaveAccessibleName('Série 2');
    expect(set).not.toHaveAttribute('aria-current');
  });
});

describe('ERGO-01 (passe code-reviewer) : série en cours dans un circuit', () => {
  it('séries alternées : après la 1re série du couché, la série en cours est la 1re du rowing (ordre de la séance, pas ordre des blocs)', async () => {
    const started = await db.data.transaction(async (repos) => (await repos.workouts()).start({ source: 'routine', routineId: ROUTINE.id, dayId: u(2) }));
    const workouts = await db.data.repos.workouts();
    const grouped = await workouts.groupExercises(started.id, { exerciseIds: ['bench-press-barbell', 'row-barbell'], restBetweenSec: 0, restRoundSec: null });
    const first = grouped.sets.filter((s) => s.exerciseId === 'bench-press-barbell').sort((a, b) => a.position - b.position)[0];
    if (!first) throw new Error('aucune série de couché');
    await db.data.transaction(async (repos) => (await repos.workouts()).validateSet(first.id, { reps: 8, loadKg: 80, durationSec: null, rir: null }));
    openSession();
    await screen.findByRole('heading', { level: 2, name: 'Haut A' });
    const set = current();
    expect(within(screen.getByRole('region', { name: 'Rowing à la barre' })).getByRole('group', { current: 'step' })).toBe(set);
    expect(set).toHaveAccessibleName('Série 1');
    expect(screen.getByText('Exercice 2 sur 2')).toBeInTheDocument();
  });
});

describe('ERGO-01 : repos en barre de progression', () => {
  it('après une série : barre « Repos » (progressbar) bornée par la durée lancée, valeur écoulée et texte restant', async () => {
    await start();
    const set = current();
    fireEvent.change(within(set).getByLabelText('Charge (kg)'), { target: { value: '80' } });
    fireEvent.change(within(set).getByLabelText('Répétitions'), { target: { value: '8' } });
    fireEvent.click(within(set).getByRole('button', { name: 'Valider la série' }));
    const bar = await screen.findByRole('progressbar', { name: 'Repos' });
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '150');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    expect(bar).toHaveAttribute('aria-valuetext', '2:30 restantes');
    expect(bar).toHaveClass('ct-session__rest-bar');
  });
});
