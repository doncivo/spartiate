import type { WriteStamper } from '../../../domain/hlc';
import { isFactorCode } from '../../../domain/recovery';
import { recoveryFactorId } from '../../../domain/sync/naturalIds';
import { isLocalDate, type LocalDate } from '../../../domain/types';
import { encodeFactors, parseFactors } from '../../parse/recoveryFactorJson';
import type { SqlExecutor, SqlRow } from '../../driver';
import { RepositoryError } from '../common';
import type { FactorEntry, RecoveryFactorRecord, RecoveryFactorRepository } from '../recoveryFactorRepository';
import { readSyncMeta, type SyncRow } from './sqlHelpers';

interface FactorRow extends SqlRow, SyncRow {
  readonly date: string;
  readonly factors: string;
  readonly none: number;
}

const toRecord = (row: FactorRow): RecoveryFactorRecord => {
  const factors = parseFactors(row.factors);
  if (factors === null) throw new RepositoryError('invalid', 'recovery_factor', row.id);
  return { id: row.id, day: row.date as LocalDate, factors, none: row.none === 1, ...readSyncMeta(row) };
};

/** Contrôles du dépôt (les CHECK de la base restent le dernier recours) : rien n'est écrit si l'entrée est refusée. */
function validate(day: LocalDate, entry: FactorEntry): void {
  const fail = (): never => {
    throw new RepositoryError('invalid', 'recovery_factor', String(day));
  };
  if (!isLocalDate(day) || !Array.isArray(entry.factors) || entry.factors.some((code) => typeof code !== 'string' || !isFactorCode(code))) fail();
  if (entry.none && entry.factors.length > 0) fail();
  if (!entry.none && entry.factors.length === 0) fail();
}

/**
 * Une ligne par date locale, identifiant `recovery_factor|AAAA-MM-JJ` (même ligne sur les deux appareils). Resaisir une date effacée rétablit la
 * ligne (`deleted_at` remis à NULL : restauration `'+'` pour la synchro). Même limite connue que `day_completeness` pour un effacement et une
 * saisie concurrents (fusion champ par champ, dernière écriture gagne).
 */
export function createRecoveryFactorRepository(db: SqlExecutor, stamper: WriteStamper): RecoveryFactorRepository {
  const read = async (id: string): Promise<FactorRow | undefined> => (await db.select<FactorRow>('SELECT * FROM recovery_factor WHERE id = ?', [id]))[0];

  return {
    async save(day, entry) {
      validate(day, entry);
      const id = recoveryFactorId(day);
      const factors = encodeFactors(entry.factors);
      const none = entry.none ? 1 : 0;
      const row = await read(id);
      if (row && row.deleted_at === null && row.factors === factors && row.none === none) return toRecord(row);
      const stamp = stamper.next();
      if (row) {
        await db.execute('UPDATE recovery_factor SET factors = ?, none = ?, deleted_at = NULL, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [factors, none, stamp.at, stamp.deviceId, stamp.hlc, id]);
      } else {
        await db.execute('INSERT INTO recovery_factor (id, date, factors, none, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, day, factors, none, stamp.at, stamp.at, stamp.deviceId, stamp.hlc]);
      }
      const saved = await read(id);
      if (!saved) throw new RepositoryError('not-found', 'recovery_factor', id);
      return toRecord(saved);
    },

    async clear(day) {
      if (!isLocalDate(day)) throw new RepositoryError('invalid', 'recovery_factor', String(day));
      const id = recoveryFactorId(day);
      const row = await read(id);
      if (!row || row.deleted_at !== null) return;
      const stamp = stamper.next();
      await db.execute('UPDATE recovery_factor SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, id]);
    },

    async get(day) {
      if (!isLocalDate(day)) return null;
      const row = await read(recoveryFactorId(day));
      return row && row.deleted_at === null ? toRecord(row) : null;
    },

    async list(from, to) {
      const rows = await db.select<FactorRow>('SELECT * FROM recovery_factor WHERE date >= ? AND date <= ? AND deleted_at IS NULL ORDER BY date', [from, to]);
      return rows.map(toRecord);
    },
  };
}
