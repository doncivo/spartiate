import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';

/** SEANCE-0292 (C-082, § 13.8) : le journal n'est plus limité aux 50 dernières séances. Données synthétiques. */
const DEVICE = '60000000-0000-4000-8000-0000000000e9' as DeviceId;
let db: TestDb;

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-01-01T17:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

async function seed(n: number): Promise<void> {
  for (let i = 1; i <= n; i += 1) {
    await db.data.transaction(async (r) => {
      const repo = await r.workouts();
      const w = await repo.start({ source: 'empty', name: `Séance ${String(i)}` });
      const next = await repo.addExercise(w.id, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 1, targetRepsMin: 5, targetRepsMax: 8 });
      const set = next.sets[0];
      if (!set) throw new Error('aucune série');
      await repo.validateSet(set.id, { loadKg: 60, reps: 5 });
      await repo.close(w.id);
    });
    db.clock.advance(86_400_000);
  }
}

describe('C-082 : journal au-delà de 50 séances', () => {
  it('55 séances : 50 d’abord, puis « Afficher les séances plus anciennes » montre les 5 premières (ouvrables, donc corrigeables)', async () => {
    await seed(55);
    act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'history' } as Route));
    render(
      <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
        <TrainingScreen />
      </AppContainerProvider>,
    );
    const list = await screen.findByRole('list', { name: 'Séances terminées' });
    expect(within(list).getAllByRole('button', { name: /^Séance \d+/ })).toHaveLength(50);
    expect(within(list).queryByRole('button', { name: /^Séance 1 / })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Afficher les séances plus anciennes' }));
    expect(await within(list).findByRole('button', { name: /^Séance 1 / })).toBeInTheDocument();
    expect(within(list).getAllByRole('button', { name: /^Séance \d+/ })).toHaveLength(55);
    expect(screen.queryByRole('button', { name: 'Afficher les séances plus anciennes' })).toBeNull();
  });
});
