import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
 * SESS-01a, recette du brief : « Développé couché à la barre » → « Développé couché aux haltères » en séance, alternatives de la fiche d'abord,
 * charge de départ estimée (80 kg → 2 × 30 kg, profil embarqué par défaut), case « Remplacer aussi dans la routine ».
 */

const DEVICE = '60000000-0000-4000-8000-0000000000f2' as DeviceId;
const u = (n: number): string => `5e5a0201-0000-4000-8000-${String(n).padStart(12, '0')}`;
const BENCH = 'Développé couché à la barre';
const BENCH_DB = 'Développé couché aux haltères';
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
        { id: u(4), exerciseId: 'row-barbell', exerciseName: 'Rowing à la barre', sets: 2, repMin: 8, repMax: 12, rir: null, restSec: 120, position: 1 },
      ],
    },
  ],
};

const notifier: TimerNotifier = { permission: async () => 'granted', requestPermission: async () => 'granted', isPending: async () => false, schedule: async () => true, cancel: async () => undefined };
const liveActivity: LiveActivity = { isAvailable: async () => ({ available: true }), start: async () => ({ started: true }), end: async () => ({ ended: true, count: 1 }) };

let db: TestDb;
const openSession = () => {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'session' } as Route));
  const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
  return render(
    <AppContainerProvider container={container}>
      <TrainingScreen session={{ os: 'other', notifier, liveActivity }} />
    </AppContainerProvider>,
  );
};
const rows = (sql: string) => db.driver.select<Record<string, string | number | null>>(sql);

async function startAndValidateOneBench(): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: /^Démarrer « Haut A »/ }));
  const block = await screen.findByRole('region', { name: BENCH });
  const [first] = within(block).getAllByRole('group', { name: /^Série/ });
  if (!first) throw new Error('aucune série');
  fireEvent.change(within(first).getByLabelText(/^Charge/), { target: { value: '80' } });
  fireEvent.change(within(first).getByLabelText(tTraining('sessionReps')), { target: { value: '8' } });
  fireEvent.click(within(first).getByRole('button', { name: tTraining('sessionValidate') }));
  await within(first).findByText(tTraining('sessionDone'));
}

async function chooseDumbbells(): Promise<HTMLElement> {
  fireEvent.click(within(await screen.findByRole('region', { name: BENCH })).getByRole('button', { name: tSession('replace') }));
  const sheet = await screen.findByRole('region', { name: tSession('replaceTitle', { name: BENCH }) });
  const alternatives = within(sheet).getByRole('list', { name: tSession('replaceAlternatives') });
  fireEvent.click(within(alternatives).getByRole('button', { name: BENCH_DB }));
  return sheet;
}

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-21T17:00:00.000Z');
  await (await db.data.repos.trainingRoutines()).create(ROUTINE);
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('SESS-01a — remplacer l’exercice en séance', () => {
  it('barre → haltères : alternative de la fiche, 2 × 30 kg estimés et dits, position et séries gardées, série validée conservée, routine aussi', async () => {
    openSession();
    await startAndValidateOneBench();
    const sheet = await chooseDumbbells();
    expect(await within(sheet).findByText(/2 × 30 kg/)).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('checkbox', { name: tSession('replaceRoutine') }));
    fireEvent.click(within(sheet).getByRole('button', { name: tSession('replaceConfirm') }));
    const block = await screen.findByRole('region', { name: BENCH_DB });
    expect(within(block).getAllByRole('group', { name: /^Série/ })).toHaveLength(2);
    expect(await rows("SELECT position, exercise_id, target_reps_min, target_reps_max, target_load_kg, done FROM workout_set WHERE deleted_at IS NULL ORDER BY position")).toEqual([
      { position: 0, exercise_id: 'bench-press-barbell', target_reps_min: 6, target_reps_max: 10, target_load_kg: null, done: 1 },
      { position: 1, exercise_id: 'bench-press-dumbbell', target_reps_min: 6, target_reps_max: 10, target_load_kg: 30, done: 0 },
      { position: 2, exercise_id: 'bench-press-dumbbell', target_reps_min: 6, target_reps_max: 10, target_load_kg: 30, done: 0 },
      { position: 3, exercise_id: 'row-barbell', target_reps_min: 8, target_reps_max: 12, target_load_kg: null, done: 0 },
      { position: 4, exercise_id: 'row-barbell', target_reps_min: 8, target_reps_max: 12, target_load_kg: null, done: 0 },
    ]);
    expect(await rows(`SELECT exercise_id, exercise_name, sets, rep_min, rep_max, rest_sec, position FROM routine_exercise WHERE id = '${u(3)}'`)).toEqual([
      { exercise_id: 'bench-press-dumbbell', exercise_name: BENCH_DB, sets: 3, rep_min: 6, rep_max: 10, rest_sec: 150, position: 0 },
    ]);
  });

  it('sans la case : la routine n’est pas touchée (la question « Mettre à jour la routine ? » viendra à la fin)', async () => {
    openSession();
    await startAndValidateOneBench();
    const sheet = await chooseDumbbells();
    fireEvent.click(within(sheet).getByRole('button', { name: tSession('replaceConfirm') }));
    await screen.findByRole('region', { name: BENCH_DB });
    expect(await rows(`SELECT exercise_id FROM routine_exercise WHERE id = '${u(3)}'`)).toEqual([{ exercise_id: 'bench-press-barbell' }]);
  });

  it('« Annuler » ne change rien ; un exercice déjà dans la séance n’est pas proposé', async () => {
    openSession();
    fireEvent.click(await screen.findByRole('button', { name: /^Démarrer « Haut A »/ }));
    fireEvent.click(within(await screen.findByRole('region', { name: BENCH })).getByRole('button', { name: tSession('replace') }));
    const sheet = await screen.findByRole('region', { name: tSession('replaceTitle', { name: BENCH }) });
    expect(within(sheet).queryByRole('button', { name: 'Rowing à la barre' })).toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: tSession('replaceCancel') }));
    expect(screen.queryByRole('region', { name: tSession('replaceTitle', { name: BENCH }) })).toBeNull();
    expect((await rows('SELECT DISTINCT exercise_id FROM workout_set ORDER BY exercise_id')).map((r) => r.exercise_id)).toEqual(['bench-press-barbell', 'row-barbell']);
  });
});
