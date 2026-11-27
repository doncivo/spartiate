import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
 * SESS-0302 (BL-110, D-658, § 13.2 « Pause / abandonner ») : bouton « Pause » / « Reprendre » de l'écran de séance active, état « En pause » dit,
 * chrono figé pendant la pause et privé du temps de pause ensuite, repos en cours annulé (notification et Live Activity fermées), saisie des séries
 * suspendue pendant la pause. Base SQLite réelle, contenu embarqué réel, valeurs inventées.
 */
const DEVICE = '60000000-0000-4000-8000-0000000003c2' as DeviceId;
const u = (n: number): string => `3c2b1a00-0000-4000-8000-${String(n).padStart(12, '0')}`;
const BENCH = 'Développé couché à la barre';
const ROUTINE: RoutineInput = {
  id: u(1),
  name: 'Haut',
  mode: 'programme',
  days: [{ id: u(2), name: 'Haut A', dayOrder: 1, exercises: [{ id: u(3), exerciseId: 'bench-press-barbell', exerciseName: BENCH, sets: 2, repMin: 6, repMax: 10, rir: 2, restSec: 150, position: 0 }] }],
};

function fakes() {
  const calls = { cancel: 0, ends: 0 };
  const notifier: TimerNotifier = { permission: async () => 'granted', requestPermission: async () => 'granted', isPending: async () => false, schedule: async () => true, cancel: async () => void calls.cancel++ };
  const liveActivity: LiveActivity = { isAvailable: async () => ({ available: true }), start: async () => ({ started: true }), end: async () => (calls.ends++, { ended: true, count: 1 }) };
  return { notifier, liveActivity, calls };
}

let db: TestDb;
// Importations à froid (écran, séance active, blocs à la demande) préchauffées, modèle de Circuit.test.tsx : aucun délai de `findBy` allongé.
beforeAll(async () => {
  await Promise.all([import('../TrainingScreen'), import('./ActiveSession'), import('./ExerciseProgression'), import('./StartSession'), import('./RecoverySession'), import('./WorkoutSummary')]);
}, 60_000);
beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-27T17:00:00.000Z');
  await (await db.data.repos.trainingRoutines()).create(ROUTINE);
});
afterEach(async () => {
  cleanup();
  await db.close();
});

const openScreen = (f = fakes()) => {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'session' } as Route));
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <TrainingScreen session={{ os: 'ios', notifier: f.notifier, liveActivity: f.liveActivity }} />
    </AppContainerProvider>,
  );
  return f;
};
/** Région d'annonce de la pause (`role="status"`, toujours montée). */
const pauseStatus = (): HTMLElement => {
  const el = document.querySelector<HTMLElement>('.ct-session__paused');
  if (el === null || el.getAttribute('role') !== 'status') throw new Error('région d’annonce absente');
  return el;
};
const elapsed = () => screen.getByRole('timer', { name: tTraining('sessionElapsed') }).textContent;

describe('SESS-0302 : pause de la séance active', () => {
  it('« Pause » : repos annulé, « En pause » dit, saisie suspendue, « Reprendre » nommé ; reprise : chrono sans le temps de pause', async () => {
    const f = openScreen();
    fireEvent.click(await screen.findByRole('button', { name: /^Démarrer « Haut A »/ }));
    const region = await screen.findByRole('region', { name: BENCH });
    const [first] = within(region).getAllByRole('group', { name: /^Série/ });
    if (!first) throw new Error('aucune série');
    fireEvent.change(within(first).getByLabelText(tTraining('sessionLoad')), { target: { value: '80' } });
    fireEvent.change(within(first).getByLabelText(tTraining('sessionReps')), { target: { value: '8' } });
    fireEvent.click(within(first).getByRole('button', { name: tTraining('sessionValidate') }));
    await screen.findByRole('timer', { name: tTraining('restRemaining') });

    // Accessibilité : région d'annonce présente avant la pause, vide ; seul « En pause » y est injecté.
    const announce = pauseStatus();
    expect(announce.textContent).toBe('');
    act(() => db.clock.advance(60_000));
    fireEvent.click(screen.getByRole('button', { name: tSession('pause') }));
    await screen.findByText(tSession('paused'));
    expect(pauseStatus()).toBe(announce);
    expect(announce.textContent).toBe(tSession('paused'));
    const resume = screen.getByRole('button', { name: tSession('pauseResume') });
    await waitFor(() => expect(screen.queryByRole('timer', { name: tTraining('restRemaining') })).toBeNull());
    expect(f.calls.cancel).toBeGreaterThan(0);
    expect(f.calls.ends).toBeGreaterThan(0);
    expect((await db.driver.select('SELECT rest_timer_end_at FROM workout WHERE ended_at IS NULL'))).toEqual([{ rest_timer_end_at: null }]);
    const second = within(screen.getByRole('region', { name: BENCH })).getAllByRole('group', { name: /^Série/ })[1];
    expect((within(second as HTMLElement).getByRole('button', { name: tTraining('sessionValidate') }) as HTMLButtonElement).disabled).toBe(true);

    // Pendant la pause, le chrono reste à la durée effective (60 s) ; le retour au premier plan relit l'horloge.
    await waitFor(() => expect(elapsed()).toBe('1:00'));
    await act(async () => {
      db.clock.advance(5 * 60_000);
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });
    expect(elapsed()).toBe('1:00');

    fireEvent.click(resume);
    await waitFor(() => expect(screen.queryByText(tSession('paused'))).toBeNull());
    expect(pauseStatus()).toBe(announce);
    expect(announce.textContent).toBe('');
    expect(screen.getByRole('button', { name: tSession('pause') })).toBeTruthy();
    expect(await db.driver.select('SELECT paused_at, paused_ms FROM workout WHERE ended_at IS NULL')).toEqual([{ paused_at: null, paused_ms: 300_000 }]);
    await waitFor(() => expect(elapsed()).toBe('1:00'));
    expect(screen.queryByRole('timer', { name: tTraining('restRemaining') })).toBeNull();
  });

  it('reprise après fermeture de l’écran pendant la pause : toujours « En pause », chrono figé ; clôture : résumé sans le temps de pause', async () => {
    openScreen();
    fireEvent.click(await screen.findByRole('button', { name: /^Démarrer « Haut A »/ }));
    const region = await screen.findByRole('region', { name: BENCH });
    const [first] = within(region).getAllByRole('group', { name: /^Série/ });
    if (!first) throw new Error('aucune série');
    fireEvent.change(within(first).getByLabelText(tTraining('sessionLoad')), { target: { value: '80' } });
    fireEvent.change(within(first).getByLabelText(tTraining('sessionReps')), { target: { value: '8' } });
    fireEvent.click(within(first).getByRole('button', { name: tTraining('sessionValidate') }));
    await screen.findByRole('timer', { name: tTraining('restRemaining') });
    act(() => db.clock.advance(120_000));
    fireEvent.click(screen.getByRole('button', { name: tSession('pause') }));
    await screen.findByText(tSession('paused'));
    cleanup();

    act(() => db.clock.advance(10 * 60_000));
    openScreen();
    await screen.findByText(tSession('paused'));
    expect(elapsed()).toBe('2:00');
    fireEvent.click(screen.getByRole('button', { name: tTraining('sessionFinish') }));
    fireEvent.click(await screen.findByRole('button', { name: tTraining('sessionFinishConfirm') }));
    await waitFor(async () => expect(await db.driver.select('SELECT paused_at, paused_ms FROM workout')).toEqual([{ paused_at: null, paused_ms: 600_000 }]));
  });
});
