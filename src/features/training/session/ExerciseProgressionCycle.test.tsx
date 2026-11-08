import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import { DEFAULT_GENERATION_CONFIG } from '../../../domain/training/config';
import { createMesocycleSpec } from '../../../domain/training/mesocycle';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import type { LiveActivity } from '../../../platform/liveActivity';
import type { TimerNotifier } from '../../../platform/notifications/timerNotification';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';

/**
 * I3-02 (critère 3) : pendant la semaine de deload du cycle, « Deload » est activé par défaut dans la proposition de chaque exercice (séries ÷ 2,
 * charge × 0,8, RIR ≥ 4 : la règle I2, D-72 point 9), dit en texte, désactivable ; rien n'est écrit sans geste. Hors deload : désactivé.
 */

const DEVICE = '60000000-0000-4000-8000-0000000000e9' as DeviceId;
const u = (n: number): string => `3d6e8f0a-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CURRENT = u(9);
const BENCH = 'Développé couché à la barre';
const BENCH_ID = 'bench-press-barbell';
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
async function seed(cycleStart: string): Promise<void> {
  const r = await db.data.repos.workouts();
  await r.start({ source: 'empty', id: u(1), name: 'Haut A' });
  const w = await r.addExercise(u(1), { exerciseId: BENCH_ID, exerciseName: BENCH, sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
  for (const s of w.sets) await r.validateSet(s.id, { reps: 8, loadKg: 100 });
  await db.data.transaction(async (repos) => (await repos.workouts()).close(u(1)));
  db.clock.advance(3 * 86_400_000);
  const spec = createMesocycleSpec({ routineId: u(50), startDate: cycleStart as LocalDate, weeks: 5 }, DEFAULT_GENERATION_CONFIG);
  if (spec === null) throw new Error('spec');
  await db.data.transaction(async (repos) => (await repos.mesocycles()).start(spec, { id: u(60) }));
  await r.start({ source: 'empty', id: CURRENT, name: 'Haut B' });
  await r.addExercise(CURRENT, { exerciseId: BENCH_ID, exerciseName: BENCH, sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
}
const proposal = async () => within(await screen.findByRole('region', { name: BENCH })).findByRole('group', { name: 'Proposition' });

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  // Séance courante le mercredi 4 novembre 2026 (trois jours après la séance passée).
  db = await openBaseDb(DEVICE, '2026-11-01T12:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('semaine de deload du cycle (I3-02)', () => {
  it('deload activé par défaut, dit en texte, désactivable ; proposition allégée ; rien d’écrit sans geste', async () => {
    // Début le lundi 5 octobre : le 4 novembre est en semaine 5 (deload).
    await seed('2026-10-05');
    openSession();
    const p = await proposal();
    expect(await within(p).findByText('80 kg × 8')).toBeInTheDocument();
    const toggle = within(p).getByRole('button', { name: 'Deload pour cette séance' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(within(p).getByText('Semaine de deload du cycle : le deload est proposé par défaut, à accepter ou non.')).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(await within(p).findByText('100 kg × 9 · 8 · 8')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(await db.driver.select('SELECT 1 FROM recommendation_decision')).toEqual([]);
  });

  it('semaine de travail : deload désactivé, aucune mention du cycle', async () => {
    await seed('2026-10-26');
    openSession();
    const p = await proposal();
    expect(await within(p).findByText('100 kg × 9 · 8 · 8')).toBeInTheDocument();
    expect(within(p).getByRole('button', { name: 'Deload pour cette séance' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(p).queryByText(/Semaine de deload du cycle/)).toBeNull();
  });
});
