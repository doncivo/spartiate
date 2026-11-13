import { DATA_RESET_TABLE, RESET_LOCAL_TABLES, wipedSettingKeys } from '../../../domain/dataReset';
import type { WriteStamper } from '../../../domain/hlc';
import { uuidGenerator } from '../../../domain/id';
import type { SyncCatalogue, SyncTable } from '../../../domain/sync/syncTables';
import type { Hlc } from '../../../domain/types';
import type { SqlExecutor } from '../../driver';
import type { DataResetRepository } from '../dataResetRepository';

/**
 * RESET-01 (D-180 à D-186). Les noms de tables et de colonnes viennent du catalogue injecté (jamais d'une valeur reçue, audit H5) ; les valeurs
 * passent par paramètres liés. Horloge de création d'une ligne = horloge du champ `created_at`, sinon `'*'`, sinon `hlc` de la ligne (ADR 0011 §3.2).
 */
export function createDataResetRepository(db: SqlExecutor, stamper: WriteStamper, catalogue: SyncCatalogue): DataResetRepository {
  const known = catalogue.table(DATA_RESET_TABLE) !== undefined;

  const creationClock = (t: SyncTable): string => {
    const clock = (field: string): string => `(SELECT c.hlc FROM sync_field_clock c WHERE c.table_name = '${t.name}' AND c.row_id = ${t.name}.${t.key} AND c.field = '${field}')`;
    return `COALESCE(${clock('created_at')}, ${clock('*')}, ${t.name}.hlc)`;
  };

  /** Lignes d'une table parente absentes : leurs enfants partent avec elles (lien obligatoire ou non). */
  const orphanClause = (t: SyncTable): string =>
    t.parents
      .filter((p) => catalogue.table(p.table) !== undefined)
      .map((p) => {
        const pt = catalogue.table(p.table) as SyncTable;
        return ` OR (${t.name}.${p.column} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ${pt.name} p WHERE p.${pt.key} = ${t.name}.${p.column}))`;
      })
      .join('');

  return {
    async horizon() {
      if (!known) return null;
      const row = (await db.select<{ h: string | null }>(`SELECT MAX(hlc) AS h FROM ${DATA_RESET_TABLE}`))[0];
      return (row?.h ?? null) as Hlc | null;
    },

    async hasOpenWorkout() {
      return (await db.select('SELECT 1 FROM workout WHERE ended_at IS NULL AND deleted_at IS NULL LIMIT 1')).length > 0;
    },

    async record() {
      const id = uuidGenerator.next();
      const stamp = stamper.next();
      await db.execute(`INSERT INTO ${DATA_RESET_TABLE} (id, created_at, updated_at, deleted_at, device_id, hlc) VALUES (?, ?, ?, NULL, ?, ?)`, [id, stamp.at, stamp.at, stamp.deviceId, stamp.hlc]);
      return stamp.hlc;
    },

    async wipe(horizon) {
      await db.execute('PRAGMA defer_foreign_keys = ON');
      let rows = 0;
      let tables = 0;
      const count = (n: number): void => {
        rows += n;
        if (n > 0) tables += 1;
      };
      // Parents d'abord (ordre topologique du catalogue) : un enfant créé après l'horizon sous un parent effacé part avec lui.
      for (const t of catalogue.tables) {
        if (t.name === DATA_RESET_TABLE) continue;
        const where = `${creationClock(t)} <= ?${orphanClause(t)}`;
        count((await db.execute(`DELETE FROM ${t.name} WHERE ${where}`, [horizon])).rowsAffected);
        const gone = `table_name = ? AND row_id NOT IN (SELECT ${t.key} FROM ${t.name})`;
        await db.execute(`DELETE FROM sync_field_clock WHERE ${gone}`, [t.name]);
        await db.execute(`DELETE FROM sync_outbox WHERE ${gone}`, [t.name]);
        // Mises de côté : seules celles d'avant l'horizon partent (une opération d'après attend sa ligne ou son parent comme d'habitude).
        await db.execute('DELETE FROM sync_parked WHERE table_name = ? AND hlc <= ?', [t.name, horizon]);
        await db.execute('DELETE FROM sync_tombstone WHERE table_name = ? AND deleted_hlc <= ?', [t.name, horizon]);
        await db.execute('DELETE FROM sync_unknown WHERE table_name = ? AND hlc <= ?', [t.name, horizon]);
      }
      // Fichiers de photos (table locale) : seuls ceux d'une fiche encore présente (prise après l'horizon) restent.
      count((await db.execute('DELETE FROM progress_photo_file WHERE photo_id NOT IN (SELECT id FROM progress_photo)')).rowsAffected);
      for (const name of RESET_LOCAL_TABLES) count((await db.execute(`DELETE FROM ${name}`)).rowsAffected);
      const keys = wipedSettingKeys();
      const settings = (await db.execute(`DELETE FROM settings WHERE key IN (${keys.map(() => '?').join(', ')})`, keys)).rowsAffected;
      return { rows, tables, settings };
    },
  };
}
