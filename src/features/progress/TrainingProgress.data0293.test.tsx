import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { tTrainingProgress } from '../../i18n/trainingProgressText';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { TrainingProgress } from './TrainingProgress';

/** DATA-0293 (BL-135, D-481) : l'adhérence distingue les séries ajoutées en séance (hors proposées) et les séries retirées (proposées non faites). Valeurs synthétiques. */
const DEVICE = '60000000-0000-4000-8000-000000000293' as DeviceId;
const W = '5e5a0700-0000-4000-8000-000000000293';
let db: TestDb;

beforeEach(async () => {
  db = await openBaseDb(DEVICE, '2026-11-10T08:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('Progrès › Prescriptions respectées : ajoutées et retirées', () => {
  it('2 proposées dont 1 faite, 1 ajoutée faite : 50 % (1 sur 2), « ajoutées : 1 · retirées : 1 », règle sans l’ancienne limite', async () => {
    const r = await db.data.repos.workouts();
    await r.start({ source: 'empty', id: W, name: 'Séance' });
    const w = await r.addExercise(W, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché à la barre', sets: 2, targetRepsMin: 8, targetRepsMax: 10 });
    await r.validateSet((w.sets[0] as { id: string }).id, { loadKg: 60, reps: 8 });
    const extra = await r.addSet(W, 'bench-press-barbell');
    await r.validateSet(extra.id, { loadKg: 60, reps: 8 });
    await db.data.transaction(async (repos) => (await repos.workouts()).close(W));
    db.clock.set('2026-11-18T18:00:00.000Z');
    render(
      <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, platform: { runtime: 'web', os: 'other' } })}>
        <TrainingProgress />
      </AppContainerProvider>,
    );
    expect(await screen.findByText(/Séries faites : 50 % \(1 sur 2 proposées\)/)).toBeInTheDocument();
    expect(screen.getByText(/Séries ajoutées en séance : 1 · retirées : 1/)).toBeInTheDocument();
    expect(screen.getByText(tTrainingProgress('prescriptionRule'))).toBeInTheDocument();
    expect(tTrainingProgress('prescriptionRule')).not.toMatch(/reprend la cible/);
  });
});
