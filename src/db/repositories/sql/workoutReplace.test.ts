import { afterEach, describe, expect, it } from 'vitest';
import type { DeviceId } from '../../../domain/types';
import { RepositoryError } from '../common';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * SESS-01a (§ 13.2 « Remplacer ») : dans la séance OUVERTE, les séries à faire d'un exercice passent à un autre exercice, à la même position,
 * même nombre, même plage, même repos, charge cible donnée par l'appelant ; les séries validées restent à l'exercice d'origine ; les échauffements
 * à faire (rampe de l'ancien exercice) sont retirés. Rien n'est publié (séance ouverte, D-27).
 */

const DEVICE = '60000000-0000-4000-8000-0000000000f1' as DeviceId;
const u = (n: number): string => `5e5a0101-0000-4000-8000-${String(n).padStart(12, '0')}`;
const W = u(1);
let db: TestDb;
afterEach(async () => db.close());

async function open(): Promise<void> {
  db = await openBaseDb(DEVICE);
  const r = await db.data.repos.workouts();
  await r.start({ source: 'empty', id: W, name: 'Haut A' });
  await r.addExercise(W, { exerciseId: 'row-barbell', exerciseName: 'Rowing à la barre', sets: 2, targetRepsMin: 8, targetRepsMax: 12, targetRestSec: 90 });
  await r.addExercise(W, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché à la barre', sets: 3, targetRepsMin: 6, targetRepsMax: 10, targetRestSec: 150 });
  await r.addExercise(W, { exerciseId: 'curl-barbell', exerciseName: 'Curl à la barre', sets: 2, targetRestSec: 60 });
}
const shape = async () =>
  ((await (await db.data.repos.workouts()).get(W))?.sets ?? []).map((s) => [s.position, s.exerciseId, s.exerciseName, s.setKind, s.targetRepsMin, s.targetRepsMax, s.targetRestSec, s.targetLoadKg, s.loadKg, s.done]);
const replace = (from: string, to: { exerciseId: string; exerciseName: string; targetLoadKg: number | null }) =>
  db.data.transaction(async (repos) => (await repos.workouts()).replaceExercise(W, from, to));

describe('WorkoutRepository.replaceExercise', () => {
  it('séries à faire : même position, même nombre, même plage et même repos, charge estimée ; saisie effacée', async () => {
    await open();
    const r = await db.data.repos.workouts();
    const bench = (await r.get(W))?.sets.filter((s) => s.exerciseId === 'bench-press-barbell') ?? [];
    await r.updateSet(bench[0]?.id ?? '', { loadKg: 80, reps: 8 });
    await replace('bench-press-barbell', { exerciseId: 'bench-press-dumbbell', exerciseName: 'Développé couché aux haltères', targetLoadKg: 30 });
    expect(await shape()).toEqual([
      [0, 'row-barbell', 'Rowing à la barre', 'work', 8, 12, 90, null, null, false],
      [1, 'row-barbell', 'Rowing à la barre', 'work', 8, 12, 90, null, null, false],
      [2, 'bench-press-dumbbell', 'Développé couché aux haltères', 'work', 6, 10, 150, 30, null, false],
      [3, 'bench-press-dumbbell', 'Développé couché aux haltères', 'work', 6, 10, 150, 30, null, false],
      [4, 'bench-press-dumbbell', 'Développé couché aux haltères', 'work', 6, 10, 150, 30, null, false],
      [5, 'curl-barbell', 'Curl à la barre', 'work', null, null, 60, null, null, false],
      [6, 'curl-barbell', 'Curl à la barre', 'work', null, null, 60, null, null, false],
    ]);
  });

  it('série validée gardée à l’exercice d’origine ; échauffement à faire retiré ; positions contiguës', async () => {
    await open();
    await db.data.transaction(async (repos) => (await repos.workouts()).addWarmupSets(W, 'bench-press-barbell', [{ loadKg: 40, reps: 8 }]));
    const r = await db.data.repos.workouts();
    const work = (await r.get(W))?.sets.filter((s) => s.exerciseId === 'bench-press-barbell' && s.setKind === 'work') ?? [];
    await r.validateSet(work[0]?.id ?? '', { loadKg: 80, reps: 8 });
    await replace('bench-press-barbell', { exerciseId: 'bench-press-dumbbell', exerciseName: 'Développé couché aux haltères', targetLoadKg: null });
    const rows = await shape();
    expect(rows.map((x) => [x[0], x[1], x[3], x[9]])).toEqual([
      [0, 'row-barbell', 'work', false],
      [1, 'row-barbell', 'work', false],
      [2, 'bench-press-barbell', 'work', true],
      [3, 'bench-press-dumbbell', 'work', false],
      [4, 'bench-press-dumbbell', 'work', false],
      [5, 'curl-barbell', 'work', false],
      [6, 'curl-barbell', 'work', false],
    ]);
  });

  it('refus : exercice déjà dans la séance (conflict), rien à faire (invalid), séance close (invalid), absente (not-found) ; rien n’est écrit', async () => {
    await open();
    const before = await shape();
    await expect(replace('bench-press-barbell', { exerciseId: 'curl-barbell', exerciseName: 'Curl', targetLoadKg: null })).rejects.toMatchObject({ code: 'conflict' });
    await expect(replace('squat-barbell', { exerciseId: 'leg-press', exerciseName: 'Presse', targetLoadKg: null })).rejects.toMatchObject({ code: 'not-found' });
    await expect(replace('bench-press-barbell', { exerciseId: 'bench-press-dumbbell', exerciseName: ' ', targetLoadKg: null })).rejects.toBeInstanceOf(RepositoryError);
    await expect(replace('bench-press-barbell', { exerciseId: 'bench-press-dumbbell', exerciseName: 'Haltères', targetLoadKg: -1 })).rejects.toMatchObject({ code: 'invalid' });
    expect(await shape()).toEqual(before);
    const r = await db.data.repos.workouts();
    for (const s of (await r.get(W))?.sets.filter((x) => x.exerciseId === 'curl-barbell') ?? []) await r.validateSet(s.id, { loadKg: 30, reps: 10 });
    await expect(replace('curl-barbell', { exerciseId: 'curl-dumbbell', exerciseName: 'Curl haltères', targetLoadKg: null })).rejects.toMatchObject({ code: 'invalid' });
    await db.data.transaction(async (repos) => (await repos.workouts()).close(W));
    await expect(replace('bench-press-barbell', { exerciseId: 'bench-press-dumbbell', exerciseName: 'Haltères', targetLoadKg: null })).rejects.toMatchObject({ code: 'invalid' });
  });
});
