import type { Migration } from '../migrator';

/**
 * I6-02 : Corps, mensurations et photos de progression (PRD § 17.1, § 20.2, § 9 ; D-99). TROIS TABLES NEUVES ; AUCUNE table existante n'est modifiée,
 * aucune donnée migrée (schéma strictement additif, schéma 12).
 *
 * PUBLIÉES (écrites par les deux appareils) :
 * - `measurement` : une mesure par date locale et genre, identifiant naturel `measurement|AAAA-MM-JJ|genre` (CHECK, comme `recovery_factor`) ; valeur en
 *   centimètres, strictement positive et inférieure à 1000. Le genre n'est PAS une liste fermée en SQL (un genre ajouté plus tard par une version plus
 *   récente ne doit pas bloquer la ligne sur un appareil au schéma 12) : seul son format est contrôlé ; la liste et les bornes par genre sont dans
 *   `src/domain/bodyProgress`. Aucune contrainte croisée entre colonnes : le catalogue fusionne champ par champ (leçon d'I6-01, relecture sync A1).
 * - `progress_photo` : FICHE d'une photo (date, nom de fichier), identifiant UUID (plusieurs photos le même jour). MÉTADONNÉES SEULEMENT (§ 9, § 20.2).
 *
 * LOCALE, NON PUBLIÉE (aucune colonne de synchro, aucun déclencheur, jamais exportée) :
 * - `progress_photo_file` : le fichier image (JPEG réduit, codé en base64) copié dans le dossier de données de l'app, clé = identifiant de la fiche.
 *   Les photos ne quittent jamais l'appareil (§ 4, § 22). Un appareil qui reçoit une fiche sans avoir le fichier le dit (pas de ligne ici).
 *
 * Copie figée `CAPTURE_TABLES_V12` (jamais lue depuis le catalogue vivant), deux déclencheurs par table publiée sur le modèle de la 0011. Aucune
 * migration publiée n'est modifiée.
 */

/** Copie figée (version 12) des colonnes capturées : colonnes métier, `created_at` et `deleted_at` (ni `id`, ni `updated_at`, `device_id`, `hlc`). */
export const CAPTURE_TABLES_V12 = [
  ['measurement', ['date', 'kind', 'value', 'created_at', 'deleted_at']],
  ['progress_photo', ['date', 'file_name', 'created_at', 'deleted_at']],
] as const;

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

/** Modèle de la 0002 (et des 0006 à 0011) : un `_ai` (ligne entière) et un `_au` (champ par champ, `base_hlc`, `'+'` à la restauration). */
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

const [[MEASUREMENT, MEASUREMENT_COLUMNS], [PHOTO, PHOTO_COLUMNS]] = CAPTURE_TABLES_V12;

export const migration0012BodyProgress: Migration = {
  version: 12,
  name: 'body_progress',
  statements: [
    `CREATE TABLE measurement (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      kind TEXT NOT NULL CHECK (length(kind) BETWEEN 1 AND 32 AND kind NOT GLOB '*[^a-z_]*'),
      value REAL NOT NULL CHECK (typeof(value) IN ('real', 'integer') AND value > 0 AND value < 1000),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL,
      UNIQUE (date, kind),
      CHECK (id = 'measurement|' || date || '|' || kind)
    )`,
    `CREATE TABLE progress_photo (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      file_name TEXT NOT NULL CHECK (length(file_name) BETWEEN 1 AND 64 AND instr(file_name, '/') = 0 AND instr(file_name, char(92)) = 0 AND instr(file_name, '..') = 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL
    )`,
    'CREATE INDEX progress_photo_date_idx ON progress_photo (date)',
    `CREATE TABLE progress_photo_file (
      photo_id TEXT PRIMARY KEY NOT NULL,
      mime TEXT NOT NULL CHECK (mime = 'image/jpeg'),
      data TEXT NOT NULL CHECK (length(data) > 0 AND length(data) <= 3000000),
      saved_at TEXT NOT NULL
    )`,
    ...captureTriggers(MEASUREMENT, MEASUREMENT_COLUMNS),
    ...captureTriggers(PHOTO, PHOTO_COLUMNS),
  ],
};
