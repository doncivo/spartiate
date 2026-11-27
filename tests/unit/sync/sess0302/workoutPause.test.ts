import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import { setSnapshotTestHooks } from '../../../../src/sync/snapshot';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice, type SimSchema } from '../../../sim/syncDevice';

/**
 * SESS-0302 (BL-110, D-658, D-26, D-27) : `workout.paused_at` et `workout.paused_ms` (migration 0024) à deux bases. Une séance ouverte en pause n'est
 * jamais publiée ; close, elle arrive avec son cumul. Un appareil resté au schéma 23 garde les deux champs dans `sync_unknown` et les réintègre après sa
 * mise à jour ; une séance close qu'il a écrite (sans les champs) est mise de côté chez l'appareil à jour, puis reçue entière avec un cumul nul (lu 0) après la
 * republication de `workout` (schéma 24). Données synthétiques.
 */
const A_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb302';
const B_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa302';
const W = '5c1d0e2f-0000-4000-8000-000000000302';
const W_OLD = '5c1d0e2f-0000-4000-8000-000000000301';

let devices: SimDevice[] = [];
afterEach(async () => {
  setSnapshotTestHooks({});
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});
async function two(bSchema: SimSchema = 'i0'): Promise<{ a: SimDevice; b: SimDevice }> {
  const a = await createSimDevice(A_ID, { name: 'PC', schema: 'i0' });
  const b = await createSimDevice(B_ID, { name: 'iPhone', schema: bSchema, clock: createManualClock(a.clock.nowMs()) });
  devices = [a, b];
  await setupFirst(a);
  await a.cycle();
  await pair(a, b);
  await b.cycle();
  syncFolders(devices);
  await a.cycle();
  return { a, b };
}
async function roundTrip(times = 2): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    for (const d of devices) {
      d.clock.advance(1_000);
      await d.cycle();
    }
    syncFolders(devices);
  }
}
/** Séance avec une série validée puis une pause de 90 s, encore ouverte et en pause. */
async function pausedOn(d: SimDevice, id: string, pause = true): Promise<void> {
  await d.data.transaction(async (repos) => {
    const r = await repos.workouts();
    await r.start({ source: 'empty', id, name: 'Séance' });
    const w = await r.addExercise(id, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 1, targetRepsMin: 8, targetRepsMax: 10 });
    for (const s of w.sets) await r.validateSet(s.id, { reps: 8, loadKg: 80 });
  });
  if (!pause) return;
  await (await d.data.repos.workouts()).pauseWorkout(id);
  d.clock.advance(90_000);
}
const closeOn = async (d: SimDevice, id: string) => d.data.transaction(async (repos) => (await repos.workouts()).close(id));
const pauseRow = (d: SimDevice, id: string) => d.driver.select('SELECT paused_at, paused_ms FROM workout WHERE id = ?', [id]);

describe('SESS-0302 : pause de séance à deux bases', () => {
  it('séance en pause : absente de l’autre appareil ; close : reçue avec son cumul, aucune ligne de côté, aucun conflit', async () => {
    const { a, b } = await two();
    await pausedOn(a, W);
    await roundTrip(2);
    expect(await b.driver.select('SELECT 1 FROM workout WHERE id = ?', [W])).toEqual([]);
    await closeOn(a, W);
    await roundTrip(2);
    // 90 s de pause, plus les 2 s des deux cycles de A pendant lesquels la séance est restée en pause avant sa clôture.
    expect(await pauseRow(b, W)).toEqual([{ paused_at: null, paused_ms: 92_000 }]);
    expect(await pauseRow(a, W)).toEqual(await pauseRow(b, W));
    expect(await b.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
    expect((await b.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM conflict_log'))[0]?.n).toBe(0);
    const closed = await (await b.data.repos.workouts()).getClosed(W);
    expect(closed?.pausedMs).toBe(92_000);
  });

  it('appareil resté au schéma 23 : champs gardés dans sync_unknown, réintégrés après sa mise à jour', async () => {
    const { a, b } = await two('v23');
    await pausedOn(a, W);
    await closeOn(a, W);
    await roundTrip(3);
    expect(await b.driver.select('SELECT name FROM workout WHERE id = ?', [W])).toEqual([{ name: 'Séance' }]);
    const unknown = (await b.driver.select<{ field: string }>("SELECT field FROM sync_unknown WHERE table_name = 'workout' ORDER BY field")).map((r) => r.field);
    expect(unknown).toEqual(['paused_at', 'paused_ms']);
    await b.upgradeSchema('i0');
    await roundTrip(3);
    expect(await pauseRow(b, W)).toEqual([{ paused_at: null, paused_ms: 90_000 }]);
    expect(await b.driver.select("SELECT 1 FROM sync_unknown WHERE table_name = 'workout'")).toEqual([]);
  });

  it('séance close écrite au schéma 23 (sans les champs) : mise de côté chez l’appareil à jour, puis reçue avec un cumul nul (lu 0) après la mise à jour', async () => {
    const { a, b } = await two('v23');
    await pausedOn(b, W_OLD, false);
    await closeOn(b, W_OLD);
    await roundTrip(3);
    expect(await a.driver.select('SELECT 1 FROM workout WHERE id = ?', [W_OLD])).toEqual([]);
    expect((await a.driver.select<{ n: number }>("SELECT COUNT(*) AS n FROM sync_parked WHERE table_name = 'workout'"))[0]?.n).toBeGreaterThan(0);
    await b.upgradeSchema('i0');
    await roundTrip(4);
    expect(await pauseRow(a, W_OLD)).toEqual([{ paused_at: null, paused_ms: null }]);
    expect(await pauseRow(b, W_OLD)).toEqual([{ paused_at: null, paused_ms: null }]);
    expect((await (await a.data.repos.workouts()).getClosed(W_OLD))?.pausedMs).toBe(0);
    expect(await a.driver.select('SELECT exercise_name, reps FROM workout_set WHERE workout_id = ?', [W_OLD])).toEqual([{ exercise_name: 'Développé couché', reps: 8 }]);
  });

  /** Relecture : A clôt sa séance en pause AVANT l'arrivée de B ; B rejoint par l'instantané (époque 1), jamais par le journal seul. */
  async function lateJoiner(bSchema: SimSchema): Promise<{ a: SimDevice; b: SimDevice; batches: () => number }> {
    const a = await createSimDevice(A_ID, { name: 'PC', schema: 'i0' });
    devices = [a];
    await setupFirst(a);
    await pausedOn(a, W);
    await closeOn(a, W);
    expect((await a.cycle()).phase).toBe('idle');
    const b = await createSimDevice(B_ID, { name: 'iPhone', schema: bSchema, clock: createManualClock(a.clock.nowMs()) });
    devices = [a, b];
    let count = 0;
    setSnapshotTestHooks({ beforeBatch: () => void (count += 1) });
    await pair(a, b);
    await b.cycle();
    setSnapshotTestHooks({});
    return { a, b, batches: () => count };
  }

  it('instantané : appareil arrivé après la clôture, reçoit le cumul par l’instantané', async () => {
    const { a, b, batches } = await lateJoiner('i0');
    expect(batches()).toBeGreaterThan(0);
    expect(await pauseRow(b, W)).toEqual([{ paused_at: null, paused_ms: 90_000 }]);
    expect(await pauseRow(b, W)).toEqual(await pauseRow(a, W));
    expect(await b.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
  });

  it('instantané du schéma 24 lu par un appareil au schéma 23 : champs gardés dans sync_unknown, réintégrés après sa mise à jour', async () => {
    const { b, batches } = await lateJoiner('v23');
    expect(batches()).toBeGreaterThan(0);
    expect(await b.driver.select('SELECT name FROM workout WHERE id = ?', [W])).toEqual([{ name: 'Séance' }]);
    const unknown = (await b.driver.select<{ field: string }>("SELECT field FROM sync_unknown WHERE table_name = 'workout' ORDER BY field")).map((r) => r.field);
    expect(unknown).toEqual(['paused_at', 'paused_ms']);
    await b.upgradeSchema('i0');
    devices.forEach((d) => d.clock.advance(1_000));
    await b.cycle();
    expect(await pauseRow(b, W)).toEqual([{ paused_at: null, paused_ms: 90_000 }]);
    expect(await b.driver.select("SELECT 1 FROM sync_unknown WHERE table_name = 'workout'")).toEqual([]);
  });
});
