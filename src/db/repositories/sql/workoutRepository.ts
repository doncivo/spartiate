import { uuidGenerator, type IdGenerator } from '../../../domain/id';
import type { WriteStamper } from '../../../domain/hlc';
import {
  SETS_MAX,
  ABANDONED_WORKOUT_KEEP_MS,
  WORKOUT_SETS_MAX,
  SET_KINDS,
  WORKOUT_SOURCES,
  extendRestEnd,
  isRestSeconds,
  planFromPastWorkout,
  planFromRoutineDay,
  orderWithCircuit,
  validateCircuit,
  restEndAt,
  routineDiff,
  summarizeWorkout,
  validateSetBounds,
  validateSetEntry,
  REST_EXTEND_SEC,
  DIFFICULTIES,
  type Difficulty,
  type PlannedSet,
  type RoutineDay,
  type RoutineDiff,
  type RoutineExerciseSpec,
  type SetEntry,
  type SetKind,
  type Workout,
  type WorkoutSet,
  type WorkoutSource,
  type WorkoutWithSets,
} from '../../../domain/training';
import type { IsoDateTime } from '../../../domain/types';
import type { SqlDriver, SqlExecutor, SqlRow } from '../../driver';
import { RepositoryError } from '../common';
import type { RestTimer, WorkoutRepository } from '../workoutRepository';
import { readSyncMeta, type SyncRow } from './sqlHelpers';
import { createTrainingRoutineRepository } from './trainingRoutineRepository';

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
  readonly corrected_at: string | null;
  /** Absente d'une base antérieure à la migration 0006 (jamais en production : le migrateur passe avant). */
  readonly difficulty?: string | null;
  /** Absentes d'une base antérieure à la migration 0013 (jamais en production : le migrateur passe avant). */
  readonly circuit_id?: string | null;
  readonly circuit_rest_sec?: number | null;
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
  correctedAt: (row.corrected_at ?? null) as IsoDateTime | null,
  difficulty: (row.difficulty ?? null) as Difficulty | null,
  circuitId: row.circuit_id ?? null,
  circuitRestSec: row.circuit_rest_sec ?? null,
  ...readSyncMeta(row),
});

const isIntOrNull = (n: number | null | undefined, min: number, max: number): boolean => n === null || n === undefined || (Number.isInteger(n) && n >= min && n <= max);

export function createWorkoutRepository(db: SqlExecutor, stamper: WriteStamper, ids: IdGenerator = uuidGenerator): WorkoutRepository {
  const invalid = (entity: string, id: string): never => {
    throw new RepositoryError('invalid', entity, id);
  };
  /**
   * Relecture sync-icloud I1-03 (B1) : appelé sur le driver (hors `DataAccess.transaction`), une écriture multiple qui doit être atomique
   * ouvre elle-même sa transaction et s'y exécute (repository de la transaction) ; appelé dans une transaction (`tx` sans `transaction`),
   * null : l'appelant écrit directement. Aucun cycle de synchro ne peut donc s'intercaler entre ses instructions.
   */
  const atomic = <T>(work: (inTx: WorkoutRepository) => Promise<T>): Promise<T> | null =>
    typeof (db as Partial<SqlDriver>).transaction === 'function' ? (db as SqlDriver).transaction((tx) => work(createWorkoutRepository(tx, stamper, ids))) : null;

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
    const live = Number((await db.select<{ n: number }>('SELECT COUNT(*) AS n FROM workout_set WHERE workout_id = ? AND deleted_at IS NULL', [workoutId]))[0]?.n ?? 0);
    // Borne de l'agrégat publié d'un bloc (WORKOUT_SETS_MAX) : refus clair, rien n'est écrit pour cette série.
    if (live >= WORKOUT_SETS_MAX) invalid('workout_set', workoutId);
    const stamp = stamper.next();
    // Les colonnes de groupe (0013) ne sont écrites que pour une série de groupe : une série libre s'écrit comme avant.
    const grouped = plan.circuitId !== undefined && plan.circuitId !== null;
    await db.execute(
      `INSERT INTO workout_set (id, workout_id, exercise_id, exercise_name, position, set_kind, target_reps_min, target_reps_max, target_load_kg, target_rest_sec,
         done${grouped ? ', circuit_id, circuit_rest_sec' : ''}, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0${grouped ? ', ?, ?' : ''}, ?, ?, ?, ?)`,
      [
        id,
        workoutId,
        plan.exerciseId,
        plan.exerciseName,
        position,
        plan.setKind,
        plan.targetRepsMin,
        plan.targetRepsMax,
        plan.targetLoadKg,
        plan.targetRestSec,
        ...(grouped ? [plan.circuitId as string, plan.circuitRestSec ?? null] : []),
        stamp.at,
        stamp.at,
        stamp.deviceId,
        stamp.hlc,
      ],
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
  /** Écrit les positions de `order` (identifiants dans le nouvel ordre) ; ne réécrit que les lignes qui changent. */
  const applyOrder = async (order: readonly string[]): Promise<void> => {
    if (order.length === 0) return;
    const current = new Map((await db.select<SetRow>(`SELECT id, position FROM workout_set WHERE id IN (${order.map(() => '?').join(', ')})`, [...order])).map((r) => [r.id, r.position]));
    for (const [index, id] of order.entries()) {
      if (current.get(id) === index) continue;
      const stamp = stamper.next();
      await db.execute('UPDATE workout_set SET position = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [index, stamp.at, stamp.deviceId, stamp.hlc, id]);
    }
  };
  /** Exercices d'un groupe (ordre d'exécution du tour) dans la séance. */
  const circuitExercises = (rows: readonly SetRow[], circuitId: string): string[] => [...new Set(rows.filter((r) => r.circuit_id === circuitId).map((r) => r.exercise_id))];
  /** Remet les séries d'un groupe dans l'ordre alterné (après l'ajout d'une série ou d'un échauffement), positions contiguës. */
  const reorderCircuit = async (workoutId: string, circuitId: string): Promise<void> => {
    const rows = await rawSets(workoutId);
    await applyOrder(orderWithCircuit(rows.map(rowToSet), circuitExercises(rows, circuitId)));
  };
  /** Efface le groupe (colonnes nulles) et rend les séries de chaque exercice voisines, dans l'ordre de première apparition. */
  const dissolveCircuit = async (workoutId: string, circuitId: string): Promise<void> => {
    for (const row of (await rawSets(workoutId)).filter((r) => r.circuit_id === circuitId)) {
      const stamp = stamper.next();
      await db.execute('UPDATE workout_set SET circuit_id = NULL, circuit_rest_sec = NULL, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.deviceId, stamp.hlc, row.id]);
    }
    const rows = await rawSets(workoutId);
    const exerciseOrder = [...new Set(rows.map((r) => r.exercise_id))];
    await applyOrder([...rows].sort((a, b) => exerciseOrder.indexOf(a.exercise_id) - exerciseOrder.indexOf(b.exercise_id) || a.position - b.position || a.id.localeCompare(b.id)).map((r) => r.id));
  };
  /** Un groupe qui n'a plus qu'un exercice (retrait) n'en est plus un : il est dissous. */
  const dissolveBroken = async (workoutId: string): Promise<void> => {
    const rows = await rawSets(workoutId);
    for (const id of new Set(rows.map((r) => r.circuit_id).filter((c): c is string => c !== null && c !== undefined))) {
      if (circuitExercises(rows, id).length < 2) await dissolveCircuit(workoutId, id);
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

  /** Séance close non supprimée : absente `not-found`, ouverte `invalid`. */
  const requireClosed = async (id: string): Promise<WorkoutRow> => {
    const row = await rawWorkout(id);
    if (!row) throw new RepositoryError('not-found', 'workout', id);
    if (row.ended_at === null) invalid('workout', id);
    return row;
  };
  /** Séries de travail validées des séances closes antérieures à `workout`, pour ses exercices (records). */
  const historyFor = async (workout: WorkoutWithSets): Promise<WorkoutSet[]> => {
    const exercises = [...new Set(workout.sets.map((s) => s.exerciseId))];
    if (exercises.length === 0) return [];
    const before = workout.endedAt ?? workout.startedAt;
    const out: WorkoutSet[] = [];
    for (let i = 0; i < exercises.length; i += 400) {
      const part = exercises.slice(i, i + 400);
      const rows = await db.select<SetRow>(
        `SELECT s.* FROM workout_set s JOIN workout w ON w.id = s.workout_id
         WHERE w.ended_at IS NOT NULL AND w.deleted_at IS NULL AND w.id <> ? AND w.ended_at < ? AND s.deleted_at IS NULL AND s.done = 1 AND s.set_kind = 'work'
           AND s.exercise_id IN (${part.map(() => '?').join(', ')})`,
        [workout.id, before, ...part],
      );
      out.push(...rows.map(rowToSet));
    }
    return out;
  };
  /** Jour de routine d'origine (non supprimé), ou null. */
  const dayOf = async (workout: WorkoutWithSets): Promise<RoutineDay | null> => {
    if (workout.routineId === null || workout.routineDayId === null) return null;
    const tree = await createTrainingRoutineRepository(db, stamper).get(workout.routineId);
    return tree?.days.find((d) => d.id === workout.routineDayId) ?? null;
  };
  const diffFor = async (workout: WorkoutWithSets): Promise<RoutineDiff> => routineDiff(workout, await dayOf(workout));

  const mergedEntry = (row: SetRow, patch: Partial<SetEntry>): SetEntry => ({
    reps: patch.reps === undefined ? row.reps : patch.reps,
    loadKg: patch.loadKg === undefined ? row.load_kg : patch.loadKg,
    durationSec: patch.durationSec === undefined ? row.duration_sec : patch.durationSec,
    rir: patch.rir === undefined ? row.rir : patch.rir,
  });

  return {
    async start(input) {
      // Séances ouvertes abandonnées depuis plus de 30 jours : jamais publiées (aucune file, aucune trace), effacées physiquement.
      const cut = new Date(Date.parse(stamper.next().at) - ABANDONED_WORKOUT_KEEP_MS).toISOString();
      await db.execute('DELETE FROM workout_set WHERE workout_id IN (SELECT id FROM workout WHERE ended_at IS NULL AND deleted_at IS NOT NULL AND deleted_at < ?)', [cut]);
      await db.execute('DELETE FROM workout WHERE ended_at IS NULL AND deleted_at IS NOT NULL AND deleted_at < ?', [cut]);
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
      // Rejeu (I6-03) : chaque groupe de la source reçoit un identifiant neuf, la source n'est jamais modifiée ni partagée.
      const circuitIds = new Map<string, string>();
      for (const [position, set] of plan.entries()) {
        let mapped: string | undefined;
        if (set.circuitId) {
          mapped = circuitIds.get(set.circuitId) ?? ids.next();
          circuitIds.set(set.circuitId, mapped);
        }
        await insertSet(id, ids.next(), position, mapped === undefined ? set : { ...set, circuitId: mapped });
      }
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
      await dissolveBroken(workoutId);
      return loadOrThrow(workoutId);
    },

    /**
     * I6-03 : relie des exercices de la séance OUVERTE en un groupe (superset, triset, circuit). Les séries de travail de chaque exercice sont ramenées
     * à `rounds` (par défaut le plus grand nombre existant) : séries manquantes ajoutées avec les cibles de l'exercice, séries à faire en trop
     * retirées, jamais une série validée (`'invalid'`). Ordre alterné série par série ; repos entre exercices et de fin de tour écrits.
     */
    async groupExercises(workoutId, input) {
      const inTx = atomic((tx) => tx.groupExercises(workoutId, input));
      if (inTx) return inTx;
      await requireOpen(workoutId);
      const rows = await rawSets(workoutId);
      const exerciseIds = [...input.exerciseIds];
      const workOf = (e: string): SetRow[] => rows.filter((r) => r.exercise_id === e && r.set_kind !== 'warmup');
      const rounds = input.rounds ?? Math.max(1, ...exerciseIds.map((e) => workOf(e).length));
      if (validateCircuit({ exerciseIds, rounds, restBetweenSec: input.restBetweenSec, restRoundSec: input.restRoundSec }).length > 0) invalid('workout', workoutId);
      if (exerciseIds.some((e) => !rows.some((r) => r.exercise_id === e))) invalid('workout_set', workoutId);
      if (rows.some((r) => exerciseIds.includes(r.exercise_id) && r.circuit_id)) throw new RepositoryError('conflict', 'workout_set', workoutId);
      if (rounds > SETS_MAX) invalid('workout', workoutId);
      for (const e of exerciseIds) {
        const works = workOf(e);
        const base = works.at(-1) ?? rows.filter((r) => r.exercise_id === e).at(-1);
        if (!base) return invalid('workout_set', e);
        const extras = works.slice(rounds);
        if (extras.some((x) => x.done === 1)) invalid('workout_set', e);
        for (const x of extras) await markSetDeleted(x.id);
        for (let i = works.length; i < rounds; i += 1) {
          await insertSet(workoutId, ids.next(), rows.length + i, {
            exerciseId: e,
            exerciseName: base.exercise_name,
            setKind: 'work',
            targetRepsMin: base.target_reps_min,
            targetRepsMax: base.target_reps_max,
            targetLoadKg: base.target_load_kg,
            targetRestSec: base.target_rest_sec,
          });
        }
      }
      const circuitId = ids.next();
      for (const row of (await rawSets(workoutId)).filter((r) => exerciseIds.includes(r.exercise_id))) {
        const stamp = stamper.next();
        const restRound = input.restRoundSec !== null && row.set_kind !== 'warmup';
        await db.execute(
          `UPDATE workout_set SET circuit_id = ?, circuit_rest_sec = ?, target_rest_sec = ${restRound ? '?' : 'target_rest_sec'}, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?`,
          [circuitId, input.restBetweenSec, ...(restRound ? [input.restRoundSec as number] : []), stamp.at, stamp.deviceId, stamp.hlc, row.id],
        );
      }
      await applyOrder(orderWithCircuit((await rawSets(workoutId)).map(rowToSet), exerciseIds));
      return loadOrThrow(workoutId);
    },

    /** I6-03 : défait un groupe de la séance OUVERTE ; les séries faites sont gardées, les exercices redeviennent indépendants. Groupe absent : `'not-found'`. */
    async ungroupCircuit(workoutId, circuitId) {
      const inTx = atomic((tx) => tx.ungroupCircuit(workoutId, circuitId));
      if (inTx) return inTx;
      await requireOpen(workoutId);
      if (!(await rawSets(workoutId)).some((r) => r.circuit_id === circuitId)) throw new RepositoryError('not-found', 'workout_set', circuitId);
      await dissolveCircuit(workoutId, circuitId);
      return loadOrThrow(workoutId);
    },

    async setDifficulty(workoutId, exerciseId, difficulty) {
      await requireOpen(workoutId);
      if (difficulty !== null && !(DIFFICULTIES as readonly string[]).includes(difficulty)) invalid('workout_set', workoutId);
      const rows = (await rawSets(workoutId)).filter((s) => s.exercise_id === exerciseId);
      if (rows.length === 0) invalid('workout_set', exerciseId);
      for (const row of rows) {
        if ((row.difficulty ?? null) === difficulty) continue;
        const stamp = stamper.next();
        await db.execute('UPDATE workout_set SET difficulty = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [difficulty, stamp.at, stamp.deviceId, stamp.hlc, row.id]);
      }
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
        ...(last.circuit_id ? { circuitId: last.circuit_id, circuitRestSec: last.circuit_rest_sec ?? null } : {}),
      });
      await renumber(workoutId);
      if (last.circuit_id) await reorderCircuit(workoutId, last.circuit_id);
      return rowToSet((await db.select<SetRow>('SELECT * FROM workout_set WHERE id = ?', [id]))[0] as SetRow);
    },

    async addWarmupSets(workoutId, exerciseId, ramp) {
      await requireOpen(workoutId);
      for (const step of ramp) {
        const entry = { reps: step.reps, loadKg: step.loadKg, durationSec: null, rir: null };
        if (validateSetBounds(entry).length > 0) invalid('workout_set', workoutId);
      }
      const rows = await rawSets(workoutId);
      const firstIndex = rows.findIndex((s) => s.exercise_id === exerciseId);
      const first = rows[firstIndex];
      if (!first) throw new RepositoryError('not-found', 'workout_set', exerciseId);
      // Jamais en double : une série d'échauffement déjà présente (rampe insérée, séance copiée, choix d'Ali) l'emporte.
      if (ramp.length === 0 || rows.some((s) => s.exercise_id === exerciseId && s.set_kind === 'warmup')) return [];
      // Décale la première série de l'exercice et les suivantes, puis insère la rampe à leur place.
      for (const row of rows.slice(firstIndex)) {
        const stamp = stamper.next();
        await db.execute('UPDATE workout_set SET position = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [row.position + ramp.length, stamp.at, stamp.deviceId, stamp.hlc, row.id]);
      }
      const created: string[] = [];
      for (const [i, step] of ramp.entries()) {
        const id = ids.next();
        await insertSet(workoutId, id, first.position + i, {
          exerciseId,
          exerciseName: first.exercise_name,
          setKind: 'warmup',
          targetRepsMin: step.reps,
          targetRepsMax: step.reps,
          targetLoadKg: step.loadKg,
          targetRestSec: null,
          ...(first.circuit_id ? { circuitId: first.circuit_id, circuitRestSec: first.circuit_rest_sec ?? null } : {}),
        });
        created.push(id);
      }
      await renumber(workoutId);
      if (first.circuit_id) await reorderCircuit(workoutId, first.circuit_id);
      const out: WorkoutSet[] = [];
      for (const id of created) out.push(await requireSetRow(id));
      return out;
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
      // I2-01 (relecture de la #61, D-27) : les décisions de la séance abandonnée, jamais publiées (déclencheurs gardés), disparaissent.
      await db.execute('DELETE FROM recommendation_decision WHERE workout_id = ?', [id]);
      const stamp = stamper.next();
      await db.execute('UPDATE workout SET rest_timer_end_at = NULL, deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, id]);
    },

    // --- I1-03 -----------------------------------------------------------------------------------------------------------------------

    async close(workoutId) {
      const outer = atomic((r) => r.close(workoutId));
      if (outer) return outer;
      const row = await rawWorkout(workoutId);
      if (!row) throw new RepositoryError('not-found', 'workout', workoutId);
      if (row.ended_at === null) {
        const sets = await rawSets(workoutId);
        if (!sets.some((s) => s.done === 1)) invalid('workout', workoutId);
        // Un seul tampon pour tout l'agrégat (un hlc : un groupe jamais coupé, ni à l'écriture ni à la lecture).
        const stamp = stamper.next();
        // Séance encore ouverte : ces écritures ne sont pas capturées (déclencheurs gardés). Les séries retirées pendant la séance, jamais
        // publiées, disparaissent ; les autres prennent le tampon de la clôture (leurs anciens hlc peuvent être sous la tête déjà publiée).
        await db.execute('DELETE FROM workout_set WHERE workout_id = ? AND deleted_at IS NOT NULL', [workoutId]);
        await db.execute('UPDATE workout_set SET updated_at = ?, device_id = ?, hlc = ? WHERE workout_id = ?', [stamp.at, stamp.deviceId, stamp.hlc, workoutId]);
        // I2-01 : les décisions prises pendant la séance suivent l'agrégat (même tampon ; mises en file par `sync_workout_close_decisions_au`).
        await db.execute('UPDATE recommendation_decision SET updated_at = ?, device_id = ?, hlc = ? WHERE workout_id = ?', [stamp.at, stamp.deviceId, stamp.hlc, workoutId]);
        // Clôture : le déclencheur `sync_workout_au` met en file la séance et toutes ses séries (« * »), dans cette instruction.
        await db.execute('UPDATE workout SET ended_at = ?, rest_timer_end_at = NULL, updated_at = ?, device_id = ?, hlc = ? WHERE id = ? AND ended_at IS NULL', [
          stamp.at,
          stamp.at,
          stamp.deviceId,
          stamp.hlc,
          workoutId,
        ]);
      }
      const workout = await loadOrThrow(workoutId);
      return { workout, summary: summarizeWorkout(workout, await historyFor(workout)), routineDiff: await diffFor(workout), alreadyClosed: row.ended_at !== null };
    },

    getClosed: async (id) => {
      const w = await load(id);
      return w && w.endedAt !== null ? w : null;
    },

    async summary(workoutId) {
      const workout = await loadOrThrow(workoutId);
      return summarizeWorkout(workout, await historyFor(workout));
    },

    async correctSet(setId, patch) {
      const row = (await db.select<SetRow>('SELECT * FROM workout_set WHERE id = ? AND deleted_at IS NULL', [setId]))[0];
      if (!row) throw new RepositoryError('not-found', 'workout_set', setId);
      await requireClosed(row.workout_id);
      const kind = patch.setKind ?? (row.set_kind as SetKind);
      if (!(SET_KINDS as readonly string[]).includes(kind)) invalid('workout_set', setId);
      const entry = mergedEntry(row, patch);
      if ((row.done === 1 ? validateSetEntry(entry, kind) : validateSetBounds(entry)).length > 0) invalid('workout_set', setId);
      const difficulty = patch.difficulty === undefined ? (row.difficulty ?? null) : patch.difficulty;
      if (difficulty !== null && !(DIFFICULTIES as readonly string[]).includes(difficulty)) invalid('workout_set', setId);
      const unchanged =
        kind === row.set_kind && entry.reps === row.reps && entry.loadKg === row.load_kg && entry.durationSec === row.duration_sec && entry.rir === row.rir && difficulty === (row.difficulty ?? null);
      if (unchanged) return rowToSet(row);
      const stamp = stamper.next();
      await db.execute('UPDATE workout_set SET set_kind = ?, reps = ?, load_kg = ?, duration_sec = ?, rir = ?, difficulty = ?, corrected_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [
        kind,
        entry.reps,
        entry.loadKg,
        entry.durationSec,
        entry.rir,
        difficulty,
        stamp.at,
        stamp.at,
        stamp.deviceId,
        stamp.hlc,
        setId,
      ]);
      return requireSetRow(setId);
    },

    async deleteClosed(id) {
      const outer = atomic((r) => r.deleteClosed(id));
      if (outer) return outer;
      await requireClosed(id);
      const stamp = stamper.next();
      await db.execute('UPDATE workout_set SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE workout_id = ? AND deleted_at IS NULL', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, id]);
      // I2-01 : décisions de la séance supprimées avec elle (enfants publiés, comme les séries).
      await db.execute('UPDATE recommendation_decision SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE workout_id = ? AND deleted_at IS NULL', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, id]);
      await db.execute('UPDATE workout SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, id]);
    },

    async routineChanges(workoutId) {
      return diffFor(await loadOrThrow(workoutId));
    },

    async applyRoutineUpdate(workoutId) {
      const outer = atomic((r) => r.applyRoutineUpdate(workoutId));
      if (outer) return outer;
      await requireClosed(workoutId);
      const workout = await loadOrThrow(workoutId);
      const day = await dayOf(workout);
      const diff = routineDiff(workout, day);
      if (!day || !diff.hasChanges) return diff;
      const routines = createTrainingRoutineRepository(db, stamper);
      for (const line of diff.removed) await routines.removeExercise(line.lineId);
      for (const change of diff.setsChanged) await routines.updateExercise(change.lineId, { sets: Math.min(change.to, SETS_MAX) });
      let position = Math.max(-1, ...day.exercises.map((l) => l.position));
      for (const added of diff.added) {
        position += 1;
        const repMin = added.repMin ?? DEFAULT_REP_MIN;
        await routines.addExercise(day.id, {
          id: ids.next(),
          exerciseId: added.exerciseId,
          exerciseName: added.exerciseName,
          sets: Math.min(added.sets, SETS_MAX),
          repMin,
          repMax: Math.max(repMin, added.repMax ?? DEFAULT_REP_MAX),
          rir: null,
          restSec: added.restSec ?? DEFAULT_REST_SEC,
          position,
        });
      }
      return diff;
    },
  };
}

/** Cibles d'une ligne ajoutée à la routine quand la séance n'en avait pas (fourchette et repos usuels de la bibliothèque). */
const DEFAULT_REP_MIN = 8;
const DEFAULT_REP_MAX = 12;
const DEFAULT_REST_SEC = 120;
