import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { groupByExercise } from '../../../domain/training';
import type { DeviceId } from '../../../domain/types';
import type { DataAccess } from '../../../db/repositories/dataAccess';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { tSession } from '../../../i18n/trainingSessionText';
import { readTrainingData } from '../trainingState';
import { ReplaceExercise } from './ReplaceExercise';

/** SEANCE-0292 (BL-121, relecture B) : lecture des gênes en échec dite, jamais ignorée en silence. Base SQLite réelle, données synthétiques. */
const DEVICE = '60000000-0000-4000-8000-0000000000fb' as DeviceId;
const W = '5e5a0a01-0000-4000-8000-000000000121';
let db: TestDb;
beforeEach(async () => {
  db = await openBaseDb(DEVICE, '2026-11-21T17:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

async function sheet(access: (base: DataAccess) => DataAccess) {
  const r = await db.data.repos.workouts();
  await r.start({ source: 'empty', id: W, name: 'Haut A' });
  const workout = await r.addExercise(W, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché à la barre', sets: 2, targetLoadKg: 80 });
  const data = await readTrainingData(db.data);
  const block = groupByExercise(workout.sets)[0];
  if (!block) throw new Error('aucun bloc');
  render(<ReplaceExercise data={data} access={access(db.data)} workout={workout} block={block} excluded={new Set()} onRestore={vi.fn()} onCancel={vi.fn()} onDone={vi.fn()} />);
  return screen.getByRole('region', { name: tSession('replaceTitle', { name: 'Développé couché à la barre' }) });
}

describe('BL-121 : gênes illisibles au remplacement', () => {
  it('lecture des gênes en échec : un texte dit que le filtre des gênes n’a pas pu s’appliquer ; les remplaçants restent proposés', async () => {
    const region = await sheet((base) => ({ ...base, repos: { ...base.repos, injuries: async () => Promise.reject(new Error('lecture impossible')) } }));
    expect(await within(region).findByText('Gênes déclarées illisibles : les remplaçants proposés n’en tiennent pas compte.')).toBeInTheDocument();
    expect(within(region).getByRole('button', { name: 'Développé couché aux haltères' })).toBeInTheDocument();
  });

  it('lecture des gênes réussie : aucun texte d’échec', async () => {
    const region = await sheet((base) => base);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(within(region).queryByText(/Gênes déclarées illisibles/)).toBeNull();
  });
});
