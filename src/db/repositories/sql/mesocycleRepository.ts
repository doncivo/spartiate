import type { WriteStamper } from '../../../domain/hlc';
import { uuidGenerator, type IdGenerator } from '../../../domain/id';
import { DEFAULT_GENERATION_CONFIG } from '../../../domain/training/config';
import { validateMesocycleSpec, type MesocycleOutcome, type MesocyclePause, type MesocycleSpec, type MesocycleStatus } from '../../../domain/training/mesocycle';
import { isId, isLocalDate, type LocalDate } from '../../../domain/types';
import type { SqlExecutor, SqlRow } from '../../driver';
import { RepositoryError } from '../common';
import type { MesocycleRecord, MesocycleRepository } from '../mesocycleRepository';
import { readSyncMeta, type SyncRow } from './sqlHelpers';

interface MesocycleRow extends SqlRow, SyncRow {
  readonly routine_id: string;
  readonly start_date: string;
  readonly weeks: number;
  readonly unlimited: number;
  readonly deload_week: number | null;
  readonly block_origin_week: number;
  readonly block_origin_index: number;
  readonly rotation_index: number;
  readonly pauses: string;
  readonly status: string;
  readonly outcome: string | null;
  readonly ended_on: string | null;
}

/** Pauses relues strictement : `null` si le texte n'est pas un tableau de pauses bien formées (ligne d'une autre version). */
function parsePauses(text: string): MesocyclePause[] | null {
  try {
    const raw: unknown = JSON.parse(text);
    if (!Array.isArray(raw)) return null;
    const out: MesocyclePause[] = [];
    for (const item of raw as unknown[]) {
      if (item === null || typeof item !== 'object') return null;
      const { from, to, lightWeek } = item as Record<string, unknown>;
      if (typeof from !== 'string' || !isLocalDate(from) || !(to === null || (typeof to === 'string' && isLocalDate(to))) || typeof lightWeek !== 'boolean') return null;
      out.push({ from, to: to as LocalDate | null, lightWeek });
    }
    return out;
  } catch {
    return null;
  }
}

const toRecord = (row: MesocycleRow): MesocycleRecord => {
  const pauses = parsePauses(row.pauses);
  return {
    id: row.id,
    routineId: row.routine_id,
    startDate: row.start_date as LocalDate,
    weeks: row.weeks,
    unlimited: row.unlimited === 1,
    deloadWeek: row.deload_week,
    blockOriginWeek: row.block_origin_week,
    blockOriginIndex: row.block_origin_index,
    rotationIndex: row.rotation_index,
    pauses: pauses ?? [],
    status: row.status as MesocycleStatus,
    outcome: row.outcome as MesocycleOutcome | null,
    endedOn: row.ended_on as LocalDate | null,
    readable: pauses !== null,
    ...readSyncMeta(row),
  };
};

/** Colonnes écrites, dans l'ordre des requêtes. */
const values = (spec: MesocycleSpec): (string | number | null)[] => [
  spec.routineId,
  spec.startDate,
  spec.weeks,
  spec.unlimited ? 1 : 0,
  spec.deloadWeek,
  spec.blockOriginWeek,
  spec.blockOriginIndex,
  spec.rotationIndex,
  JSON.stringify(spec.pauses.map((p) => ({ from: p.from, to: p.to, lightWeek: p.lightWeek }))),
  spec.status,
  spec.outcome,
  spec.endedOn,
];

const ACTIVE_ORDER = "WHERE status = 'active' AND deleted_at IS NULL ORDER BY start_date DESC, created_at DESC, id DESC";

export function createMesocycleRepository(db: SqlExecutor, stamper: WriteStamper, ids: IdGenerator = uuidGenerator): MesocycleRepository {
  const read = async (id: string): Promise<MesocycleRow | undefined> => (await db.select<MesocycleRow>('SELECT * FROM mesocycle WHERE id = ?', [id]))[0];
  const reload = async (id: string): Promise<MesocycleRecord> => {
    const row = await read(id);
    if (!row) throw new RepositoryError('not-found', 'mesocycle', id);
    return toRecord(row);
  };
  const check = (spec: MesocycleSpec, id: string): void => {
    if (!validateMesocycleSpec(spec, DEFAULT_GENERATION_CONFIG)) throw new RepositoryError('invalid', 'mesocycle', id);
  };

  return {
    async current() {
      const row = (await db.select<MesocycleRow>(`SELECT * FROM mesocycle ${ACTIVE_ORDER} LIMIT 1`))[0];
      return row ? toRecord(row) : null;
    },

    async activeCount() {
      const [row] = await db.select<{ n: number }>("SELECT COUNT(*) AS n FROM mesocycle WHERE status = 'active' AND deleted_at IS NULL");
      return row?.n ?? 0;
    },

    async get(id) {
      const row = await read(id);
      return row && row.deleted_at === null ? toRecord(row) : null;
    },

    async list() {
      const rows = await db.select<MesocycleRow>('SELECT * FROM mesocycle WHERE deleted_at IS NULL ORDER BY start_date DESC, created_at DESC, id DESC');
      return rows.map(toRecord);
    },

    async start(spec, options) {
      const id = options?.id ?? ids.next();
      if (!isId(id)) throw new RepositoryError('invalid', 'mesocycle', id);
      check(spec, id);
      if (spec.status !== 'active') throw new RepositoryError('invalid', 'mesocycle', id);
      if ((await read(id)) !== undefined) throw new RepositoryError('conflict', 'mesocycle', id);
      // Un seul cycle suivi : les autres actifs sont clos, pause en cours terminée au même jour.
      for (const other of await db.select<MesocycleRow>(`SELECT * FROM mesocycle ${ACTIVE_ORDER}`)) {
        const record = toRecord(other);
        const pauses = record.pauses.map((p) => (p.to === null ? { ...p, to: p.from > spec.startDate ? p.from : spec.startDate } : p));
        const stamp = stamper.next();
        await db.execute(
          "UPDATE mesocycle SET status = 'completed', outcome = 'stopped', ended_on = ?, pauses = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?",
          [spec.startDate, record.readable ? JSON.stringify(pauses) : other.pauses, stamp.at, stamp.deviceId, stamp.hlc, other.id],
        );
      }
      const stamp = stamper.next();
      await db.execute(
        `INSERT INTO mesocycle (id, routine_id, start_date, weeks, unlimited, deload_week, block_origin_week, block_origin_index, rotation_index, pauses, status, outcome, ended_on, created_at, updated_at, device_id, hlc)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, ...values(spec), stamp.at, stamp.at, stamp.deviceId, stamp.hlc],
      );
      return reload(id);
    },

    async save(id, spec) {
      const row = await read(id);
      if (!row || row.deleted_at !== null) throw new RepositoryError('not-found', 'mesocycle', id);
      check(spec, id);
      const stamp = stamper.next();
      await db.execute(
        `UPDATE mesocycle SET routine_id = ?, start_date = ?, weeks = ?, unlimited = ?, deload_week = ?, block_origin_week = ?, block_origin_index = ?, rotation_index = ?,
           pauses = ?, status = ?, outcome = ?, ended_on = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?`,
        [...values(spec), stamp.at, stamp.deviceId, stamp.hlc, id],
      );
      return reload(id);
    },
  };
}
