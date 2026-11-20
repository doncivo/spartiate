import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { RoutineInput, WorkoutWithSets } from '../../../domain/training';
import type { DeviceId, IsoDateTime } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import type { LiveActivity } from '../../../platform/liveActivity';
import type { TimerNotifier } from '../../../platform/notifications/timerNotification';
import { seedPastWorkout, setRow, workoutRow } from '../../../../tests/fixtures/training/workout';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';

/**
 * FIX-ABERR (lot 0.28.0, C-005, § 11.5 « aberrantes signalées avant enregistrement ») : base SQLite réelle (wasm), trois séances closes à
 * 100 kg × 8 au développé couché, puis saisie dans la séance active. Données synthétiques (D-292).
 */

const DEVICE = '60000000-0000-4000-8000-0000000000e5' as DeviceId;
const u = (n: number): string => `4ab0e000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const BENCH = 'Développé couché à la barre';
const ROUTINE: RoutineInput = {
  id: u(1),
  name: 'Haut / Bas',
  mode: 'programme',
  days: [
    {
      id: u(2),
      name: 'Haut A',
      dayOrder: 1,
      exercises: [{ id: u(3), exerciseId: 'bench-press-barbell', exerciseName: BENCH, sets: 3, repMin: 6, repMax: 10, rir: 2, restSec: 150, position: 0 }],
    },
  ],
};

/** Séance close à 100 kg × 8 (trois séries de travail), `day` jours de novembre. */
function past(index: number, day: number): WorkoutWithSets {
  const start = `2026-11-0${String(day)}T17:00:00.000Z` as IsoDateTime;
  const id = u(100 + index);
  return {
    ...workoutRow({ id, startedAt: start, endedAt: `2026-11-0${String(day)}T18:00:00.000Z` as IsoDateTime }),
    sets: [0, 1, 2].map((position) => setRow(0, { id: u(200 + index * 10 + position), workoutId: id, position, done: true, reps: 8, loadKg: 100, doneAt: start })),
  };
}

const notifier: TimerNotifier = { permission: async () => 'granted', requestPermission: async () => 'granted', isPending: async () => false, schedule: async () => true, cancel: async () => undefined };
const liveActivity: LiveActivity = { isAvailable: async () => ({ available: false, reason: 'unsupported' }) as never, start: async () => ({ started: false }) as never, end: async () => ({ ended: true, count: 0 }) };

let db: TestDb;
const openSession = () => {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'session' } as Route));
  return render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <TrainingScreen session={{ os: 'ios', notifier, liveActivity }} />
    </AppContainerProvider>,
  );
};
const openDone = async (): Promise<number> => {
  const [row] = await db.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM workout_set s JOIN workout w ON w.id = s.workout_id WHERE w.ended_at IS NULL AND s.done = 1');
  return row?.n ?? -1;
};
async function firstSet(): Promise<HTMLElement> {
  fireEvent.click(await screen.findByRole('button', { name: /^Démarrer « Haut A »/ }));
  const region = await screen.findByRole('region', { name: BENCH });
  const [first] = within(region).getAllByRole('group', { name: /^Série \d+$/ });
  if (!first) throw new Error('aucune série');
  return first;
}
function enter(set: HTMLElement, load: string, reps: string): void {
  fireEvent.change(within(set).getByLabelText('Charge (kg)'), { target: { value: load } });
  fireEvent.change(within(set).getByLabelText('Répétitions'), { target: { value: reps } });
  fireEvent.click(within(set).getByRole('button', { name: 'Valider la série' }));
}

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T17:00:00.000Z');
  await (await db.data.repos.trainingRoutines()).create(ROUTINE);
  for (const [i, day] of [2, 4, 6].entries()) await seedPastWorkout(db.driver, past(i, day));
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('FIX-ABERR (C-005) : charge aberrante signalée avant enregistrement', () => {
  it('200 kg × 8 après trois séances à 100 kg × 8 : confirmation demandée, rien n’est écrit', async () => {
    openSession();
    const set = await firstSet();
    enter(set, '200', '8');
    expect(await within(set).findByText(/200 kg : c’est 200 % de ta charge habituelle.*\(100 kg\)/)).toBeInTheDocument();
    expect(within(set).getByRole('button', { name: 'Confirmer' })).toBeInTheDocument();
    expect(within(set).getByRole('button', { name: 'Corriger' })).toBeInTheDocument();
    expect(await openDone()).toBe(0);
  });

  it('« Corriger » : rien n’est écrit, la question disparaît, le focus revient au champ Charge', async () => {
    openSession();
    const set = await firstSet();
    enter(set, '200', '8');
    fireEvent.click(await within(set).findByRole('button', { name: 'Corriger' }));
    await waitFor(() => expect(within(set).queryByRole('button', { name: 'Corriger' })).toBeNull());
    expect(within(set).getByLabelText('Charge (kg)')).toHaveFocus();
    expect(within(set).getByText('À faire')).toBeInTheDocument();
    expect(await openDone()).toBe(0);
  });

  it('« Confirmer » : la série est écrite telle quelle', async () => {
    openSession();
    const set = await firstSet();
    enter(set, '200', '8');
    fireEvent.click(await within(set).findByRole('button', { name: 'Confirmer' }));
    await within(set).findByText('Validée');
    const [row] = await db.driver.select<{ load_kg: number; reps: number }>('SELECT s.load_kg, s.reps FROM workout_set s JOIN workout w ON w.id = s.workout_id WHERE w.ended_at IS NULL AND s.done = 1');
    expect(row).toEqual({ load_kg: 200, reps: 8 });
  });

  it('102 kg × 8 : écrit sans question', async () => {
    openSession();
    const set = await firstSet();
    enter(set, '102', '8');
    await within(set).findByText('Validée');
    expect(screen.queryByRole('button', { name: 'Corriger' })).toBeNull();
    expect(await openDone()).toBe(1);
  });

  it('passe qa-test : après « Confirmer », la série suivante à la même charge est écrite sans nouvelle question', async () => {
    openSession();
    const set = await firstSet();
    enter(set, '200', '8');
    fireEvent.click(await within(set).findByRole('button', { name: 'Confirmer' }));
    await within(set).findByText('Validée');
    const region = screen.getByRole('region', { name: BENCH });
    const next = within(region).getAllByRole('group', { name: /^Série \d+$/ }).find((g) => within(g).queryByRole('button', { name: 'Valider la série' }) !== null);
    if (!next) throw new Error('aucune série à faire');
    enter(next, '200', '8');
    await within(next).findByText('Validée');
    expect(within(next).queryByRole('button', { name: 'Corriger' })).toBeNull();
    expect(await openDone()).toBe(2);
  });
});
