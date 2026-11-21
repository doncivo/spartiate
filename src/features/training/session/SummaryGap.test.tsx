import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoutineInput } from '../../../domain/training';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import type { ClosedWorkout } from '../../../db/repositories/workoutRepository';
import { tSession } from '../../../i18n/trainingSessionText';
import type { SummaryCard } from './summaryShare';
import { WorkoutSummary } from './WorkoutSummary';

/**
 * SESS-01e (§ 13.5) : résumé de fin avec l'écart à la prescription par exercice, la prochaine séance (jour suivant de la routine) et « Partager
 * l'image » (image locale, sans donnée corporelle).
 */

const DEVICE = '60000000-0000-4000-8000-0000000000f7' as DeviceId;
const u = (n: number): string => `5e5a0701-0000-4000-8000-${String(n).padStart(12, '0')}`;
const BENCH = 'Développé couché à la barre';
const ROUTINE: RoutineInput = {
  id: u(1),
  name: 'Haut / Bas',
  mode: 'programme',
  days: [
    { id: u(2), name: 'Haut A', dayOrder: 1, exercises: [{ id: u(3), exerciseId: 'bench-press-barbell', exerciseName: BENCH, sets: 3, repMin: 6, repMax: 10, rir: 2, restSec: 150, position: 0 }] },
    { id: u(4), name: 'Bas A', dayOrder: 2, exercises: [{ id: u(5), exerciseId: 'squat-barbell', exerciseName: 'Squat', sets: 3, repMin: 5, repMax: 8, rir: 2, restSec: 180, position: 0 }] },
  ],
};

let db: TestDb;
beforeEach(async () => {
  db = await openBaseDb(DEVICE, '2026-11-21T17:00:00.000Z');
  await (await db.data.repos.trainingRoutines()).create(ROUTINE);
});
afterEach(async () => {
  cleanup();
  await db.close();
});

async function closeTwoOfThree(): Promise<ClosedWorkout> {
  const r = await db.data.repos.workouts();
  const w = await r.start({ source: 'routine', routineId: u(1), dayId: u(2) });
  for (const s of w.sets) await r.updateSet(s.id, { targetLoadKg: 80 });
  const [a, b] = w.sets;
  await r.validateSet(a?.id ?? '', { loadKg: 80, reps: 8 });
  await r.validateSet(b?.id ?? '', { loadKg: 77.5, reps: 8 });
  db.clock.advance(40 * 60_000);
  return db.data.transaction(async (repos) => (await repos.workouts()).close(w.id));
}

describe('SESS-01e — résumé de fin', () => {
  it('écart à la prescription, prochaine séance, image partagée (carte sans donnée corporelle)', async () => {
    const closed = await closeTwoOfThree();
    const shareImage = vi.fn(async (_card: SummaryCard) => 'shared' as const);
    render(<WorkoutSummary access={db.data} closed={closed} onClose={vi.fn()} onJournal={vi.fn()} shareImage={shareImage} />);
    expect(await screen.findByRole('heading', { name: tSession('gapTitle') })).toBeInTheDocument();
    expect(screen.getByText(tSession('gapSets', { done: 2, planned: 3 }))).toBeInTheDocument();
    expect(screen.getByText(tSession('gapLoad', { done: '80 kg', target: '80 kg' }))).toBeInTheDocument();
    expect(await screen.findByText(tSession('nextSession', { name: 'Bas A' }))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: tSession('shareImage') }));
    expect(await screen.findByText(tSession('shareDone'))).toBeInTheDocument();
    const card = shareImage.mock.calls[0]?.[0];
    expect(card?.title).toBe('Haut A');
    expect(Object.keys(card ?? {}).sort()).toEqual(['date', 'lines', 'title']);
  });
});
