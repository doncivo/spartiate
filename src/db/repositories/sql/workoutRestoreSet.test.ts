import { afterEach, describe, expect, it } from 'vitest';
import { WORKOUT_SETS_MAX } from '../../../domain/training';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * GEST-0303 (BL-169, D-653) : « Annuler » après une série supprimée d'un geste : la série revient intacte (saisie, état, type, groupe) à côté
 * de son repère (série voisine de la même unité, relevée au geste), dans la séance OUVERTE et hors pause seulement ; rien n'est publié
 * (séance ouverte, D-27). Relecture : repère disparu ou passé dans une autre unité (`conflict`), séance en pause ou pleine (`invalid`).
 * Séance close (série effacée à la clôture), série vivante ou absente : refus, rien n'est écrit. Valeurs inventées.
 */
const DEVICE = '60000000-0000-4000-8000-0000000003d3' as DeviceId;
const u = (n: number): string => `3d3a0000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const W1 = u(100);
const must = <T>(value: T | null | undefined): T => {
  if (value === null || value === undefined) throw new Error('valeur attendue');
  return value;
};
let db: TestDb;
afterEach(async () => db.close());

async function seeded() {
  db = await openBaseDb(DEVICE);
  const repo = await db.data.repos.workouts();
  await repo.start({ source: 'empty', id: W1 });
  await repo.addExercise(W1, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé', sets: 3, targetRepsMin: 6, targetRepsMax: 10 });
  const w = await repo.addExercise(W1, { exerciseId: 'row-barbell', exerciseName: 'Rowing', sets: 1 });
  return { repo, sets: w.sets.map((s) => s.id) };
}
const deletedAt = async (id: string): Promise<string | null | undefined> =>
  (await db.driver.select<{ deleted_at: string | null }>('SELECT deleted_at FROM workout_set WHERE id = ?', [id]))[0]?.deleted_at;

describe('GEST-0303 : restoreSet (annulation d’une série supprimée)', () => {
  it('la série supprimée revient intacte après son repère, positions contiguës, rien en file de synchro', async () => {
    const { repo, sets } = await seeded();
    const [b0, b1] = sets as [string, string, string, string];
    const second = must(b1);
    await repo.validateSet(must(b0), { loadKg: 80, reps: 8 });
    await repo.updateSet(second, { loadKg: 82.5, reps: 7, rir: 2 });
    const before = must((await repo.get(W1))?.sets.find((s) => s.id === second));
    await repo.removeSet(second);
    expect((await repo.get(W1))?.sets.map((s) => s.id)).not.toContain(second);

    const restored = await repo.restoreSet(second, { kind: 'after', id: must(b0) });
    expect(restored).toMatchObject({ id: second, loadKg: 82.5, reps: 7, rir: 2, done: false, setKind: 'work', exerciseId: 'bench-press-barbell', deletedAt: null, position: 1 });
    const w = must(await repo.get(W1));
    expect(w.sets.map((s) => s.id)).toEqual(sets);
    expect(w.sets.map((s) => s.position)).toEqual([0, 1, 2, 3]);
    const again = must(w.sets.find((s) => s.id === second));
    expect({ ...again, updatedAt: before.updatedAt, hlc: before.hlc, deviceId: before.deviceId }).toEqual(before);
    expect(await db.driver.select('SELECT * FROM sync_outbox')).toEqual([]);
  });

  it('réordonner puis annuler : la série revient après sa voisine, pas à son ancien index', async () => {
    const { repo, sets } = await seeded();
    const [b0, b1, b2, r0] = sets as [string, string, string, string];
    await repo.removeSet(b1);
    await repo.reorderSets(W1, [r0, b0, b2]);
    await repo.restoreSet(b1, { kind: 'after', id: b0 });
    expect(must(await repo.get(W1)).sets.map((s) => s.id)).toEqual([r0, b0, b1, b2]);
  });

  it('repère disparu ou unité changée : conflict, rien n’est écrit', async () => {
    const { repo, sets } = await seeded();
    const [b0, b1, , r0] = sets as [string, string, string, string];
    await repo.removeSet(b1);
    await repo.removeSet(b0);
    await expect(repo.restoreSet(b1, { kind: 'after', id: b0 })).rejects.toMatchObject({ code: 'conflict' });
    await expect(repo.restoreSet(b1, { kind: 'before', id: r0 })).rejects.toMatchObject({ code: 'conflict' });
    expect(await deletedAt(b1)).not.toBeNull();
  });

  it('séance en pause : invalid, rien n’est écrit ; après la reprise, la série revient', async () => {
    const { repo, sets } = await seeded();
    const [b0, b1] = sets as [string, string, string, string];
    await repo.removeSet(b1);
    await repo.pauseWorkout(W1);
    await expect(repo.restoreSet(b1, { kind: 'after', id: b0 })).rejects.toMatchObject({ code: 'invalid' });
    expect(await deletedAt(b1)).not.toBeNull();
    await repo.resumeWorkout(W1);
    await repo.restoreSet(b1, { kind: 'after', id: b0 });
    expect(await deletedAt(b1)).toBeNull();
  });

  it('séance pleine (WORKOUT_SETS_MAX séries vivantes) : invalid, comme un ajout', async () => {
    const { repo, sets } = await seeded();
    const [b0, b1] = sets as [string, string, string, string];
    await repo.removeSet(b1);
    // Séance remplie d'un bloc (copies de la série de rowing) : 3 vivantes + 197 = WORKOUT_SETS_MAX.
    await db.driver.execute(
      `INSERT INTO workout_set (id, workout_id, exercise_id, exercise_name, position, set_kind, done, created_at, updated_at, device_id, hlc)
       WITH RECURSIVE n(i) AS (SELECT 4 UNION ALL SELECT i + 1 FROM n WHERE i < ${String(WORKOUT_SETS_MAX)})
       SELECT 'fill-' || i, workout_id, exercise_id, exercise_name, i, set_kind, 0, created_at, updated_at, device_id, hlc FROM n, workout_set WHERE id = ?`,
      [must(sets[3])],
    );
    expect(must(await repo.get(W1)).sets).toHaveLength(WORKOUT_SETS_MAX);
    await expect(repo.restoreSet(b1, { kind: 'after', id: b0 })).rejects.toMatchObject({ code: 'invalid' });
  });

  it('refus sans écriture : série vivante (invalid), absente (not-found), séance close (série effacée à la clôture : not-found)', async () => {
    const { repo, sets } = await seeded();
    const [b0, b1, b2] = sets as [string, string, string, string];
    await expect(repo.restoreSet(b1, { kind: 'after', id: b0 })).rejects.toMatchObject({ code: 'invalid' });
    await expect(repo.restoreSet(u(999), { kind: 'after', id: b0 })).rejects.toMatchObject({ code: 'not-found' });
    await repo.removeSet(b2);
    await repo.validateSet(b0, { loadKg: 80, reps: 8 });
    await repo.close(W1);
    await expect(repo.restoreSet(b2, { kind: 'after', id: b1 })).rejects.toMatchObject({ code: 'not-found' });
    expect(must(await repo.getClosed(W1)).sets.map((s) => s.id)).not.toContain(b2);
  });

  it('séance close dont la série supprimée existerait encore : invalid, rien n’est écrit', async () => {
    const { repo, sets } = await seeded();
    const [, b1, b2] = sets as [string, string, string, string];
    await repo.removeSet(b2);
    // Ligne gardée par une base plus ancienne (cas hypothétique) : la clôture est simulée sans purge.
    await db.driver.execute("UPDATE workout SET ended_at = '2026-10-01T09:00:00.000Z' WHERE id = ?", [W1]);
    await expect(repo.restoreSet(b2, { kind: 'after', id: b1 })).rejects.toMatchObject({ code: 'invalid' });
    expect(await deletedAt(b2)).not.toBeNull();
  });
});
