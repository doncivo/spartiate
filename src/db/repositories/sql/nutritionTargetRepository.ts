import type { WriteStamper } from '../../../domain/hlc';
import { uuidGenerator, type IdGenerator } from '../../../domain/id';
import { formatTrainingDays, restPlanOf } from '../../../domain/nutrition/restDay';
import { effectiveTarget, validateTargetRecord, type TargetSource } from '../../../domain/nutrition/targetRecord';
import { isId, type LocalDate } from '../../../domain/types';
import type { SqlExecutor, SqlRow } from '../../driver';
import { RepositoryError } from '../common';
import type { NutritionTargetRecord, NutritionTargetRepository } from '../nutritionTargetRepository';
import { readSyncMeta, type SyncRow } from './sqlHelpers';

interface TargetRow extends SqlRow, SyncRow {
  readonly week_start: string;
  readonly kcal: number;
  readonly protein_g: number;
  readonly fat_g: number;
  readonly carb_g: number;
  readonly source: string;
  readonly accepted: number;
  readonly engine_version: number | null;
  readonly rest_kcal?: number | null;
  readonly rest_carb_g?: number | null;
  readonly training_days?: string | null;
}

const toRecord = (row: TargetRow): NutritionTargetRecord => {
  const meta = readSyncMeta(row);
  return {
    id: row.id,
    weekStart: row.week_start as LocalDate,
    target: { kcal: row.kcal, proteinG: row.protein_g, fatG: row.fat_g, carbG: row.carb_g },
    source: row.source as TargetSource,
    accepted: row.accepted === 1,
    restPlan: restPlanOf(
      { kcal: row.kcal, proteinG: row.protein_g, fatG: row.fat_g, carbG: row.carb_g },
      { restKcal: row.rest_kcal ?? null, restCarbG: row.rest_carb_g ?? null, trainingDays: row.training_days ?? null },
    ),
    engineVersion: row.engine_version,
    ...meta,
  };
};

const ORDER = 'ORDER BY week_start DESC, created_at DESC, id DESC';

export function createNutritionTargetRepository(db: SqlExecutor, stamper: WriteStamper, ids: IdGenerator = uuidGenerator): NutritionTargetRepository {
  const read = async (id: string): Promise<TargetRow | undefined> => (await db.select<TargetRow>('SELECT * FROM nutrition_target WHERE id = ?', [id]))[0];

  return {
    async record(draft, options) {
      const id = options?.id ?? ids.next();
      if (!isId(id)) throw new RepositoryError('invalid', 'nutrition_target', id);
      if (validateTargetRecord(draft).length > 0) throw new RepositoryError('invalid', 'nutrition_target', id);
      if ((await read(id)) !== undefined) throw new RepositoryError('conflict', 'nutrition_target', id);
      const stamp = stamper.next();
      await db.execute(
        `INSERT INTO nutrition_target (id, week_start, kcal, protein_g, fat_g, carb_g, source, accepted, engine_version, rest_kcal, rest_carb_g, training_days, created_at, updated_at, device_id, hlc)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, draft.weekStart, draft.target.kcal, draft.target.proteinG, draft.target.fatG, draft.target.carbG, draft.source, draft.accepted ? 1 : 0, draft.engineVersion, draft.restPlan?.rest.kcal ?? null, draft.restPlan?.rest.carbG ?? null, draft.restPlan ? formatTrainingDays(draft.restPlan.trainingDays) : null, stamp.at, stamp.at, stamp.deviceId, stamp.hlc],
      );
      const row = await read(id);
      if (!row) throw new RepositoryError('not-found', 'nutrition_target', id);
      return toRecord(row);
    },

    async get(id) {
      const row = await read(id);
      return row && row.deleted_at === null ? toRecord(row) : null;
    },

    async list() {
      return (await db.select<TargetRow>(`SELECT * FROM nutrition_target WHERE deleted_at IS NULL ${ORDER}`)).map(toRecord);
    },

    async effective(date) {
      const rows = (await db.select<TargetRow>('SELECT * FROM nutrition_target WHERE deleted_at IS NULL AND accepted = 1 AND week_start <= ?', [date])).map(toRecord);
      return effectiveTarget(rows, date);
    },
  };
}
