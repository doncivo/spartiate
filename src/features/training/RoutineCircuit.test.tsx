import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { RoutineInput } from '../../domain/training';
import type { DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../app/navigation';
import { TrainingScreen } from './TrainingScreen';

/**
 * I6-03b (§ 13.8, constat 11 de la relecture Codex du 12/11) : dans l'éditeur de routine, « Grouper en circuit » relie des exercices d'un jour (deux =
 * superset, trois = triset, quatre ou plus = circuit), avec nombre de tours, repos entre exercices et repos de fin de tour ; le groupe est dit en
 * texte, enregistré avec la routine, et retrouvé dans la séance démarrée depuis ce jour. « Défaire le groupe » et le retrait d'un exercice le dissolvent.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000c9' as DeviceId;
const u = (n: number): string => `3c2b1a00-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ROUTINE: RoutineInput = {
  id: u(1),
  name: 'Haut / Bas',
  mode: 'libre',
  days: [
    {
      id: u(2),
      name: 'Haut A',
      dayOrder: 1,
      exercises: [
        { id: u(3), exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché à la barre', sets: 3, repMin: 6, repMax: 10, rir: 2, restSec: 150, position: 0 },
        { id: u(4), exerciseId: 'row-barbell', exerciseName: 'Rowing à la barre', sets: 2, repMin: 8, repMax: 12, rir: null, restSec: 120, position: 1 },
        { id: u(5), exerciseId: 'overhead-press-barbell', exerciseName: 'Développé militaire', sets: 2, repMin: 6, repMax: 10, rir: 2, restSec: 120, position: 2 },
      ],
    },
  ],
};
const BENCH = 'Développé couché à la barre';
const ROW = 'Rowing à la barre';

let db: TestDb;
const container = () => createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
function show(screenId: 'routines' | 'session'): void {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: screenId } as Route));
  render(
    <AppContainerProvider container={container()}>
      <TrainingScreen session={{ os: 'other' }} />
    </AppContainerProvider>,
  );
}
async function openEditor(): Promise<HTMLElement> {
  show('routines');
  fireEvent.click(await screen.findByRole('button', { name: /^Haut \/ Bas/ }));
  return screen.findByRole('group', { name: 'Haut A' });
}
async function groupTwo(day: HTMLElement, restBetween = '15', restRound = '90', rounds = ''): Promise<HTMLElement> {
  fireEvent.click(within(day).getByRole('button', { name: 'Grouper en circuit' }));
  const form = await within(day).findByRole('region', { name: 'Superset, triset ou circuit' });
  fireEvent.click(within(form).getByRole('checkbox', { name: BENCH }));
  fireEvent.click(within(form).getByRole('checkbox', { name: ROW }));
  fireEvent.change(within(form).getByLabelText('Nombre de tours'), { target: { value: rounds } });
  fireEvent.change(within(form).getByLabelText('Repos entre exercices (s)'), { target: { value: restBetween } });
  fireEvent.change(within(form).getByLabelText('Repos de fin de tour (s)'), { target: { value: restRound } });
  fireEvent.click(within(form).getByRole('button', { name: 'Créer le groupe' }));
  return within(day).findByRole('region', { name: 'Groupe : Superset' });
}
const saved = () => db.driver.select<{ exercise_id: string; sets: number; rest_sec: number; position: number; circuit_id: string | null; circuit_rest_sec: number | null }>('SELECT exercise_id, sets, rest_sec, position, circuit_id, circuit_rest_sec FROM routine_exercise WHERE deleted_at IS NULL ORDER BY position');

beforeAll(async () => {
  await Promise.all([import('./TrainingScreen'), import('./RoutineCircuitUi'), import('./session/ActiveSession'), import('./session/CircuitUi'), import('./session/StartSession'), import('./session/ExerciseProgression'), import('./session/RecoverySession')]);
}, 60_000);

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-12T17:00:00.000Z');
  await (await db.data.repos.trainingRoutines()).create(ROUTINE);
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('éditeur de routine : grouper', () => {
  it('deux exercices cochés : groupe annoncé en texte (nature, tours, repos), puis enregistré avec la routine', async () => {
    const day = await openEditor();
    const header = await groupTwo(day);
    expect(within(header).getByText('Superset · 2 exercices · 3 tours')).toBeInTheDocument();
    expect(within(header).getByText(/Repos entre exercices : 15 s · repos de fin de tour : 1 min 30/)).toBeInTheDocument();
    expect(within(header).getByText(`${BENCH}, ${ROW}`)).toBeInTheDocument();
    // Rien n'est écrit avant « Enregistrer la routine ».
    expect((await saved()).every((r) => r.circuit_id === null)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la routine' }));
    expect(await screen.findByText('Routine enregistrée')).toBeInTheDocument();
    const rows = await saved();
    expect(rows.map((r) => r.exercise_id)).toEqual(['bench-press-barbell', 'row-barbell', 'overhead-press-barbell']);
    expect(rows.slice(0, 2).every((r) => r.circuit_id !== null && r.circuit_id === rows[0]?.circuit_id && r.circuit_rest_sec === 15 && r.sets === 3 && r.rest_sec === 90)).toBe(true);
    expect(rows[2]).toMatchObject({ circuit_id: null, circuit_rest_sec: null, sets: 2, rest_sec: 120 });
  });

  it('moins de deux exercices cochés ou valeurs hors bornes : refus dit en texte, aucun groupe', async () => {
    const day = await openEditor();
    fireEvent.click(within(day).getByRole('button', { name: 'Grouper en circuit' }));
    const form = await within(day).findByRole('region', { name: 'Superset, triset ou circuit' });
    fireEvent.click(within(form).getByRole('checkbox', { name: BENCH }));
    fireEvent.click(within(form).getByRole('button', { name: 'Créer le groupe' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('Coche au moins deux exercices.');
    fireEvent.click(within(form).getByRole('checkbox', { name: ROW }));
    fireEvent.change(within(form).getByLabelText('Repos de fin de tour (s)'), { target: { value: '901' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Créer le groupe' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('Valeurs hors bornes');
    expect(within(day).queryByRole('region', { name: 'Groupe : Superset' })).toBeNull();
  });

  it('« Défaire le groupe » et retrait d’un exercice d’un superset : le groupe disparaît', async () => {
    const day = await openEditor();
    const header = await groupTwo(day);
    fireEvent.click(within(header).getByRole('button', { name: 'Défaire le groupe' }));
    await waitFor(() => expect(within(day).queryByRole('region', { name: 'Groupe : Superset' })).toBeNull());
    await groupTwo(day);
    fireEvent.click(within(within(day).getByRole('group', { name: ROW })).getByRole('button', { name: 'Retirer' }));
    await waitFor(() => expect(within(day).queryByRole('region', { name: 'Groupe : Superset' })).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la routine' }));
    expect(await screen.findByText('Routine enregistrée')).toBeInTheDocument();
    expect((await saved()).every((r) => r.circuit_id === null && r.circuit_rest_sec === null)).toBe(true);
  });
});

describe('séance démarrée depuis la routine groupée', () => {
  it('le groupe est retrouvé dans la séance active (en-tête, séries alternées)', async () => {
    const day = await openEditor();
    await groupTwo(day, '0', '90', '2');
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la routine' }));
    expect(await screen.findByText('Routine enregistrée')).toBeInTheDocument();
    cleanup();
    show('session');
    fireEvent.click(await screen.findByRole('button', { name: /^Démarrer « Haut A »/ }));
    const header = await screen.findByRole('region', { name: 'Groupe : Superset' });
    expect(within(header).getByText(/Superset · 2 exercices · 2 tours/)).toBeInTheDocument();
    expect(within(header).getByText(`Suivant : ${BENCH} (tour 1 sur 2)`)).toBeInTheDocument();
    const rows = await db.driver.select<{ exercise_id: string; circuit_id: string | null }>('SELECT exercise_id, circuit_id FROM workout_set ORDER BY position');
    expect(rows.map((r) => r.exercise_id)).toEqual(['bench-press-barbell', 'row-barbell', 'bench-press-barbell', 'row-barbell', 'overhead-press-barbell', 'overhead-press-barbell']);
  });
});
