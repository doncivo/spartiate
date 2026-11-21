import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { RoutineInput } from '../../../domain/training';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { tProgression } from '../../../i18n/progressionText';
import { tSession } from '../../../i18n/trainingSessionText';
import { tTraining } from '../../../i18n/trainingText';
import type { LiveActivity } from '../../../platform/liveActivity';
import type { TimerNotifier } from '../../../platform/notifications/timerNotification';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';

/**
 * SESS-01d (§ 13.2 « Fatigue déclarée ») : Frais / Normal / Fatigué en tête de séance, facultatif (rien n'est bloqué sans réponse), un second appui
 * efface ; « Fatigué » : aucune hausse de charge ce jour-là (la proposition qui montait reste à la charge de référence, dit en une phrase).
 */

const DEVICE = '60000000-0000-4000-8000-0000000000f6' as DeviceId;
const u = (n: number): string => `5e5a0601-0000-4000-8000-${String(n).padStart(12, '0')}`;
const BENCH = 'Développé couché à la barre';
const ROUTINE: RoutineInput = {
  id: u(1),
  name: 'Haut',
  mode: 'programme',
  days: [{ id: u(2), name: 'Haut A', dayOrder: 1, exercises: [{ id: u(3), exerciseId: 'bench-press-barbell', exerciseName: BENCH, sets: 3, repMin: 8, repMax: 10, rir: 2, restSec: 150, position: 0 }] }],
};
const notifier: TimerNotifier = { permission: async () => 'granted', requestPermission: async () => 'granted', isPending: async () => false, schedule: async () => true, cancel: async () => undefined };
const liveActivity: LiveActivity = { isAvailable: async () => ({ available: true }), start: async () => ({ started: true }), end: async () => ({ ended: true, count: 1 }) };

let db: TestDb;
const openAndStart = async (): Promise<string> => {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'session' } as Route));
  const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
  render(
    <AppContainerProvider container={container}>
      <TrainingScreen session={{ os: 'other', notifier, liveActivity }} />
    </AppContainerProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /^Démarrer « Haut A »/ }));
  await screen.findByRole('region', { name: BENCH });
  const [row] = await db.driver.select<{ id: string }>('SELECT id FROM workout WHERE ended_at IS NULL');
  if (!row) throw new Error('aucune séance ouverte');
  return row.id;
};

/** Séance close 3 jours avant : 60 kg × 10 × 3 (haut de plage 8–10) : la prescription propose une hausse. */
async function seedTopOfRange(): Promise<void> {
  const r = await db.data.repos.workouts();
  const w = await r.start({ source: 'empty', name: 'Avant' });
  const full = await r.addExercise(w.id, { exerciseId: 'bench-press-barbell', exerciseName: BENCH, sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
  for (const s of full.sets) await r.validateSet(s.id, { loadKg: 60, reps: 10 });
  await db.data.transaction(async (repos) => (await repos.workouts()).close(w.id));
  db.clock.advance(3 * 86_400_000);
}
const fatigue = () => screen.getByRole('group', { name: tSession('fatigueLabel') });

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-18T17:00:00.000Z');
  await (await db.data.repos.trainingRoutines()).create(ROUTINE);
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('SESS-01d — fatigue déclarée', () => {
  it('trois choix facultatifs, état dit par aria-pressed, écrit pour cette séance ; second appui : effacé', async () => {
    const id = await openAndStart();
    const tired = within(fatigue()).getByRole('button', { name: tSession('fatigueTired') });
    expect(within(fatigue()).getAllByRole('button').map((b) => b.textContent)).toEqual([tSession('fatigueFresh'), tSession('fatigueNormal'), tSession('fatigueTired')]);
    expect(tired).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(tired);
    await within(fatigue()).findByRole('button', { name: tSession('fatigueTired'), pressed: true });
    expect(await db.data.repos.settings.get('training.declaredFatigue')).toEqual({ v: 1, workoutId: id, level: 'tired' });
    fireEvent.click(within(fatigue()).getByRole('button', { name: tSession('fatigueTired') }));
    await within(fatigue()).findByRole('button', { name: tSession('fatigueTired'), pressed: false });
    expect(await db.data.repos.settings.get('training.declaredFatigue')).toEqual({ v: 1, workoutId: id, level: null });
  });

  it('jamais bloquant : une série se valide sans déclaration', async () => {
    await openAndStart();
    const [first] = within(screen.getByRole('region', { name: BENCH })).getAllByRole('group', { name: /^Série/ });
    if (!first) throw new Error('aucune série');
    fireEvent.change(within(first).getByLabelText(tTraining('sessionLoad')), { target: { value: '60' } });
    fireEvent.change(within(first).getByLabelText(tTraining('sessionReps')), { target: { value: '8' } });
    fireEvent.click(within(first).getByRole('button', { name: tTraining('sessionValidate') }));
    expect(await within(first).findByText(tTraining('sessionDone'))).toBeInTheDocument();
  });

  it('« Fatigué » : la hausse prévue (62,5 kg) devient un maintien à 60 kg, dit en une phrase', async () => {
    await seedTopOfRange();
    await openAndStart();
    const block = screen.getByRole('region', { name: BENCH });
    const held = tProgression('explainDeclaredFatigue', { load: tProgression('loadSingle', { load: '60' }) });
    expect(await within(block).findByText(tProgression('value', { load: tProgression('loadSingle', { load: '62,5' }), reps: ['8', '8', '8'].join(tProgression('repsJoin')) }))).toBeInTheDocument();
    fireEvent.click(within(fatigue()).getByRole('button', { name: tSession('fatigueTired') }));
    expect(await within(block).findByText((text) => text.startsWith(held))).toBeInTheDocument();
  });
});
