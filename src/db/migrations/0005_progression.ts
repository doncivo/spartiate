import type { Migration } from '../migrator';

/**
 * I2-01, moteur de prescription (PRD § 11, § 20.2 ; D-72).
 *
 * - `progression_profile` : état RECALCULABLE par exercice (1RM estimé, confiance, dernier recalibrage « Facile »). Identifiant naturel
 *   `progression|<exercise_id>` (CHECK) : une seule ligne par exercice, même écrite par deux appareils ; `exercise_id` est une référence
 *   logique (exercice embarqué ou personnalisé, P-09), sans clé étrangère.
 * - `recommendation_decision` : trace d'une prescription présentée et de la valeur retenue par Ali (acceptée telle quelle ou modifiée,
 *   § 11.2 point 9). Identifiant UUID ; `workout_id` et `workout_set_id` sont des références logiques (séance ouverte, locale, D-27).
 *
 * Tables LOCALES en 0.3.0 : aucun déclencheur de capture, absentes de `SYNC_CATALOGUE`. Rien ne les écrit avant l'affichage (I2-01,
 * PR 2/2), qui ajoutera par une migration ultérieure la publication (catalogue, captures, identités) ; les colonnes portent déjà ce
 * qu'il faut pour cela (`created_at`, `updated_at`, `deleted_at`, `device_id`, `hlc`). Les colonnes JSON (`prescription`, `reasons`,
 * `chosen_reps`) sont écrites et relues par le repository seul (aucun CHECK `json_valid` : aucune migration ne dépend de JSON1). Aucune
 * migration publiée n'est modifiée.
 */
export const migration0005Progression: Migration = {
  version: 5,
  name: 'progression',
  statements: [
    `CREATE TABLE progression_profile (
      id TEXT PRIMARY KEY NOT NULL CHECK (id = 'progression|' || exercise_id),
      exercise_id TEXT NOT NULL CHECK (length(exercise_id) BETWEEN 1 AND 128),
      estimated_1rm_kg REAL CHECK (estimated_1rm_kg IS NULL OR estimated_1rm_kg > 0),
      confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
      last_easy_recalibration_at TEXT,
      engine_version INTEGER NOT NULL CHECK (engine_version >= 1),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL
    )`,
    `CREATE TABLE recommendation_decision (
      id TEXT PRIMARY KEY NOT NULL,
      exercise_id TEXT NOT NULL CHECK (length(exercise_id) BETWEEN 1 AND 128),
      workout_id TEXT,
      workout_set_id TEXT,
      engine_version INTEGER NOT NULL CHECK (engine_version >= 1),
      prescription TEXT NOT NULL,
      reasons TEXT NOT NULL,
      accepted INTEGER NOT NULL CHECK (accepted IN (0, 1)),
      chosen_load_kg REAL CHECK (chosen_load_kg IS NULL OR chosen_load_kg >= 0),
      chosen_reps TEXT NOT NULL,
      decided_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL
    )`,
    'CREATE INDEX idx_recommendation_decision_exercise ON recommendation_decision(exercise_id, decided_at)',
  ],
};
