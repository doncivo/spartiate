import { uuidGenerator, type IdGenerator } from '../../../domain/id';
import type { WriteStamper } from '../../../domain/hlc';
import { HISTORY_SESSIONS_LOADED } from '../../../domain/training/config';
import type { SetKind } from '../../../domain/training/session';
import { progressionId } from '../../../domain/sync/naturalIds';
import { DIFFICULTIES, type Difficulty, type ExerciseSession, type HistorySet, type Prescription } from '../../../domain/training/types';
import { isIsoDateTime, type IsoDateTime } from '../../../domain/types';
import type { SqlExecutor, SqlRow } from '../../driver';
import { RepositoryError } from '../common';
import type { ProgressionProfileInput, ProgressionProfileRecord, ProgressionRepository, RecommendationDecisionRecord, RecordDecisionInput } from '../progressionRepository';
import { readSyncMeta, type SyncRow } from './sqlHelpers';

/** Implémentation SQL de `ProgressionRepository` (I2-01, migrations 0005 et 0006 : tables publiées, captures par déclencheurs). */

interface HistoryRow extends SqlRow {
  readonly workout_id: string;
  readonly ended_at: string;
  readonly position: number;
  readonly set_kind: string;
  readonly done: number;
  readonly reps: number | null;
  readonly load_kg: number | null;
  readonly rir: number | null;
  readonly difficulty: string | null;
}
interface ProfileRow extends SqlRow, SyncRow {
  readonly exercise_id: string;
  readonly estimated_1rm_kg: number | null;
  readonly confidence: number | null;
  readonly last_easy_recalibration_at: string | null;
  readonly engine_version: number;
}
interface DecisionRow extends SqlRow, SyncRow {
  readonly exercise_id: string;
  readonly workout_id: string | null;
  readonly workout_set_id: string | null;
  readonly engine_version: number;
  readonly prescription: string;
  readonly accepted: number;
  readonly chosen_load_kg: number | null;
  readonly chosen_reps: string;
  readonly decided_at: string;
}

const EXERCISE_ID_MAX = 128;
/** Identifiant naturel du profil d'un exercice (une ligne par exercice, quel que soit l'appareil). */
export const progressionProfileId = progressionId;
const isDifficulty = (v: string | null): v is Difficulty => v !== null && (DIFFICULTIES as readonly string[]).includes(v);

const rowToProfile = (row: ProfileRow): ProgressionProfileRecord => ({
  id: row.id,
  exerciseId: row.exercise_id,
  estimated1rmKg: row.estimated_1rm_kg,
  confidence: row.confidence,
  lastEasyRecalibrationAt: row.last_easy_recalibration_at as IsoDateTime | null,
  engineVersion: row.engine_version,
  ...readSyncMeta(row),
});
const rowToDecision = (row: DecisionRow): RecommendationDecisionRecord => ({
  id: row.id,
  exerciseId: row.exercise_id,
  workoutId: row.workout_id,
  workoutSetId: row.workout_set_id,
  engineVersion: row.engine_version,
  prescription: JSON.parse(row.prescription) as Prescription,
  accepted: row.accepted === 1,
  loadKg: row.chosen_load_kg,
  reps: JSON.parse(row.chosen_reps) as number[],
  decidedAt: row.decided_at as IsoDateTime,
  ...readSyncMeta(row),
});

const validExerciseId = (id: string): boolean => id.length >= 1 && id.length <= EXERCISE_ID_MAX;
const finiteOrNull = (n: number | null, ok: (x: number) => boolean): boolean => n === null || (Number.isFinite(n) && ok(n));

export function createProgressionRepository(db: SqlExecutor, stamper: WriteStamper, ids: IdGenerator = uuidGenerator): ProgressionRepository {
  const invalid = (entity: string, id: string): never => {
    throw new RepositoryError('invalid', entity, id);
  };
  const selectProfile = async (exerciseId: string): Promise<ProfileRow | undefined> =>
    (await db.select<ProfileRow>('SELECT * FROM progression_profile WHERE id = ?', [progressionProfileId(exerciseId)]))[0];

  return {
    async history(exerciseId, limit = HISTORY_SESSIONS_LOADED) {
      const rows = await db.select<HistoryRow>(
        `WITH recent AS (
           SELECT w.id, w.ended_at FROM workout w
           WHERE w.ended_at IS NOT NULL AND w.deleted_at IS NULL
             AND EXISTS (SELECT 1 FROM workout_set s WHERE s.workout_id = w.id AND s.exercise_id = ? AND s.deleted_at IS NULL)
           ORDER BY w.ended_at DESC, w.id DESC LIMIT ?)
         SELECT r.id AS workout_id, r.ended_at, s.position, s.set_kind, s.done, s.reps, s.load_kg, s.rir, s.difficulty
         FROM recent r JOIN workout_set s ON s.workout_id = r.id AND s.exercise_id = ? AND s.deleted_at IS NULL
         ORDER BY r.ended_at DESC, r.id DESC, s.position, s.id`,
        [exerciseId, Math.max(0, Math.floor(limit)), exerciseId],
      );
      const sessions: { workoutId: string; endedAt: IsoDateTime; difficulty: Difficulty | null; sets: HistorySet[] }[] = [];
      for (const row of rows) {
        let current = sessions[sessions.length - 1];
        if (current?.workoutId !== row.workout_id) {
          current = { workoutId: row.workout_id, endedAt: row.ended_at as IsoDateTime, difficulty: null, sets: [] };
          sessions.push(current);
        }
        current.sets.push({ position: row.position, setKind: row.set_kind as SetKind, done: row.done === 1, reps: row.reps, loadKg: row.load_kg, rir: row.rir });
        // Difficulté de l'exercice dans la séance (0006) : portée par ses séries ; la série renseignée de plus haute position l'emporte.
        if (isDifficulty(row.difficulty)) current.difficulty = row.difficulty;
      }
      return sessions.map((s): ExerciseSession => ({ workoutId: s.workoutId, endedAt: s.endedAt, difficulty: s.difficulty, sets: s.sets }));
    },

    async getProfile(exerciseId) {
      const row = await selectProfile(exerciseId);
      return row ? rowToProfile(row) : null;
    },

    async saveProfile(input: ProgressionProfileInput) {
      const id = progressionProfileId(input.exerciseId);
      const ok =
        validExerciseId(input.exerciseId) &&
        finiteOrNull(input.estimated1rmKg, (x) => x > 0) &&
        finiteOrNull(input.confidence, (x) => x >= 0 && x <= 1) &&
        (input.lastEasyRecalibrationAt === null || isIsoDateTime(input.lastEasyRecalibrationAt)) &&
        Number.isInteger(input.engineVersion) &&
        input.engineVersion >= 1;
      if (!ok) invalid('progression_profile', id);
      const stamp = stamper.next();
      await db.execute(
        `INSERT INTO progression_profile (id, exercise_id, estimated_1rm_kg, confidence, last_easy_recalibration_at, engine_version, created_at, updated_at, deleted_at, device_id, hlc)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
         ON CONFLICT (id) DO UPDATE SET estimated_1rm_kg = excluded.estimated_1rm_kg, confidence = excluded.confidence,
           last_easy_recalibration_at = excluded.last_easy_recalibration_at, engine_version = excluded.engine_version,
           updated_at = excluded.updated_at, deleted_at = NULL, device_id = excluded.device_id, hlc = excluded.hlc`,
        [id, input.exerciseId, input.estimated1rmKg, input.confidence, input.lastEasyRecalibrationAt, input.engineVersion, stamp.at, stamp.at, stamp.deviceId, stamp.hlc],
      );
      const row = await selectProfile(input.exerciseId);
      if (!row) throw new RepositoryError('not-found', 'progression_profile', id);
      return rowToProfile(row);
    },

    async recordDecision(input: RecordDecisionInput) {
      const id = input.id ?? ids.next();
      const ok =
        validExerciseId(input.exerciseId) &&
        finiteOrNull(input.chosenLoadKg, (x) => x >= 0) &&
        // Refus (PR 2/2) : rien retenu, ni charge ni répétitions ; sinon au moins une série.
        (input.chosenReps.length > 0 || (!input.accepted && input.chosenLoadKg === null)) &&
        input.chosenReps.every((r) => Number.isInteger(r) && r >= 1) &&
        Number.isInteger(input.prescription.engineVersion) &&
        input.prescription.engineVersion >= 1;
      if (!ok) invalid('recommendation_decision', id);
      const stamp = stamper.next();
      await db.execute(
        `INSERT INTO recommendation_decision (id, exercise_id, workout_id, workout_set_id, engine_version, prescription, reasons, accepted, chosen_load_kg, chosen_reps,
           decided_at, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.exerciseId,
          input.workoutId,
          input.workoutSetId ?? null,
          input.prescription.engineVersion,
          JSON.stringify(input.prescription),
          JSON.stringify(input.prescription.reasons),
          input.accepted ? 1 : 0,
          input.chosenLoadKg,
          JSON.stringify(input.chosenReps),
          stamp.at,
          stamp.at,
          stamp.at,
          stamp.deviceId,
          stamp.hlc,
        ],
      );
      const row = (await db.select<DecisionRow>('SELECT * FROM recommendation_decision WHERE id = ?', [id]))[0];
      if (!row) throw new RepositoryError('not-found', 'recommendation_decision', id);
      return rowToDecision(row);
    },

    async lastDecision(exerciseId) {
      const row = (await db.select<DecisionRow>('SELECT * FROM recommendation_decision WHERE exercise_id = ? AND deleted_at IS NULL ORDER BY decided_at DESC, id DESC LIMIT 1', [exerciseId]))[0];
      return row ? rowToDecision(row) : null;
    },
  };
}
