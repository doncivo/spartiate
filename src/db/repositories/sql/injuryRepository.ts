import type { WriteStamper } from '../../../domain/hlc';
import { injuryFromColumns, injuryToColumns, injuryUpdate, legacyInjuryId, parseInjury, type Injury, type InjuryColumns } from '../../../domain/training/injuries';
import { isId } from '../../../domain/types';
import type { SqlExecutor, SqlRow } from '../../driver';
import { RepositoryError } from '../common';
import type { InjuryRepository } from '../injuryRepository';

interface InjuryRow extends SqlRow, InjuryColumns {
  readonly id: string;
}

const COLUMNS = ['muscle_id', 'patterns', 'started_on', 'note', 'status', 'healed_on', 'checkins'] as const satisfies readonly (keyof InjuryColumns)[];
const SELECT = `SELECT id, ${COLUMNS.join(', ')} FROM injury`;

/**
 * Gênes publiées (SYNC-0291, D-464). Toute écriture prend son tampon HLC juste avant son `db.execute`. Validation par le domaine (`parseInjury`) avant
 * toute écriture ; les CHECK de la migration 0021 restent le dernier recours. Une mise à jour n'écrit que les colonnes changées : les déclencheurs ne
 * publient que celles-là (une réponse au check-in ne recouvre pas une guérison faite ailleurs).
 */
export function createInjuryRepository(db: SqlExecutor, stamper: WriteStamper): InjuryRepository {
  const readRow = async (id: string): Promise<InjuryRow | undefined> => (await db.select<InjuryRow>(`${SELECT} WHERE id = ?`, [id]))[0];
  const valid = (injury: Injury): Injury => {
    const checked = isId(injury.id) ? parseInjury(injury) : null;
    if (checked === null) throw new RepositoryError('invalid', 'injury', injury.id.slice(0, 36));
    return checked;
  };
  /** Relecture 1 (point 2) : insertion sans effet sur une clé déjà présente (reprise concurrente ou rejouée) ; rend vrai si la ligne a été créée. */
  const insert = async (injury: Injury): Promise<boolean> => {
    const cols = injuryToColumns(injury);
    const stamp = stamper.next();
    const done = await db.execute(`INSERT INTO injury (id, ${COLUMNS.join(', ')}, created_at, updated_at, device_id, hlc) VALUES (?, ${COLUMNS.map(() => '?').join(', ')}, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`, [
      injury.id,
      ...COLUMNS.map((c) => cols[c]),
      stamp.at,
      stamp.at,
      stamp.deviceId,
      stamp.hlc,
    ]);
    return done.rowsAffected > 0;
  };

  return {
    async read() {
      const rows = await db.select<InjuryRow>(`${SELECT} WHERE deleted_at IS NULL ORDER BY created_at, hlc, id`);
      const items: Injury[] = [];
      for (const row of rows) {
        const injury = injuryFromColumns(row.id, row);
        if (injury !== null) items.push(injury);
      }
      return { v: 1, items };
    },

    async save(input, before) {
      const injury = valid(input);
      const row = await readRow(injury.id);
      if (!row) {
        await insert(injury);
        return;
      }
      // Relecture 1 (point 1, D-468) : seules les colonnes changées PAR L'ÉCRAN (après ≠ avant) partent ; les réponses sont fusionnées.
      const current = injuryFromColumns(row.id, row);
      const seen = before ?? current;
      const update: Partial<InjuryColumns> = seen === null ? injuryToColumns(injury) : injuryUpdate(current, seen, injury);
      const changed = COLUMNS.filter((c) => c in update);
      if (changed.length === 0) return;
      const stamp = stamper.next();
      await db.execute(`UPDATE injury SET ${changed.map((c) => `${c} = ?`).join(', ')}, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?`, [...changed.map((c) => update[c] ?? null), stamp.at, stamp.deviceId, stamp.hlc, injury.id]);
    },

    async importLocal(items) {
      let inserted = 0;
      let failed = 0;
      for (const item of items) {
        const injury = parseInjury(item);
        if (injury === null) {
          failed += 1;
          continue;
        }
        // Relecture 1 (points 2 et 4) : ancien identifiant non UUID → UUID déterministe ; insertion sans effet sur une clé présente ; échec isolé.
        try {
          if (await insert(isId(injury.id) ? injury : { ...injury, id: legacyInjuryId(injury) })) inserted += 1;
        } catch {
          failed += 1;
        }
      }
      return { inserted, failed };
    },
  };
}
