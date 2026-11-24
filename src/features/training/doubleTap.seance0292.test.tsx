import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import type { LiveActivity } from '../../platform/liveActivity';
import type { TimerNotifier } from '../../platform/notifications/timerNotification';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../app/navigation';
import { loadTrainingContent } from './content';
import { TrainingScreen } from './TrainingScreen';

/**
 * SEANCE-0292 (C-077) : un double appui (deux clics avant le redessin) n'écrit qu'une fois : « Ajouter une série », « Nouvelle routine »,
 * « Dupliquer pour modifier ». Base SQLite réelle, contenu embarqué, données synthétiques.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000f7' as DeviceId;
const W = '2b4c6d8e-0000-4000-8000-000000000077';
const notifier: TimerNotifier = { permission: async () => 'granted', requestPermission: async () => 'granted', isPending: async () => false, schedule: async () => true, cancel: async () => undefined };
const liveActivity: LiveActivity = { isAvailable: async () => ({ available: false }) as never, start: async () => ({ started: false }) as never, end: async () => ({ ended: true, count: 0 }) };

let db: TestDb;
const open = (screenId: 'session' | 'routines' | 'equipment') => {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: screenId } as Route));
  return render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <TrainingScreen session={{ os: 'other', notifier, liveActivity }} />
    </AppContainerProvider>,
  );
};
const count = async (sql: string): Promise<number> => ((await db.driver.select<{ n: number }>(sql))[0]?.n ?? 0);

beforeAll(async () => {
  await loadTrainingContent();
});
beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-20T17:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('C-077 : double appui', () => {
  it('« Ajouter une série » appuyé deux fois de suite : une seule série ajoutée', async () => {
    const r = await db.data.repos.workouts();
    await r.start({ source: 'empty', id: W, name: 'Séance' });
    await r.addExercise(W, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché à la barre', sets: 2, targetRepsMin: 8, targetRepsMax: 10 });
    open('session');
    const region = await screen.findByRole('region', { name: 'Développé couché à la barre' });
    const add = within(region).getByRole('button', { name: 'Ajouter une série' });
    fireEvent.click(add);
    fireEvent.click(add);
    await waitFor(async () => expect(within(region).getAllByRole('group', { name: /^Série \d+$/ })).toHaveLength(3));
    expect(await count(`SELECT COUNT(*) AS n FROM workout_set WHERE workout_id = '${W}' AND deleted_at IS NULL`)).toBe(3);
  });

  it('« Nouvelle routine » appuyé deux fois de suite : une seule routine', async () => {
    open('routines');
    const create = await screen.findByRole('button', { name: 'Nouvelle routine' });
    fireEvent.click(create);
    fireEvent.click(create);
    await screen.findByLabelText('Nom de la routine');
    expect(await count('SELECT COUNT(*) AS n FROM routine WHERE deleted_at IS NULL')).toBe(1);
  });

  it('« Dupliquer pour modifier » appuyé deux fois de suite : une seule copie', async () => {
    open('equipment');
    const dup = await screen.findByRole('button', { name: 'Dupliquer pour modifier' });
    fireEvent.click(dup);
    fireEvent.click(dup);
    await screen.findByRole('heading', { name: 'Salle complète (copie)' });
    expect(await count('SELECT COUNT(*) AS n FROM equipment_profile')).toBe(1);
  });
});
