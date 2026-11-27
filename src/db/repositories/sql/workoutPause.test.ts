import { afterEach, describe, expect, it } from 'vitest';
import type { DeviceId } from '../../../domain/types';
import { RepositoryError } from '../common';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * SESS-0302 (BL-110, D-658, § 13.2) : pause de la séance OUVERTE. `pauseWorkout` pose `paused_at` et annule le repos en cours (même écriture) ;
 * `resumeWorkout` ajoute la durée de la pause à `paused_ms` ; la clôture d'une séance en pause y ajoute la pause en cours. Rien n'est publié avant la
 * clôture (D-27) ; la clôture publie la ligne entière, cumul compris. Base SQLite réelle, données synthétiques.
 */
const DEVICE = '60000000-0000-4000-8000-000000000302' as DeviceId;
const W = '3c5d7e9f-0000-4000-8000-000000000302';
const START = '2026-11-27T17:00:00.000Z';
let db: TestDb;
afterEach(async () => {
  await (db as TestDb | undefined)?.close();
  db = undefined as never;
});

async function openSession() {
  db = await openBaseDb(DEVICE, START);
  const r = await db.data.repos.workouts();
  await r.start({ source: 'empty', id: W, name: 'Séance' });
  const w = await r.addExercise(W, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 2, targetRepsMin: 8, targetRepsMax: 10 });
  return { r, sets: w.sets };
}
const row = async () => (await db.driver.select<{ paused_at: string | null; paused_ms: number; rest_timer_end_at: string | null }>('SELECT paused_at, paused_ms, rest_timer_end_at FROM workout WHERE id = ?', [W]))[0];

describe('SESS-0302 : pause et reprise de la séance ouverte', () => {
  it('séance neuve : aucune pause, cumul 0 (lecture)', async () => {
    const { r } = await openSession();
    const w = await r.get(W);
    expect(w?.pausedAt ?? null).toBeNull();
    expect(w?.pausedMs ?? 0).toBe(0);
  });

  it('pause : instant posé et repos en cours annulé ; deuxième appui sans effet ; nouveau repos refusé pendant la pause', async () => {
    const { r } = await openSession();
    await r.startRest({ seconds: 120 });
    db.clock.advance(30_000);
    const paused = await r.pauseWorkout(W);
    expect(paused.pausedAt).toBe('2026-11-27T17:00:30.000Z');
    expect(await row()).toMatchObject({ paused_at: '2026-11-27T17:00:30.000Z', paused_ms: 0, rest_timer_end_at: null });
    expect(await r.getRest()).toBeNull();
    db.clock.advance(10_000);
    expect((await r.pauseWorkout(W)).pausedAt).toBe('2026-11-27T17:00:30.000Z');
    await expect(r.startRest({ seconds: 90 })).rejects.toMatchObject({ code: 'invalid' });
    await expect(r.extendRest()).rejects.toMatchObject({ code: 'invalid' });
  });

  it('reprise : la durée de la pause rejoint le cumul ; plusieurs pauses s’additionnent ; reprise sans pause : rien', async () => {
    const { r } = await openSession();
    await r.pauseWorkout(W);
    db.clock.advance(120_000);
    expect(await r.resumeWorkout(W)).toMatchObject({ pausedAt: null, pausedMs: 120_000 });
    db.clock.advance(60_000);
    await r.pauseWorkout(W);
    db.clock.advance(45_000);
    await r.resumeWorkout(W);
    expect(await row()).toMatchObject({ paused_at: null, paused_ms: 165_000 });
    const hlc = (await db.driver.select<{ hlc: string }>('SELECT hlc FROM workout WHERE id = ?', [W]))[0]?.hlc;
    await r.resumeWorkout(W);
    expect((await db.driver.select<{ hlc: string }>('SELECT hlc FROM workout WHERE id = ?', [W]))[0]?.hlc).toBe(hlc);
    await r.startRest({ seconds: 90 });
    expect(await r.getRest()).not.toBeNull();
  });

  it('séance ouverte : pause et reprise jamais publiées ; clôture pendant une pause : pause en cours ajoutée au cumul, ligne entière en file', async () => {
    const { r, sets } = await openSession();
    await r.validateSet(sets[0]?.id ?? '', { reps: 8, loadKg: 80 });
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(60_000);
    await r.pauseWorkout(W);
    db.clock.advance(90_000);
    expect(await db.driver.select("SELECT 1 FROM sync_outbox WHERE table_name = 'workout'")).toEqual([]);
    const closed = await r.close(W);
    expect(closed.workout).toMatchObject({ pausedAt: null, pausedMs: 90_000 });
    expect(closed.summary.durationSec).toBe(60);
    expect(await db.driver.select("SELECT field FROM sync_outbox WHERE table_name = 'workout'")).toEqual([{ field: '*' }]);
  });

  it('séance close ou absente : pause et reprise refusées, rien n’est écrit', async () => {
    const { r, sets } = await openSession();
    await r.validateSet(sets[0]?.id ?? '', { reps: 8, loadKg: 80 });
    await r.close(W);
    await expect(r.pauseWorkout(W)).rejects.toBeInstanceOf(RepositoryError);
    await expect(r.pauseWorkout(W)).rejects.toMatchObject({ code: 'invalid' });
    await expect(r.resumeWorkout(W)).rejects.toMatchObject({ code: 'invalid' });
    await expect(r.pauseWorkout('3c5d7e9f-0000-4000-8000-000000000999')).rejects.toMatchObject({ code: 'not-found' });
  });

  it('abandon pendant une pause : séance et séries supprimées, repos effacé, rien de publié ; une nouvelle séance démarre sans pause', async () => {
    const { r, sets } = await openSession();
    await r.validateSet(sets[0]?.id ?? '', { reps: 8, loadKg: 80 });
    await r.startRest({ seconds: 120 });
    await db.driver.execute('DELETE FROM sync_outbox');
    await r.pauseWorkout(W);
    db.clock.advance(60_000);
    await db.data.transaction(async (repos) => (await repos.workouts()).discard(W));
    expect(await r.getOpen()).toBeNull();
    expect(await r.get(W)).toBeNull();
    expect(await db.driver.select('SELECT deleted_at IS NOT NULL AS deleted, rest_timer_end_at FROM workout WHERE id = ?', [W])).toEqual([{ deleted: 1, rest_timer_end_at: null }]);
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM workout_set WHERE workout_id = ? AND deleted_at IS NULL', [W])).toEqual([{ n: 0 }]);
    expect(await db.driver.select("SELECT 1 FROM sync_outbox WHERE table_name IN ('workout', 'workout_set')")).toEqual([]);
    await expect(r.resumeWorkout(W)).rejects.toMatchObject({ code: 'not-found' });
    const next = await r.start({ source: 'empty', name: 'Suivante' });
    expect(next.pausedAt ?? null).toBeNull();
    expect(next.pausedMs ?? 0).toBe(0);
  });
});
