import type { Migration } from '../migrator';

/**
 * I2-01 (PR 2/2, 0.3.1) : difficulté de fin d'exercice et publication de la progression (PRD § 11, § 13.2, § 20.2 ; D-26, D-27, D-72).
 *
 * - `workout_set.difficulty` (`easy` | `ok` | `hard`, nulle par défaut) : ressenti Facile / Juste / Dur d'un exercice dans la séance, écrit
 *   sur ses séries. Séance ouverte : rien n'est capturé (D-27) ; la clôture met la ligne entière en file (`sync_workout_au`, 0004), difficulté
 *   comprise. Une correction après la clôture est capturée par un déclencheur PROPRE (`sync_workout_set_difficulty_au`, `AFTER UPDATE OF
 *   difficulty`), sur le modèle et avec la garde de `sync_workout_set_au` : le corps publié de la 0004 n'est pas modifié (aucun corps remplacé
 *   côté Rust). Les deux déclencheurs calculent la même horloge de base (`'*'`, sinon `OLD.hlc`), quel que soit l'ordre où SQLite les exécute.
 * - `progression_profile` et `recommendation_decision` (0005, locales en 0.3.0) deviennent publiées : un `_ai` et un `_au` chacune, copie
 *   figée `CAPTURE_TABLES_V6` du modèle de la 0002 (jamais lue depuis le catalogue vivant ; `0006_progression_sync.test.ts` vérifie copie =
 *   catalogue). Les lignes déjà écrites en 0.3.0 (aucune en pratique : rien ne les écrivait) partent en ligne entière.
 *
 * Aucune migration publiée n'est modifiée.
 */

/** Copie figée (version 6) des colonnes capturées des tables de progression, dans l'ordre du catalogue de synchro. */
export const CAPTURE_TABLES_V6 = [
  ['progression_profile', ['exercise_id', 'estimated_1rm_kg', 'confidence', 'last_easy_recalibration_at', 'engine_version', 'created_at', 'deleted_at']],
  [
    'recommendation_decision',
    ['exercise_id', 'workout_id', 'workout_set_id', 'engine_version', 'prescription', 'reasons', 'accepted', 'chosen_load_kg', 'chosen_reps', 'decided_at', 'created_at', 'deleted_at'],
  ],
] as const;

const fieldCapture = (table: string, column: string, guard: string): string[] => {
  const row = `table_name = '${table}' AND row_id = NEW.id`;
  const clock = (field: string): string => `(SELECT hlc FROM sync_field_clock WHERE ${row} AND field = '${field}')`;
  const g = guard === '' ? '' : ` AND ${guard}`;
  return [
    `INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT '${table}', NEW.id, '${column}', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE ${row} AND field IN ('${column}', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE ${row} AND field = '${column}')
           ELSE COALESCE(${clock(column)}, ${clock('*')}, OLD.hlc) END
       WHERE OLD.${column} IS NOT NEW.${column}${g}
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;`,
    `DELETE FROM sync_outbox WHERE ${row} AND field = '${column}' AND OLD.${column} IS NOT NEW.${column}${g};`,
    `INSERT INTO sync_outbox (table_name, row_id, field) SELECT '${table}', NEW.id, '${column}' WHERE OLD.${column} IS NOT NEW.${column}${g};`,
  ];
};

/** Modèle de la 0002 : un `_ai` (ligne entière) et un `_au` (champ par champ, `base_hlc`, `'+'` à la restauration). */
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
       ${columns.flatMap((column) => fieldCapture(table, column, '')).join('\n')}
       DELETE FROM sync_outbox WHERE ${row} AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT '${table}', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END`,
  ];
}

/** Garde de `sync_workout_set_au` (0004) : séance close seulement. */
const SET_OF_CLOSED_WORKOUT = '(SELECT ended_at FROM workout WHERE id = NEW.workout_id) IS NOT NULL';

const DIFFICULTY_TRIGGER = `CREATE TRIGGER sync_workout_set_difficulty_au AFTER UPDATE OF difficulty ON workout_set
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) AND ${SET_OF_CLOSED_WORKOUT} BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'workout_set', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*');
       ${fieldCapture('workout_set', 'difficulty', '').join('\n')}
     END`;

export const migration0006ProgressionSync: Migration = {
  version: 6,
  name: 'progression_sync',
  statements: [
    "ALTER TABLE workout_set ADD COLUMN difficulty TEXT CHECK (difficulty IS NULL OR difficulty IN ('easy', 'ok', 'hard'))",
    DIFFICULTY_TRIGGER,
    ...CAPTURE_TABLES_V6.flatMap(([table, columns]) => captureTriggers(table, columns)),
    // Lignes écrites en 0.3.0 (tables locales) : publiées en ligne entière, comme une insertion.
    "INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'progression_profile', id, '*' FROM progression_profile ORDER BY id",
    "INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recommendation_decision', id, '*' FROM recommendation_decision ORDER BY id",
  ],
};
