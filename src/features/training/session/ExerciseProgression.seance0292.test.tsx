import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

/** SEANCE-0292 (C-069) : « Accepter » n’écrase jamais une série déjà validée (relue dans la transaction de la décision). Base SQLite réelle. */

const DEVICE = '60000000-0000-4000-8000-0000000000e4' as DeviceId;
const u = (n: number): string => `2b4c6d8e-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PAST = u(1);
const CURRENT = u(2);
const BENCH = 'Développé couché à la barre';

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

/** Séance close il y a trois jours : 3 × 10 à 60 kg au développé couché (haut de la plage 8–10). */
async function seedPast(): Promise<void> {
  const r = await db.data.repos.workouts();
  await r.start({ source: 'empty', id: PAST, name: 'Haut A' });
  const w = await r.addExercise(PAST, { exerciseId: 'bench-press-barbell', exerciseName: BENCH, sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
  for (const s of w.sets) await r.validateSet(s.id, { reps: 10, loadKg: 60 });
  await db.data.transaction(async (repos) => (await repos.workouts()).close(PAST));
  db.clock.advance(3 * 86_400_000);
}
/** Séance ouverte : 3 séries de développé couché, plage 8–10. */
async function seedCurrent(): Promise<void> {
  const r = await db.data.repos.workouts();
  await r.start({ source: 'empty', id: CURRENT, name: 'Haut B' });
  await r.addExercise(CURRENT, { exerciseId: 'bench-press-barbell', exerciseName: BENCH, sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
}
const block = async () => screen.findByRole('region', { name: BENCH });
const proposal = async () => within(await block()).findByRole('group', { name: 'Proposition' });

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-04T17:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('C-069 : « Accepter » après une validation pas encore redessinée', () => {
  it('série 1 validée à 90 × 8 (écran pas encore à jour), puis « Accepter » : la série validée garde 90 × 8, les autres sont remplies', async () => {
    await seedPast();
    await seedCurrent();
    openSession();
    const p = await proposal();
    const accept = await within(p).findByRole('button', { name: 'Accepter' });
    const r = await db.data.repos.workouts();
    const open = await r.getOpen();
    const first = open?.sets.find((x) => x.setKind === 'work');
    if (!first) throw new Error('série absente');
    // Validation écrite sans redessin de l'écran (deux gestes rapprochés) : l'instantané des séries de l'écran est périmé.
    await r.validateSet(first.id, { reps: 8, loadKg: 90 });
    fireEvent.click(accept);
    expect(await within(await proposal()).findByText('Proposition acceptée.')).toBeInTheDocument();
    const rows = await db.driver.select<{ id: string; load_kg: number | null; reps: number | null; done: number }>("SELECT id, load_kg, reps, done FROM workout_set WHERE set_kind = 'work' ORDER BY position");
    const mine = rows.filter((x) => x.id === first.id);
    expect(mine).toEqual([{ id: first.id, load_kg: 90, reps: 8, done: 1 }]);
    expect(rows.filter((x) => x.id !== first.id).map((x) => [x.load_kg, x.reps, x.done])).toEqual([
      [62.5, 8, 0],
      [62.5, 8, 0],
    ]);
  });
});
