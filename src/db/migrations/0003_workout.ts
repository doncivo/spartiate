import type { Migration } from '../migrator';

/**
 * I1-02, séance active locale (PRD § 13, § 20.2–20.3 ; D-27, D-71).
 *
 * Deux tables, `workout` et `workout_set`, SANS déclencheur de capture de synchro et absentes de `SYNC_CATALOGUE` : une séance ouverte reste
 * locale et ne peut jamais être publiée (D-27). I1-03 ajoutera le catalogue, des déclencheurs gardés (séance close seulement) et la
 * publication atomique à la clôture, par une migration ultérieure ; les colonnes ci-dessous portent déjà ce qu'il faudra pour cela
 * (`id` UUID, `created_at`, `updated_at`, `deleted_at`, `device_id`, `hlc`, `ended_at`).
 *
 * Références logiques, sans clé étrangère : `routine_id`, `routine_day_id`, `copied_from_workout_id` (routine ou séance ensuite supprimée ou
 * non synchronisée) et `workout_set.exercise_id` (identifiant embarqué ou UUID personnalisé, `exercise_name` en fige le nom, D-71). Seule
 * `workout_set.workout_id` est une clé étrangère, sans CASCADE ni SET NULL : l'abandon d'une séance est une suppression logique.
 *
 * `rest_timer_end_at` est la date de fin (ISO UTC) du repos en cours ; le temps restant se recalcule toujours depuis elle. `workout_set.position`
 * est le rang de la série dans la séance. `done = 0` : série non validée, jamais comptée comme série de travail réussie.
 */
export const migration0003Workout: Migration = {
  version: 3,
  name: 'workout',
  statements: [
    `CREATE TABLE workout (
      id TEXT PRIMARY KEY NOT NULL,
      routine_id TEXT,
      routine_day_id TEXT,
      name TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      source TEXT NOT NULL CHECK (source IN ('empty', 'routine', 'copy')),
      copied_from_workout_id TEXT,
      rest_timer_end_at TEXT,
      rest_timer_seconds INTEGER NOT NULL DEFAULT 0 CHECK (rest_timer_seconds >= 0),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL
    )`,
    'CREATE INDEX idx_workout_open ON workout(started_at) WHERE ended_at IS NULL AND deleted_at IS NULL',
    'CREATE INDEX idx_workout_started ON workout(started_at)',
    `CREATE TABLE workout_set (
      id TEXT PRIMARY KEY NOT NULL,
      workout_id TEXT NOT NULL REFERENCES workout(id),
      exercise_id TEXT NOT NULL,
      exercise_name TEXT NOT NULL,
      position INTEGER NOT NULL CHECK (position >= 0),
      set_kind TEXT NOT NULL CHECK (set_kind IN ('warmup', 'work', 'drop', 'partial', 'timed')),
      target_reps_min INTEGER CHECK (target_reps_min >= 1),
      target_reps_max INTEGER,
      target_load_kg REAL CHECK (target_load_kg >= 0),
      target_rest_sec INTEGER CHECK (target_rest_sec >= 0),
      reps INTEGER CHECK (reps >= 1),
      load_kg REAL CHECK (load_kg >= 0),
      duration_sec INTEGER CHECK (duration_sec >= 1),
      rir INTEGER CHECK (rir BETWEEN 0 AND 5),
      done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
      done_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL,
      CHECK (target_reps_max IS NULL OR target_reps_min IS NULL OR target_reps_max >= target_reps_min)
    )`,
    'CREATE INDEX idx_workout_set_workout ON workout_set(workout_id, position, id)',
    'CREATE INDEX idx_workout_set_exercise ON workout_set(exercise_id, created_at)',
  ],
};
