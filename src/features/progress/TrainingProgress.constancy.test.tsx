import { cleanup, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
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
import { TodayStreak } from './TodayStreak';
import { TrainingProgress } from './TrainingProgress';

/** PROGRES-b (§ 17.1, § 18.2) : constance (streak, semaine, calendrier) dans Progrès et streak sur Aujourd'hui. Valeurs synthétiques. */

const DEVICE = '60000000-0000-4000-8000-0000000000e2' as DeviceId;
const NOW = '2026-11-18T18:00:00.000Z';
const u = (n: number): string => `5e5a0600-0000-4000-8000-${String(n).padStart(12, '0')}`;
const line = (id: number, position: number) => ({ id: u(id), exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché à la barre', sets: 3, repMin: 8, repMax: 10, rir: null, restSec: 120, position });
const PROGRAM: RoutineInput = {
  id: u(1),
  name: 'Programme',
  mode: 'programme',
  days: [
    { id: u(2), name: 'A', dayOrder: 1, exercises: [line(3, 0)] },
    { id: u(4), name: 'B', dayOrder: 2, exercises: [line(5, 0)] },
  ],
};
let db: TestDb;
let next = 100;

const mount = (node: ReactNode) =>
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, platform: { runtime: 'web', os: 'other' } })}>
      {node}
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

describe('Constance', () => {
  it('sans programme : 1 séance par semaine ; 3 semaines de suite + cette semaine → série de 3 (la règle est dite) ; calendrier du mois en texte', async () => {
    for (const at of ['2026-10-28T08:00:00.000Z', '2026-11-03T08:00:00.000Z', '2026-11-10T08:00:00.000Z', '2026-11-11T08:00:00.000Z']) await sessionAt(at);
    db.clock.set(NOW);
    mount(<TrainingProgress />);
    const card = await screen.findByRole('region', { name: tTrainingProgress('constancyTitle') });
    expect(within(card).getByText(tTrainingProgress('streak', { n: 3 }))).toBeInTheDocument();
    expect(within(card).getByText(tTrainingProgress('streakRuleDefault'))).toBeInTheDocument();
    expect(within(card).getByText(tTrainingProgress('weekDone', { n: 0, target: 1 }))).toBeInTheDocument();
    expect(within(card).getByRole('listitem', { name: tTrainingProgress('calendarDay', { date: '10 novembre', n: 1 }) })).toBeInTheDocument();
    expect(within(card).getByRole('listitem', { name: tTrainingProgress('calendarDayNone', { date: '12 novembre' }) })).toBeInTheDocument();
  });

  it('programme suivi de 2 jours : objectif 2 depuis son début ; carte d’Aujourd’hui : série et semaine en cours', async () => {
    await db.data.transaction(async (repos) => (await repos.trainingRoutines()).create(PROGRAM));
    const spec = createMesocycleSpec({ routineId: u(1), startDate: '2026-11-09' as LocalDate, weeks: 5 }, DEFAULT_GENERATION_CONFIG);
    if (spec === null) throw new Error('spec');
    await db.data.transaction(async (repos) => (await repos.mesocycles()).start(spec));
    for (const at of ['2026-11-03T08:00:00.000Z', '2026-11-10T08:00:00.000Z', '2026-11-12T08:00:00.000Z', '2026-11-16T08:00:00.000Z']) await sessionAt(at);
    db.clock.set(NOW);
    mount(<TodayStreak />);
    expect(await screen.findByText(tTrainingProgress('streak', { n: 2 }))).toBeInTheDocument();
    expect(screen.getByText(tTrainingProgress('weekDoneOne', { n: 1, target: 2 }))).toBeInTheDocument();
  });

  it('Aujourd’hui sans aucune séance : la carte le dit, sans zéro trompeur de série', async () => {
    db.clock.set(NOW);
    mount(<TodayStreak />);
    expect(await screen.findByText(tTrainingProgress('streakNone'))).toBeInTheDocument();
  });
});
