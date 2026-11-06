import { afterEach, describe, expect, it } from 'vitest';
import type { RoutineInput } from '../../../domain/training';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/** I1-03 : clôture, journal, correction, suppression d'une séance close et mise à jour de la routine (D-27, § 13.5, § 13.8). */

const DEVICE = '60000000-0000-4000-8000-0000000000e4' as DeviceId;
const u = (n: number): string => `9b3a1c2e-0000-4000-8000-${String(n).padStart(12, '0')}`;
const R = u(1);
const D1 = u(2);
const W1 = u(100);
const W2 = u(101);
const must = <T>(value: T | null | undefined): T => {
  if (value === null || value === undefined) throw new Error('valeur attendue');
  return value;
};
let db: TestDb;
afterEach(async () => db.close());

const routine = (): RoutineInput => ({
  id: R,
  name: 'Haut / Bas',
  mode: 'programme',
  days: [
    {
      id: D1,
      name: 'Haut A',
      dayOrder: 0,
      exercises: [
        { id: u(4), exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 2, repMin: 6, repMax: 10, rir: 2, restSec: 150, position: 0 },
        { id: u(5), exerciseId: 'row-barbell', exerciseName: 'Rowing', sets: 2, repMin: 8, repMax: 12, rir: 2, restSec: 120, position: 1 },
      ],
    },
  ],
});

const repo = () => db.data.repos.workouts();
const outbox = () => db.driver.select<{ table_name: string; row_id: string; field: string }>('SELECT table_name, row_id, field FROM sync_outbox ORDER BY seq');

/** Séance ouverte vide avec `n` séries de développé validées (60 kg × 8). */
async function openWith(id: string, n = 2, load = 60): Promise<string[]> {
  db.clock.advance(1_000);
  const r = await repo();
  await r.start({ source: 'empty', id, name: 'Séance' });
  const w = await r.addExercise(id, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: n });
  for (const s of w.sets) await r.validateSet(s.id, { reps: 8, loadKg: load });
  return w.sets.map((s) => s.id);
}
const close = (id: string) => db.data.transaction(async (repos) => (await repos.workouts()).close(id));

describe('clôture', () => {
  it('pose ended_at, résumé (durée, séries, tonnage), séance et séries en file d’un bloc avec un seul hlc', async () => {
    db = await openBaseDb(DEVICE);
    const sets = await openWith(W1);
    expect(await outbox()).toEqual([]);
    db.clock.advance(60_000);
    const closed = await close(W1);
    expect(closed.alreadyClosed).toBe(false);
    expect(closed.workout.endedAt).not.toBeNull();
    expect(closed.summary).toMatchObject({ validatedSets: 2, validatedWorkSets: 2, plannedSets: 2, tonnageKg: 960, records: [] });
    expect(closed.summary.durationSec).toBeGreaterThanOrEqual(60);
    expect(await outbox()).toEqual([{ table_name: 'workout', row_id: W1, field: '*' }, ...sets.map((id) => ({ table_name: 'workout_set', row_id: id, field: '*' }))]);
    const hlcs = await db.driver.select<{ hlc: string }>('SELECT hlc FROM workout WHERE id = ? UNION SELECT hlc FROM workout_set WHERE workout_id = ?', [W1, W1]);
    expect(hlcs).toHaveLength(1);
    expect(await (await repo()).getOpen()).toBeNull();
  });

  it('rejeu : déjà close, rien n’est réécrit (exactement une fois)', async () => {
    db = await openBaseDb(DEVICE);
    await openWith(W1);
    await close(W1);
    const before = [await outbox(), await db.driver.select('SELECT * FROM workout'), await db.driver.select('SELECT * FROM workout_set ORDER BY id')];
    const again = await close(W1);
    expect(again.alreadyClosed).toBe(true);
    expect([await outbox(), await db.driver.select('SELECT * FROM workout'), await db.driver.select('SELECT * FROM workout_set ORDER BY id')]).toEqual(before);
  });

  it('interruption au milieu de la clôture (échec de l’instruction finale) : rien d’écrit, rien en file ; le réessai aboutit une fois', async () => {
    db = await openBaseDb(DEVICE);
    await openWith(W1);
    const removed = must((await (await repo()).get(W1))?.sets[1]);
    await (await repo()).removeSet(removed.id);
    const before = await db.driver.select('SELECT * FROM workout_set ORDER BY id');
    await db.driver.execute("CREATE TEMP TRIGGER crash_close BEFORE UPDATE OF ended_at ON workout BEGIN SELECT RAISE(ABORT, 'arrêt simulé'); END");
    await expect(close(W1)).rejects.toThrow();
    expect(await db.driver.select('SELECT * FROM workout_set ORDER BY id')).toEqual(before);
    expect(await outbox()).toEqual([]);
    expect(must(await (await repo()).getOpen()).id).toBe(W1);
    await db.driver.execute('DROP TRIGGER crash_close');
    await close(W1);
    expect((await outbox()).map((o) => `${o.table_name}:${o.field}`)).toEqual(['workout:*', 'workout_set:*']);
    // La série retirée pendant la séance, jamais publiée, a disparu.
    expect(await db.driver.select('SELECT 1 FROM workout_set WHERE id = ?', [removed.id])).toEqual([]);
  });

  it('séance sans série validée : refusée (abandonner), absente : not-found', async () => {
    db = await openBaseDb(DEVICE);
    await (await repo()).start({ source: 'empty', id: W1 });
    await expect(close(W1)).rejects.toMatchObject({ code: 'invalid' });
    await expect(close(W2)).rejects.toMatchObject({ code: 'not-found' });
    expect(await outbox()).toEqual([]);
  });
});

describe('journal, correction, suppression', () => {
  it('getClosed et listClosed ne rendent que les séances closes ; une séance ouverte reste lisible par get', async () => {
    db = await openBaseDb(DEVICE);
    await openWith(W1);
    await close(W1);
    await openWith(W2);
    const r = await repo();
    expect((await r.listClosed()).map((w) => w.id)).toEqual([W1]);
    expect(await r.getClosed(W2)).toBeNull();
    expect(must(await r.getClosed(W1)).sets).toHaveLength(2);
  });

  it('correction : champ par champ, corrected_at daté, file par champ ; séance ouverte refusée ; saisie invalide refusée', async () => {
    db = await openBaseDb(DEVICE);
    const [s1] = await openWith(W1);
    await close(W1);
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(3_600_000);
    const r = await repo();
    const fixed = await r.correctSet(must(s1), { loadKg: 62.5, setKind: 'drop' });
    expect(fixed).toMatchObject({ loadKg: 62.5, setKind: 'drop', reps: 8, done: true });
    expect(fixed.correctedAt).not.toBeNull();
    expect((await outbox()).map((o) => o.field).sort()).toEqual(['corrected_at', 'load_kg', 'set_kind']);
    await expect(r.correctSet(must(s1), { reps: 0 })).rejects.toMatchObject({ code: 'invalid' });
    const unchanged = await r.correctSet(must(s1), { loadKg: 62.5 });
    expect(unchanged.hlc).toBe(fixed.hlc);
    const [open] = await openWith(W2);
    await expect(r.correctSet(must(open), { loadKg: 10 })).rejects.toMatchObject({ code: 'invalid' });
    expect((await r.summary(W1)).tonnageKg).toBe(480);
  });

  it('suppression d’une séance close : séance et séries supprimées logiquement, même tampon ; ouverte refusée', async () => {
    db = await openBaseDb(DEVICE);
    await openWith(W1);
    await close(W1);
    await db.driver.execute('DELETE FROM sync_outbox');
    await db.data.transaction(async (repos) => (await repos.workouts()).deleteClosed(W1));
    const rows = await db.driver.select<{ deleted_at: string | null; hlc: string }>('SELECT deleted_at, hlc FROM workout WHERE id = ? UNION ALL SELECT deleted_at, hlc FROM workout_set WHERE workout_id = ?', [W1, W1]);
    expect(rows.every((row) => row.deleted_at !== null)).toBe(true);
    expect(new Set(rows.map((row) => row.hlc)).size).toBe(1);
    expect((await outbox()).map((o) => `${o.table_name}:${o.field}`)).toEqual(['workout_set:deleted_at', 'workout_set:deleted_at', 'workout:deleted_at']);
    expect(await (await repo()).getClosed(W1)).toBeNull();
    await openWith(W2);
    await expect((await repo()).deleteClosed(W2)).rejects.toMatchObject({ code: 'invalid' });
  });

  it('records contre les séances closes antérieures (charge plus lourde)', async () => {
    db = await openBaseDb(DEVICE);
    await openWith(W1, 1, 60);
    await close(W1);
    await openWith(W2, 1, 65);
    const closed = await close(W2);
    expect(closed.summary.records.map((r) => [r.kind, r.value, r.previous])).toEqual([
      ['load', 65, 60],
      ['set-volume', 520, 480],
    ]);
  });
});

describe('« Mettre à jour la routine ? »', () => {
  it('écarts proposés à la clôture ; rien n’est écrit dans la routine sans confirmation ; « Oui » applique les écarts', async () => {
    db = await openBaseDb(DEVICE);
    await (await db.data.repos.trainingRoutines()).create(routine());
    const r = await repo();
    const w = await r.start({ source: 'routine', id: W1, routineId: R, dayId: D1 });
    await r.removeExercise(W1, 'row-barbell');
    await r.addExercise(W1, { exerciseId: 'dip', exerciseName: 'Dips', sets: 3, targetRepsMin: 8, targetRepsMax: 12, targetRestSec: 90 });
    await r.validateSet(must(w.sets[0]).id, { reps: 8, loadKg: 60 });
    const routineBefore = await db.driver.select('SELECT * FROM routine_exercise ORDER BY id');
    const closed = await close(W1);
    expect(closed.routineDiff.hasChanges).toBe(true);
    expect(closed.routineDiff.added.map((a) => [a.exerciseId, a.sets])).toEqual([['dip', 3]]);
    expect(closed.routineDiff.removed.map((x) => x.exerciseId)).toEqual(['row-barbell']);
    expect(await db.driver.select('SELECT * FROM routine_exercise ORDER BY id')).toEqual(routineBefore);
    const applied = await db.data.transaction(async (repos) => (await repos.workouts()).applyRoutineUpdate(W1));
    expect(applied.hasChanges).toBe(true);
    const day = must((await (await db.data.repos.trainingRoutines()).get(R))?.days[0]);
    expect(day.exercises.map((l) => [l.exerciseId, l.sets, l.repMin, l.repMax, l.restSec])).toEqual([
      ['bench-press-barbell', 2, 6, 10, 150],
      ['dip', 3, 8, 12, 90],
    ]);
    expect((await (await repo()).routineChanges(W1)).hasChanges).toBe(false);
  });
});
