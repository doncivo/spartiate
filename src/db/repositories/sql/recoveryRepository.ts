import type { WriteStamper } from '../../../domain/hlc';
import type { Contributor, MuscleRecoveryRow, RecoveryDayOutput, RecoveryDaySummary, RecoveryExplanationKey } from '../../../domain/recovery';
import { muscleRecoveryId, recoveryDayId } from '../../../domain/sync/naturalIds';
import { isIsoDateTime, isLocalDate, type LocalDate } from '../../../domain/types';
import { encodeContributors, encodeExplanationKeys, parseContributors, parseExplanationKeys } from '../../parse/recoveryJson';
import type { SqlDriver, SqlExecutor, SqlRow } from '../../driver';
import { RepositoryError } from '../common';
import type { RepositoryOptions } from '../dataAccess';
import { RECOVERY_ENGINE_VERSION, type MuscleRecoveryRecord, type RecoveryDayRecord, type RecoveryRepository, type SavedRecoveryDay } from '../recoveryRepository';
import { readSyncMeta, type SyncRow } from './sqlHelpers';

interface DayRow extends SqlRow, SyncRow {
  readonly date: string;
  readonly level: string;
  readonly recovery: number | null;
  readonly abstain_reason: string | null;
  readonly quality: string;
  readonly exertion: number;
  readonly exertion_prev_day: number;
  readonly sleep_minutes: number | null;
  readonly sleep_need_minutes: number;
  readonly sleep_score: number | null;
  readonly bedtime_sigma_minutes: number | null;
  readonly target_zone_from: number | null;
  readonly target_zone_to: number | null;
  readonly hrv_ms: number | null;
  readonly resting_hr: number | null;
  readonly learning_nights: number;
  readonly contributors: string;
  readonly explanation_keys: string;
  readonly computed_at: string;
  readonly engine_version: number;
}

interface MuscleRow extends SqlRow, SyncRow {
  readonly date: string;
  readonly muscle_id: string;
  readonly muscle_group: string;
  readonly percent: number;
  readonly hours: number;
  readonly last_worked_at: string;
  readonly ready_at: string;
}

// Identifiants naturels : `src/domain/sync/naturalIds.ts` (propriété sync-icloud, mêmes formes que les CHECK de la 0010).
const dayId = (date: string): string => recoveryDayId(date as LocalDate);
const muscleId = (date: string, muscle: string): string => muscleRecoveryId(date as LocalDate, muscle);

const toDay = (row: DayRow): RecoveryDayRecord => {
  const contributors = parseContributors(row.contributors);
  const keys = parseExplanationKeys(row.explanation_keys);
  if (contributors === null || keys === null) throw new RepositoryError('invalid', 'recovery_day', row.id);
  const summary: RecoveryDaySummary = {
    day: row.date,
    level: row.level as RecoveryDaySummary['level'],
    recovery: row.recovery,
    abstainReason: row.abstain_reason as RecoveryDaySummary['abstainReason'],
    quality: row.quality as RecoveryDaySummary['quality'],
    exertion: row.exertion,
    exertionPrevDay: row.exertion_prev_day,
    sleepMinutes: row.sleep_minutes,
    sleepNeedMinutes: row.sleep_need_minutes,
    sleepScore: row.sleep_score,
    bedtimeSigmaMinutes: row.bedtime_sigma_minutes,
    targetZone: row.target_zone_from === null || row.target_zone_to === null ? null : { from: row.target_zone_from, to: row.target_zone_to },
    hrvMs: row.hrv_ms,
    restingHr: row.resting_hr,
    learningNights: row.learning_nights,
    contributors,
    explanationKeys: keys,
    computedAt: row.computed_at,
  };
  return { id: row.id, summary, engineVersion: row.engine_version, ...readSyncMeta(row) };
};

const toMuscle = (row: MuscleRow): MuscleRecoveryRecord => ({
  id: row.id,
  day: row.date as LocalDate,
  muscleId: row.muscle_id,
  group: row.muscle_group,
  percent: row.percent,
  hours: row.hours,
  lastWorkedAt: row.last_worked_at,
  readyAt: row.ready_at,
  ...readSyncMeta(row),
});

const LEVELS: readonly string[] = ['A', 'B', 'C'];
const QUALITIES: readonly string[] = ['good', 'partial', 'insufficient'];
const REASONS: readonly string[] = ['measure_missing_hrv', 'measure_missing_rhr', 'baseline_incomplete', 'zero_variance'];

const finite = (v: number | null): boolean => v === null || Number.isFinite(v);
const isInt = (v: number | null, min: number, max: number): boolean => v === null || (Number.isInteger(v) && v >= min && v <= max);

/** Contrôles du dépôt (les CHECK de la base restent le dernier recours) : rien n'est écrit si l'entrée est refusée. */
function validate(output: RecoveryDayOutput): void {
  const s = output.summary;
  const fail = (): never => {
    throw new RepositoryError('invalid', 'recovery_day', String(s.day));
  };
  if (!isLocalDate(s.day) || !LEVELS.includes(s.level) || !QUALITIES.includes(s.quality)) fail();
  if ((s.recovery === null) !== (s.abstainReason !== null)) fail();
  if (s.abstainReason !== null && !REASONS.includes(s.abstainReason)) fail();
  if (!isInt(s.recovery, 0, 100) || !isInt(s.sleepScore, 0, 100) || !isInt(s.learningNights, 0, 365)) fail();
  if (![s.exertion, s.exertionPrevDay, s.sleepMinutes, s.sleepNeedMinutes, s.bedtimeSigmaMinutes, s.hrvMs, s.restingHr].every(finite)) fail();
  if (s.targetZone !== null && !(Number.isFinite(s.targetZone.from) && Number.isFinite(s.targetZone.to) && s.targetZone.from <= s.targetZone.to)) fail();
  // Instants publiés en `datetime` (catalogue de synchro) : une valeur que le PC refuserait n'est jamais écrite ici.
  if (typeof s.computedAt !== 'string' || !isIsoDateTime(s.computedAt)) fail();
  const seen = new Set<string>();
  for (const m of output.muscles) {
    if (m.day !== s.day || m.muscleId.length === 0 || m.muscleId.includes('|') || seen.has(m.muscleId)) fail();
    if (m.muscleId.length > 64 || m.group.length === 0 || m.group.length > 64 || !isInt(m.percent, 0, 100) || !Number.isFinite(m.hours) || m.hours <= 0) fail();
    if (!isIsoDateTime(m.lastWorkedAt) || !isIsoDateTime(m.readyAt)) fail();
    seen.add(m.muscleId);
  }
}

const sameContributors = (a: readonly Contributor[], b: readonly Contributor[]): boolean => encodeContributors(a) === encodeContributors(b);
const sameKeys = (a: readonly RecoveryExplanationKey[], b: readonly RecoveryExplanationKey[]): boolean => encodeExplanationKeys(a) === encodeExplanationKeys(b);

/** Ligne vivante identique au résumé voulu ? `computedAt` est exclu : un recalcul identique ne republie rien. */
function sameDay(row: DayRow, s: RecoveryDaySummary): boolean {
  const current = toDay(row);
  const c = current.summary;
  return (
    row.deleted_at === null &&
    current.engineVersion === RECOVERY_ENGINE_VERSION &&
    c.level === s.level &&
    c.recovery === s.recovery &&
    c.abstainReason === s.abstainReason &&
    c.quality === s.quality &&
    c.exertion === s.exertion &&
    c.exertionPrevDay === s.exertionPrevDay &&
    c.sleepMinutes === s.sleepMinutes &&
    c.sleepNeedMinutes === s.sleepNeedMinutes &&
    c.sleepScore === s.sleepScore &&
    c.bedtimeSigmaMinutes === s.bedtimeSigmaMinutes &&
    c.targetZone?.from === s.targetZone?.from &&
    c.targetZone?.to === s.targetZone?.to &&
    c.hrvMs === s.hrvMs &&
    c.restingHr === s.restingHr &&
    c.learningNights === s.learningNights &&
    sameContributors(c.contributors, s.contributors) &&
    sameKeys(c.explanationKeys, s.explanationKeys)
  );
}

const sameMuscle = (row: MuscleRow, m: MuscleRecoveryRow): boolean =>
  row.deleted_at === null && row.muscle_group === m.group && row.percent === m.percent && row.hours === m.hours && row.last_worked_at === m.lastWorkedAt && row.ready_at === m.readyAt;

export function createRecoveryRepository(db: SqlExecutor, stamper: WriteStamper, options: RepositoryOptions = {}): RecoveryRepository {
  const writer = options.recoveryWriter === true;
  /** Lecteur (PC) : écriture locale écartée, événement fixe sans valeur (jamais une date, un identifiant ni une mesure). */
  const ignore = (): void => {
    try {
      options.onIgnoredWrite?.('recovery-write-ignored');
    } catch {
      // Un journal défaillant ne change jamais l'issue : rien n'est écrit.
    }
  };
  const atomic = <T>(work: (inTx: RecoveryRepository) => Promise<T>): Promise<T> | null =>
    typeof (db as Partial<SqlDriver>).transaction === 'function' ? (db as SqlDriver).transaction((tx) => work(createRecoveryRepository(tx, stamper, options))) : null;
  const readDay = async (id: string): Promise<DayRow | undefined> => (await db.select<DayRow>('SELECT * FROM recovery_day WHERE id = ?', [id]))[0];
  const liveMuscles = (date: string): Promise<MuscleRow[]> => db.select<MuscleRow>('SELECT * FROM muscle_recovery WHERE date = ? AND deleted_at IS NULL ORDER BY muscle_id', [date]);

  const saveInTx = async (output: RecoveryDayOutput): Promise<SavedRecoveryDay> => {
    const s = output.summary;
    const id = dayId(s.day);
    const existing = await readDay(id);
    if (!existing || !sameDay(existing, s)) {
      const stamp = stamper.next();
      const values = [
        s.level, s.recovery, s.abstainReason, s.quality, s.exertion, s.exertionPrevDay, s.sleepMinutes, s.sleepNeedMinutes, s.sleepScore, s.bedtimeSigmaMinutes,
        s.targetZone?.from ?? null, s.targetZone?.to ?? null, s.hrvMs, s.restingHr, s.learningNights, encodeContributors(s.contributors), encodeExplanationKeys(s.explanationKeys),
        s.computedAt, RECOVERY_ENGINE_VERSION,
      ];
      if (existing) {
        await db.execute(
          `UPDATE recovery_day SET level = ?, recovery = ?, abstain_reason = ?, quality = ?, exertion = ?, exertion_prev_day = ?, sleep_minutes = ?, sleep_need_minutes = ?,
             sleep_score = ?, bedtime_sigma_minutes = ?, target_zone_from = ?, target_zone_to = ?, hrv_ms = ?, resting_hr = ?, learning_nights = ?, contributors = ?,
             explanation_keys = ?, computed_at = ?, engine_version = ?, deleted_at = NULL, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?`,
          [...values, stamp.at, stamp.deviceId, stamp.hlc, id],
        );
      } else {
        await db.execute(
          `INSERT INTO recovery_day (id, date, level, recovery, abstain_reason, quality, exertion, exertion_prev_day, sleep_minutes, sleep_need_minutes, sleep_score,
             bedtime_sigma_minutes, target_zone_from, target_zone_to, hrv_ms, resting_hr, learning_nights, contributors, explanation_keys, computed_at, engine_version,
             created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, s.day, ...values, stamp.at, stamp.at, stamp.deviceId, stamp.hlc],
        );
      }
    }
    // Muscles : remplacement du jour (identifiant naturel, champs modifiés seulement, absents supprimés, revenus restaurés).
    const rows = await db.select<MuscleRow>('SELECT * FROM muscle_recovery WHERE date = ?', [s.day]);
    const byId = new Map(rows.map((r) => [r.muscle_id, r] as const));
    const wanted = new Set(output.muscles.map((m) => m.muscleId));
    for (const m of output.muscles) {
      const row = byId.get(m.muscleId);
      if (row && sameMuscle(row, m)) continue;
      const stamp = stamper.next();
      if (row) {
        await db.execute(
          'UPDATE muscle_recovery SET muscle_group = ?, percent = ?, hours = ?, last_worked_at = ?, ready_at = ?, deleted_at = NULL, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?',
          [m.group, m.percent, m.hours, m.lastWorkedAt, m.readyAt, stamp.at, stamp.deviceId, stamp.hlc, row.id],
        );
      } else {
        await db.execute(
          `INSERT INTO muscle_recovery (id, date, muscle_id, muscle_group, percent, hours, last_worked_at, ready_at, created_at, updated_at, device_id, hlc)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [muscleId(s.day, m.muscleId), s.day, m.muscleId, m.group, m.percent, m.hours, m.lastWorkedAt, m.readyAt, stamp.at, stamp.at, stamp.deviceId, stamp.hlc],
        );
      }
    }
    for (const row of rows) {
      if (wanted.has(row.muscle_id) || row.deleted_at !== null) continue;
      const stamp = stamper.next();
      await db.execute('UPDATE muscle_recovery SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, row.id]);
    }
    const saved = await readDay(id);
    if (!saved) throw new RepositoryError('not-found', 'recovery_day', id);
    return { day: toDay(saved), muscles: (await liveMuscles(s.day)).map(toMuscle) };
  };

  return {
    async saveDay(output) {
      validate(output);
      if (!writer) {
        ignore();
        return null;
      }
      return atomic((inTx) => inTx.saveDay(output)) ?? saveInTx(output);
    },

    async getDay(date) {
      if (!isLocalDate(date)) return null;
      const row = await readDay(dayId(date));
      return row && row.deleted_at === null ? toDay(row) : null;
    },

    async listDays(from, to) {
      const rows = await db.select<DayRow>('SELECT * FROM recovery_day WHERE date >= ? AND date <= ? AND deleted_at IS NULL ORDER BY date', [from, to]);
      return rows.map(toDay);
    },

    async listMuscles(date) {
      return (await liveMuscles(date)).map(toMuscle);
    },

    async deleteDay(date) {
      if (!isLocalDate(date)) throw new RepositoryError('invalid', 'recovery_day', String(date));
      if (!writer) {
        ignore();
        return;
      }
      const work = async (): Promise<void> => {
        const row = await readDay(dayId(date));
        if (row && row.deleted_at === null) {
          const stamp = stamper.next();
          await db.execute('UPDATE recovery_day SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, row.id]);
        }
        for (const m of await liveMuscles(date)) {
          const stamp = stamper.next();
          await db.execute('UPDATE muscle_recovery SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, m.id]);
        }
      };
      await (atomic((inTx) => inTx.deleteDay(date)) ?? work());
    },
  };
}
