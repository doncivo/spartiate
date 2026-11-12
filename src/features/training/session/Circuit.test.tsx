import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { RoutineInput } from '../../../domain/training';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';

/**
 * I6-03 (§ 13.8, circuits) : dans la séance active, « Grouper en circuit » relie des exercices (deux = superset, trois = triset, quatre ou plus =
 * circuit : un seul mécanisme), avec nombre de tours, repos entre exercices et repos de fin de tour. Séries alternées, tour et exercice suivant dits
 * en texte, minuteur de repos : aucun entre deux exercices d'un même tour (repos nul), le repos de fin de tour après le dernier exercice du tour.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000c3' as DeviceId;
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
        { id: u(3), exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché à la barre', sets: 3, repMin: 6, repMax: 10, rir: 2, restSec: 150, position: 0 },
        { id: u(4), exerciseId: 'row-barbell', exerciseName: 'Rowing à la barre', sets: 3, repMin: 8, repMax: 12, rir: null, restSec: 120, position: 1 },
        { id: u(5), exerciseId: 'overhead-press-barbell', exerciseName: 'Développé militaire', sets: 2, repMin: 6, repMax: 10, rir: 2, restSec: 120, position: 2 },
      ],
    },
  ],
};
const BENCH = 'Développé couché à la barre';
const ROW = 'Rowing à la barre';

let db: TestDb;
const container = () => createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
async function openActive(): Promise<void> {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'session' } as Route));
  render(
    <AppContainerProvider container={container()}>
      <TrainingScreen session={{ os: 'other' }} />
    </AppContainerProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /^Démarrer « Haut A »/ }));
  await screen.findByRole('heading', { level: 2, name: 'Haut A' });
}
const circuitRows = () => db.driver.select<{ exercise_id: string; circuit_id: string | null; circuit_rest_sec: number | null; target_rest_sec: number | null }>('SELECT exercise_id, circuit_id, circuit_rest_sec, target_rest_sec FROM workout_set ORDER BY position');
async function createSuperset(restBetween = '0', restRound = '90'): Promise<HTMLElement> {
  fireEvent.click(await screen.findByRole('button', { name: 'Grouper en circuit' }));
  const form = await screen.findByRole('region', { name: 'Superset, triset ou circuit' });
  fireEvent.click(within(form).getByRole('checkbox', { name: BENCH }));
  fireEvent.click(within(form).getByRole('checkbox', { name: ROW }));
  fireEvent.change(within(form).getByLabelText('Repos entre exercices (s)'), { target: { value: restBetween } });
  fireEvent.change(within(form).getByLabelText('Repos de fin de tour (s)'), { target: { value: restRound } });
  fireEvent.click(within(form).getByRole('button', { name: 'Créer le groupe' }));
  return screen.findByRole('region', { name: 'Groupe : Superset' });
}
async function validateFirstOpen(exercise: string): Promise<void> {
  const block = await screen.findByRole('region', { name: exercise });
  const open = within(block).getAllByRole('group', { name: /^Série/ }).find((g) => within(g).queryByRole('button', { name: 'Valider la série' }) !== null);
  if (!open) throw new Error('aucune série à valider');
  fireEvent.change(within(open).getByLabelText('Charge (kg)'), { target: { value: '40' } });
  fireEvent.change(within(open).getByLabelText('Répétitions'), { target: { value: '10' } });
  fireEvent.click(within(open).getByRole('button', { name: 'Valider la série' }));
  await within(open).findByText('Validée');
}

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T17:00:00.000Z');
  await (await db.data.repos.trainingRoutines()).create(ROUTINE);
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('créer un groupe', () => {
  it('deux exercices cochés : superset de 3 tours (le plus grand nombre de séries), séries alternées en base, groupe annoncé en texte', async () => {
    await openActive();
    const header = await createSuperset();
    expect(within(header).getByText(/Superset · 2 exercices · 3 tours/)).toBeInTheDocument();
    expect(within(header).getByText(/Repos entre exercices : aucun · repos de fin de tour : 1 min 30/)).toBeInTheDocument();
    expect(within(header).getByText(`Suivant : ${BENCH} (tour 1 sur 3)`)).toBeInTheDocument();
    const rows = await circuitRows();
    expect(rows.slice(0, 6).map((r) => r.exercise_id)).toEqual(['bench-press-barbell', 'row-barbell', 'bench-press-barbell', 'row-barbell', 'bench-press-barbell', 'row-barbell']);
    expect(rows.slice(0, 6).every((r) => r.circuit_id !== null && r.circuit_id === rows[0]?.circuit_id && r.circuit_rest_sec === 0 && r.target_rest_sec === 90)).toBe(true);
    expect(rows[6]?.circuit_id).toBeNull();
  });

  it('trois exercices : triset ; quatre : circuit (même mécanisme)', async () => {
    await openActive();
    fireEvent.click(await screen.findByRole('button', { name: 'Grouper en circuit' }));
    const form = await screen.findByRole('region', { name: 'Superset, triset ou circuit' });
    for (const name of [BENCH, ROW, 'Développé militaire']) fireEvent.click(within(form).getByRole('checkbox', { name }));
    fireEvent.click(within(form).getByRole('button', { name: 'Créer le groupe' }));
    expect(await screen.findByRole('region', { name: 'Groupe : Triset' })).toBeInTheDocument();
  });

  it('moins de deux exercices cochés : refus dit en texte, rien n’est écrit', async () => {
    await openActive();
    fireEvent.click(await screen.findByRole('button', { name: 'Grouper en circuit' }));
    const form = await screen.findByRole('region', { name: 'Superset, triset ou circuit' });
    fireEvent.click(within(form).getByRole('checkbox', { name: BENCH }));
    fireEvent.click(within(form).getByRole('button', { name: 'Créer le groupe' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('Coche au moins deux exercices.');
    expect((await circuitRows()).every((r) => r.circuit_id === null)).toBe(true);
  });

  it('valeurs hors bornes : refus dit en texte, rien n’est écrit', async () => {
    await openActive();
    fireEvent.click(await screen.findByRole('button', { name: 'Grouper en circuit' }));
    const form = await screen.findByRole('region', { name: 'Superset, triset ou circuit' });
    fireEvent.click(within(form).getByRole('checkbox', { name: BENCH }));
    fireEvent.click(within(form).getByRole('checkbox', { name: ROW }));
    fireEvent.change(within(form).getByLabelText('Repos de fin de tour (s)'), { target: { value: '9999' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Créer le groupe' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('Valeurs hors bornes');
    expect((await circuitRows()).every((r) => r.circuit_id === null)).toBe(true);
  });
});

describe('dérouler un groupe', () => {
  it('entre deux exercices d’un tour (repos nul) : aucun minuteur ; après le dernier exercice du tour : repos de fin de tour ; le suivant avance', async () => {
    await openActive();
    const header = await createSuperset('0', '90');
    await validateFirstOpen(BENCH);
    expect(screen.queryByRole('timer', { name: 'Repos restant' })).toBeNull();
    await waitFor(() => expect(within(header).getByText(`Suivant : ${ROW} (tour 1 sur 3)`)).toBeInTheDocument());
    await validateFirstOpen(ROW);
    expect(await screen.findByRole('timer', { name: 'Repos restant' })).toHaveTextContent('1:30');
    await waitFor(() => expect(within(header).getByText(`Suivant : ${BENCH} (tour 2 sur 3)`)).toBeInTheDocument());
  });

  it('repos entre exercices non nul : le minuteur démarre à la validation du premier exercice du tour', async () => {
    await openActive();
    await createSuperset('20', '90');
    await validateFirstOpen(BENCH);
    expect(await screen.findByRole('timer', { name: 'Repos restant' })).toHaveTextContent('0:20');
  });

  it('« Défaire le groupe » : les exercices redeviennent indépendants, les séries faites sont gardées', async () => {
    await openActive();
    const header = await createSuperset();
    await validateFirstOpen(BENCH);
    fireEvent.click(within(header).getByRole('button', { name: 'Défaire le groupe' }));
    await waitFor(async () => expect((await circuitRows()).every((r) => r.circuit_id === null)).toBe(true));
    expect(screen.queryByRole('region', { name: 'Groupe : Superset' })).toBeNull();
    expect(await db.driver.select('SELECT 1 FROM workout_set WHERE done = 1')).toHaveLength(1);
  });
});
