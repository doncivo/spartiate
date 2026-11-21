import { afterEach, describe, expect, it } from 'vitest';
import type { DeviceId, IsoDateTime } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/** PROGRES-a et b : lectures de Progrès (séances closes depuis un instant, avec séries ; débuts des séances closes). Lecture seule. */

const DEVICE = '60000000-0000-4000-8000-0000000000f7' as DeviceId;
const W1 = '5e5a0401-0000-4000-8000-000000000001';
const W2 = '5e5a0401-0000-4000-8000-000000000002';
const W3 = '5e5a0401-0000-4000-8000-000000000003';
const W_OPEN = '5e5a0401-0000-4000-8000-000000000004';
let db: TestDb;
afterEach(async () => db.close());

async function closedWorkout(id: string, at: string): Promise<void> {
  db.clock.set(at);
  const r = await db.data.repos.workouts();
  await r.start({ source: 'empty', id, name: 'Séance' });
  const w = await r.addExercise(id, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé', sets: 2 });
  await r.validateSet((w.sets[0] as { id: string }).id, { loadKg: 60, reps: 8 });
  await db.data.transaction(async (repos) => (await repos.workouts()).close(id));
}

describe('WorkoutRepository : lectures de Progrès', () => {
  it('closedSince : séances closes non supprimées commencées à partir de l’instant, avec leurs séries vivantes ; ni ouverte ni supprimée', async () => {
    db = await openBaseDb(DEVICE, '2026-11-01T08:00:00.000Z');
    await closedWorkout(W1, '2026-11-02T08:00:00.000Z');
    await closedWorkout(W2, '2026-11-10T08:00:00.000Z');
    await closedWorkout(W3, '2026-11-12T08:00:00.000Z');
    const r = await db.data.repos.workouts();
    await r.deleteClosed(W3);
    db.clock.set('2026-11-14T08:00:00.000Z');
    await r.start({ source: 'empty', id: W_OPEN, name: 'Ouverte' });
    const since = await r.closedSince('2026-11-05T00:00:00.000Z' as IsoDateTime);
    expect(since.map((w) => w.id)).toEqual([W2]);
    expect(since[0]?.sets.map((s) => s.done)).toEqual([true, false]);
    expect((await r.closedSince('2026-10-01T00:00:00.000Z' as IsoDateTime)).map((w) => w.id)).toEqual([W1, W2]);
  });

  it('closedStarts : débuts de toutes les séances closes non supprimées, du plus ancien au plus récent', async () => {
    db = await openBaseDb(DEVICE, '2026-11-01T08:00:00.000Z');
    await closedWorkout(W2, '2026-11-10T08:00:00.000Z');
    await closedWorkout(W1, '2026-11-02T08:00:00.000Z');
    await closedWorkout(W3, '2026-11-12T08:00:00.000Z');
    const r = await db.data.repos.workouts();
    await r.deleteClosed(W3);
    db.clock.set('2026-11-14T08:00:00.000Z');
    await r.start({ source: 'empty', id: W_OPEN, name: 'Ouverte' });
    expect(await r.closedStarts()).toEqual(['2026-11-02T08:00:00.000Z', '2026-11-10T08:00:00.000Z']);
  });
});
