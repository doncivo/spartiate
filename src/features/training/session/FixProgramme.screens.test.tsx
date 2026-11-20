import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { RoutineInput } from '../../../domain/training';
import { DEFAULT_GENERATION_CONFIG } from '../../../domain/training/config';
import { createMesocycleSpec } from '../../../domain/training/mesocycle';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { tCycle } from '../../../i18n/trainingCycleText';
import { tTraining } from '../../../i18n/trainingText';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';
import { TodaySessionCard } from './TodaySessionCard';

/** FIX-PROGRAMME (lot 0.28.0) : C-063 (carte du jour après la séance faite), C-064 (reprise au 2e cycle), C-065 (échange de jours). Lundi 16/11/2026. */
const DEVICE = '60000000-0000-4000-8000-0000000004f2' as DeviceId;
const u = (n: number): string => `5e4d3c98-0000-4000-8000-${String(n).padStart(12, '0')}`;
const line = (id: number) => ({ id: u(id), exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché à la barre', sets: 3, repMin: 8, repMax: 10, rir: null, restSec: 120, position: 0 });
const NAMES = ['Lundi — Poussée', 'Jeudi — Tirage'];
const program = (weekdays: (number | null)[]): RoutineInput => ({
  id: u(1),
  name: 'Programme deux jours',
  mode: 'programme',
  days: NAMES.map((name, i) => ({ id: u(10 + i), name, dayOrder: i + 1, weekday: weekdays[i] ?? null, exercises: [line(20 + i)] })) as RoutineInput['days'],
});

let db: TestDb;
const container = () => createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
const mountCard = () =>
  render(
    <AppContainerProvider container={container()}>
      <TodaySessionCard />
    </AppContainerProvider>,
  );
const mountTraining = (route: Route) => {
  act(() => useNavigationStore.getState().navigate(route));
  return render(
    <AppContainerProvider container={container()}>
      <TrainingScreen session={{ os: 'other' }} />
    </AppContainerProvider>,
  );
};
async function follow(weekdays: (number | null)[]): Promise<void> {
  await db.data.transaction(async (r) => (await r.trainingRoutines()).create(program(weekdays)));
  const spec = createMesocycleSpec({ routineId: u(1), startDate: '2026-11-16' as LocalDate, weeks: 5 }, DEFAULT_GENERATION_CONFIG);
  if (spec === null) throw new Error('spec');
  await db.data.transaction(async (r) => (await r.mesocycles()).start(spec));
}
async function mondayClosed(): Promise<void> {
  const repo = await db.data.repos.workouts();
  const w = await repo.start({ source: 'routine', routineId: u(1), dayId: u(10) });
  const first = w.sets[0];
  if (first === undefined) throw new Error('série');
  await repo.validateSet(first.id, { reps: 8, loadKg: 60 });
  await db.data.transaction(async (r) => (await r.workouts()).close(w.id));
}

beforeAll(async () => {
  await import('./todaySessionPreview');
});
beforeEach(async () => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-16T17:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await db.close();
});

describe('C-063 : la séance du jour faite n’est pas reproposée', () => {
  it('lundi, séance « Lundi » close le jour même : « faite », prochaine séance jeudi, pas de « Lancer la séance »', async () => {
    await follow([1, 4]);
    await mondayClosed();
    mountCard();
    const card = await screen.findByRole('region', { name: tTraining('sessionTodayEyebrow') });
    expect(await within(card).findByText(tTraining('sessionDoneToday', { weekday: 'jeudi', name: 'Jeudi — Tirage' }))).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: tTraining('sessionLaunch') })).toBeNull();
    expect(within(card).getByRole('button', { name: tTraining('sessionOther') })).toBeInTheDocument();
  });

  it('lundi suivant : la séance « Lundi » est de nouveau proposée', async () => {
    await follow([1, 4]);
    await mondayClosed();
    db.clock.advance(7 * 86_400_000);
    mountCard();
    const card = await screen.findByRole('region', { name: tTraining('sessionTodayEyebrow') });
    expect(await within(card).findByText('Lundi — Poussée')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: tTraining('sessionLaunch') })).toBeInTheDocument();
  });
});

describe('C-065 : échanger deux jours de la semaine dans l’éditeur de routine', () => {
  async function editAndSave(first: string, second: string): Promise<void> {
    mountTraining({ tab: 'training', screen: 'routines' } as Route);
    fireEvent.click(await screen.findByRole('button', { name: /^Programme deux jours/ }));
    const a = await screen.findByRole('group', { name: 'Lundi — Poussée' });
    const b = screen.getByRole('group', { name: 'Jeudi — Tirage' });
    fireEvent.change(within(a).getByLabelText(tTraining('dayWeekday')), { target: { value: first } });
    fireEvent.change(within(b).getByLabelText(tTraining('dayWeekday')), { target: { value: second } });
    fireEvent.click(screen.getByRole('button', { name: tTraining('saveRoutine') }));
  }
  const weekdays = () => db.driver.select<{ id: string; weekday: number | null }>('SELECT id, weekday FROM routine_day ORDER BY day_order');

  it('lundi ↔ jeudi : enregistré, la base porte l’échange', async () => {
    await db.data.transaction(async (r) => (await r.trainingRoutines()).create(program([1, 4])));
    await editAndSave('4', '1');
    await vi.waitFor(async () => expect(await weekdays()).toEqual([{ id: u(10), weekday: 4 }, { id: u(11), weekday: 1 }]));
    expect(screen.queryByText(tTraining('saveError'))).toBeNull();
  });

  it('Jour 1 aucun → lundi, Jour 2 lundi → aucun : enregistré', async () => {
    await db.data.transaction(async (r) => (await r.trainingRoutines()).create(program([null, 1])));
    await editAndSave('1', '');
    await vi.waitFor(async () => expect(await weekdays()).toEqual([{ id: u(10), weekday: 1 }, { id: u(11), weekday: null }]));
  });
});

describe('C-064 : la semaine de reprise ne se reconduit pas au 2e cycle dans le même montage', () => {
  it('premier cycle avec reprise, terminé « sans suite » sans quitter l’écran : interrupteur éteint, 2e cycle sans reprise', async () => {
    await db.data.transaction(async (r) => (await r.trainingRoutines()).create(program([null, null])));
    await db.data.repos.settings.set('onboarding.answers', { v: 1, mesoWeeks: 4, rampUp: true });
    mountTraining({ tab: 'training', screen: 'cycle' } as Route);
    const r = await screen.findByRole('region', { name: tCycle('title') });
    expect(await within(r).findByRole('radio', { name: tCycle('weeksOption', { weeks: 4 }) })).toHaveAttribute('aria-checked', 'true');
    expect(within(r).getByRole('switch', { name: tCycle('rampUpLabel') })).toBeChecked();
    fireEvent.click(within(r).getByRole('button', { name: tCycle('start') }));
    fireEvent.click(await within(r).findByRole('button', { name: tCycle('finish') }));
    fireEvent.click(await within(r).findByRole('button', { name: tCycle('stop') }));
    await within(r).findByText(tCycle('none'));
    expect(await within(r).findByRole('switch', { name: tCycle('rampUpLabel') })).not.toBeChecked();
    fireEvent.click(within(r).getByRole('button', { name: tCycle('start') }));
    await within(r).findByRole('button', { name: tCycle('finish') });
    // Deux cycles créés au même instant (horloge figée) : lus par statut, jamais par date de création.
    expect(await db.driver.select("SELECT status, ramp_up FROM mesocycle ORDER BY status = 'active', id")).toEqual([expect.objectContaining({ ramp_up: 1 }), { status: 'active', ramp_up: 0 }]);
  });
});

