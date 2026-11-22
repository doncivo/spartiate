import type { WriteStamper } from '../../../domain/hlc';
import { uuidGenerator } from '../../../domain/id';
import { injuryFromColumns, injuryToColumns, parseInjury, type Injury, type InjuryColumns } from '../../../domain/training/injuries';
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
  const insert = async (injury: Injury): Promise<void> => {
    const cols = injuryToColumns(injury);
    const stamp = stamper.next();
    await db.execute(`INSERT INTO injury (id, ${COLUMNS.join(', ')}, created_at, updated_at, device_id, hlc) VALUES (?, ${COLUMNS.map(() => '?').join(', ')}, ?, ?, ?, ?)`, [
      injury.id,
      ...COLUMNS.map((c) => cols[c]),
      stamp.at,
      stamp.at,
      stamp.deviceId,
      stamp.hlc,
    ]);
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

    async save(input) {
      const injury = valid(input);
      const row = await readRow(injury.id);
      if (!row) return insert(injury);
      const next = injuryToColumns(injury);
      const changed = COLUMNS.filter((c) => next[c] !== row[c]);
      if (changed.length === 0) return;
      const stamp = stamper.next();
      await db.execute(`UPDATE injury SET ${changed.map((c) => `${c} = ?`).join(', ')}, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?`, [...changed.map((c) => next[c]), stamp.at, stamp.deviceId, stamp.hlc, injury.id]);
    },

    async importLocal(items) {
      let inserted = 0;
      for (const item of items) {
        const injury = parseInjury(item);
        if (injury === null) continue;
        if (isId(injury.id)) {
          if (await readRow(injury.id)) continue;
          await insert(injury);
        } else {
          // Ancien identifiant (avant les UUID) : UUID neuf ; une reprise rejouée reconnaît la gêne à son contenu (début, muscle, motifs, note).
          const cols = injuryToColumns(injury);
          const twin = await db.select('SELECT 1 FROM injury WHERE started_on = ? AND muscle_id IS ? AND patterns = ? AND note IS ? LIMIT 1', [cols.started_on, cols.muscle_id, cols.patterns, cols.note]);
          if (twin.length > 0) continue;
          await insert({ ...injury, id: uuidGenerator.next() });
        }
        inserted += 1;
      }
      return inserted;
    },
  };
}
