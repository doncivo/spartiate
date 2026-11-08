import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import type { LiveActivity } from '../../../platform/liveActivity';
import type { TimerNotifier } from '../../../platform/notifications/timerNotification';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';

/**
 * I2-04 (points 2 et 3) : la phrase de la proposition dit qu'une séance partielle a été ignorée et que la grille de charges repose sur du
 * matériel « à vérifier » (barre EZ du profil embarqué Fitness Park Antony). Information seulement : la proposition reste proposée.
 */

const DEVICE = '60000000-0000-4000-8000-0000000000e5' as DeviceId;
const u = (n: number): string => `3c5d7e9f-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CURRENT = u(9);
const BENCH = { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché à la barre' };
const SKULL = { exerciseId: 'skull-crusher', exerciseName: 'Barre au front' };

const notifier: TimerNotifier = { permission: async () => 'granted', requestPermission: async () => 'granted', isPending: async () => false, schedule: async () => true, cancel: async () => undefined };
const liveActivity: LiveActivity = { isAvailable: async () => ({ available: false }) as never, start: async () => ({ started: false }) as never, end: async () => ({ ended: true, count: 0 }) };

let db: TestDb;
const openSession = () => {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'session' } as Route));
  return render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <TrainingScreen session={{ os: 'other', notifier, liveActivity }} />
    </AppContainerProvider>,
  );
};

/** Séance close à `loadKg`, une série par valeur de `reps`, les `done` premières validées ; trois jours passent ensuite. */
async function seedPast(id: string, exercise: typeof BENCH, loadKg: number, reps: readonly number[], done = reps.length): Promise<void> {
  const r = await db.data.repos.workouts();
  await r.start({ source: 'empty', id, name: 'Haut A' });
  const w = await r.addExercise(id, { ...exercise, sets: reps.length, targetRepsMin: 8, targetRepsMax: 10 });
  for (const [i, s] of w.sets.entries()) if (i < done) await r.validateSet(s.id, { reps: reps[i] ?? 0, loadKg });
  await db.data.transaction(async (repos) => (await repos.workouts()).close(id));
  db.clock.advance(3 * 86_400_000);
}
async function seedCurrent(exercise: typeof BENCH): Promise<void> {
  const r = await db.data.repos.workouts();
  await r.start({ source: 'empty', id: CURRENT, name: 'Haut B' });
  await r.addExercise(CURRENT, { ...exercise, sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
}
const proposal = async (exercise: typeof BENCH) => within(await screen.findByRole('region', { name: exercise.exerciseName })).findByRole('group', { name: 'Proposition' });

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-01T17:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('séance partielle ignorée (I2-04, point 3)', () => {
  it('1 série faite sur 3 : la phrase le dit ; la proposition vient de la séance complète précédente', async () => {
    await seedPast(u(1), BENCH, 100, [8, 8, 8]);
    await seedPast(u(2), BENCH, 100, [4, 4, 4], 1);
    await seedCurrent(BENCH);
    openSession();
    const p = await proposal(BENCH);
    expect(await within(p).findByText('100 kg × 9 · 8 · 8')).toBeInTheDocument();
    expect(within(p).getByText('Même charge, une répétition de plus sur la série 1. Ta dernière séance (moins de la moitié des séries faites) n’est pas prise en compte.')).toBeInTheDocument();
  });
});

describe('matériel à vérifier (I2-04, point 2)', () => {
  it('barre EZ « à vérifier » dans le profil embarqué : la phrase le signale, la proposition reste proposée', async () => {
    await seedPast(u(1), SKULL, 28.5, [8, 8, 8]);
    await seedCurrent(SKULL);
    openSession();
    const p = await proposal(SKULL);
    expect(await within(p).findByText('28,5 kg × 9 · 8 · 8')).toBeInTheDocument();
    expect(within(p).getByText('Même charge, une répétition de plus sur la série 1. Charges calculées sur du matériel à vérifier en salle (profil de matériel).')).toBeInTheDocument();
    expect(within(p).getByRole('button', { name: 'Accepter' })).toBeEnabled();
  });
});
