import type { Migration } from '../migrator';

/**
 * I1-01, bibliothèque, matériel et routines (PRD § 14, § 20.2 ; D-25, D-26, D-71 ; P-09).
 *
 * Cinq tables publiées : `exercise` (exercices PERSONNALISÉS seulement, identifiant UUID ; les exercices embarqués n'ont aucune ligne),
 * `equipment_profile`, `routine`, `routine_day`, `routine_exercise`. `workout` et `workout_set` arrivent en 0003.
 *
 * Références logiques (P-09) : `routine_exercise.exercise_id` est une valeur opaque (identifiant du JSON embarqué ou UUID d'un exercice
 * personnalisé), SANS clé étrangère, et `exercise_name` en fige le nom (D-71). Seules les clés parent-enfant de la routine
 * (`routine_day.routine_id`, `routine_exercise.routine_day_id`) sont des clés étrangères, sans CASCADE ni SET NULL : les suppressions
 * sont logiques (`deleted_at`) et la synchro purge dans l'ordre des parents.
 *
 * `exercise.is_custom` est une colonne locale (toujours 1 : une ligne `is_custom = 0` n'est jamais stockée ni publiée) et ne figure dans
 * aucun déclencheur. Le profil de matériel actif est un réglage local (`settings`), pas une colonne.
 *
 * Déclencheurs de capture : copie figée (`CAPTURE_TABLES_V2`, jamais lue depuis le catalogue vivant) du modèle de la 0001, un `_ai` et un
 * `_au` par table. `src/domain/sync/catalogue.test.ts` / `0002_training.test.ts` vérifient copie = catalogue.
 */

/** Copie figée (version 2) des colonnes capturées, dans l'ordre du catalogue de synchro. */
export const CAPTURE_TABLES_V2 = [
  [
    'exercise',
    [
      'name_fr',
      'aliases_en',
      'muscles',
      'equipment',
      'pattern',
      'kind',
      'metric',
      'bodyweight_fraction',
      'default_rep_min',
      'default_rep_max',
      'default_rest_sec',
      'instructions',
      'media',
      'strength_standard_key',
      'schema_version',
      'created_at',
      'deleted_at',
    ],
  ],
  ['equipment_profile', ['name', 'kind', 'inventory', 'increments', 'created_at', 'deleted_at']],
  ['routine', ['name', 'mode', 'created_at', 'deleted_at']],
  ['routine_day', ['routine_id', 'name', 'day_order', 'created_at', 'deleted_at']],
  ['routine_exercise', ['routine_day_id', 'exercise_id', 'exercise_name', 'sets', 'rep_min', 'rep_max', 'rir', 'rest_sec', 'position', 'created_at', 'deleted_at']],
] as const;

function captureTriggers(table: string, columns: readonly string[]): string[] {
  const row = `table_name = '${table}' AND row_id = NEW.id`;
  const clock = (field: string): string => `(SELECT hlc FROM sync_field_clock WHERE ${row} AND field = '${field}')`;
  const changes = columns.flatMap((column) => [
    `INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT '${table}', NEW.id, '${column}', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE ${row} AND field IN ('${column}', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE ${row} AND field = '${column}')
           ELSE COALESCE(${clock(column)}, ${clock('*')}, OLD.hlc) END
       WHERE OLD.${column} IS NOT NEW.${column}
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;`,
    `DELETE FROM sync_outbox WHERE ${row} AND field = '${column}' AND OLD.${column} IS NOT NEW.${column};`,
    `INSERT INTO sync_outbox (table_name, row_id, field) SELECT '${table}', NEW.id, '${column}' WHERE OLD.${column} IS NOT NEW.${column};`,
  ]);
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
       ${changes.join('\n')}
       DELETE FROM sync_outbox WHERE ${row} AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT '${table}', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END`,
  ];
}

export const migration0002Training: Migration = {
  version: 2,
  name: 'training',
  statements: [
    `CREATE TABLE exercise (
      id TEXT PRIMARY KEY NOT NULL,
      name_fr TEXT NOT NULL,
      aliases_en TEXT NOT NULL,
      muscles TEXT NOT NULL,
      equipment TEXT NOT NULL,
      pattern TEXT NOT NULL,
      kind TEXT NOT NULL,
      metric TEXT NOT NULL,
      bodyweight_fraction REAL,
      default_rep_min INTEGER NOT NULL CHECK (default_rep_min >= 1),
      default_rep_max INTEGER NOT NULL,
      default_rest_sec INTEGER NOT NULL CHECK (default_rest_sec >= 0),
      instructions TEXT NOT NULL,
      media TEXT,
      strength_standard_key TEXT,
      is_custom INTEGER NOT NULL DEFAULT 1 CHECK (is_custom = 1),
      schema_version INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL,
      CHECK (default_rep_max >= default_rep_min)
    )`,
    `CREATE TABLE equipment_profile (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      inventory TEXT NOT NULL,
      increments TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL
    )`,
    `CREATE TABLE routine (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      mode TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL
    )`,
    `CREATE TABLE routine_day (
      id TEXT PRIMARY KEY NOT NULL,
      routine_id TEXT NOT NULL REFERENCES routine(id),
      name TEXT NOT NULL,
      day_order INTEGER NOT NULL CHECK (day_order >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL
    )`,
    'CREATE INDEX idx_routine_day_routine ON routine_day(routine_id, day_order)',
    `CREATE TABLE routine_exercise (
      id TEXT PRIMARY KEY NOT NULL,
      routine_day_id TEXT NOT NULL REFERENCES routine_day(id),
      exercise_id TEXT NOT NULL,
      exercise_name TEXT NOT NULL,
      sets INTEGER NOT NULL CHECK (sets >= 1),
      rep_min INTEGER NOT NULL CHECK (rep_min >= 1),
      rep_max INTEGER NOT NULL,
      rir INTEGER,
      rest_sec INTEGER NOT NULL CHECK (rest_sec >= 0),
      position INTEGER NOT NULL CHECK (position >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL,
      CHECK (rep_max >= rep_min)
    )`,
    'CREATE INDEX idx_routine_exercise_day ON routine_exercise(routine_day_id, position)',
    'CREATE INDEX idx_routine_exercise_exercise ON routine_exercise(exercise_id)',
    ...CAPTURE_TABLES_V2.flatMap(([table, columns]) => captureTriggers(table, columns)),
  ],
};
