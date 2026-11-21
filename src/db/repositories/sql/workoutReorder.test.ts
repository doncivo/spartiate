import { afterEach, describe, expect, it } from 'vitest';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/** SESS-01b : ordre des séries de la séance OUVERTE réécrit (vignettes, « Sauter ») ; l'ensemble des séries doit être exactement celui de la séance. */

const DEVICE = '60000000-0000-4000-8000-0000000000f3' as DeviceId;
const W = '5e5a0301-0000-4000-8000-000000000001';
let db: TestDb;
afterEach(async () => db.close());

describe('WorkoutRepository.reorderSets', () => {
  it('positions écrites dans l’ordre donné ; liste incomplète, étrangère ou en double : invalid, rien n’est écrit ; séance close : invalid', async () => {
    db = await openBaseDb(DEVICE);
    const r = await db.data.repos.workouts();
    await r.start({ source: 'empty', id: W, name: 'Haut A' });
    await r.addExercise(W, { exerciseId: 'row-barbell', exerciseName: 'Rowing', sets: 2 });
    const full = await r.addExercise(W, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé', sets: 1 });
    const [a, b, c] = full.sets.map((s) => s.id) as [string, string, string];
    const after = await r.reorderSets(W, [c, a, b]);
    expect(after.sets.map((s) => [s.position, s.exerciseId])).toEqual([
      [0, 'bench-press-barbell'],
      [1, 'row-barbell'],
      [2, 'row-barbell'],
    ]);
    for (const bad of [[a, b], [a, b, c, c], [a, b, 'autre']]) await expect(r.reorderSets(W, bad)).rejects.toMatchObject({ code: 'invalid' });
    expect((await r.get(W))?.sets.map((s) => s.id)).toEqual([c, a, b]);
    await r.validateSet(c, { loadKg: 60, reps: 8 });
    await db.data.transaction(async (repos) => (await repos.workouts()).close(W));
    await expect(r.reorderSets(W, [a, b, c])).rejects.toMatchObject({ code: 'invalid' });
  });
});
