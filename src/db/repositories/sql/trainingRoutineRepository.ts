import type { WriteStamper } from '../../../domain/hlc';
import {
  validateRoutine,
  validateRoutineDay,
  validateRoutineLine,
  type Routine,
  type RoutineDay,
  type RoutineDayInput,
  type RoutineExercise,
  type RoutineExerciseInput,
  type RoutineInput,
  type RoutineMode,
  type RoutineTree,
} from '../../../domain/training';
import { isId } from '../../../domain/types';
import type { SqlExecutor, SqlRow } from '../../driver';
import { RepositoryError } from '../common';
import type { TrainingRoutineRepository } from '../trainingRoutineRepository';
import { readSyncMeta, type SyncRow } from './sqlHelpers';

interface RoutineRow extends SqlRow, SyncRow {
  readonly name: string;
  readonly mode: string;
}
interface DayRow extends SqlRow, SyncRow {
  readonly routine_id: string;
  readonly name: string;
  readonly day_order: number;
}
interface LineRow extends SqlRow, SyncRow {
  readonly routine_day_id: string;
  readonly exercise_id: string;
  readonly exercise_name: string;
  readonly sets: number;
  readonly rep_min: number;
  readonly rep_max: number;
  readonly rir: number | null;
  readonly rest_sec: number;
  readonly position: number;
}

const rowToRoutine = (row: RoutineRow): Routine => ({ id: row.id, name: row.name, mode: row.mode as RoutineMode, ...readSyncMeta(row) });
const rowToLine = (row: LineRow): RoutineExercise => ({
  id: row.id,
  routineDayId: row.routine_day_id,
  exerciseId: row.exercise_id,
  exerciseName: row.exercise_name,
  sets: row.sets,
  repMin: row.rep_min,
  repMax: row.rep_max,
  rir: row.rir,
  restSec: row.rest_sec,
  position: row.position,
  ...readSyncMeta(row),
});
const rowToDay = (row: DayRow, lines: readonly LineRow[]): RoutineDay => ({
  id: row.id,
  routineId: row.routine_id,
  name: row.name,
  dayOrder: row.day_order,
  exercises: lines.filter((l) => l.routine_day_id === row.id).map(rowToLine),
  ...readSyncMeta(row),
});

export function createTrainingRoutineRepository(db: SqlExecutor, stamper: WriteStamper): TrainingRoutineRepository {
  const invalid = (entity: string, id: string): never => {
    throw new RepositoryError('invalid', entity, id);
  };
  const exists = async (table: 'routine' | 'routine_day' | 'routine_exercise', id: string): Promise<boolean> =>
    (await db.select(`SELECT 1 FROM ${table} WHERE id = ?`, [id])).length > 0;
  const liveRoutine = async (id: string): Promise<RoutineRow> => {
    const row = (await db.select<RoutineRow>('SELECT * FROM routine WHERE id = ? AND deleted_at IS NULL', [id]))[0];
    if (!row) throw new RepositoryError('not-found', 'routine', id);
    return row;
  };
  const liveDay = async (id: string): Promise<DayRow> => {
    const row = (await db.select<DayRow>('SELECT * FROM routine_day WHERE id = ? AND deleted_at IS NULL', [id]))[0];
    if (!row) throw new RepositoryError('not-found', 'routine_day', id);
    return row;
  };
  const liveLine = async (id: string): Promise<LineRow> => {
    const row = (await db.select<LineRow>('SELECT * FROM routine_exercise WHERE id = ? AND deleted_at IS NULL', [id]))[0];
    if (!row) throw new RepositoryError('not-found', 'routine_exercise', id);
    return row;
  };
  const dayWithLines = async (id: string): Promise<RoutineDay> => {
    const day = (await db.select<DayRow>('SELECT * FROM routine_day WHERE id = ?', [id]))[0];
    if (!day) throw new RepositoryError('not-found', 'routine_day', id);
    const lines = await db.select<LineRow>('SELECT * FROM routine_exercise WHERE routine_day_id = ? AND deleted_at IS NULL ORDER BY position, id', [id]);
    return rowToDay(day, lines);
  };

  const insertRoutine = async (id: string, name: string, mode: RoutineMode): Promise<void> => {
    const stamp = stamper.next();
    await db.execute('INSERT INTO routine (id, name, mode, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, name.trim(), mode, stamp.at, stamp.at, stamp.deviceId, stamp.hlc]);
  };
  const insertDay = async (routineId: string, day: Omit<RoutineDayInput, 'exercises'>): Promise<void> => {
    const stamp = stamper.next();
    await db.execute('INSERT INTO routine_day (id, routine_id, name, day_order, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
      day.id,
      routineId,
      day.name.trim(),
      day.dayOrder,
      stamp.at,
      stamp.at,
      stamp.deviceId,
      stamp.hlc,
    ]);
  };
  const insertLine = async (dayId: string, line: RoutineExerciseInput): Promise<void> => {
    const stamp = stamper.next();
    await db.execute(
      `INSERT INTO routine_exercise (id, routine_day_id, exercise_id, exercise_name, sets, rep_min, rep_max, rir, rest_sec, position, created_at, updated_at, device_id, hlc)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [line.id, dayId, line.exerciseId, line.exerciseName.trim(), line.sets, line.repMin, line.repMax, line.rir, line.restSec, line.position, stamp.at, stamp.at, stamp.deviceId, stamp.hlc],
    );
  };
  const markDeleted = async (table: 'routine' | 'routine_day' | 'routine_exercise', id: string): Promise<void> => {
    const stamp = stamper.next();
    await db.execute(`UPDATE ${table} SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?`, [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, id]);
  };

  const getTree = async (id: string): Promise<RoutineTree | null> => {
    const routine = (await db.select<RoutineRow>('SELECT * FROM routine WHERE id = ? AND deleted_at IS NULL', [id]))[0];
    if (!routine) return null;
    const days = await db.select<DayRow>('SELECT * FROM routine_day WHERE routine_id = ? AND deleted_at IS NULL ORDER BY day_order, id', [id]);
    const lines = await db.select<LineRow>(
      `SELECT * FROM routine_exercise WHERE deleted_at IS NULL AND routine_day_id IN (SELECT id FROM routine_day WHERE routine_id = ? AND deleted_at IS NULL) ORDER BY position, id`,
      [id],
    );
    return { ...rowToRoutine(routine), days: days.map((d) => rowToDay(d, lines)) };
  };

  return {
    async create(input: RoutineInput) {
      const ids = [input.id, ...input.days.flatMap((d) => [d.id, ...d.exercises.map((e) => e.id)])];
      if (ids.some((id) => !isId(id)) || validateRoutine(input).length > 0) invalid('routine', input.id);
      if (new Set(ids).size !== ids.length) throw new RepositoryError('conflict', 'routine', input.id);
      if (await exists('routine', input.id)) throw new RepositoryError('conflict', 'routine', input.id);
      for (const day of input.days) {
        if (await exists('routine_day', day.id)) throw new RepositoryError('conflict', 'routine_day', day.id);
        for (const line of day.exercises) if (await exists('routine_exercise', line.id)) throw new RepositoryError('conflict', 'routine_exercise', line.id);
      }
      await insertRoutine(input.id, input.name, input.mode);
      for (const day of input.days) {
        await insertDay(input.id, day);
        for (const line of day.exercises) await insertLine(day.id, line);
      }
      const tree = await getTree(input.id);
      if (!tree) throw new RepositoryError('not-found', 'routine', input.id);
      return tree;
    },

    get: getTree,

    async list() {
      return (await db.select<RoutineRow>('SELECT * FROM routine WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE, id')).map(rowToRoutine);
    },

    async update(id, patch) {
      const current = await liveRoutine(id);
      const name = patch.name ?? current.name;
      const mode = patch.mode ?? (current.mode as RoutineMode);
      if (validateRoutine({ name, mode, days: [] }).length > 0) invalid('routine', id);
      const stamp = stamper.next();
      await db.execute('UPDATE routine SET name = ?, mode = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [name.trim(), mode, stamp.at, stamp.deviceId, stamp.hlc, id]);
      return rowToRoutine(await liveRoutine(id));
    },

    async softDelete(id) {
      await liveRoutine(id);
      const days = await db.select<DayRow>('SELECT * FROM routine_day WHERE routine_id = ? AND deleted_at IS NULL', [id]);
      for (const day of days) {
        const lines = await db.select<LineRow>('SELECT id FROM routine_exercise WHERE routine_day_id = ? AND deleted_at IS NULL', [day.id]);
        for (const line of lines) await markDeleted('routine_exercise', line.id);
        await markDeleted('routine_day', day.id);
      }
      await markDeleted('routine', id);
    },

    async addDay(routineId, day) {
      if (!isId(day.id) || day.exercises.some((e) => !isId(e.id)) || validateRoutineDay(day).length > 0) invalid('routine_day', day.id);
      await liveRoutine(routineId);
      if (await exists('routine_day', day.id)) throw new RepositoryError('conflict', 'routine_day', day.id);
      for (const line of day.exercises) if (await exists('routine_exercise', line.id)) throw new RepositoryError('conflict', 'routine_exercise', line.id);
      await insertDay(routineId, day);
      for (const line of day.exercises) await insertLine(day.id, line);
      return dayWithLines(day.id);
    },

    async updateDay(id, patch) {
      const current = await liveDay(id);
      const next = { name: patch.name ?? current.name, dayOrder: patch.dayOrder ?? current.day_order, exercises: [] };
      if (validateRoutineDay(next).length > 0) invalid('routine_day', id);
      const stamp = stamper.next();
      await db.execute('UPDATE routine_day SET name = ?, day_order = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [next.name.trim(), next.dayOrder, stamp.at, stamp.deviceId, stamp.hlc, id]);
      return dayWithLines(id);
    },

    async removeDay(id) {
      await liveDay(id);
      const lines = await db.select<LineRow>('SELECT id FROM routine_exercise WHERE routine_day_id = ? AND deleted_at IS NULL', [id]);
      for (const line of lines) await markDeleted('routine_exercise', line.id);
      await markDeleted('routine_day', id);
    },

    async addExercise(dayId, line) {
      if (!isId(line.id) || validateRoutineLine(line).length > 0) invalid('routine_exercise', line.id);
      await liveDay(dayId);
      if (await exists('routine_exercise', line.id)) throw new RepositoryError('conflict', 'routine_exercise', line.id);
      await insertLine(dayId, line);
      return rowToLine(await liveLine(line.id));
    },

    async updateExercise(id, patch) {
      const current = rowToLine(await liveLine(id));
      const next: RoutineExerciseInput = {
        id,
        exerciseId: patch.exerciseId ?? current.exerciseId,
        exerciseName: patch.exerciseName ?? current.exerciseName,
        sets: patch.sets ?? current.sets,
        repMin: patch.repMin ?? current.repMin,
        repMax: patch.repMax ?? current.repMax,
        rir: patch.rir === undefined ? current.rir : patch.rir,
        restSec: patch.restSec ?? current.restSec,
        position: patch.position ?? current.position,
      };
      if (validateRoutineLine(next).length > 0) invalid('routine_exercise', id);
      const stamp = stamper.next();
      await db.execute(
        `UPDATE routine_exercise SET exercise_id = ?, exercise_name = ?, sets = ?, rep_min = ?, rep_max = ?, rir = ?, rest_sec = ?, position = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?`,
        [next.exerciseId, next.exerciseName.trim(), next.sets, next.repMin, next.repMax, next.rir, next.restSec, next.position, stamp.at, stamp.deviceId, stamp.hlc, id],
      );
      return rowToLine(await liveLine(id));
    },

    async removeExercise(id) {
      await liveLine(id);
      await markDeleted('routine_exercise', id);
    },
  };
}
