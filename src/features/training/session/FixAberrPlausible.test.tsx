import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { RoutineInput } from '../../../domain/training';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import type { LiveActivity } from '../../../platform/liveActivity';
import type { TimerNotifier } from '../../../platform/notifications/timerNotification';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';

/**
 * FIX-ABERR suite (décision d'Ali du 20/11) : vraisemblance à la PREMIÈRE séance d'un exercice (aucun historique), en multiple du poids de
 * corps selon le type d'exercice. Base SQLite réelle (wasm), saisie dans la séance active. Données synthétiques (D-292).
 */

const DEVICE = '60000000-0000-4000-8000-0000000000e6' as DeviceId;
const u = (n: number): string => `4ab1e000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const BENCH = 'Développé couché à la barre';
const ASSISTED = 'Traction assistée';
const CURL = 'Curl aux haltères';
const ROUTINE: RoutineInput = {
  id: u(1),
  name: 'Découverte',
  mode: 'programme',
  days: [
    {
      id: u(2),
      name: 'Jour A',
      dayOrder: 1,
      exercises: [
        { id: u(3), exerciseId: 'bench-press-barbell', exerciseName: BENCH, sets: 3, repMin: 5, repMax: 8, rir: 2, restSec: 150, position: 0 },
        { id: u(4), exerciseId: 'pull-up-assisted', exerciseName: ASSISTED, sets: 3, repMin: 6, repMax: 10, rir: 2, restSec: 120, position: 1 },
        { id: u(5), exerciseId: 'curl-dumbbell', exerciseName: CURL, sets: 3, repMin: 8, repMax: 12, rir: 2, restSec: 90, position: 2 },
      ],
    },
  ],
};

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
const openDone = async (): Promise<{ load_kg: number; reps: number }[]> =>
  db.driver.select<{ load_kg: number; reps: number }>('SELECT s.load_kg, s.reps FROM workout_set s JOIN workout w ON w.id = s.workout_id WHERE w.ended_at IS NULL AND s.done = 1');
const weigh = async (kg: number): Promise<void> => {
  await (await db.data.repos.bodyWeights()).saveManual({ date: '2026-11-08' as LocalDate, kg, timezone: 'Europe/Paris' }, '2026-11-09' as LocalDate);
};
let started = false;
async function firstSet(name: string): Promise<HTMLElement> {
  if (!started) fireEvent.click(await screen.findByRole('button', { name: /^Démarrer « Jour A »/ }));
  started = true;
  const region = await screen.findByRole('region', { name });
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
  started = false;
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T17:00:00.000Z');
  await (await db.data.repos.trainingRoutines()).create(ROUTINE);
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('FIX-ABERR vraisemblance : première séance, poids de corps 80 kg', () => {
  beforeEach(async () => weigh(80));

  it('développé couché 201 kg × 5 : question « plus de 2,5 fois ton poids de corps », rien n’est écrit', async () => {
    openSession();
    const set = await firstSet(BENCH);
    enter(set, '201', '5');
    expect(await within(set).findByText(/201 kg : c’est plus de 2,5 fois ton poids de corps \(80 kg\)/)).toBeInTheDocument();
    expect(within(set).getByRole('button', { name: 'Confirmer' })).toBeInTheDocument();
    expect(await openDone()).toEqual([]);
  });

  it('« Corriger » : rien n’est écrit, la question disparaît, le focus revient au champ Charge', async () => {
    openSession();
    const set = await firstSet(BENCH);
    enter(set, '201', '5');
    fireEvent.click(await within(set).findByRole('button', { name: 'Corriger' }));
    await waitFor(() => expect(within(set).queryByRole('button', { name: 'Corriger' })).toBeNull());
    expect(within(set).getByLabelText('Charge (kg)')).toHaveFocus();
    expect(await openDone()).toEqual([]);
  });

  it('« Confirmer » : 201 kg × 5 est écrit tel quel', async () => {
    openSession();
    const set = await firstSet(BENCH);
    enter(set, '201', '5');
    fireEvent.click(await within(set).findByRole('button', { name: 'Confirmer' }));
    await within(set).findByText('Validée');
    expect(await openDone()).toEqual([{ load_kg: 201, reps: 5 }]);
  });

  it('200 kg × 5 (au plafond) : écrit sans question', async () => {
    openSession();
    const set = await firstSet(BENCH);
    enter(set, '200', '5');
    await within(set).findByText('Validée');
    expect(screen.queryByRole('button', { name: 'Corriger' })).toBeNull();
    expect(await openDone()).toEqual([{ load_kg: 200, reps: 5 }]);
  });

  it('traction assistée : 80 kg d’assistance (≥ poids de corps) signalée ; 79,5 kg écrite sans question', async () => {
    openSession();
    const set = await firstSet(ASSISTED);
    enter(set, '80', '8');
    expect(await within(set).findByText(/Assistance de 80 kg : peu plausible face à ton poids de corps \(80 kg\)/)).toBeInTheDocument();
    expect(await openDone()).toEqual([]);
    fireEvent.click(within(set).getByRole('button', { name: 'Corriger' }));
    enter(set, '79,5', '8');
    await within(set).findByText('Validée');
    expect(await openDone()).toEqual([{ load_kg: 79.5, reps: 8 }]);
  });

  it('curl aux haltères : 48,5 kg par haltère signalé (moitié du plafond d’isolation), « par haltère » dit', async () => {
    openSession();
    const set = await firstSet(CURL);
    enter(set, '48,5', '10');
    expect(await within(set).findByText(/48,5 kg : c’est plus de 0,6 fois ton poids de corps \(80 kg\) par haltère/)).toBeInTheDocument();
    expect(await openDone()).toEqual([]);
  });
});

describe('FIX-ABERR vraisemblance : première séance, poids de corps inconnu', () => {
  it('développé couché 201 kg × 5 : question avec le plafond absolu (200 kg)', async () => {
    openSession();
    const set = await firstSet(BENCH);
    enter(set, '201', '5');
    expect(await within(set).findByText(/201 kg : au-delà du plausible pour ce type d’exercice \(200 kg au plus sans poids de corps connu\)/)).toBeInTheDocument();
    expect(await openDone()).toEqual([]);
  });
  it('200 kg × 5 : écrit sans question', async () => {
    openSession();
    const set = await firstSet(BENCH);
    enter(set, '200', '5');
    await within(set).findByText('Validée');
    expect(await openDone()).toEqual([{ load_kg: 200, reps: 5 }]);
  });
});
