import type { WriteStamper } from '../../../domain/hlc';
import type { DayDeclaration } from '../../../domain/nutrition/types';
import { dayCompletenessId } from '../../../domain/sync/naturalIds';
import { isLocalDate, type LocalDate } from '../../../domain/types';
import type { SqlExecutor, SqlRow } from '../../driver';
import { RepositoryError } from '../common';
import type { DayCompletenessRepository, DayDeclarationRecord } from '../dayCompletenessRepository';
import { readSyncMeta, type SyncRow } from './sqlHelpers';

interface DayRow extends SqlRow, SyncRow {
  readonly date: string;
  readonly state: string;
}

const STATES: readonly string[] = ['complete', 'incomplete'];

const toRecord = (row: DayRow): DayDeclarationRecord => ({ id: row.id, date: row.date as LocalDate, state: row.state as DayDeclaration, ...readSyncMeta(row) });

/**
 * I4-07 (D-81) : une ligne par date locale, identifiant `day|AAAA-MM-JJ` (même ligne sur les deux appareils). Redéclarer une date effacée
 * rétablit la ligne (`deleted_at` remis à NULL : restauration `'+'` pour la synchro), comme une pesée supprimée puis ressaisie.
 * Limite connue : un effacement et une redéclaration CONCURRENTS sur deux appareils se fusionnent champ par champ (`deleted_at` d'un côté, `state`
 * de l'autre) ; la journée reste alors effacée tant que `deleted_at` n'est pas rétabli par une écriture plus récente.
 */
export function createDayCompletenessRepository(db: SqlExecutor, stamper: WriteStamper): DayCompletenessRepository {
  const read = async (id: string): Promise<DayRow | undefined> => (await db.select<DayRow>('SELECT * FROM day_completeness WHERE id = ?', [id]))[0];

  return {
    async declare(date, state) {
      if (!isLocalDate(date) || !STATES.includes(state)) throw new RepositoryError('invalid', 'day_completeness', String(date));
      const id = dayCompletenessId(date);
      const row = await read(id);
      if (row && row.deleted_at === null && row.state === state) return toRecord(row);
      const stamp = stamper.next();
      if (row) {
        await db.execute('UPDATE day_completeness SET state = ?, deleted_at = NULL, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [state, stamp.at, stamp.deviceId, stamp.hlc, id]);
      } else {
        await db.execute('INSERT INTO day_completeness (id, date, state, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, date, state, stamp.at, stamp.at, stamp.deviceId, stamp.hlc]);
      }
      const saved = await read(id);
      if (!saved) throw new RepositoryError('not-found', 'day_completeness', id);
      return toRecord(saved);
    },

    async clear(date) {
      if (!isLocalDate(date)) throw new RepositoryError('invalid', 'day_completeness', String(date));
      const id = dayCompletenessId(date);
      const row = await read(id);
      if (!row || row.deleted_at !== null) return;
      const stamp = stamper.next();
      await db.execute('UPDATE day_completeness SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, id]);
    },

    async get(date) {
      if (!isLocalDate(date)) return null;
      const row = await read(dayCompletenessId(date));
      return row && row.deleted_at === null ? toRecord(row) : null;
    },

    async listBetween(from, to) {
      const rows = await db.select<DayRow>('SELECT * FROM day_completeness WHERE date >= ? AND date <= ? AND deleted_at IS NULL ORDER BY date', [from, to]);
      return new Map(rows.map((row) => [row.date as LocalDate, row.state as DayDeclaration] as const));
    },
  };
}
