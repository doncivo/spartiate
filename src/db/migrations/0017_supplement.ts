import type { Migration } from '../migrator';

/**
 * I6-05 (§ 15.3 ; D-210) : compléments. DEUX TABLES NEUVES, publiées, écrites par les deux appareils ; AUCUNE table existante n'est modifiée
 * (schéma strictement additif).
 *
 * - `supplement` : UUID ; nom de 1 à 80 caractères, dose facultative (> 0), unité facultative (1 à 16), heures de prise (tableau JSON de 1 à 4
 *   heures `HH:mm`, triées), jours (masque de 1 à 127 : lundi = 1 … dimanche = 64), actif ou en pause. Validation fine : `src/domain/nutrition/supplements.ts`.
 * - `supplement_intake` : prise cochée, identifiant naturel `intake|<complément>|<date>|<heure>` (CHECK) : la même prise cochée sur les deux appareils
 *   donne UNE ligne ; décocher = suppression logique. Lien logique au complément (comme `meal_entry` → `food`), sans clé étrangère.
 *
 * Copie figée `CAPTURE_TABLES_V17` (jamais lue depuis le catalogue vivant), deux déclencheurs par table sur le modèle de la 0016.
 */

/** Copie figée des colonnes capturées : colonnes métier, `created_at` et `deleted_at` (ni `id`, ni `updated_at`, `device_id`, `hlc`). */
export const CAPTURE_TABLES_V17 = [
  ['supplement', ['name', 'dose', 'unit', 'times', 'days', 'active', 'created_at', 'deleted_at']],
  ['supplement_intake', ['supplement_id', 'date', 'moment', 'taken_at', 'created_at', 'deleted_at']],
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

/** Modèle de la 0002 (et des 0006 à 0016) : un `_ai` (ligne entière) et un `_au` (champ par champ, `base_hlc`, `'+'` à la restauration). */
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

const [[SUPPLEMENT, SUPPLEMENT_COLUMNS], [INTAKE, INTAKE_COLUMNS]] = CAPTURE_TABLES_V17;

export const migration0017Supplement: Migration = {
  version: 17,
  name: 'supplement',
  statements: [
    `CREATE TABLE supplement (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
      dose REAL CHECK (dose IS NULL OR (typeof(dose) IN ('real', 'integer') AND dose > 0 AND dose <= 100000)),
      unit TEXT CHECK (unit IS NULL OR length(unit) BETWEEN 1 AND 16),
      times TEXT NOT NULL CHECK (json_valid(times) AND json_type(times) = 'array' AND json_array_length(times) BETWEEN 1 AND 4),
      days INTEGER NOT NULL CHECK (typeof(days) = 'integer' AND days BETWEEN 1 AND 127),
      active INTEGER NOT NULL CHECK (typeof(active) = 'integer' AND active IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL
    )`,
    'CREATE INDEX supplement_name_idx ON supplement (name)',
    `CREATE TABLE supplement_intake (
      id TEXT PRIMARY KEY NOT NULL,
      supplement_id TEXT NOT NULL CHECK (length(supplement_id) = 36 AND instr(supplement_id, '|') = 0),
      date TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
      moment TEXT NOT NULL CHECK (moment GLOB '[0-2][0-9]:[0-5][0-9]'),
      taken_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL,
      CHECK (id = 'intake|' || supplement_id || '|' || date || '|' || moment)
    )`,
    'CREATE INDEX supplement_intake_date_idx ON supplement_intake (date)',
    ...captureTriggers(SUPPLEMENT, SUPPLEMENT_COLUMNS),
    ...captureTriggers(INTAKE, INTAKE_COLUMNS),
  ],
};
