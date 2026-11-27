import { afterEach, describe, expect, it } from 'vitest';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * GEST-0303 (BL-169, D-653) : « Annuler » après une série supprimée d'un geste : la série revient intacte (saisie, état, type, groupe) à sa place
 * d'avant, dans la séance OUVERTE seulement ; rien n'est publié (séance ouverte, D-27). Séance close (série effacée à la clôture), série
 * vivante ou absente : refus, rien n'est écrit. Valeurs inventées.
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
  return { repo, sets: w.sets };
}

describe('GEST-0303 : restoreSet (annulation d’une série supprimée)', () => {
  it('la série supprimée revient intacte à sa place d’avant, positions contiguës, rien en file de synchro', async () => {
    const { repo, sets } = await seeded();
    const second = must(sets[1]);
    await repo.validateSet(must(sets[0]).id, { loadKg: 80, reps: 8 });
    await repo.updateSet(second.id, { loadKg: 82.5, reps: 7, rir: 2 });
    const before = must((await repo.get(W1))?.sets.find((s) => s.id === second.id));
    await repo.removeSet(second.id);
    expect((await repo.get(W1))?.sets.map((s) => s.id)).not.toContain(second.id);

    const restored = await repo.restoreSet(second.id, 1);
    expect(restored).toMatchObject({ id: second.id, loadKg: 82.5, reps: 7, rir: 2, done: false, setKind: 'work', exerciseId: 'bench-press-barbell', deletedAt: null, position: 1 });
    const w = must(await repo.get(W1));
    expect(w.sets.map((s) => s.id)).toEqual(sets.map((s) => s.id));
    expect(w.sets.map((s) => s.position)).toEqual([0, 1, 2, 3]);
    const again = must(w.sets.find((s) => s.id === second.id));
    expect({ ...again, updatedAt: before.updatedAt, hlc: before.hlc, deviceId: before.deviceId }).toEqual(before);
    expect(await db.driver.select('SELECT * FROM sync_outbox')).toEqual([]);
  });

  it('place bornée : au-delà de la fin, la série revient en dernier ; en deçà de 0, en premier', async () => {
    const { repo, sets } = await seeded();
    const last = must(sets[3]);
    await repo.removeSet(last.id);
    await repo.restoreSet(last.id, 99);
    expect(must(await repo.get(W1)).sets.map((s) => s.id).at(-1)).toBe(last.id);
    const first = must(sets[0]);
    await repo.removeSet(first.id);
    await repo.restoreSet(first.id, -3);
    expect(must(await repo.get(W1)).sets.map((s) => s.id)[0]).toBe(first.id);
  });

  it('refus sans écriture : série vivante (invalid), absente (not-found), séance close (série effacée à la clôture : not-found)', async () => {
    const { repo, sets } = await seeded();
    await expect(repo.restoreSet(must(sets[1]).id, 1)).rejects.toMatchObject({ code: 'invalid' });
    await expect(repo.restoreSet(u(999), 0)).rejects.toMatchObject({ code: 'not-found' });
    const removed = must(sets[2]);
    await repo.removeSet(removed.id);
    await repo.validateSet(must(sets[0]).id, { loadKg: 80, reps: 8 });
    await repo.close(W1);
    await expect(repo.restoreSet(removed.id, 2)).rejects.toMatchObject({ code: 'not-found' });
    expect(must(await repo.getClosed(W1)).sets.map((s) => s.id)).not.toContain(removed.id);
  });

  it('séance close dont la série supprimée existerait encore : invalid, rien n’est écrit', async () => {
    const { repo, sets } = await seeded();
    const removed = must(sets[2]);
    await repo.removeSet(removed.id);
    // Ligne gardée par une base plus ancienne (cas hypothétique) : la clôture est simulée sans purge.
    await db.driver.execute("UPDATE workout SET ended_at = '2026-10-01T09:00:00.000Z' WHERE id = ?", [W1]);
    await expect(repo.restoreSet(removed.id, 2)).rejects.toMatchObject({ code: 'invalid' });
    const row = await db.driver.select<{ deleted_at: string | null }>('SELECT deleted_at FROM workout_set WHERE id = ?', [removed.id]);
    expect(row[0]?.deleted_at).not.toBeNull();
  });
});
