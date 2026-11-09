import { uuidGenerator, type IdGenerator } from '../../../domain/id';
import type { WriteStamper } from '../../../domain/hlc';
import { HISTORY_SESSIONS_LOADED } from '../../../domain/training/config';
import type { SetKind } from '../../../domain/training/session';
import { isProgressionExerciseId, progressionId } from '../../../domain/sync/naturalIds';
import { recalibrationKept } from '../../../domain/training/decision';
import { DIFFICULTIES, type Difficulty, type ExerciseSession, type HistorySet, type Prescription } from '../../../domain/training/types';
import { isIsoDateTime, type IsoDateTime } from '../../../domain/types';
import type { SqlExecutor, SqlRow } from '../../driver';
import { RepositoryError } from '../common';
import {
  DECISION_UNREADABLE,
  type DecisionReadReporter,
  type ProgressionProfileInput,
  type ProgressionProfileRecord,
  type ProgressionRepository,
  type RecommendationDecisionRecord,
  type RecordDecisionInput,
} from '../progressionRepository';
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
/** I4-08 : décisions lues au plus pour trouver la plus récente lisible (borne de la lecture ; au-delà, aucune référence). */
const DECISIONS_SCANNED = 20;
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
const parseOrNull = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};
/** Forme minimale d'une prescription tracée relue par l'app (moteur 1 et suivants). */
const isPrescriptionShape = (v: unknown): v is Prescription => {
  const p = v as Partial<Record<keyof Prescription, unknown>> | null;
  return typeof v === 'object' && p !== null && !Array.isArray(v) && typeof p.engineVersion === 'number' && typeof p.status === 'string' && Array.isArray(p.sets) && Array.isArray(p.reasons);
};

/**
 * I4-08 : décision lue, ou null si son JSON est illisible (prescription ou répétitions retenues altérées, autre version) : la ligne est
 * ignorée, jamais une exception (l'écran de séance ne tombe pas). Le rapporteur reçoit un nom d'événement fixe, jamais le contenu.
 */
function rowToDecision(row: DecisionRow, report?: DecisionReadReporter): RecommendationDecisionRecord | null {
  const prescription = parseOrNull(row.prescription);
  const reps = parseOrNull(row.chosen_reps);
  if (!isPrescriptionShape(prescription) || !Array.isArray(reps) || !reps.every((r) => typeof r === 'number' && Number.isFinite(r))) {
    report?.(DECISION_UNREADABLE);
    return null;
  }
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    workoutId: row.workout_id,
    workoutSetId: row.workout_set_id,
    engineVersion: row.engine_version,
    prescription,
    accepted: row.accepted === 1,
    loadKg: row.chosen_load_kg,
    reps: reps as number[],
    decidedAt: row.decided_at as IsoDateTime,
    ...readSyncMeta(row),
  };
}
/** Première décision lisible des lignes (déjà ordonnées), ou null. */
const firstReadable = (rows: readonly DecisionRow[], report?: DecisionReadReporter): RecommendationDecisionRecord | null => {
  for (const row of rows) {
    const decision = rowToDecision(row, report);
    if (decision !== null) return decision;
  }
  return null;
};

/**
 * Décision retenue sur une proposition de deload (I2-02) : acceptée telle quelle, ou valeur retenue au plus à la charge du deload (un
 * « Modifier » à une charge plus haute n'est pas un deload : la séance reste dans les statistiques). Refus, JSON illisible ou prescription
 * 0.3.1 (sans champ `deload`) : pas un deload, jamais d'échec.
 */
function isRetainedDeload(row: { readonly prescription: string; readonly accepted: number; readonly chosen_load_kg: number | null }): boolean {
  if (row.chosen_load_kg === null) return false;
  try {
    const p = JSON.parse(row.prescription) as { deload?: unknown; loadKg?: unknown } | null;
    if (p?.deload !== true) return false;
    return row.accepted === 1 || (typeof p.loadKg === 'number' && row.chosen_load_kg <= p.loadKg + 1e-9);
  } catch {
    return false;
  }
}

/**
 * I4-08 : décision qui a retenu un choix de fatigue (« −5 % » ou « −2 reps ») : modification dont la charge et les répétitions sont exactement
 * celles d'un choix `fatigue-load` ou `fatigue-reps` de la prescription tracée. Acceptation, refus, autre valeur ou JSON illisible : non.
 */
function isRetainedFatigueChoice(row: { readonly prescription: string; readonly accepted: number; readonly chosen_load_kg: number | null; readonly chosen_reps: string }): boolean {
  if (row.accepted === 1 || row.chosen_load_kg === null) return false;
  try {
    const p = JSON.parse(row.prescription) as { options?: unknown } | null;
    const reps = JSON.parse(row.chosen_reps) as unknown;
    if (!Array.isArray(p?.options) || !Array.isArray(reps)) return false;
    return p.options.some((o: unknown) => {
      const option = o as { kind?: unknown; loadKg?: unknown; reps?: unknown } | null;
      return (
        (option?.kind === 'fatigue-load' || option?.kind === 'fatigue-reps') &&
        typeof option.loadKg === 'number' &&
        Math.abs(option.loadKg - (row.chosen_load_kg ?? NaN)) <= 1e-9 &&
        Array.isArray(option.reps) &&
        option.reps.length === reps.length &&
        option.reps.every((r, i) => r === reps[i])
      );
    });
  } catch {
    return false;
  }
}

/** I4-08 : RIR cible de la prescription tracée (`rirTarget`, entier 0 à 10), ou null (absent, illisible, prescription 0.3.1). */
function targetRirOf(prescription: string): number | null {
  const p = parseOrNull(prescription) as { rirTarget?: unknown } | null | undefined;
  const rir = typeof p === 'object' && p !== null ? p.rirTarget : null;
  return typeof rir === 'number' && Number.isInteger(rir) && rir >= 0 && rir <= 10 ? rir : null;
}

const validExerciseId = (id: string): boolean => id.length >= 1 && id.length <= EXERCISE_ID_MAX;
const finiteOrNull = (n: number | null, ok: (x: number) => boolean): boolean => n === null || (Number.isFinite(n) && ok(n));

export function createProgressionRepository(db: SqlExecutor, stamper: WriteStamper, ids: IdGenerator = uuidGenerator): ProgressionRepository {
  const invalid = (entity: string, id: string): never => {
    throw new RepositoryError('invalid', entity, id);
  };
  const selectProfile = async (exerciseId: string): Promise<ProfileRow | undefined> =>
    (await db.select<ProfileRow>('SELECT * FROM progression_profile WHERE id = ?', [progressionProfileId(exerciseId)]))[0];

  const repository: ProgressionRepository = {
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
      // Deload (I2-02) : la dernière décision de l'exercice dans la séance a retenu une proposition de deload (acceptée, ou valeur retenue au
      // plus à sa charge). Aucune colonne nouvelle : le marqueur est lu dans la prescription tracée (publiée avec la séance, D-27).
      // I4-08 : même lecture pour le choix de fatigue retenu (`fatigueChoice`), aucune colonne nouvelle.
      const deloads = new Set<string>();
      const fatigueChoices = new Set<string>();
      const targetRirs = new Map<string, number>();
      if (sessions.length > 0) {
        type Decided = { prescription: string; accepted: number; chosen_load_kg: number | null; chosen_reps: string };
        const decided = await db.select<{ workout_id: string } & Decided & SqlRow>(
          `SELECT workout_id, prescription, accepted, chosen_load_kg, chosen_reps FROM recommendation_decision
           WHERE exercise_id = ? AND deleted_at IS NULL AND workout_id IN (${sessions.map(() => '?').join(', ')})
           ORDER BY workout_id, decided_at, id`,
          [exerciseId, ...sessions.map((s) => s.workoutId)],
        );
        const latest = new Map<string, Decided>();
        for (const row of decided) latest.set(row.workout_id, row);
        for (const [workoutId, row] of latest) {
          if (isRetainedDeload(row)) deloads.add(workoutId);
          else if (isRetainedFatigueChoice(row)) fatigueChoices.add(workoutId);
          const rir = targetRirOf(row.prescription);
          if (rir !== null) targetRirs.set(workoutId, rir);
        }
      }
      return sessions.map(
        (s): ExerciseSession => ({
          workoutId: s.workoutId,
          endedAt: s.endedAt,
          difficulty: s.difficulty,
          sets: s.sets,
          ...(deloads.has(s.workoutId) ? { deload: true } : {}),
          ...(fatigueChoices.has(s.workoutId) ? { fatigueChoice: true } : {}),
          ...((rir) => (rir === undefined ? {} : { targetRir: rir }))(targetRirs.get(s.workoutId)),
        }),
      );
    },

    async getProfile(exerciseId) {
      const row = await selectProfile(exerciseId);
      return row ? rowToProfile(row) : null;
    },

    async saveProfile(input: ProgressionProfileInput) {
      const id = progressionProfileId(input.exerciseId);
      const ok =
        isProgressionExerciseId(input.exerciseId) &&
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
      const written = row ? rowToDecision(row) : null;
      if (!written) throw new RepositoryError('not-found', 'recommendation_decision', id);
      return written;
    },

    async lastDecision(exerciseId, report) {
      // Revue de la #61 (D-27) : seulement une décision d'une séance CLOSE et non supprimée ; jamais d'une séance ouverte ou abandonnée.
      // I4-08 : une décision illisible est sautée (la plus récente lisible sert), jamais une exception.
      const rows = await db.select<DecisionRow>(
        `SELECT d.* FROM recommendation_decision d JOIN workout w ON w.id = d.workout_id
         WHERE d.exercise_id = ? AND d.deleted_at IS NULL AND w.ended_at IS NOT NULL AND w.deleted_at IS NULL
         ORDER BY d.decided_at DESC, d.id DESC LIMIT ?`,
        [exerciseId, DECISIONS_SCANNED],
      );
      return firstReadable(rows, report);
    },

    async decisionFor(workoutId, exerciseId, report) {
      const rows = await db.select<DecisionRow>('SELECT * FROM recommendation_decision WHERE workout_id = ? AND exercise_id = ? AND deleted_at IS NULL ORDER BY decided_at DESC, id DESC LIMIT ?', [
        workoutId,
        exerciseId,
        DECISIONS_SCANNED,
      ]);
      return firstReadable(rows, report);
    },

    async applyClosedWorkout(workoutId, report) {
      const workout = (await db.select<{ ended_at: string | null; deleted_at: string | null } & SqlRow>('SELECT ended_at, deleted_at FROM workout WHERE id = ?', [workoutId]))[0];
      if (!workout || workout.deleted_at !== null) throw new RepositoryError('not-found', 'workout', workoutId);
      if (workout.ended_at === null) invalid('workout', workoutId);
      const rows = await db.select<DecisionRow>('SELECT * FROM recommendation_decision WHERE workout_id = ? AND deleted_at IS NULL ORDER BY exercise_id, decided_at DESC, id DESC', [workoutId]);
      // I4-08 : dernière décision illisible : exercice sauté (jamais une décision plus ancienne, qu'Ali a pu remplacer).
      const latest = new Map<string, RecommendationDecisionRecord | null>();
      for (const row of rows) if (!latest.has(row.exercise_id)) latest.set(row.exercise_id, rowToDecision(row, report));
      for (const decision of latest.values()) {
        if (decision === null) continue;
        const kept = recalibrationKept(decision.prescription, decision.loadKg);
        if (kept === null || !isProgressionExerciseId(decision.exerciseId)) continue;
        // Une séance se clôture toujours (re-relecture sync-icloud) : une prescription stockée invalide (valeur hors bornes) saute cet
        // exercice, profil non écrit, sans rien lever ; aucun journal dans cette couche (aucune donnée corporelle ne doit y partir).
        try {
          await repository.saveProfile({
            exerciseId: decision.exerciseId,
            estimated1rmKg: kept.estimated1rmKg,
            confidence: decision.prescription.confidence,
            lastEasyRecalibrationAt: kept.at,
            engineVersion: decision.prescription.engineVersion,
          });
        } catch (e) {
          if (!(e instanceof RepositoryError && e.code === 'invalid')) throw e;
        }
      }
    },
  };
  return repository;
}
