import type { Migration } from '../migrator';

/**
 * RESET-01 (D-183 ; ADR 0011, avenant 36) : « Repartir de zéro ». UNE TABLE NEUVE, publiée ; AUCUNE table existante n'est modifiée (schéma strictement
 * additif, schéma 16).
 *
 * - `data_reset` : une ligne par remise à zéro des données, identifiant UUID. Son `hlc` est l'HORIZON : tout ce qui a été écrit avant lui est effacé
 *   sur chaque appareil qui reçoit la ligne et n'est plus jamais accepté ensuite. La ligne n'est jamais modifiée, supprimée ni purgée ; elle ne
 *   porte aucune donnée de l'utilisateur (seulement `created_at`).
 * - Un appareil resté en schéma 15 la range dans `sync_unknown` (ADR 0011 §7.2) et affiche « Mets à jour l'app » ; après sa mise à jour, la ligne
 *   est réintégrée et la remise à zéro s'applique au cycle suivant (`src/sync/dataReset.ts`).
 *
 * Copie figée `CAPTURE_TABLES_V16` (jamais lue depuis le catalogue vivant), deux déclencheurs sur le modèle de la 0015. Aucune migration publiée
 * n'est modifiée.
 */

/** Copie figée (version 16) des colonnes capturées : `created_at` et `deleted_at` (ni `id`, ni `updated_at`, `device_id`, `hlc`). */
export const CAPTURE_TABLES_V16 = [['data_reset', ['created_at', 'deleted_at']]] as const;

const fieldCapture = (table: string, column: string): string[] => {
  const row = `table_name = '${table}' AND row_id = NEW.id`;
  const clock = (field: string): string => `(SELECT hlc FROM sync_field_clock WHERE ${row} AND field = '${field}')`;
  return [
    `INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT '${table}', NEW.id, '${column}', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE ${row} AND field IN ('${column}', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE ${row} AND field = '${column}')
           ELSE COALESCE(${clock(column)}, ${clock('*')}, OLD.hlc) END
       WHERE OLD.${column} IS NOT NEW.${column}
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;`,
    `DELETE FROM sync_outbox WHERE ${row} AND field = '${column}' AND OLD.${column} IS NOT NEW.${column};`,
    `INSERT INTO sync_outbox (table_name, row_id, field) SELECT '${table}', NEW.id, '${column}' WHERE OLD.${column} IS NOT NEW.${column};`,
  ];
};

/** Modèle de la 0015 : un `_ai` (ligne entière) et un `_au` (champ par champ, `base_hlc`, `'+'` au rétablissement). */
function captureTriggers(table: string, columns: readonly string[]): string[] {
  const row = `table_name = '${table}' AND row_id = NEW.id`;
  return [
    `CREATE TRIGGER sync_${table}_ai AFTER INSERT ON ${table}
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE ${row};
       DELETE FROM sync_outbox WHERE ${row} AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('${table}', NEW.id, '*');
     END`,
    `CREATE TRIGGER sync_${table}_au AFTER UPDATE ON ${table}
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT '${table}', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE ${row} AND field = '*');
       ${columns.flatMap((column) => fieldCapture(table, column)).join('\n')}
       DELETE FROM sync_outbox WHERE ${row} AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT '${table}', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END`,
  ];
}

const [[RESET, RESET_COLUMNS]] = CAPTURE_TABLES_V16;

export const migration0016DataReset: Migration = {
  version: 16,
  name: 'data_reset',
  statements: [
    `CREATE TABLE data_reset (
      id TEXT PRIMARY KEY NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL
    )`,
    ...captureTriggers(RESET, RESET_COLUMNS),
  ],
};
