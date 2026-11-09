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

/** REV-01 constat 6 : dans la séance active, le 2ᵉ exercice de pectoraux reçoit la décote de position, et la phrase le dit ; le 1er et les autres muscles non. */
const DEVICE = '60000000-0000-4000-8000-0000000000e6' as DeviceId;
const u = (n: number): string => `2b4c6d8e-0000-4000-8000-${String(n).padStart(12, '0')}`;
const BENCH = 'Développé couché à la barre';
const INCLINE = 'Développé incliné aux haltères';
const notifier: TimerNotifier = { permission: async () => 'granted', requestPermission: async () => 'granted', isPending: async () => false, schedule: async () => true, cancel: async () => undefined };
const liveActivity: LiveActivity = { isAvailable: async () => ({ available: false }) as never, start: async () => ({ started: false }) as never, end: async () => ({ ended: true, count: 0 }) };
let db: TestDb;

async function past(id: string, exerciseId: string, name: string, loadKg: number): Promise<void> {
  const r = await db.data.repos.workouts();
  await r.start({ source: 'empty', id, name: 'Haut A' });
  const w = await r.addExercise(id, { exerciseId, exerciseName: name, sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
  for (const s of w.sets) await r.validateSet(s.id, { reps: 10, loadKg });
  await db.data.transaction(async (repos) => (await repos.workouts()).close(id));
  db.clock.advance(86_400_000);
}

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-04T17:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('REV-01 constat 6 : position dans la séance active', () => {
  it('Haut / Bas, deux exercices de pectoraux : seul le deuxième est décoté, avec sa phrase', async () => {
    // Chaque exercice a été fait seul (rang 1) à sa dernière séance : la décote ne figure dans aucune charge de référence.
    await past(u(1), 'bench-press-barbell', BENCH, 60);
    await past(u(2), 'incline-press-dumbbell', INCLINE, 24);
    const r = await db.data.repos.workouts();
    await r.start({ source: 'empty', id: u(3), name: 'Haut B' });
    await r.addExercise(u(3), { exerciseId: 'bench-press-barbell', exerciseName: BENCH, sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
    await r.addExercise(u(3), { exerciseId: 'incline-press-dumbbell', exerciseName: INCLINE, sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
    act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'session' } as Route));
    render(
      <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
        <TrainingScreen session={{ os: 'other', notifier, liveActivity }} />
      </AppContainerProvider>,
    );
    const bench = await within(await screen.findByRole('region', { name: BENCH })).findByRole('group', { name: 'Proposition' });
    expect(await within(bench).findByText('62,5 kg × 8 · 8 · 8')).toBeInTheDocument();
    expect(within(bench).queryByText(/ᵉ exercice de ce muscle/)).toBeNull();
    const incline = await within(await screen.findByRole('region', { name: INCLINE })).findByRole('group', { name: 'Proposition' });
    expect(await within(incline).findByText(/2ᵉ exercice de ce muscle/)).toBeInTheDocument();
  });
});

describe('REV-01 (point 7 de 0.9.2) : poids de corps dans la séance active', () => {
  it('traction lestée : avec une pesée, le plafond +10 % se calcule sur la charge totale ; sans pesée, la phrase le dit', async () => {
    await past(u(11), 'pull-up-weighted', 'Traction lestée', 10);
    const r = await db.data.repos.workouts();
    await r.start({ source: 'empty', id: u(13), name: 'Dos' });
    await r.addExercise(u(13), { exerciseId: 'pull-up-weighted', exerciseName: 'Traction lestée', sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
    act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'session' } as Route));
    const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
    render(
      <AppContainerProvider container={container}>
        <TrainingScreen session={{ os: 'other', notifier, liveActivity }} />
      </AppContainerProvider>,
    );
    const group = await within(await screen.findByRole('region', { name: 'Traction lestée' })).findByRole('group', { name: 'Proposition' });
    expect(await within(group).findByText(/Poids de corps inconnu/)).toBeInTheDocument();
  });
});
