import { afterEach, describe, expect, it } from 'vitest';
import { circuitsOf, type RoutineInput } from '../../../domain/training';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * I6-03b (§ 13.8, constat 11 de la relecture Codex du 12/11) : un groupe (superset, triset, circuit) défini dans un jour de routine est écrit dans
 * `routine_exercise.circuit_id` / `circuit_rest_sec` (migration 0014), relu par `get`, modifiable par `updateExercise`, et RETROUVÉ dans la séance
 * démarrée depuis ce jour : séries alternées, identifiant de groupe NEUF propre à la séance (la routine n'est jamais partagée), repos du groupe.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000e8' as DeviceId;
const u = (n: number): string => `9b3a1c2e-0000-4000-8000-${String(n).padStart(12, '0')}`;
const R = u(1);
const D1 = u(2);
const [L1, L2, L3] = [u(4), u(5), u(6)];
const C = u(9);
let db: TestDb;
afterEach(async () => db.close());

const line = (id: string, exerciseId: string, position: number, over: Record<string, unknown> = {}) => ({ id, exerciseId, exerciseName: `Nom ${exerciseId}`, sets: 2, repMin: 6, repMax: 10, rir: null, restSec: 150, position, ...over });
const grouped = (): RoutineInput => ({
  id: R,
  name: 'Haut / Bas',
  mode: 'libre',
  days: [
    {
      id: D1,
      name: 'Haut A',
      dayOrder: 1,
      exercises: [line(L1, 'bench-press-barbell', 0, { circuitId: C, circuitRestSec: 20, restSec: 90 }), line(L2, 'row-barbell', 1, { circuitId: C, circuitRestSec: 20, restSec: 90 }), line(L3, 'plank', 2, { sets: 1 })],
    },
  ],
});
const routines = async () => db.data.repos.trainingRoutines();

describe('TrainingRoutineRepository : groupes de circuit', () => {
  it('create puis get : identifiant et repos du groupe relus ; une ligne libre a les deux valeurs nulles', async () => {
    db = await openBaseDb(DEVICE);
    const created = await db.data.transaction(async (repos) => (await repos.trainingRoutines()).create(grouped()));
    expect(created.days[0]?.exercises.map((e) => [e.circuitId, e.circuitRestSec])).toEqual([
      [C, 20],
      [C, 20],
      [null, null],
    ]);
    expect(await (await routines()).get(R)).toEqual(created);
  });

  it('updateExercise : grouper puis défaire, capturés pour la synchro ; un patch sans champ de groupe le garde', async () => {
    db = await openBaseDb(DEVICE);
    await db.data.transaction(async (repos) => (await repos.trainingRoutines()).create(grouped()));
    await db.driver.execute('DELETE FROM sync_outbox');
    const repo = await routines();
    expect(await repo.updateExercise(L3, { circuitId: C, circuitRestSec: 20 })).toMatchObject({ circuitId: C, circuitRestSec: 20 });
    expect((await db.driver.select<{ field: string }>("SELECT field FROM sync_outbox WHERE table_name = 'routine_exercise' ORDER BY field")).map((r) => r.field)).toEqual(['circuit_id', 'circuit_rest_sec']);
    expect(await repo.updateExercise(L1, { sets: 4 })).toMatchObject({ sets: 4, circuitId: C, circuitRestSec: 20 });
    expect(await repo.updateExercise(L1, { circuitId: null, circuitRestSec: null })).toMatchObject({ circuitId: null, circuitRestSec: null });
  });

  it('valeurs hors bornes refusées, rien n’est écrit', async () => {
    db = await openBaseDb(DEVICE);
    await db.data.transaction(async (repos) => (await repos.trainingRoutines()).create(grouped()));
    const repo = await routines();
    await expect(repo.updateExercise(L3, { circuitId: '', circuitRestSec: 0 })).rejects.toMatchObject({ code: 'invalid' });
    await expect(repo.updateExercise(L3, { circuitId: C, circuitRestSec: 3601 })).rejects.toMatchObject({ code: 'invalid' });
    const bad = grouped();
    await expect(
      db.data.transaction(async (repos) =>
        (await repos.trainingRoutines()).create({ ...bad, id: u(20), days: [{ ...(bad.days[0] as RoutineInput['days'][number]), id: u(21), exercises: [line(u(22), 'bench-press-barbell', 0, { circuitId: 'g' }), line(u(23), 'bench-press-barbell', 1, { circuitId: 'g' })] }] }),
      ),
    ).rejects.toMatchObject({ code: 'invalid' });
    expect(await db.driver.select('SELECT circuit_id FROM routine_exercise WHERE id = ?', [L3])).toEqual([{ circuit_id: null }]);
    expect(await db.driver.select('SELECT 1 FROM routine WHERE id = ?', [u(20)])).toEqual([]);
  });
});

describe('WorkoutRepository.start depuis une routine groupée', () => {
  it('séries alternées, groupe retrouvé avec un identifiant NEUF, repos entre exercices et de fin de tour', async () => {
    db = await openBaseDb(DEVICE);
    await db.data.transaction(async (repos) => (await repos.trainingRoutines()).create(grouped()));
    const w = await db.data.transaction(async (repos) => (await repos.workouts()).start({ source: 'routine', routineId: R, dayId: D1 }));
    expect(w.sets.map((s) => s.exerciseId)).toEqual(['bench-press-barbell', 'row-barbell', 'bench-press-barbell', 'row-barbell', 'plank']);
    const [circuit] = circuitsOf(w.sets);
    expect(circuit).toMatchObject({ exerciseIds: ['bench-press-barbell', 'row-barbell'], rounds: 2, kind: 'superset', restBetweenSec: 20, restRoundSec: 90 });
    expect(circuit?.circuitId).not.toBe(C);
    expect(w.sets[4]?.circuitId ?? null).toBeNull();
    // Deux séances depuis la même routine : deux groupes distincts.
    await db.data.transaction(async (repos) => (await repos.workouts()).discard(w.id));
    const again = await db.data.transaction(async (repos) => (await repos.workouts()).start({ source: 'routine', routineId: R, dayId: D1 }));
    expect(circuitsOf(again.sets)[0]?.circuitId).not.toBe(circuit?.circuitId);
    // La routine n'est pas modifiée par le démarrage.
    expect((await (await routines()).get(R))?.days[0]?.exercises.map((e) => e.circuitId)).toEqual([C, C, null]);
  });

  it('routine sans groupe (programme de départ) : séance sans groupe', async () => {
    db = await openBaseDb(DEVICE);
    const plain = grouped();
    const day = plain.days[0] as RoutineInput['days'][number];
    await db.data.transaction(async (repos) => (await repos.trainingRoutines()).create({ ...plain, days: [{ ...day, exercises: day.exercises.map(({ circuitId: _c, circuitRestSec: _r, ...rest }) => rest) }] }));
    const w = await db.data.transaction(async (repos) => (await repos.workouts()).start({ source: 'routine', routineId: R, dayId: D1 }));
    expect(w.sets.every((s) => (s.circuitId ?? null) === null)).toBe(true);
  });
});
