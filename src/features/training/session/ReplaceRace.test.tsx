import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { groupByExercise } from '../../../domain/training';
import type { DeviceId } from '../../../domain/types';
import type { DataAccess } from '../../../db/repositories/dataAccess';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { tSession } from '../../../i18n/trainingSessionText';
import { readTrainingData } from '../trainingState';
import { ReplaceExercise } from './ReplaceExercise';

/**
 * SESS-01, passe qa-test : deux choix rapides dans la feuille « Remplacer » ; la lecture d'historique du premier, plus lente, n'écrase jamais
 * l'estimation du second (l'estimation affichée est toujours celle de l'exercice choisi).
 */

const DEVICE = '60000000-0000-4000-8000-0000000000fa' as DeviceId;
const W = '5e5a0a01-0000-4000-8000-000000000001';
let db: TestDb;
beforeEach(async () => {
  db = await openBaseDb(DEVICE, '2026-11-21T17:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('ReplaceExercise — choix successifs', () => {
  it('la réponse tardive du premier choix est ignorée', async () => {
    const r = await db.data.repos.workouts();
    await r.start({ source: 'empty', id: W, name: 'Haut A' });
    const workout = await r.addExercise(W, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché à la barre', sets: 2, targetLoadKg: 80 });
    const data = await readTrainingData(db.data);
    let release: () => void = () => undefined;
    const progression = await db.data.repos.progression();
    const slow: DataAccess = {
      ...db.data,
      repos: {
        ...db.data.repos,
        progression: async () => ({
          ...progression,
          // Premier choix (haltères) : historique rendu tard, et non vide (aucune estimation) ; les autres : immédiat.
          history: (id: string) => {
            if (id !== 'bench-press-dumbbell') return progression.history(id);
            return new Promise<Awaited<ReturnType<typeof progression.history>>>((resolve) => {
              release = () => resolve([{ workoutId: 'x', endedAt: '2026-11-01T00:00:00.000Z', difficulty: null, sets: [] }] as never);
            });
          },
        }),
      },
    };
    const block = groupByExercise(workout.sets)[0];
    if (!block) throw new Error('aucun bloc');
    render(<ReplaceExercise data={data} access={slow} workout={workout} block={block} excluded={new Set()} onRestore={vi.fn()} onCancel={vi.fn()} onDone={vi.fn()} />);
    const sheet = screen.getByRole('region', { name: tSession('replaceTitle', { name: 'Développé couché à la barre' }) });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Développé couché aux haltères' }));
    const similar = within(sheet).getByRole('list', { name: tSession('replaceSimilar') });
    fireEvent.click(within(similar).getAllByRole('button')[0] as HTMLElement);
    await within(sheet).findByText((t) => t === tSession('replaceNoEstimate') || t.startsWith(tSession('replaceEstimate', { load: '', rule: '' }).slice(0, 10)));
    release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(within(sheet).queryByText(tSession('replaceHistory'))).toBeNull();
  });
});
