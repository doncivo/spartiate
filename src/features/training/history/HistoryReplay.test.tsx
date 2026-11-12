import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { PAST_WORKOUT_ID, seedPastWorkout } from '../../../../tests/fixtures/training/workout';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';

/**
 * I6-03 (§ 13.8, rejeu de séance) : depuis le détail d'une séance close du journal, « Rejouer cette séance » crée une NOUVELLE séance ouverte préremplie
 * (mêmes exercices, mêmes groupes, charges et répétitions de la séance source en CIBLES), jamais les séries réalisées copiées comme faites ; la
 * séance source n'est pas modifiée. Une séance déjà ouverte n'est pas écrasée : le refus est dit.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000e6' as DeviceId;
let db: TestDb;
const openDetail = async () => {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'history' } as Route));
  const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
  render(
    <AppContainerProvider container={container}>
      <TrainingScreen />
    </AppContainerProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /Haut A/ }));
  return screen.findByRole('region', { name: 'Détail de la séance' });
};
const open = () => db.driver.select<{ id: string; source: string; copied_from_workout_id: string | null }>('SELECT id, source, copied_from_workout_id FROM workout WHERE ended_at IS NULL AND deleted_at IS NULL');

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T17:00:00.000Z');
  await seedPastWorkout(db.driver);
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('rejeu depuis l’historique', () => {
  it('« Rejouer cette séance » crée une séance ouverte préremplie (cibles, aucune série faite) et ouvre la séance active', async () => {
    await openDetail();
    expect(await open()).toEqual([]);
    fireEvent.click(await screen.findByRole('button', { name: 'Rejouer cette séance' }));
    await waitFor(async () => expect((await open()).length).toBe(1));
    const [created] = await open();
    expect(created).toMatchObject({ source: 'copy', copied_from_workout_id: PAST_WORKOUT_ID });
    const sets = await db.driver.select<{ done: number; reps: number | null; load_kg: number | null; target_reps_min: number | null; target_load_kg: number | null }>(
      'SELECT done, reps, load_kg, target_reps_min, target_load_kg FROM workout_set WHERE workout_id = ? ORDER BY position',
      [created?.id ?? ''],
    );
    expect(sets.length).toBeGreaterThan(0);
    expect(sets.every((s) => s.done === 0 && s.reps === null && s.load_kg === null)).toBe(true);
    expect(sets.some((s) => s.target_reps_min !== null && s.target_load_kg !== null)).toBe(true);
    expect(useNavigationStore.getState().route).toMatchObject({ tab: 'training', screen: 'session' });
    // La séance source reste intacte.
    expect(await db.driver.select('SELECT 1 FROM workout WHERE id = ? AND ended_at IS NOT NULL', [PAST_WORKOUT_ID])).toHaveLength(1);
  });

  it('séance déjà ouverte : rien n’est écrasé, le refus est dit', async () => {
    await db.data.transaction(async (r) => (await r.workouts()).start({ source: 'empty', name: 'En cours' }));
    await openDetail();
    fireEvent.click(await screen.findByRole('button', { name: 'Rejouer cette séance' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Une séance est déjà ouverte');
    expect((await open()).map((w) => w.source)).toEqual(['empty']);
    expect(useNavigationStore.getState().route).toMatchObject({ tab: 'training', screen: 'history' });
  });
});
