import { uuidGenerator, type IdGenerator } from '../../../domain/id';
import type { WriteStamper } from '../../../domain/hlc';
import {
  SETS_MAX,
  SET_KINDS,
  WORKOUT_SOURCES,
  extendRestEnd,
  isRestSeconds,
  planFromPastWorkout,
  planFromRoutineDay,
  restEndAt,
  validateSetBounds,
  validateSetEntry,
  REST_EXTEND_SEC,
  type PlannedSet,
  type RoutineExerciseSpec,
  type SetEntry,
  type SetKind,
  type Workout,
  type WorkoutSet,
  type WorkoutSource,
  type WorkoutWithSets,
} from '../../../domain/training';
import type { IsoDateTime } from '../../../domain/types';
import type { SqlExecutor, SqlRow } from '../../driver';
import { RepositoryError } from '../common';
import type { RestTimer, WorkoutRepository } from '../workoutRepository';
import { readSyncMeta, type SyncRow } from './sqlHelpers';

interface WorkoutRow extends SqlRow, SyncRow {
  readonly routine_id: string | null;
  readonly routine_day_id: string | null;
  readonly name: string;
  readonly started_at: string;
  readonly ended_at: string | null;
  readonly source: string;
  readonly copied_from_workout_id: string | null;
  readonly rest_timer_end_at: string | null;
  readonly rest_timer_seconds: number;
  readonly notes: string;
}
interface SetRow extends SqlRow, SyncRow {
  readonly workout_id: string;
  readonly exercise_id: string;
  readonly exercise_name: string;
  readonly position: number;
  readonly set_kind: string;
  readonly target_reps_min: number | null;
  readonly target_reps_max: number | null;
  readonly target_load_kg: number | null;
  readonly target_rest_sec: number | null;
  readonly reps: number | null;
  readonly load_kg: number | null;
  readonly duration_sec: number | null;
  readonly rir: number | null;
  readonly done: number;
  readonly done_at: string | null;
}
interface RoutineLineRow extends SqlRow {
  readonly exercise_id: string;
  readonly exercise_name: string;
  readonly sets: number;
  readonly rep_min: number;
  readonly rep_max: number;
  readonly rir: number | null;
  readonly rest_sec: number;
  readonly position: number;
}

const rowToWorkout = (row: WorkoutRow): Workout => ({
  id: row.id,
  routineId: row.routine_id,
  routineDayId: row.routine_day_id,
  name: row.name,
  startedAt: row.started_at as IsoDateTime,
  endedAt: row.ended_at as IsoDateTime | null,
  source: row.source as WorkoutSource,
  copiedFromWorkoutId: row.copied_from_workout_id,
  restTimerEndAt: row.rest_timer_end_at as IsoDateTime | null,
  restTimerSeconds: row.rest_timer_seconds,
  notes: row.notes,
  ...readSyncMeta(row),
});
const rowToSet = (row: SetRow): WorkoutSet => ({
  id: row.id,
  workoutId: row.workout_id,
  exerciseId: row.exercise_id,
  exerciseName: row.exercise_name,
  position: row.position,
  setKind: row.set_kind as SetKind,
  targetRepsMin: row.target_reps_min,
  targetRepsMax: row.target_reps_max,
  targetLoadKg: row.target_load_kg,
  targetRestSec: row.target_rest_sec,
  reps: row.reps,
  loadKg: row.load_kg,
  durationSec: row.duration_sec,
  rir: row.rir,
  done: row.done === 1,
  doneAt: row.done_at as IsoDateTime | null,
  ...readSyncMeta(row),
});

const isIntOrNull = (n: number | null | undefined, min: number, max: number): boolean => n === null || n === undefined || (Number.isInteger(n) && n >= min && n <= max);

export function createWorkoutRepository(db: SqlExecutor, stamper: WriteStamper, ids: IdGenerator = uuidGenerator): WorkoutRepository {
  const invalid = (entity: string, id: string): never => {
    throw new RepositoryError('invalid', entity, id);
  };

  const rawWorkout = async (id: string): Promise<WorkoutRow | undefined> => (await db.select<WorkoutRow>('SELECT * FROM workout WHERE id = ? AND deleted_at IS NULL', [id]))[0];
  const rawSets = (workoutId: string): Promise<SetRow[]> =>
    db.select<SetRow>('SELECT * FROM workout_set WHERE workout_id = ? AND deleted_at IS NULL ORDER BY position, id', [workoutId]);
  const rawOpen = async (): Promise<WorkoutRow | undefined> =>
    (await db.select<WorkoutRow>('SELECT * FROM workout WHERE ended_at IS NULL AND deleted_at IS NULL ORDER BY started_at DESC, id LIMIT 1'))[0];

  const load = async (id: string): Promise<WorkoutWithSets | null> => {
    const row = await rawWorkout(id);
    return row ? { ...rowToWorkout(row), sets: (await rawSets(id)).map(rowToSet) } : null;
  };
  const loadOrThrow = async (id: string): Promise<WorkoutWithSets> => {
    const w = await load(id);
    if (!w) throw new RepositoryError('not-found', 'workout', id);
    return w;
  };
  /** Séance existante et ouverte : absente `not-found`, close `invalid`. */
  const requireOpen = async (id: string): Promise<WorkoutRow> => {
    const row = await rawWorkout(id);
    if (!row) throw new RepositoryError('not-found', 'workout', id);
    if (row.ended_at !== null) invalid('workout', id);
    return row;
  };
  const requireSet = async (setId: string): Promise<SetRow> => {
    const row = (await db.select<SetRow>('SELECT * FROM workout_set WHERE id = ? AND deleted_at IS NULL', [setId]))[0];
    if (!row) throw new RepositoryError('not-found', 'workout_set', setId);
    await requireOpen(row.workout_id);
    return row;
  };
  const requireSetRow = async (setId: string): Promise<WorkoutSet> => {
    const row = (await db.select<SetRow>('SELECT * FROM workout_set WHERE id = ?', [setId]))[0];
    if (!row) throw new RepositoryError('not-found', 'workout_set', setId);
    return rowToSet(row);
  };

  const insertSet = async (workoutId: string, id: string, position: number, plan: PlannedSet): Promise<void> => {
    const stamp = stamper.next();
    await db.execute(
      `INSERT INTO workout_set (id, workout_id, exercise_id, exercise_name, position, set_kind, target_reps_min, target_reps_max, target_load_kg, target_rest_sec,
         done, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [id, workoutId, plan.exerciseId, plan.exerciseName, position, plan.setKind, plan.targetRepsMin, plan.targetRepsMax, plan.targetLoadKg, plan.targetRestSec, stamp.at, stamp.at, stamp.deviceId, stamp.hlc],
    );
  };
  const markSetDeleted = async (id: string): Promise<void> => {
    const stamp = stamper.next();
    await db.execute('UPDATE workout_set SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, id]);
  };
  /** Positions 0, 1, 2… dans l'ordre courant ; ne réécrit que les lignes qui changent. */
  const renumber = async (workoutId: string): Promise<void> => {
    const rows = await rawSets(workoutId);
    for (const [index, row] of rows.entries()) {
      if (row.position === index) continue;
      const stamp = stamper.next();
      await db.execute('UPDATE workout_set SET position = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [index, stamp.at, stamp.deviceId, stamp.hlc, row.id]);
    }
  };
  /** Le tampon sert aussi d'horloge : l'échéance se calcule depuis lui, puis l'écriture suit sans attente entre les deux. */
  const writeRest = async (id: string, compute: (nowMs: number) => { endAt: string | null; seconds: number }): Promise<{ endAt: string | null; seconds: number }> => {
    const stamp = stamper.next();
    const { endAt, seconds } = compute(Date.parse(stamp.at));
    await db.execute('UPDATE workout SET rest_timer_end_at = ?, rest_timer_seconds = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [endAt, seconds, stamp.at, stamp.deviceId, stamp.hlc, id]);
    return { endAt, seconds };
  };
  const toRest = (row: WorkoutRow): RestTimer | null =>
    row.rest_timer_end_at === null ? null : { workoutId: row.id, endAt: row.rest_timer_end_at, seconds: row.rest_timer_seconds };
  const requireOpenRow = async (): Promise<WorkoutRow> => {
    const row = await rawOpen();
    if (!row) throw new RepositoryError('not-found', 'workout', 'open');
    return row;
  };

  const planFor = async (input: Parameters<WorkoutRepository['start']>[0]): Promise<{ plan: PlannedSet[]; name: string; routineId: string | null; dayId: string | null; copyFromId: string | null }> => {
    const entity = 'workout';
    const key = input.id ?? 'start';
    if (input.source === 'empty') {
      if (input.routineId || input.dayId || input.copyFromId) invalid(entity, key);
      return { plan: [], name: input.name ?? '', routineId: null, dayId: null, copyFromId: null };
    }
    if (input.source === 'routine') {
      if (!input.routineId || !input.dayId || input.copyFromId) return invalid(entity, key);
      const day = (
        await db.select<{ name: string }>(
          `SELECT d.name FROM routine_day d JOIN routine r ON r.id = d.routine_id
           WHERE d.id = ? AND d.routine_id = ? AND d.deleted_at IS NULL AND r.deleted_at IS NULL`,
          [input.dayId, input.routineId],
        )
      )[0];
      if (!day) throw new RepositoryError('not-found', 'routine_day', input.dayId);
      const lines = await db.select<RoutineLineRow>(
        'SELECT exercise_id, exercise_name, sets, rep_min, rep_max, rir, rest_sec, position FROM routine_exercise WHERE routine_day_id = ? AND deleted_at IS NULL ORDER BY position, id',
        [input.dayId],
      );
      const specs: RoutineExerciseSpec[] = lines.map((l) => ({
        exerciseId: l.exercise_id,
        exerciseName: l.exercise_name,
        sets: l.sets,
        repMin: l.rep_min,
        repMax: l.rep_max,
        rir: l.rir,
        restSec: l.rest_sec,
        position: l.position,
      }));
      return { plan: planFromRoutineDay(specs), name: input.name ?? day.name, routineId: input.routineId, dayId: input.dayId, copyFromId: null };
    }
    if (!input.copyFromId || input.routineId || input.dayId) return invalid(entity, key);
    const source = await load(input.copyFromId);
    if (!source) throw new RepositoryError('not-found', 'workout', input.copyFromId);
    const plan = planFromPastWorkout(source);
    if (plan.length === 0) return invalid(entity, input.copyFromId);
    return { plan, name: input.name ?? source.name, routineId: null, dayId: null, copyFromId: input.copyFromId };
  };

  const mergedEntry = (row: SetRow, patch: Partial<SetEntry>): SetEntry => ({
    reps: patch.reps === undefined ? row.reps : patch.reps,
    loadKg: patch.loadKg === undefined ? row.load_kg : patch.loadKg,
    durationSec: patch.durationSec === undefined ? row.duration_sec : patch.durationSec,
    rir: patch.rir === undefined ? row.rir : patch.rir,
  });

  return {
    async start(input) {
      if (!(WORKOUT_SOURCES as readonly string[]).includes(input.source)) invalid('workout', input.id ?? 'start');
      if (await rawOpen()) throw new RepositoryError('conflict', 'workout', input.id ?? 'open');
      const id = input.id ?? ids.next();
      if ((await db.select('SELECT 1 FROM workout WHERE id = ?', [id])).length > 0) throw new RepositoryError('conflict', 'workout', id);
      const { plan, name, routineId, dayId, copyFromId } = await planFor(input);
      const stamp = stamper.next();
      await db.execute(
        `INSERT INTO workout (id, routine_id, routine_day_id, name, started_at, source, copied_from_workout_id, created_at, updated_at, device_id, hlc)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, routineId, dayId, name.trim(), stamp.at, input.source, copyFromId, stamp.at, stamp.at, stamp.deviceId, stamp.hlc],
      );
      for (const [position, set] of plan.entries()) await insertSet(id, ids.next(), position, set);
      return loadOrThrow(id);
    },

    getOpen: async () => {
      const row = await rawOpen();
      return row ? load(row.id) : null;
    },

    get: load,

    async listClosed(limit = 10) {
      const n = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 10;
      const rows = await db.select<WorkoutRow>('SELECT * FROM workout WHERE ended_at IS NOT NULL AND deleted_at IS NULL ORDER BY ended_at DESC, id LIMIT ?', [n]);
      return rows.map(rowToWorkout);
    },

    async addExercise(workoutId, input) {
      await requireOpen(workoutId);
      const count = input.sets ?? 1;
      const min = input.targetRepsMin ?? null;
      const max = input.targetRepsMax ?? null;
      if (
        input.exerciseId.trim() === '' ||
        input.exerciseId.length > 128 ||
        input.exerciseName.trim() === '' ||
        !isIntOrNull(count, 1, SETS_MAX) ||
        !isIntOrNull(min, 1, 999) ||
        !isIntOrNull(max, 1, 999) ||
        (min !== null && max !== null && max < min) ||
        !isIntOrNull(input.targetRestSec, 0, 900) ||
        (input.targetLoadKg !== undefined && input.targetLoadKg !== null && !(input.targetLoadKg >= 0 && input.targetLoadKg <= 1000))
      ) {
        invalid('workout_set', workoutId);
      }
      const existing = await rawSets(workoutId);
      if (existing.some((s) => s.exercise_id === input.exerciseId)) throw new RepositoryError('conflict', 'workout_set', input.exerciseId);
      for (let i = 0; i < count; i++) {
        await insertSet(workoutId, ids.next(), existing.length + i, {
          exerciseId: input.exerciseId,
          exerciseName: input.exerciseName.trim(),
          setKind: 'work',
          targetRepsMin: min,
          targetRepsMax: max,
          targetLoadKg: input.targetLoadKg ?? null,
          targetRestSec: input.targetRestSec ?? null,
        });
      }
      return loadOrThrow(workoutId);
    },

    async removeExercise(workoutId, exerciseId) {
      await requireOpen(workoutId);
      const rows = (await rawSets(workoutId)).filter((s) => s.exercise_id === exerciseId);
      if (rows.length === 0) throw new RepositoryError('not-found', 'workout_set', exerciseId);
      for (const row of rows) await markSetDeleted(row.id);
      await renumber(workoutId);
      return loadOrThrow(workoutId);
    },

    async addSet(workoutId, exerciseId, options) {
      await requireOpen(workoutId);
      const kind = options?.setKind ?? 'work';
      if (!(SET_KINDS as readonly string[]).includes(kind)) invalid('workout_set', workoutId);
      const rows = await rawSets(workoutId);
      const lastIndex = rows.map((s) => s.exercise_id).lastIndexOf(exerciseId);
      const last = rows[lastIndex];
      if (!last) throw new RepositoryError('not-found', 'workout_set', exerciseId);
      const id = options?.id ?? ids.next();
      if ((await db.select('SELECT 1 FROM workout_set WHERE id = ?', [id])).length > 0) throw new RepositoryError('conflict', 'workout_set', id);
      // Place la nouvelle série juste après la dernière de l'exercice, puis renumérote les suivantes.
      const later = rows.slice(lastIndex + 1);
      for (const [offset, row] of later.entries()) {
        const stamp = stamper.next();
        await db.execute('UPDATE workout_set SET position = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [last.position + 2 + offset, stamp.at, stamp.deviceId, stamp.hlc, row.id]);
      }
      await insertSet(workoutId, id, last.position + 1, {
        exerciseId,
        exerciseName: last.exercise_name,
        setKind: kind,
        targetRepsMin: last.target_reps_min,
        targetRepsMax: last.target_reps_max,
        targetLoadKg: last.target_load_kg,
        targetRestSec: last.target_rest_sec,
      });
      await renumber(workoutId);
      return rowToSet((await db.select<SetRow>('SELECT * FROM workout_set WHERE id = ?', [id]))[0] as SetRow);
    },

    async updateSet(setId, patch) {
      const row = await requireSet(setId);
      const kind = patch.setKind ?? (row.set_kind as SetKind);
      if (!(SET_KINDS as readonly string[]).includes(kind)) invalid('workout_set', setId);
      const entry = mergedEntry(row, patch);
      const min = patch.targetRepsMin === undefined ? row.target_reps_min : patch.targetRepsMin;
      const max = patch.targetRepsMax === undefined ? row.target_reps_max : patch.targetRepsMax;
      const load = patch.targetLoadKg === undefined ? row.target_load_kg : patch.targetLoadKg;
      const issues = row.done === 1 ? validateSetEntry(entry, kind) : validateSetBounds(entry);
      if (
        issues.length > 0 ||
        !isIntOrNull(min, 1, 999) ||
        !isIntOrNull(max, 1, 999) ||
        (min !== null && max !== null && max < min) ||
        (load !== null && !(Number.isFinite(load) && load >= 0 && load <= 1000))
      ) {
        invalid('workout_set', setId);
      }
      const stamp = stamper.next();
      await db.execute(
        `UPDATE workout_set SET set_kind = ?, reps = ?, load_kg = ?, duration_sec = ?, rir = ?, target_reps_min = ?, target_reps_max = ?, target_load_kg = ?,
           updated_at = ?, device_id = ?, hlc = ? WHERE id = ?`,
        [kind, entry.reps, entry.loadKg, entry.durationSec, entry.rir, min, max, load, stamp.at, stamp.deviceId, stamp.hlc, setId],
      );
      return requireSetRow(setId);
    },

    async validateSet(setId, entryInput) {
      const row = await requireSet(setId);
      const entry = mergedEntry(row, entryInput ?? {});
      if (validateSetEntry(entry, row.set_kind as SetKind).length > 0) invalid('workout_set', setId);
      const stamp = stamper.next();
      await db.execute(
        `UPDATE workout_set SET reps = ?, load_kg = ?, duration_sec = ?, rir = ?, done = 1, done_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?`,
        [entry.reps, entry.loadKg, entry.durationSec, entry.rir, stamp.at, stamp.at, stamp.deviceId, stamp.hlc, setId],
      );
      return requireSetRow(setId);
    },

    async unvalidateSet(setId) {
      await requireSet(setId);
      const stamp = stamper.next();
      await db.execute('UPDATE workout_set SET done = 0, done_at = NULL, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.deviceId, stamp.hlc, setId]);
      return requireSetRow(setId);
    },

    async removeSet(setId) {
      const row = await requireSet(setId);
      await markSetDeleted(setId);
      await renumber(row.workout_id);
    },

    async startRest({ seconds }) {
      const row = await requireOpenRow();
      if (!isRestSeconds(seconds)) invalid('workout', row.id);
      const written = await writeRest(row.id, (now) => ({ endAt: restEndAt(now, seconds), seconds }));
      return { workoutId: row.id, endAt: written.endAt ?? '', seconds };
    },

    async extendRest(addSeconds = REST_EXTEND_SEC) {
      const row = await requireOpenRow();
      if (!isRestSeconds(addSeconds)) invalid('workout', row.id);
      const written = await writeRest(row.id, (now) => {
        const running = row.rest_timer_end_at !== null && Date.parse(row.rest_timer_end_at) > now;
        return { endAt: extendRestEnd(row.rest_timer_end_at, now, addSeconds), seconds: running ? row.rest_timer_seconds + addSeconds : addSeconds };
      });
      return { workoutId: row.id, endAt: written.endAt ?? '', seconds: written.seconds };
    },

    async skipRest() {
      const row = await rawOpen();
      if (!row || row.rest_timer_end_at === null) return;
      await writeRest(row.id, () => ({ endAt: null, seconds: row.rest_timer_seconds }));
    },

    getRest: async () => {
      const row = await rawOpen();
      return row ? toRest(row) : null;
    },

    async discard(id) {
      await requireOpen(id);
      for (const row of await rawSets(id)) await markSetDeleted(row.id);
      const stamp = stamper.next();
      await db.execute('UPDATE workout SET rest_timer_end_at = NULL, deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, id]);
    },
  };
}
