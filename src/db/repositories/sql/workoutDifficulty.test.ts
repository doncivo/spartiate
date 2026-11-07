import { afterEach, describe, expect, it } from 'vitest';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * I2-01 (PR 2/2, critère 13) : difficulté Facile / Juste / Dur de fin d'exercice (§ 13.2), écrite sur les séries de l'exercice dans la séance
 * OUVERTE (`workout_set.difficulty`, migration 0006), relue avec la séance ; jamais capturée tant que la séance est ouverte (D-27), publiée
 * avec l'agrégat à la clôture.
 */

const DEVICE = '60000000-0000-4000-8000-0000000000d6' as DeviceId;
const u = (n: number): string => `6d1f2a3b-0000-4000-8000-${String(n).padStart(12, '0')}`;
const W = u(1);
let db: TestDb;
afterEach(async () => db.close());

async function openWithTwoExercises(): Promise<void> {
  const r = await db.data.repos.workouts();
  await r.start({ source: 'empty', id: W, name: 'Haut A' });
  await r.addExercise(W, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 3 });
  await r.addExercise(W, { exerciseId: 'row-barbell', exerciseName: 'Rowing', sets: 2 });
}
const difficulties = async () => (await (await db.data.repos.workouts()).get(W))?.sets.map((s) => [s.exerciseId, s.difficulty ?? null]);

describe('WorkoutRepository.setDifficulty', () => {
  it('écrit la difficulté sur toutes les séries de l’exercice dans la séance, modifiable et effaçable ; l’autre exercice n’est pas touché', async () => {
    db = await openBaseDb(DEVICE);
    await openWithTwoExercises();
    const r = await db.data.repos.workouts();
    await r.setDifficulty(W, 'bench-press-barbell', 'hard');
    expect(await difficulties()).toEqual([
      ['bench-press-barbell', 'hard'],
      ['bench-press-barbell', 'hard'],
      ['bench-press-barbell', 'hard'],
      ['row-barbell', null],
      ['row-barbell', null],
    ]);
    await r.setDifficulty(W, 'bench-press-barbell', 'easy');
    await r.setDifficulty(W, 'row-barbell', 'ok');
    expect((await difficulties())?.map(([, d]) => d)).toEqual(['easy', 'easy', 'easy', 'ok', 'ok']);
    await r.setDifficulty(W, 'bench-press-barbell', null);
    expect((await difficulties())?.map(([, d]) => d)).toEqual([null, null, null, 'ok', 'ok']);
    // Séance ouverte : rien dans la file de synchro (D-27).
    expect(await db.driver.select("SELECT 1 FROM sync_outbox WHERE table_name IN ('workout', 'workout_set')")).toEqual([]);
  });

  it('valeur hors liste, exercice absent de la séance, séance close ou inconnue : refusé, rien n’est écrit', async () => {
    db = await openBaseDb(DEVICE);
    await openWithTwoExercises();
    const r = await db.data.repos.workouts();
    await expect(r.setDifficulty(W, 'bench-press-barbell', 'facile' as never)).rejects.toMatchObject({ code: 'invalid' });
    await expect(r.setDifficulty(W, 'squat-barbell', 'ok')).rejects.toMatchObject({ code: 'invalid' });
    await expect(r.setDifficulty(u(99), 'bench-press-barbell', 'ok')).rejects.toMatchObject({ code: 'not-found' });
    const sets = (await r.get(W))?.sets ?? [];
    for (const s of sets) await r.validateSet(s.id, { reps: 8, loadKg: 60 });
    await db.data.transaction(async (repos) => (await repos.workouts()).close(W));
    await expect(r.setDifficulty(W, 'bench-press-barbell', 'ok')).rejects.toMatchObject({ code: 'invalid' });
    expect(await db.driver.select('SELECT DISTINCT difficulty FROM workout_set')).toEqual([{ difficulty: null }]);
  });

  it('clôture : la difficulté part avec la séance (ligne entière) et l’historique du moteur la lit', async () => {
    db = await openBaseDb(DEVICE);
    await openWithTwoExercises();
    const r = await db.data.repos.workouts();
    for (const s of (await r.get(W))?.sets ?? []) await r.validateSet(s.id, { reps: 10, loadKg: 60 });
    await r.setDifficulty(W, 'bench-press-barbell', 'easy');
    db.clock.advance(1_000);
    await db.data.transaction(async (repos) => (await repos.workouts()).close(W));
    expect(await db.driver.select("SELECT COUNT(*) AS n FROM sync_outbox WHERE table_name = 'workout_set' AND field = '*'")).toEqual([{ n: 5 }]);
    const history = await (await db.data.repos.progression()).history('bench-press-barbell');
    expect(history.map((s) => s.difficulty)).toEqual(['easy']);
  });
});
