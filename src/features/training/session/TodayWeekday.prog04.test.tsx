import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { RoutineInput } from '../../../domain/training';
import { DEFAULT_GENERATION_CONFIG } from '../../../domain/training/config';
import { createMesocycleSpec } from '../../../domain/training/mesocycle';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';
import { TodaySessionCard } from './TodaySessionCard';

/** PROG-04 (D-316) : Aujourd'hui propose la séance du jour de la semaine ; jour sans séance : « Repos ». Lundi 16/11/2026 → jeudi 19/11. */
const DEVICE = '60000000-0000-4000-8000-0000000004c1' as DeviceId;
const u = (n: number): string => `5e4d3c99-0000-4000-8000-${String(n).padStart(12, '0')}`;
const line = (id: number) => ({ id: u(id), exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché à la barre', sets: 3, repMin: 8, repMax: 10, rir: null, restSec: 120, position: 0 });
const NAMES = ['Lundi — Poussée', 'Mardi — Bas du corps', 'Jeudi — Poussée', 'Vendredi — Tirage', 'Samedi — Jambes'];
const program = (weekdays: (number | null)[]): RoutineInput => ({
  id: u(1),
  name: 'Programme 5 jours',
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
async function follow(weekdays: (number | null)[]): Promise<void> {
  await db.data.transaction(async (r) => (await r.trainingRoutines()).create(program(weekdays)));
  const spec = createMesocycleSpec({ routineId: u(1), startDate: '2026-11-16' as LocalDate, weeks: 5 }, DEFAULT_GENERATION_CONFIG);
  if (spec === null) throw new Error('spec');
  await db.data.transaction(async (r) => (await r.mesocycles()).start(spec));
}
/** Une seule séance close, le lundi, issue du jour « Lundi — Poussée ». */
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

describe('PROG-04 : séance du jour selon le jour de la semaine', () => {
  it('jeudi, une seule séance close le lundi : « Jeudi — Poussée », pas « Mardi — Bas du corps »', async () => {
    await follow([1, 2, 4, 5, 6]);
    await mondayClosed();
    db.clock.advance(3 * 86_400_000);
    mountCard();
    const card = await screen.findByRole('region', { name: 'Séance du jour' });
    expect(await within(card).findByText('Jeudi — Poussée')).toBeInTheDocument();
    expect(within(card).queryByText('Mardi — Bas du corps')).toBeNull();
  });

  it('mercredi, jour sans séance : « Repos », avec la prochaine séance ; « Autre séance… » reste possible', async () => {
    await follow([1, 2, 4, 5, 6]);
    db.clock.advance(2 * 86_400_000);
    mountCard();
    const card = await screen.findByRole('region', { name: 'Séance du jour' });
    expect(await within(card).findByText('Repos aujourd’hui. Prochaine séance jeudi : Jeudi — Poussée.')).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Lancer la séance' })).toBeNull();
    expect(within(card).getByRole('button', { name: 'Autre séance…' })).toBeInTheDocument();
  });

  it('sans jour rattaché : rotation inchangée (« Mardi — Bas du corps » le jeudi)', async () => {
    await follow([null, null, null, null, null]);
    await mondayClosed();
    db.clock.advance(3 * 86_400_000);
    mountCard();
    const card = await screen.findByRole('region', { name: 'Séance du jour' });
    expect(await within(card).findByText('Mardi — Bas du corps')).toBeInTheDocument();
  });
});

describe('PROG-04 : saisie du jour de la semaine dans l’éditeur de routine', () => {
  it('Entraînement › routine › jour › « Jour de la semaine » : enregistré', async () => {
    await db.data.transaction(async (r) => (await r.trainingRoutines()).create(program([null, null, null, null, null])));
    act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'routines' } as Route));
    render(
      <AppContainerProvider container={container()}>
        <TrainingScreen session={{ os: 'other' }} />
      </AppContainerProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /^Programme 5 jours/ }));
    const day = await screen.findByRole('group', { name: 'Mardi — Bas du corps' });
    fireEvent.change(within(day).getByLabelText('Jour de la semaine'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la routine' }));
    await vi.waitFor(async () => expect(await db.driver.select('SELECT weekday FROM routine_day WHERE id = ?', [u(11)])).toEqual([{ weekday: 2 }]));
  });
});
