import { isIsoDateTime } from '../../../domain/types';
import type { SqlDriver, SqlExecutor, SqlParams, SqlRow } from '../../driver';
import { RepositoryError } from '../common';
import {
  RECOVERY_SAMPLE_RETENTION_DAYS,
  type RecoveryImportState,
  type RecoverySample,
  type RecoverySampleInput,
  type RecoverySampleRepository,
  type RecoverySampleType,
} from '../recoverySampleRepository';

interface SampleRow extends SqlRow {
  readonly id: number;
  readonly type: string;
  readonly start_at: string;
  readonly end_at: string;
  readonly value: number | null;
  readonly stage: string | null;
  readonly source: string;
  readonly imported_at: string;
}

interface StateRow extends SqlRow {
  readonly type: string;
  readonly imported_at: string;
  readonly newest_sample_at: string | null;
  readonly added: number;
  readonly duplicates: number;
  readonly rejected: number;
}

const TYPES: readonly string[] = ['hrv', 'fc-repos', 'sommeil', 'pas'];
const STAGES: readonly string[] = ['in_bed', 'asleep', 'awake', 'rem', 'deep', 'core'];
/** 7 paramètres par ligne : 100 lignes = 700, sous la limite de 999 variables de SQLite. */
const CHUNK = 100;
const DAY_MS = 86_400_000;

const toSample = (row: SampleRow): RecoverySample => ({
  id: row.id,
  type: row.type as RecoverySampleType,
  startAt: row.start_at,
  endAt: row.end_at,
  value: row.value,
  stage: row.stage as RecoverySample['stage'],
  source: row.source,
  importedAt: row.imported_at,
});

const toState = (row: StateRow): RecoveryImportState => ({
  type: row.type as RecoverySampleType,
  importedAt: row.imported_at,
  newestSampleAt: row.newest_sample_at,
  added: row.added,
  duplicates: row.duplicates,
  rejected: row.rejected,
});

const isCount = (v: number): boolean => Number.isInteger(v) && v >= 0;

function validSample(s: RecoverySampleInput): boolean {
  if (!TYPES.includes(s.type) || !isIsoDateTime(s.startAt) || !isIsoDateTime(s.endAt) || s.endAt < s.startAt) return false;
  if (typeof s.source !== 'string' || s.source.length < 1 || s.source.length > 128) return false;
  if (s.type === 'sommeil') return s.value === null && s.stage !== null && STAGES.includes(s.stage);
  if (s.stage !== null || s.value === null || !Number.isFinite(s.value)) return false;
  return s.type === 'pas' ? s.value >= 0 : s.value > 0;
}

export function createRecoverySampleRepository(db: SqlExecutor): RecoverySampleRepository {
  const atomic = <T>(work: (inTx: RecoverySampleRepository) => Promise<T>): Promise<T> | null =>
    typeof (db as Partial<SqlDriver>).transaction === 'function' ? (db as SqlDriver).transaction((tx) => work(createRecoverySampleRepository(tx))) : null;

  const insertAll = async (samples: readonly RecoverySampleInput[], importedAt: string) => {
    let added = 0;
    for (let i = 0; i < samples.length; i += CHUNK) {
      const chunk = samples.slice(i, i + CHUNK);
      const params: SqlParams = chunk.flatMap((s) => [s.type, s.startAt, s.endAt, s.value, s.stage, s.source, importedAt]);
      const result = await db.execute(
        `INSERT OR IGNORE INTO recovery_sample (type, start_at, end_at, value, stage, source, imported_at) VALUES ${chunk.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
        params,
      );
      added += result.rowsAffected;
    }
    return { added, duplicates: samples.length - added };
  };

  const upsertAll = async (samples: readonly RecoverySampleInput[], importedAt: string) => {
    let added = 0;
    let updated = 0;
    let duplicates = 0;
    for (const s of samples) {
      const existing = (await db.select<SampleRow>("SELECT * FROM recovery_sample WHERE type = 'pas' AND start_at = ? AND end_at = ? AND stage IS NULL", [s.startAt, s.endAt]))[0];
      if (!existing) {
        await db.execute('INSERT INTO recovery_sample (type, start_at, end_at, value, stage, source, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [s.type, s.startAt, s.endAt, s.value, null, s.source, importedAt]);
        added += 1;
      } else if (existing.value !== s.value) {
        await db.execute('UPDATE recovery_sample SET value = ?, source = ?, imported_at = ? WHERE id = ?', [s.value, s.source, importedAt, existing.id]);
        updated += 1;
      } else {
        duplicates += 1;
      }
    }
    return { added, duplicates, updated };
  };

  return {
    async upsertTotals(samples, importedAt) {
      if (!isIsoDateTime(importedAt) || !samples.every((s) => s.type === 'pas' && validSample(s))) throw new RepositoryError('invalid', 'recovery_sample', String(samples.length));
      if (samples.length === 0) return { added: 0, duplicates: 0, updated: 0 };
      return (await atomic((inTx) => inTx.upsertTotals(samples, importedAt))) ?? upsertAll(samples, importedAt);
    },

    async insertMany(samples, importedAt) {
      if (!isIsoDateTime(importedAt) || !samples.every(validSample)) throw new RepositoryError('invalid', 'recovery_sample', String(samples.length));
      if (samples.length === 0) return { added: 0, duplicates: 0 };
      return (await atomic((inTx) => inTx.insertMany(samples, importedAt))) ?? insertAll(samples, importedAt);
    },

    async listWindow(type, from, to) {
      const rows = await db.select<SampleRow>('SELECT * FROM recovery_sample WHERE type = ? AND end_at >= ? AND start_at <= ? ORDER BY start_at, end_at, id', [type, from, to]);
      return rows.map(toSample);
    },

    async purgeOlderThan(now, days = RECOVERY_SAMPLE_RETENTION_DAYS) {
      const nowMs = Date.parse(now);
      if (!Number.isFinite(nowMs) || !Number.isFinite(days) || days < 0) throw new RepositoryError('invalid', 'recovery_sample', now);
      const cutoff = new Date(nowMs - days * DAY_MS).toISOString();
      return (await db.execute('DELETE FROM recovery_sample WHERE end_at < ?', [cutoff])).rowsAffected;
    },

    async recordImport(state) {
      if (!TYPES.includes(state.type) || !isIsoDateTime(state.importedAt) || !isCount(state.added) || !isCount(state.duplicates) || !isCount(state.rejected)) {
        throw new RepositoryError('invalid', 'recovery_import_state', String(state.type));
      }
      await db.execute(
        `INSERT INTO recovery_import_state (type, imported_at, newest_sample_at, added, duplicates, rejected) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (type) DO UPDATE SET imported_at = excluded.imported_at, newest_sample_at = excluded.newest_sample_at, added = excluded.added,
           duplicates = excluded.duplicates, rejected = excluded.rejected`,
        [state.type, state.importedAt, state.newestSampleAt, state.added, state.duplicates, state.rejected],
      );
    },

    async getImportState(type) {
      const row = (await db.select<StateRow>('SELECT * FROM recovery_import_state WHERE type = ?', [type]))[0];
      return row ? toState(row) : null;
    },

    async listImportStates() {
      return (await db.select<StateRow>('SELECT * FROM recovery_import_state ORDER BY type')).map(toState);
    },
  };
}
