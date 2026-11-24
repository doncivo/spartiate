import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DeviceId } from '../../../domain/types';
import type { DataAccess } from '../../../db/repositories/dataAccess';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { loadTrainingContent, type TrainingContent } from '../content';
import { ExerciseProgression } from './ExerciseProgression';

/**
 * SEANCE-0292 (C-080) : une lecture ancienne de la proposition (exercice précédent, lecture lente) n'écrase pas la nouvelle. Base SQLite réelle,
 * données synthétiques ; la lecture de l'historique du développé couché est retenue jusqu'à ce que le test la libère.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000c8' as DeviceId;
const u = (n: number): string => `2b4c6d8e-0000-4000-8000-${String(n).padStart(12, '0')}`;
let db: TestDb;
let content: TrainingContent;

beforeAll(async () => {
  content = await loadTrainingContent();
});
beforeEach(async () => {
  db = await openBaseDb(DEVICE, '2026-11-04T17:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

async function seedPast(exerciseId: string, load: number): Promise<void> {
  const r = await db.data.repos.workouts();
  const id = u(exerciseId === 'bench-press-barbell' ? 1 : 2);
  await r.start({ source: 'empty', id, name: 'Passée' });
  const w = await r.addExercise(id, { exerciseId, exerciseName: exerciseId, sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
  for (const s of w.sets) await r.validateSet(s.id, { reps: 10, loadKg: load });
  await db.data.transaction(async (repos) => (await repos.workouts()).close(id));
  db.clock.advance(86_400_000);
}

describe('C-080 : lecture ancienne de la proposition', () => {
  it('exercice changé pendant une lecture lente : la proposition affichée est celle du nouvel exercice, même quand l’ancienne lecture finit après', async () => {
    await seedPast('bench-press-barbell', 60);
    await seedPast('squat-barbell', 100);
    const r = await db.data.repos.workouts();
    await r.start({ source: 'empty', id: u(3), name: 'Ouverte' });
    await r.addExercise(u(3), { exerciseId: 'bench-press-barbell', exerciseName: 'b', sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
    const w2 = await r.addExercise(u(3), { exerciseId: 'squat-barbell', exerciseName: 's', sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const base = await db.data.repos.progression();
    const access = {
      ...db.data,
      repos: {
        ...db.data.repos,
        progression: async () => ({ ...base, history: async (id: string) => (id === 'bench-press-barbell' ? gate.then(() => base.history(id)) : base.history(id)) }),
      },
    } as unknown as DataAccess;
    const props = (exerciseId: string) => ({
      access,
      workout: w2,
      exerciseId,
      sets: w2.sets.filter((s) => s.exerciseId === exerciseId),
      exercise: content.catalog.get(exerciseId),
      equipment: null,
      clock: db.clock,
      onChanged: async () => undefined,
    });
    const view = render(<ExerciseProgression {...props('bench-press-barbell')} />);
    view.rerender(<ExerciseProgression {...props('squat-barbell')} />);
    const group = await screen.findByRole('group', { name: 'Proposition' });
    expect(await within(group).findByText(/^102,5 kg × /)).toBeInTheDocument();
    await act(async () => {
      release();
      await gate;
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(within(screen.getByRole('group', { name: 'Proposition' })).queryByText(/^62,5 kg × /)).toBeNull();
    expect(within(screen.getByRole('group', { name: 'Proposition' })).getByText(/^102,5 kg × /)).toBeInTheDocument();
  });
});
