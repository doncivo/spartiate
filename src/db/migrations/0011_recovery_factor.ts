import type { Migration } from '../migrator';

/**
 * I6-01 point C : journal de facteurs (PRD § 16.7, § 20.2 ; D-95). UNE TABLE NEUVE, PUBLIÉE ; AUCUNE table existante n'est modifiée, aucune donnée
 * migrée (schéma strictement additif, schéma 11).
 *
 * - `recovery_factor` : une ligne par date locale (la JOURNÉE DE LA VEILLE du matin de saisie), identifiant naturel `recovery_factor|AAAA-MM-JJ`
 *   (CHECK, comme `recovery_day`) : deux appareils qui saisissent le même jour écrivent la même ligne ; fusion champ par champ par HLC, dernière
 *   écriture gagne. `factors` : tableau JSON de codes fixes (huit au plus), validé par `src/db/parse/recoveryFactorJson.ts` ; `none` : « rien de
 *   particulier » marqué explicitement (1, avec un tableau vide), distinct d'un jour non renseigné (aucune ligne, ou ligne supprimée logiquement).
 *   Les codes ne sont pas fixés en SQL : un code ajouté plus tard par une version plus récente ne doit pas bloquer la ligne sur un appareil en
 *   schéma 11 (le parseur ignore un code inconnu).
 *
 * Copie figée `CAPTURE_TABLES_V11` (jamais lue depuis le catalogue vivant), deux déclencheurs sur le modèle de la 0010. Aucune migration publiée n'est
 * modifiée.
 */

/** Copie figée (version 11) des colonnes capturées : colonnes métier, `created_at` et `deleted_at` (ni `id`, ni `updated_at`, `device_id`, `hlc`). */
export const CAPTURE_TABLES_V11 = [['recovery_factor', ['date', 'factors', 'none', 'created_at', 'deleted_at']]] as const;

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

/** Modèle de la 0002 (et des 0006 à 0010) : un `_ai` (ligne entière) et un `_au` (champ par champ, `base_hlc`, `'+'` à la restauration). */
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

const [[FACTOR, FACTOR_COLUMNS]] = CAPTURE_TABLES_V11;

export const migration0011RecoveryFactor: Migration = {
  version: 11,
  name: 'recovery_factor',
  statements: [
    `CREATE TABLE recovery_factor (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      factors TEXT NOT NULL CHECK (json_valid(factors) AND json_type(factors) = 'array' AND json_array_length(factors) <= 32),
      none INTEGER NOT NULL CHECK (typeof(none) = 'integer' AND none IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL,
      UNIQUE (date),
      CHECK (id = 'recovery_factor|' || date)
    )`,
    ...captureTriggers(FACTOR, FACTOR_COLUMNS),
  ],
};
