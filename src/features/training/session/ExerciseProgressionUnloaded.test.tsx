import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { tProgression } from '../../../i18n/progressionText';
import type { LiveActivity } from '../../../platform/liveActivity';
import type { TimerNotifier } from '../../../platform/notifications/timerNotification';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';

/**
 * MOTEUR-0281a (§ 11.3, § 13.2) : proposition d'un exercice au poids du corps (répétitions, « Poids du corps × … ») et d'un chronométré
 * (secondes) dans la séance active ; « Accepter » remplit les répétitions, ou la durée des séries chronométrées. Données SYNTHÉTIQUES.
 */
const DEVICE = '60000000-0000-4000-8000-0000000002a1' as DeviceId;
const u = (n: number): string => `2b4c6d8e-0000-4000-8000-${String(n).padStart(12, '0')}`;
const notifier: TimerNotifier = { permission: async () => 'granted', requestPermission: async () => 'granted', isPending: async () => false, schedule: async () => true, cancel: async () => undefined };
const liveActivity: LiveActivity = { isAvailable: async () => ({ available: false }) as never, start: async () => ({ started: false }) as never, end: async () => ({ ended: true, count: 0 }) };
let db: TestDb;

const rows = async (sql: string): Promise<Record<string, string | number | null>[]> => db.driver.select<Record<string, string | number | null>>(sql);

async function seed(exerciseId: string, name: string, range: readonly [number, number], value: { readonly reps?: number; readonly durationSec?: number }): Promise<HTMLElement> {
  const r = await db.data.repos.workouts();
  await r.start({ source: 'empty', id: u(1), name: 'A' });
  const w = await r.addExercise(u(1), { exerciseId, exerciseName: name, sets: 3, targetRepsMin: range[0], targetRepsMax: range[1] });
  for (const s of w.sets) {
    if (value.durationSec !== undefined) await r.updateSet(s.id, { setKind: 'timed' });
    await r.validateSet(s.id, value);
  }
  await db.data.transaction(async (repos) => (await repos.workouts()).close(u(1)));
  db.clock.advance(2 * 86_400_000);
  await r.start({ source: 'empty', id: u(2), name: 'B' });
  const next = await r.addExercise(u(2), { exerciseId, exerciseName: name, sets: 3, targetRepsMin: range[0], targetRepsMax: range[1] });
  if (value.durationSec !== undefined) for (const s of next.sets) await r.updateSet(s.id, { setKind: 'timed' });
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'session' } as Route));
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <TrainingScreen session={{ os: 'other', notifier, liveActivity }} />
    </AppContainerProvider>,
  );
  return within(await screen.findByRole('region', { name })).findByRole('group', { name: tProgression('title') });
}

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-04T17:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

const join = (parts: readonly string[]): string => parts.join(tProgression('repsJoin'));

describe('MOTEUR-0281a : séance active, exercices sans charge', () => {
  it('chronométré 3 × 45 s : « 49 s · 49 s · 49 s », phrase en secondes ; Accepter remplit la durée', async () => {
    const group = await seed('plank', 'Planche', [45, 45], { durationSec: 45 });
    const value = join([49, 49, 49].map((sec) => tProgression('valueSeconds', { sec })));
    expect(await within(group).findByText(value)).toBeInTheDocument();
    expect(within(group).getByText(tProgression('explainTimeIncrease', { delta: 4, sets: 3, sec: 45 }))).toBeInTheDocument();
    fireEvent.click(within(group).getByRole('button', { name: tProgression('accept') }));
    await within(group).findByText(tProgression('accepted'));
    await waitFor(async () => expect((await rows(`SELECT duration_sec, reps, load_kg FROM workout_set WHERE workout_id = '${u(2)}' ORDER BY position`)).map((r) => r['duration_sec'])).toEqual([49, 49, 49]));
    expect((await rows(`SELECT reps, load_kg FROM workout_set WHERE workout_id = '${u(2)}'`)).every((r) => r['reps'] === null && r['load_kg'] === null)).toBe(true);
  });

  it('poids du corps 3 × 10 (plage 8-15) : « Poids du corps × 11 · 10 · 10 » ; Accepter remplit les répétitions sans charge', async () => {
    const group = await seed('push-up', 'Pompe', [8, 15], { reps: 10 });
    expect(await within(group).findByText(tProgression('valueBodyweight', { reps: join(['11', '10', '10']) }))).toBeInTheDocument();
    expect(within(group).getByText(tProgression('explainBodyweightRepLadder', { set: 1 }))).toBeInTheDocument();
    fireEvent.click(within(group).getByRole('button', { name: tProgression('accept') }));
    await within(group).findByText(tProgression('accepted'));
    await waitFor(async () => expect((await rows(`SELECT reps FROM workout_set WHERE workout_id = '${u(2)}' ORDER BY position`)).map((r) => r['reps'])).toEqual([11, 10, 10]));
    expect((await rows(`SELECT load_kg FROM workout_set WHERE workout_id = '${u(2)}'`)).every((r) => r['load_kg'] === null)).toBe(true);
  });

  it('Modifier un chronométré : le champ dit des secondes et écrit la durée', async () => {
    const group = await seed('plank', 'Planche', [45, 45], { durationSec: 45 });
    fireEvent.click(await within(group).findByRole('button', { name: tProgression('modify') }));
    fireEvent.change(within(group).getByLabelText(tProgression('editSeconds')), { target: { value: '50' } });
    fireEvent.click(within(group).getByRole('button', { name: tProgression('save') }));
    await waitFor(async () => expect((await rows(`SELECT duration_sec FROM workout_set WHERE workout_id = '${u(2)}' ORDER BY position`)).map((r) => r['duration_sec'])).toEqual([50, 50, 50]));
  });
});
