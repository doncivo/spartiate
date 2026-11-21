import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import { DEFAULT_GENERATION_CONFIG } from '../../domain/training/config';
import { createMesocycleSpec } from '../../domain/training/mesocycle';
import type { RoutineInput } from '../../domain/training';
import type { DeviceId, LocalDate } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { tTrainingProgress } from '../../i18n/trainingProgressText';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { TrainingProgress } from './TrainingProgress';

/** PROGRES-d (I2) : adhérence sur 4 semaines dans Progrès, avec la règle dite. Valeurs synthétiques. */

const DEVICE = '60000000-0000-4000-8000-0000000000e4' as DeviceId;
const NOW = '2026-11-18T18:00:00.000Z';
const u = (n: number): string => `5e5a0700-0000-4000-8000-${String(n).padStart(12, '0')}`;
const line = (id: number) => ({ id: u(id), exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché à la barre', sets: 3, repMin: 8, repMax: 10, rir: null, restSec: 120, position: 0 });
const PROGRAM: RoutineInput = { id: u(1), name: 'Programme', mode: 'programme', days: [{ id: u(2), name: 'A', dayOrder: 1, exercises: [line(3)] }, { id: u(4), name: 'B', dayOrder: 2, exercises: [line(5)] }] };
let db: TestDb;
let next = 100;

const mount = () =>
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, platform: { runtime: 'web', os: 'other' } })}>
      <TrainingProgress />
    </AppContainerProvider>,
  );

async function sessionAt(at: string): Promise<void> {
  db.clock.set(at);
  const r = await db.data.repos.workouts();
  const id = u((next += 1));
  await r.start({ source: 'empty', id, name: 'Séance' });
  const w = await r.addExercise(id, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché à la barre', sets: 1 });
  await r.validateSet((w.sets[0] as { id: string }).id, { loadKg: 60, reps: 8 });
  await db.data.transaction(async (repos) => (await repos.workouts()).close(id));
}

beforeEach(async () => {
  db = await openBaseDb(DEVICE, '2026-10-01T08:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('Progrès › Adhérence', () => {
  it('sans programme suivi : non calculée, la raison est dite', async () => {
    db.clock.set(NOW);
    mount();
    const card = await screen.findByRole('region', { name: tTrainingProgress('adherenceTitle') });
    expect(within(card).getByText(tTrainingProgress('adherenceNone'))).toBeInTheDocument();
  });

  it('programme de 2 jours depuis le 19/10 : 2 + 1 + 2 + 2 sur 8 prévues → 88 %, règle dite', async () => {
    await db.data.transaction(async (repos) => (await repos.trainingRoutines()).create(PROGRAM));
    const spec = createMesocycleSpec({ routineId: u(1), startDate: '2026-10-19' as LocalDate, weeks: 5 }, DEFAULT_GENERATION_CONFIG);
    if (spec === null) throw new Error('spec');
    await db.data.transaction(async (repos) => (await repos.mesocycles()).start(spec));
    for (const at of ['2026-10-19', '2026-10-21', '2026-10-27', '2026-11-02', '2026-11-04', '2026-11-10', '2026-11-11', '2026-11-12']) await sessionAt(`${at}T08:00:00.000Z`);
    db.clock.set(NOW);
    mount();
    const card = await screen.findByRole('region', { name: tTrainingProgress('adherenceTitle') });
    expect(within(card).getByText(tTrainingProgress('adherenceValue', { percent: 88 }))).toBeInTheDocument();
    expect(within(card).getByText(tTrainingProgress('adherenceDetail', { done: 7, planned: 8, weeks: 4 }))).toBeInTheDocument();
    expect(within(card).getByText(tTrainingProgress('adherenceRule'))).toBeInTheDocument();
  });
});
