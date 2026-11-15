import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { progressionFr } from '../../../i18n/fr.progression';
import type { LiveActivity } from '../../../platform/liveActivity';
import type { TimerNotifier } from '../../../platform/notifications/timerNotification';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';

/**
 * ERGO-02b (critère 3, revue d'ERGO-02 point 5) : l'écart de charge d'une proposition est celui d'un haltère (valeur du moteur, D-261) ; pour
 * deux haltères il s'écrit « +2 kg par haltère », comme l'évolution de la fiche (« +n kg par haltère »). Une charge à la barre garde « +2,5 kg ».
 * Données SYNTHÉTIQUES.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000e7' as DeviceId;
const u = (n: number): string => `2b4c6d8e-0000-4000-8000-${String(n).padStart(12, '0')}`;
const notifier: TimerNotifier = { permission: async () => 'granted', requestPermission: async () => 'granted', isPending: async () => false, schedule: async () => true, cancel: async () => undefined };
const liveActivity: LiveActivity = { isAvailable: async () => ({ available: false }) as never, start: async () => ({ started: false }) as never, end: async () => ({ ended: true, count: 0 }) };
let db: TestDb;

async function proposalOf(exerciseId: string, name: string, loadKg: number): Promise<HTMLElement> {
  const r = await db.data.repos.workouts();
  await r.start({ source: 'empty', id: u(1), name: 'Haut A' });
  const w = await r.addExercise(u(1), { exerciseId, exerciseName: name, sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
  for (const s of w.sets) await r.validateSet(s.id, { reps: 10, loadKg });
  await db.data.transaction(async (repos) => (await repos.workouts()).close(u(1)));
  db.clock.advance(86_400_000);
  await r.start({ source: 'empty', id: u(2), name: 'Haut B' });
  await r.addExercise(u(2), { exerciseId, exerciseName: name, sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'session' } as Route));
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <TrainingScreen session={{ os: 'other', notifier, liveActivity }} />
    </AppContainerProvider>,
  );
  return within(await screen.findByRole('region', { name })).findByRole('group', { name: 'Proposition' });
}

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-04T17:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('ERGO-02b : écart de charge « par haltère »', () => {
  it('deux haltères : « +n kg par haltère : 3 × 10 atteint la dernière fois », charge en « 2 × »', async () => {
    const group = await proposalOf('incline-press-dumbbell', 'Développé incliné aux haltères', 24);
    expect(await within(group).findByText(/^\+\d+(,\d+)? kg par haltère : 3 × 10 atteint la dernière fois\.$/)).toBeInTheDocument();
    expect(within(group).getByText(/^2 × \d+(,\d+)? kg × /)).toBeInTheDocument();
  });

  it('barre : « +2,5 kg : 3 × 10 atteint la dernière fois », sans « par haltère »', async () => {
    const group = await proposalOf('bench-press-barbell', 'Développé couché à la barre', 60);
    expect(await within(group).findByText('+2,5 kg : 3 × 10 atteint la dernière fois.')).toBeInTheDocument();
    expect(within(group).queryByText(/par haltère/)).toBeNull();
  });

  it('catalogue : chaque écart en kg a sa variante « par haltère », même phrase par ailleurs', () => {
    const texts: Readonly<Record<string, string>> = progressionFr;
    const withDelta = Object.keys(texts).filter((k) => k.startsWith('explain') && !k.endsWith('Pair') && texts[k]?.includes('{delta} kg'));
    expect(withDelta.length).toBeGreaterThanOrEqual(6);
    for (const key of withDelta) expect(texts[`${key}Pair`], key).toBe(texts[key]?.replace('{delta} kg', '{delta} kg par haltère'));
  });
});
