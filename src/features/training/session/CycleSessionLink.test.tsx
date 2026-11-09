import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

/**
 * I4-08 points 4 et 5 : le RIR de la semaine du cycle, affiché sur « Séance proposée », suit la séance (prescription tracée, historique,
 * décision suivante) ; le deload du cycle n'est pré-activé que sur une séance issue de la routine du cycle (proposée ou démarrée depuis
 * elle), jamais sur une séance libre ni sur une autre routine. Base SQLite réelle (wasm), contenu embarqué réel.
 */

const DEVICE = '60000000-0000-4000-8000-0000000000c8' as DeviceId;
const u = (n: number): string => `5e4d3c00-0000-4000-8000-${String(n).padStart(12, '0')}`;
const BENCH = 'Développé couché à la barre';
const BENCH_ID = 'bench-press-barbell';
const routine = (n: number, name: string): RoutineInput => ({
  id: u(n),
  name,
  mode: 'programme',
  days: [
    {
      id: u(n + 1),
      name: `${name} A`,
      dayOrder: 1,
      exercises: [{ id: u(n + 2), exerciseId: BENCH_ID, exerciseName: BENCH, sets: 3, repMin: 8, repMax: 10, rir: null, restSec: 150, position: 0 }],
    },
  ],
});
const CYCLE_ROUTINE = routine(10, 'Haut');
const OTHER_ROUTINE = routine(20, 'Autre');

let db: TestDb;
const open = () => {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'session' } as Route));
  const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
  return render(
    <AppContainerProvider container={container}>
      <TrainingScreen session={{ os: 'other' }} />
    </AppContainerProvider>,
  );
};
const workouts = () => db.data.repos.workouts();
const openWorkoutId = async (): Promise<string> => {
  const [row] = await db.driver.select<{ id: string }>('SELECT id FROM workout WHERE ended_at IS NULL AND deleted_at IS NULL', []);
  if (!row) throw new Error('aucune séance ouverte');
  return row.id;
};
const closeOpen = async (): Promise<void> => {
  const id = await openWorkoutId();
  const w = await (await workouts()).get(id);
  for (const s of w?.sets ?? []) await (await workouts()).validateSet(s.id, { reps: 8, loadKg: 100 });
  await db.data.transaction(async (repos) => (await repos.workouts()).close(id));
  db.clock.advance(86_400_000);
};
/** Séance passée close : 100 kg × 8-8-8 au développé couché (référence du moteur). */
async function pastSession(): Promise<void> {
  const r = await workouts();
  await r.start({ source: 'empty', id: u(1), name: 'Passée' });
  const w = await r.addExercise(u(1), { exerciseId: BENCH_ID, exerciseName: BENCH, sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
  for (const s of w.sets) await r.validateSet(s.id, { reps: 8, loadKg: 100 });
  await db.data.transaction(async (repos) => (await repos.workouts()).close(u(1)));
  db.clock.advance(3 * 86_400_000);
}
async function startCycle(startDate: string): Promise<void> {
  const spec = createMesocycleSpec({ routineId: CYCLE_ROUTINE.id, startDate: startDate as LocalDate, weeks: 5 }, DEFAULT_GENERATION_CONFIG);
  if (spec === null) throw new Error('spec');
  await db.data.transaction(async (repos) => (await repos.mesocycles()).start(spec, { id: u(90) }));
}
/** « Proposer une séance » sur le jour de la routine du cycle, puis « Commencer cette séance ». */
async function startProposed(): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: 'Proposer une séance' }));
  const region = await screen.findByRole('region', { name: 'Séance proposée' });
  const day = within(region).queryByRole('radiogroup', { name: 'Jour' });
  if (day !== null) fireEvent.click(within(day).getByRole('radio', { name: /^Haut A/ }));
  fireEvent.click(within(region).getByRole('button', { name: 'Commencer cette séance' }));
  await screen.findByRole('heading', { level: 2, name: 'Haut A' });
}
const proposal = async () => within(await screen.findByRole('region', { name: BENCH })).findByRole('group', { name: 'Proposition' });
const lastPrescription = async (): Promise<{ rirTarget?: number | null; deload?: boolean }> => {
  const [row] = await db.driver.select<{ prescription: string }>('SELECT prescription FROM recommendation_decision ORDER BY decided_at DESC, id DESC LIMIT 1', []);
  if (!row) throw new Error('aucune décision');
  return JSON.parse(row.prescription) as { rirTarget?: number | null };
};

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  // Lundi 9 novembre 2026.
  db = await openBaseDb(DEVICE, '2026-11-06T17:00:00.000Z');
  await (await db.data.repos.trainingRoutines()).create(CYCLE_ROUTINE);
  await (await db.data.repos.trainingRoutines()).create(OTHER_ROUTINE);
  await pastSession();
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('I4-08 point 4 : RIR de la semaine du cycle enregistré avec la séance', () => {
  it('semaine 3 (RIR 1) : séance proposée, RIR dit dans la séance, tracé avec la décision, retrouvé dans l’historique et dans la décision suivante', async () => {
    // Début le lundi 26 octobre : le 9 novembre est en semaine 3 (RIR 1).
    await startCycle('2026-10-26');
    open();
    await startProposed();
    let p = await proposal();
    expect(await within(p).findByText('Objectif : 1 répétition en réserve.')).toBeInTheDocument();
    fireEvent.click(within(p).getByRole('button', { name: 'Accepter' }));
    await within(p).findByText('Proposition acceptée.');
    expect((await lastPrescription()).rirTarget).toBe(1);
    await closeOpen();
    cleanup();
    const history = await (await db.data.repos.progression()).history(BENCH_ID);
    expect(history[0]?.targetRir).toBe(1);

    open();
    await startProposed();
    p = await proposal();
    fireEvent.click(await within(p).findByRole('button', { name: 'Accepter' }));
    await within(p).findByText('Proposition acceptée.');
    expect((await lastPrescription()).rirTarget).toBe(1);
  });

  it('séance libre (sans cycle ni routine) : aucun RIR inventé', async () => {
    await startCycle('2026-10-26');
    const r = await workouts();
    await r.start({ source: 'empty', id: u(5), name: 'Libre' });
    await r.addExercise(u(5), { exerciseId: BENCH_ID, exerciseName: BENCH, sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
    open();
    const p = await proposal();
    await within(p).findByRole('button', { name: 'Accepter' });
    expect(within(p).queryByText(/répétitions? en réserve\.$/)).toBeNull();
    fireEvent.click(within(p).getByRole('button', { name: 'Accepter' }));
    await within(p).findByText('Proposition acceptée.');
    expect((await lastPrescription()).rirTarget).toBeNull();
  });
});

describe('I4-08 point 5 : deload du cycle pré-activé seulement sur une séance de la routine du cycle', () => {
  // Début le lundi 12 octobre : le 9 novembre est en semaine 5 (deload).
  const toggle = async () => within(await proposal()).findByRole('button', { name: 'Deload pour cette séance' });

  it('séance proposée depuis la routine du cycle : activé', async () => {
    await startCycle('2026-10-12');
    open();
    await startProposed();
    expect(await toggle()).toHaveAttribute('aria-pressed', 'true');
  });

  it('séance démarrée depuis la routine du cycle : activé', async () => {
    await startCycle('2026-10-12');
    await (await workouts()).start({ source: 'routine', routineId: CYCLE_ROUTINE.id, dayId: CYCLE_ROUTINE.days[0]?.id ?? '' });
    open();
    expect(await toggle()).toHaveAttribute('aria-pressed', 'true');
  });

  it('séance d’une autre routine : désactivé, aucune mention du cycle', async () => {
    await startCycle('2026-10-12');
    await (await workouts()).start({ source: 'routine', routineId: OTHER_ROUTINE.id, dayId: OTHER_ROUTINE.days[0]?.id ?? '' });
    open();
    const t = await toggle();
    expect(t).toHaveAttribute('aria-pressed', 'false');
    expect(within(await proposal()).queryByText(/Semaine de deload du cycle/)).toBeNull();
  });

  it('séance libre : désactivé', async () => {
    await startCycle('2026-10-12');
    const r = await workouts();
    await r.start({ source: 'empty', id: u(6), name: 'Libre' });
    await r.addExercise(u(6), { exerciseId: BENCH_ID, exerciseName: BENCH, sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
    open();
    expect(await toggle()).toHaveAttribute('aria-pressed', 'false');
  });
});
