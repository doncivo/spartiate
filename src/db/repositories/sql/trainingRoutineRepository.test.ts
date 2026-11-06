import { afterEach, describe, expect, it } from 'vitest';
import type { RoutineInput } from '../../../domain/training';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

const DEVICE = '60000000-0000-4000-8000-0000000000e3' as DeviceId;
const u = (n: number): string => `9b3a1c2e-0000-4000-8000-${String(n).padStart(12, '0')}`;
const R = u(1);
const D1 = u(2);
const D2 = u(3);
const L1 = u(4);
const L2 = u(5);
const L3 = u(6);
let db: TestDb;
afterEach(async () => db.close());

const line = (id: string, exerciseId: string, position: number, over: Record<string, unknown> = {}) => ({ id, exerciseId, exerciseName: `Nom ${exerciseId}`, sets: 3, repMin: 6, repMax: 10, rir: 2 as number | null, restSec: 150, position, ...over });
const tree = (): RoutineInput => ({
  id: R,
  name: 'Haut / Bas',
  mode: 'programme',
  days: [
    { id: D1, name: 'Haut A', dayOrder: 0, exercises: [line(L1, 'bench-press-barbell', 0), line(L2, 'row-barbell', 1)] },
    { id: D2, name: 'Bas A', dayOrder: 1, exercises: [line(L3, 'squat-barbell', 0, { rir: null })] },
  ],
});

describe('TrainingRoutineRepository (routine, jours, lignes)', () => {
  it('create dans une transaction : arbre complet relu trié, références embarquées sans ligne exercise, files de capture', async () => {
    db = await openBaseDb(DEVICE);
    const created = await db.data.transaction(async (repos) => (await repos.trainingRoutines()).create(tree()));
    expect(created).toMatchObject({ id: R, name: 'Haut / Bas', mode: 'programme', deletedAt: null });
    expect(created.days.map((d) => [d.id, d.name, d.dayOrder])).toEqual([[D1, 'Haut A', 0], [D2, 'Bas A', 1]]);
    expect(created.days[0]?.exercises.map((e) => e.exerciseId)).toEqual(['bench-press-barbell', 'row-barbell']);
    expect(created.days[1]?.exercises[0]).toMatchObject({ rir: null, exerciseName: 'Nom squat-barbell' });
    expect(await (await db.data.repos.trainingRoutines()).get(R)).toEqual(created);
    expect(await db.driver.select('SELECT 1 FROM exercise')).toEqual([]);
    expect(await db.driver.select("SELECT table_name, count(*) AS n FROM sync_outbox GROUP BY table_name ORDER BY table_name")).toEqual([
      { table_name: 'routine', n: 1 },
      { table_name: 'routine_day', n: 2 },
      { table_name: 'routine_exercise', n: 3 },
    ]);
  });

  it('create invalide : rien n’est écrit si la transaction échoue (série nulle, plage inversée, collision)', async () => {
    db = await openBaseDb(DEVICE);
    const bad = tree();
    const badLine = bad.days[0]?.exercises[1];
    if (!badLine) throw new Error('fixture');
    await expect(db.data.transaction(async (repos) => (await repos.trainingRoutines()).create({ ...bad, days: [{ ...bad.days[0]!, exercises: [{ ...badLine, sets: 0 }] }] }))).rejects.toMatchObject({ code: 'invalid' });
    await expect(db.data.transaction(async (repos) => (await repos.trainingRoutines()).create({ ...bad, days: [{ ...bad.days[0]!, exercises: [{ ...badLine, repMin: 12, repMax: 8 }] }] }))).rejects.toMatchObject({ code: 'invalid' });
    expect(await db.driver.select('SELECT 1 FROM routine')).toEqual([]);
    await db.data.transaction(async (repos) => (await repos.trainingRoutines()).create(tree()));
    await expect(db.data.transaction(async (repos) => (await repos.trainingRoutines()).create({ ...tree(), name: 'Doublon' }))).rejects.toMatchObject({ code: 'conflict' });
    expect((await (await db.data.repos.trainingRoutines()).get(R))?.name).toBe('Haut / Bas');
  });

  it('une transaction qui échoue au milieu de l’arbre annule tout (aucune ligne orpheline)', async () => {
    db = await openBaseDb(DEVICE);
    const dup = tree();
    const first = dup.days[0];
    if (!first) throw new Error('fixture');
    await expect(
      db.data.transaction(async (repos) => (await repos.trainingRoutines()).create({ ...dup, days: [first, { ...first, name: 'Même jour', dayOrder: 5 }] })),
    ).rejects.toBeTruthy();
    expect(await db.driver.select('SELECT 1 FROM routine')).toEqual([]);
    expect(await db.driver.select('SELECT 1 FROM routine_day')).toEqual([]);
  });

  it('list : en-têtes actifs triés par nom ; update de l’en-tête ; get inconnu : null', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await db.data.repos.trainingRoutines();
    await db.data.transaction(async (repos) => (await repos.trainingRoutines()).create(tree()));
    await repo.create({ id: u(90), name: 'Alpha', mode: 'libre', days: [] });
    expect((await repo.list()).map((r) => r.name)).toEqual(['Alpha', 'Haut / Bas']);
    db.clock.advance(1_000);
    expect(await repo.update(u(90), { name: 'Zeta' })).toMatchObject({ name: 'Zeta', mode: 'libre' });
    await expect(repo.update(u(90), { name: '' })).rejects.toMatchObject({ code: 'invalid' });
    await expect(repo.update(u(91), { name: 'x' })).rejects.toMatchObject({ code: 'not-found' });
    expect(await repo.get(u(91))).toBeNull();
  });

  it('édition d’une ligne : séries, plage, repos, position ; validée ; une entrée de file par colonne', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await db.data.repos.trainingRoutines();
    await repo.create(tree());
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(1_000);
    const edited = await repo.updateExercise(L1, { sets: 4, repMax: 12, restSec: 120 });
    expect(edited).toMatchObject({ sets: 4, repMin: 6, repMax: 12, restSec: 120, exerciseId: 'bench-press-barbell' });
    expect((await db.driver.select<{ field: string }>('SELECT field FROM sync_outbox ORDER BY field')).map((r) => r.field)).toEqual(['rep_max', 'rest_sec', 'sets']);
    await expect(repo.updateExercise(L1, { repMin: 20 })).rejects.toMatchObject({ code: 'invalid' });
    await expect(repo.updateExercise(u(99), { sets: 2 })).rejects.toMatchObject({ code: 'not-found' });
  });

  it('ajout d’une ligne sur un exercice quelconque (embarqué, personnalisé, absent) et d’un jour ; parent inconnu refusé', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await db.data.repos.trainingRoutines();
    await repo.create(tree());
    const added = await repo.addExercise(D2, line(u(10), 'ancien-exercice', 1));
    expect(added).toMatchObject({ exerciseId: 'ancien-exercice', routineDayId: D2 });
    await expect(repo.addExercise(u(98), line(u(11), 'x', 0))).rejects.toMatchObject({ code: 'not-found' });
    await expect(repo.addExercise(D2, line(L3, 'x', 2))).rejects.toMatchObject({ code: 'conflict' });
    const day = await repo.addDay(R, { id: u(12), name: 'Haut B', dayOrder: 2, exercises: [line(u(13), 'curl-dumbbell', 0)] });
    expect(day.exercises).toHaveLength(1);
    await expect(repo.addDay(u(98), { id: u(14), name: 'x', dayOrder: 3, exercises: [] })).rejects.toMatchObject({ code: 'not-found' });
    expect((await repo.get(R))?.days.map((d) => d.name)).toEqual(['Haut A', 'Bas A', 'Haut B']);
  });

  it('retrait d’une ligne, d’un jour (avec ses lignes) puis de la routine : suppressions logiques, tombstones laissées à la synchro', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await db.data.repos.trainingRoutines();
    await repo.create(tree());
    db.clock.advance(1_000);
    await repo.removeExercise(L2);
    expect((await repo.get(R))?.days[0]?.exercises.map((e) => e.id)).toEqual([L1]);
    await repo.removeDay(D2);
    expect((await repo.get(R))?.days.map((d) => d.id)).toEqual([D1]);
    expect(await db.driver.select('SELECT deleted_at IS NOT NULL AS gone FROM routine_exercise WHERE id = ?', [L3])).toEqual([{ gone: 1 }]);
    await repo.softDelete(R);
    expect(await repo.get(R)).toBeNull();
    expect(await repo.list()).toEqual([]);
    expect(await db.driver.select('SELECT count(*) AS n FROM routine_exercise WHERE deleted_at IS NULL')).toEqual([{ n: 0 }]);
    expect(await db.driver.select('SELECT count(*) AS n FROM routine_day WHERE deleted_at IS NULL')).toEqual([{ n: 0 }]);
    await expect(repo.softDelete(R)).rejects.toMatchObject({ code: 'not-found' });
  });

  it('EXPLAIN QUERY PLAN : la lecture des lignes d’un jour utilise l’index', async () => {
    db = await openBaseDb(DEVICE);
    const plan = await db.driver.select<{ detail: string }>('EXPLAIN QUERY PLAN SELECT * FROM routine_exercise WHERE routine_day_id = ? AND deleted_at IS NULL ORDER BY position', [D1]);
    expect(plan.map((p) => p.detail).join(' ')).toMatch(/idx_routine_exercise_day/);
    const plan2 = await db.driver.select<{ detail: string }>('EXPLAIN QUERY PLAN SELECT * FROM routine_exercise WHERE exercise_id = ?', ['bench-press-barbell']);
    expect(plan2.map((p) => p.detail).join(' ')).toMatch(/idx_routine_exercise_exercise/);
  });
});
