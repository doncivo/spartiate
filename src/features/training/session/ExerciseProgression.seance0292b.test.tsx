import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import { revertDecisionPrescription } from '../../../domain/training/revertPrescription';
import type { DeviceId, IsoDateTime } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import type { LiveActivity } from '../../../platform/liveActivity';
import type { TimerNotifier } from '../../../platform/notifications/timerNotification';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';

/**
 * SEANCE-0292b (BL-111, § 11.5) : « Revenir à la prescription précédente » depuis l'explication de la charge EN SÉANCE (la fiche l'avait
 * déjà, MOTEUR-0281b). Base SQLite réelle : deux séances closes avec leurs décisions (60 × 10 puis 62,5 × 8, une hausse), séance ouverte.
 */

const DEVICE = '60000000-0000-4000-8000-0000000000e5' as DeviceId;
const u = (n: number): string => `3c5d7e9f-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CURRENT = u(9);
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

/** Séance close avec sa décision tracée (valeurs retenues `loadKg` × `reps`), faite telle quelle. */
async function closedWithDecision(id: string, loadKg: number, reps: readonly number[]): Promise<void> {
  const r = await db.data.repos.workouts();
  await r.start({ source: 'empty', id, name: 'Haut' });
  const w = await r.addExercise(id, { exerciseId: 'bench-press-barbell', exerciseName: BENCH, sets: reps.length, targetRepsMin: 8, targetRepsMax: 10 });
  const traced = { ...revertDecisionPrescription({ loadKg, reps, decidedAt: new Date(db.clock.nowMs()).toISOString() as IsoDateTime }, 'load-reps'), reasons: ['decision-reference' as const] };
  await (await db.data.repos.progression()).recordDecision({ exerciseId: 'bench-press-barbell', workoutId: id, prescription: traced, accepted: true, chosenLoadKg: loadKg, chosenReps: reps });
  for (const [i, s] of w.sets.entries()) await r.validateSet(s.id, { reps: reps[i] ?? 8, loadKg });
  await db.data.transaction(async (repos) => (await repos.workouts()).close(id));
  db.clock.advance(3 * 86_400_000);
}

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-01T17:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('BL-111 : retour à la prescription précédente en séance', () => {
  it('après une hausse (60 × 10 → 62,5 × 8) : le bouton reprend 60 × 10 · 10 · 10, remplit les séries et trace un retour', async () => {
    await closedWithDecision(u(1), 60, [10, 10, 10]);
    await closedWithDecision(u(2), 62.5, [8, 8, 8]);
    const r = await db.data.repos.workouts();
    await r.start({ source: 'empty', id: CURRENT, name: 'Haut B' });
    await r.addExercise(CURRENT, { exerciseId: 'bench-press-barbell', exerciseName: BENCH, sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
    openSession();
    const p = await within(await screen.findByRole('region', { name: BENCH })).findByRole('group', { name: 'Proposition' });
    const back = await within(p).findByRole('button', { name: /Revenir à la prescription précédente/ });
    expect(within(p).getByText(/Avant ta dernière hausse/)).toBeInTheDocument();
    fireEvent.click(back);
    expect(await within(p).findByText('Valeurs retenues : 60 kg × 10.')).toBeInTheDocument();
    const rows = await db.driver.select<{ load_kg: number | null; reps: number | null }>(`SELECT load_kg, reps FROM workout_set WHERE set_kind = 'work' AND workout_id = '${CURRENT}' ORDER BY position`);
    expect(rows.map((x) => [x.load_kg, x.reps])).toEqual([[60, 10], [60, 10], [60, 10]]);
    const decision = await (await db.data.repos.progression()).decisionFor(CURRENT, 'bench-press-barbell');
    expect(decision?.revert).toBe(true);
  });

  it('sans hausse dans les décisions : aucun bouton de retour', async () => {
    await closedWithDecision(u(3), 60, [10, 10, 10]);
    const r = await db.data.repos.workouts();
    await r.start({ source: 'empty', id: CURRENT, name: 'Haut B' });
    await r.addExercise(CURRENT, { exerciseId: 'bench-press-barbell', exerciseName: BENCH, sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
    openSession();
    const p = await within(await screen.findByRole('region', { name: BENCH })).findByRole('group', { name: 'Proposition' });
    await within(p).findByRole('button', { name: 'Accepter' });
    expect(within(p).queryByRole('button', { name: /Revenir à la prescription précédente/ })).toBeNull();
  });
});
