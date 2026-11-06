import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { RoutineInput } from '../../../domain/training';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import type { LiveActivity } from '../../../platform/liveActivity';
import type { TimerNotifier } from '../../../platform/notifications/timerNotification';
import { seedPastWorkout } from '../../../../tests/fixtures/training/workout';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';

/**
 * I1-03 (interface, critères 7 et 8 ; § 13.5, § 13.8) sur base SQLite réelle : « Terminer la séance » (refus sans série validée,
 * confirmation si des séries prévues restent à faire, double appui sans effet), clôture atomique par le repository dans une transaction,
 * résumé (durée, séries, volume hors dégressives / partielles / chronométrées, records), « Mettre à jour la routine ? » (Oui / Cette fois
 * seulement : la routine n'est écrite qu'après « Oui »), minuteur et Live Activity arrêtés, copie de la séance close.
 */

const DEVICE = '60000000-0000-4000-8000-0000000000d3' as DeviceId;
const u = (n: number): string => `4d3c2b00-0000-4000-8000-${String(n).padStart(12, '0')}`;
const BENCH = 'Développé couché à la barre';
const ROW = 'Rowing à la barre';
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
        { id: u(3), exerciseId: 'bench-press-barbell', exerciseName: BENCH, sets: 3, repMin: 6, repMax: 10, rir: 2, restSec: 150, position: 0 },
        { id: u(4), exerciseId: 'row-barbell', exerciseName: ROW, sets: 2, repMin: 8, repMax: 12, rir: null, restSec: 120, position: 1 },
      ],
    },
  ],
};

function fakes() {
  const calls = { cancel: 0, ends: 0 };
  const notifier: TimerNotifier = {
    permission: async () => 'granted',
    requestPermission: async () => 'granted',
    isPending: async () => false,
    schedule: async () => true,
    cancel: async () => void calls.cancel++,
  };
  const liveActivity: LiveActivity = {
    isAvailable: async () => ({ available: true }),
    start: async () => ({ started: true }),
    end: async () => (calls.ends++, { ended: true, count: 1 }),
  };
  return { notifier, liveActivity, calls };
}

let db: TestDb;
const container = () => createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
const openSession = (f = fakes()) => {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'session' } as Route));
  return render(
    <AppContainerProvider container={container()}>
      <TrainingScreen session={{ os: 'ios', notifier: f.notifier, liveActivity: f.liveActivity }} />
    </AppContainerProvider>,
  );
};
const one = async <T,>(sql: string, params: unknown[] = []): Promise<T> => {
  const [row] = await db.driver.select<T & Record<string, string | number | null>>(sql, params as (string | number | null)[]);
  if (!row) throw new Error(`aucune ligne : ${sql}`);
  return row;
};
const count = async (sql: string, params: unknown[] = []): Promise<number> => (await one<{ n: number }>(sql, params)).n;
const setGroups = async (exercise: string) => within(await screen.findByRole('region', { name: exercise })).getAllByRole('group', { name: /^Série/ });
async function validateNext(exercise: string, load: string, reps: string): Promise<void> {
  const groups = await setGroups(exercise);
  const set = groups.find((g) => within(g).queryByRole('button', { name: 'Valider la série' }) !== null);
  if (!set) throw new Error('aucune série à valider');
  fireEvent.change(within(set).getByLabelText('Charge (kg)'), { target: { value: load } });
  fireEvent.change(within(set).getByLabelText('Répétitions'), { target: { value: reps } });
  fireEvent.click(within(set).getByRole('button', { name: 'Valider la série' }));
  await within(set).findByText('Validée');
}
const startFromRoutine = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /^Démarrer « Haut A »/ }));
  await screen.findByRole('heading', { level: 2, name: 'Haut A' });
};
const summaryRegion = () => screen.findByRole('region', { name: 'Résumé de la séance' });
const routineLines = () => db.driver.select('SELECT id, exercise_id, sets, deleted_at FROM routine_exercise ORDER BY id');

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T17:00:00.000Z');
  await (await db.data.repos.trainingRoutines()).create(ROUTINE);
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('« Terminer la séance »', () => {
  it('aucune série de travail validée : refus expliqué, rien n’est clos', async () => {
    openSession();
    await startFromRoutine();
    fireEvent.click(screen.getByRole('button', { name: 'Terminer la séance' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Valide au moins une série de travail');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(await one('SELECT ended_at FROM workout')).toEqual({ ended_at: null });
  });

  it('séries prévues non validées : confirmation ; « Continuer la séance » ne clôt rien', async () => {
    openSession();
    await startFromRoutine();
    await validateNext(BENCH, '60', '8');
    fireEvent.click(screen.getByRole('button', { name: 'Terminer la séance' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Terminer la séance ?' });
    expect(dialog).toHaveTextContent('4 séries prévues ne sont pas validées');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continuer la séance' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(await one('SELECT ended_at FROM workout')).toEqual({ ended_at: null });
  });

  it('clôture : résumé (durée, séries, volume hors dégressive) ; séance close en base, repos et Live Activity arrêtés ; aucune question de routine sans écart', async () => {
    // Une série dégressive validée avant le montage : elle compte dans les séries, pas dans le volume (§ 13.5).
    const workout = await db.data.transaction(async (r) => (await r.workouts()).start({ source: 'routine', routineId: u(1), dayId: u(2) }));
    const first = workout.sets[0];
    if (!first) throw new Error('séance sans série');
    await db.data.transaction(async (r) => {
      const repo = await r.workouts();
      await repo.updateSet(first.id, { setKind: 'drop' });
      await repo.validateSet(first.id, { loadKg: 40, reps: 10 });
    });
    const f = fakes();
    openSession(f);
    await screen.findByRole('heading', { level: 2, name: 'Haut A' });
    await validateNext(BENCH, '60', '8');
    await validateNext(BENCH, '62,5', '7');
    await validateNext(ROW, '50', '10');
    await screen.findByRole('timer', { name: 'Repos restant' });
    db.clock.advance(30 * 60_000);
    fireEvent.click(screen.getByRole('button', { name: 'Terminer la séance' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Terminer' }));
    const summary = await summaryRegion();
    expect(within(summary).getByRole('heading', { level: 2, name: 'Haut A terminée' })).toBeInTheDocument();
    expect(within(summary).getByText('Durée').nextElementSibling).toHaveTextContent('30:00');
    expect(within(summary).getByText('Séries').nextElementSibling).toHaveTextContent('4');
    expect(within(summary).getByText('Volume (kg)').nextElementSibling).toHaveTextContent(/^1 417,5$/);
    expect(within(summary).getByText(/Hors échauffement, séries dégressives, partielles et chronométrées/)).toBeInTheDocument();
    expect(within(summary).queryByText('Mettre à jour la routine ?')).toBeNull();
    expect(await one('SELECT ended_at, rest_timer_end_at FROM workout')).toEqual({ ended_at: '2026-11-09T17:30:00.000Z', rest_timer_end_at: null });
    expect(f.calls.ends).toBeGreaterThanOrEqual(1);
    expect(f.calls.cancel).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('timer', { name: 'Repos restant' })).toBeNull();
  });

  it('double appui puis clôture rejouée : une seule clôture, rien de plus en file', async () => {
    openSession();
    await startFromRoutine();
    for (const [load, reps] of [
      ['60', '8'],
      ['60', '8'],
      ['60', '7'],
    ] as const)
      await validateNext(BENCH, load, reps);
    await validateNext(ROW, '50', '10');
    await validateNext(ROW, '50', '9');
    const finish = screen.getByRole('button', { name: 'Terminer la séance' });
    fireEvent.click(finish);
    fireEvent.click(finish);
    await summaryRegion();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    const id = (await one<{ id: string }>('SELECT id FROM workout')).id;
    const before = await db.driver.select('SELECT table_name, row_id, field FROM sync_outbox ORDER BY seq');
    expect(await count("SELECT COUNT(*) AS n FROM sync_outbox WHERE table_name = 'workout' AND row_id = ?", [id])).toBe(1);
    const again = await db.data.transaction(async (r) => (await r.workouts()).close(id));
    expect(again.alreadyClosed).toBe(true);
    expect(await db.driver.select('SELECT table_name, row_id, field FROM sync_outbox ORDER BY seq')).toEqual(before);
  });

  it('records : une charge plus lourde que l’historique est signalée', async () => {
    await seedPastWorkout(db.driver);
    openSession();
    await startFromRoutine();
    await validateNext(BENCH, '65', '8');
    fireEvent.click(screen.getByRole('button', { name: 'Terminer la séance' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Terminer' }));
    const summary = await summaryRegion();
    const records = within(summary).getByRole('list', { name: 'Records' });
    expect(within(records).getAllByText(BENCH).length).toBeGreaterThanOrEqual(1);
    expect(records).toHaveTextContent('Charge la plus lourde : 65 kg (avant : 62,5 kg)');
    expect(within(summary).getByText('2 records')).toBeInTheDocument();
  });
});

describe('« Mettre à jour la routine ? » (§ 13.8)', () => {
  async function closeWithoutRowing(): Promise<HTMLElement> {
    openSession();
    await startFromRoutine();
    fireEvent.click(within(await screen.findByRole('region', { name: ROW })).getByRole('button', { name: 'Retirer l’exercice' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Retirer' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: ROW })).toBeNull());
    for (const reps of ['8', '8', '7']) await validateNext(BENCH, '60', reps);
    fireEvent.click(screen.getByRole('button', { name: 'Terminer la séance' }));
    return summaryRegion();
  }

  it('écart avec la routine : la question est posée, rien n’est écrit avant « Oui » ; « Oui » met la routine à jour', async () => {
    const before = await routineLines();
    const summary = await closeWithoutRowing();
    const question = within(summary).getByRole('group', { name: 'Mettre à jour la routine ?' });
    expect(question).toHaveTextContent(`${ROW} : retiré`);
    expect(await routineLines()).toEqual(before);
    fireEvent.click(within(question).getByRole('button', { name: 'Oui' }));
    expect(await within(summary).findByText('Routine mise à jour.')).toBeInTheDocument();
    expect(within(summary).queryByRole('group', { name: 'Mettre à jour la routine ?' })).toBeNull();
    expect(await one('SELECT deleted_at IS NOT NULL AS gone FROM routine_exercise WHERE id = ?', [u(4)])).toEqual({ gone: 1 });
    expect(await one('SELECT deleted_at FROM routine_exercise WHERE id = ?', [u(3)])).toEqual({ deleted_at: null });
  });

  it('« Cette fois seulement » : la routine reste telle quelle', async () => {
    const before = await routineLines();
    const summary = await closeWithoutRowing();
    fireEvent.click(within(within(summary).getByRole('group', { name: 'Mettre à jour la routine ?' })).getByRole('button', { name: 'Cette fois seulement' }));
    expect(await within(summary).findByText('La routine reste inchangée.')).toBeInTheDocument();
    expect(await routineLines()).toEqual(before);
  });
});

describe('après la clôture', () => {
  it('« Fermer » revient aux options de départ ; la séance close se copie (historique réel)', async () => {
    openSession();
    await startFromRoutine();
    for (const reps of ['8', '8', '7']) await validateNext(BENCH, '60', reps);
    await validateNext(ROW, '50', '10');
    await validateNext(ROW, '50', '9');
    fireEvent.click(screen.getByRole('button', { name: 'Terminer la séance' }));
    fireEvent.click(within(await summaryRegion()).getByRole('button', { name: 'Fermer le résumé' }));
    fireEvent.click(await screen.findByRole('button', { name: /^Copier « Haut A »/ }));
    expect((await screen.findAllByText('Dernière fois : 60 kg × 8')).length).toBe(2);
    expect(await count('SELECT COUNT(*) AS n FROM workout WHERE ended_at IS NULL AND source = ?', ['copy'])).toBe(1);
  });
});
