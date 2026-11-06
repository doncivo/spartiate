import type { SqlDriver } from '../../../src/db/driver';
import type { Workout, WorkoutSet, WorkoutWithSets } from '../../../src/domain/training';

/**
 * Fixtures synthétiques I1-02 (D-38 : aucune donnée réelle) : séance interrompue après cinq séries validées, repos en cours au moment du
 * « verrouillage », séance passée close (source d'une copie). Les identifiants sont des UUID de fantaisie.
 */

const u = (n: number): string => `5e1a0c2d-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const DEVICE = '0f8fad5b-d9cb-469f-a165-70867728950e';
const h = (ms: number): string => `${String(ms).padStart(15, '0')}-0000-${DEVICE}`;

export const T0 = '2026-11-02T17:00:00.000Z';
export const T0_MS = Date.parse(T0);

export const WORKOUT_ID = u(1);
export const PAST_WORKOUT_ID = u(2);
export const SET_IDS = [u(11), u(12), u(13), u(14), u(15), u(16), u(17)] as const;

const meta = { createdAt: T0, updatedAt: T0, deletedAt: null, deviceId: DEVICE, hlc: h(1) } as never;

export const workoutRow = (over: Partial<Workout> = {}): Workout => ({
  id: WORKOUT_ID,
  routineId: null,
  routineDayId: null,
  name: 'Haut A',
  startedAt: T0,
  endedAt: null,
  source: 'empty',
  copiedFromWorkoutId: null,
  restTimerEndAt: null,
  restTimerSeconds: 0,
  notes: '',
  ...(meta as object),
  ...over,
});

export const setRow = (index: number, over: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: SET_IDS[index] as string,
  workoutId: WORKOUT_ID,
  exerciseId: index < 3 ? 'bench-press-barbell' : 'row-barbell',
  exerciseName: index < 3 ? 'Développé couché à la barre' : 'Rowing à la barre',
  position: index,
  setKind: 'work',
  targetRepsMin: 6,
  targetRepsMax: 10,
  targetLoadKg: null,
  targetRestSec: 150,
  reps: null,
  loadKg: null,
  durationSec: null,
  rir: null,
  done: false,
  doneAt: null,
  ...(meta as object),
  ...over,
});

/** Cinq séries validées (3 développé couché, 2 rowing), la sixième et la septième non faites. Le repos de 150 s a commencé à T0 + 10 min. */
export const REST_STARTED_AT_MS = T0_MS + 10 * 60_000;
export const REST_END_AT = new Date(REST_STARTED_AT_MS + 150_000).toISOString();

export const INTERRUPTED: WorkoutWithSets = {
  ...workoutRow({ restTimerEndAt: REST_END_AT, restTimerSeconds: 150 }),
  sets: [
    setRow(0, { done: true, reps: 8, loadKg: 60, rir: 2, doneAt: T0 }),
    setRow(1, { done: true, reps: 8, loadKg: 60, rir: 2, doneAt: T0 }),
    setRow(2, { done: true, reps: 7, loadKg: 60, rir: 1, doneAt: T0 }),
    setRow(3, { done: true, reps: 10, loadKg: 50, rir: 2, doneAt: T0 }),
    setRow(4, { done: true, reps: 9, loadKg: 50, rir: 2, doneAt: T0 }),
    setRow(5),
    setRow(6),
  ],
};

/** Séance passée close : un échauffement validé, deux séries de travail validées, une série non faite (jamais copiée). */
export const PAST: WorkoutWithSets = {
  ...workoutRow({ id: PAST_WORKOUT_ID, name: 'Haut A', endedAt: '2026-10-26T18:10:00.000Z', startedAt: '2026-10-26T17:00:00.000Z' }),
  sets: [
    setRow(0, { workoutId: PAST_WORKOUT_ID, id: u(21), position: 0, setKind: 'warmup', done: true, reps: 8, loadKg: 40, doneAt: '2026-10-26T17:05:00.000Z' }),
    setRow(1, { workoutId: PAST_WORKOUT_ID, id: u(22), position: 1, done: true, reps: 8, loadKg: 60, rir: 2, doneAt: '2026-10-26T17:10:00.000Z' }),
    setRow(2, { workoutId: PAST_WORKOUT_ID, id: u(23), position: 2, done: true, reps: 7, loadKg: 62.5, rir: 1, doneAt: '2026-10-26T17:15:00.000Z' }),
    setRow(3, { workoutId: PAST_WORKOUT_ID, id: u(24), position: 3, exerciseId: 'plank', exerciseName: 'Planche', setKind: 'timed', done: true, durationSec: 45, doneAt: '2026-10-26T17:30:00.000Z' }),
    setRow(4, { workoutId: PAST_WORKOUT_ID, id: u(25), position: 4, exerciseId: 'plank', exerciseName: 'Planche', setKind: 'timed' }),
  ],
};

/** Insère `PAST` tel qu'I1-03 le laissera (close), directement en SQL : aucune donnée réelle, seulement la forme. */
export async function seedPastWorkout(db: SqlDriver, past: WorkoutWithSets = PAST): Promise<void> {
  await db.execute(
    `INSERT INTO workout (id, routine_id, routine_day_id, name, started_at, ended_at, source, copied_from_workout_id, rest_timer_end_at, rest_timer_seconds, notes, created_at, updated_at, device_id, hlc)
     VALUES (?, NULL, NULL, ?, ?, ?, 'empty', NULL, NULL, 0, '', ?, ?, ?, ?)`,
    [past.id, past.name, past.startedAt, past.endedAt, past.startedAt, past.startedAt, DEVICE, h(1)],
  );
  for (const s of past.sets) {
    await db.execute(
      `INSERT INTO workout_set (id, workout_id, exercise_id, exercise_name, position, set_kind, target_reps_min, target_reps_max, target_load_kg, target_rest_sec, reps, load_kg, duration_sec, rir, done, done_at, created_at, updated_at, device_id, hlc)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.id, past.id, s.exerciseId, s.exerciseName, s.position, s.setKind, s.targetRepsMin, s.targetRepsMax, s.targetLoadKg, s.targetRestSec, s.reps, s.loadKg, s.durationSec, s.rir, s.done ? 1 : 0, s.doneAt, past.startedAt, past.startedAt, DEVICE, h(1)],
    );
  }
}
