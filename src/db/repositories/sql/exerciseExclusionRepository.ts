import type { WriteStamper } from '../../../domain/hlc';
import { exclusionId, isExclusionExerciseId } from '../../../domain/sync/naturalIds';
import type { SqlExecutor, SqlRow } from '../../driver';
import { RepositoryError } from '../common';
import type { ExerciseExclusionRepository } from '../exerciseExclusionRepository';

interface ExclusionRow extends SqlRow {
  readonly id: string;
  readonly exercise_id: string;
  readonly deleted_at: string | null;
}

/**
 * Exercices écartés publiés (SYNC-0291, D-463). Toute écriture prend son tampon HLC juste avant son `db.execute`. Validation par le domaine
 * (`isExclusionExerciseId`) avant toute écriture ; les CHECK de la migration 0021 restent le dernier recours.
 */
export function createExerciseExclusionRepository(db: SqlExecutor, stamper: WriteStamper): ExerciseExclusionRepository {
  const read = async (id: string): Promise<ExclusionRow | undefined> => (await db.select<ExclusionRow>('SELECT id, exercise_id, deleted_at FROM exercise_exclusion WHERE id = ?', [id]))[0];
  /** Relecture 1 (point 2) : insertion sans effet sur une clé déjà présente (deux reprises concurrentes) ; rend vrai si la ligne a été créée. */
  const insert = async (exerciseId: string): Promise<boolean> => {
    const stamp = stamper.next();
    const done = await db.execute('INSERT INTO exercise_exclusion (id, exercise_id, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING', [exclusionId(exerciseId), exerciseId, stamp.at, stamp.at, stamp.deviceId, stamp.hlc]);
    return done.rowsAffected > 0;
  };

  return {
    async list() {
      const rows = await db.select<ExclusionRow>('SELECT id, exercise_id, deleted_at FROM exercise_exclusion WHERE deleted_at IS NULL ORDER BY exercise_id');
      return rows.filter((row) => isExclusionExerciseId(row.exercise_id) && row.id === exclusionId(row.exercise_id)).map((row) => row.exercise_id);
    },

    async setExcluded(exerciseId, excluded) {
      if (!isExclusionExerciseId(exerciseId)) throw new RepositoryError('invalid', 'exercise_exclusion', exerciseId.slice(0, 32));
      const row = await read(exclusionId(exerciseId));
      if (excluded) {
        if (!row) {
          await insert(exerciseId);
          return;
        }
        if (row.deleted_at === null) return;
        const stamp = stamper.next();
        await db.execute('UPDATE exercise_exclusion SET deleted_at = NULL, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.deviceId, stamp.hlc, row.id]);
        return;
      }
      if (!row || row.deleted_at !== null) return;
      const stamp = stamper.next();
      await db.execute('UPDATE exercise_exclusion SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, row.id]);
    },

    async importLocal(exerciseIds) {
      let inserted = 0;
      let failed = 0;
      const failedIds: string[] = [];
      for (const exerciseId of new Set(exerciseIds)) {
        if (!isExclusionExerciseId(exerciseId)) {
          failed += 1;
          failedIds.push(exerciseId);
          continue;
        }
        // Relecture 1 (points 2 et 4) : ligne existante jamais touchée, insertion sans effet sur une clé présente, échec isolé.
        try {
          if (!(await read(exclusionId(exerciseId))) && (await insert(exerciseId))) inserted += 1;
        } catch {
          failed += 1;
          failedIds.push(exerciseId);
        }
      }
      return { inserted, failed, failedIds };
    },
  };
}
