-- Généré par src/db/migrations/spartiateSchemaFixture.test.ts (UPDATE_SPARTIATE_FIXTURES=1) ; ne pas modifier à la main.
CREATE TABLE body_weight (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      kg REAL NOT NULL CHECK (kg > 0),
      source TEXT NOT NULL CHECK (source IN ('manual', 'health')),
      timezone TEXT NOT NULL,
      health_uuid TEXT,
      measured_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL,
      UNIQUE (date, source),
      CHECK (id = 'weight|' || date || '|' || source)
    );
CREATE TABLE conflict_log (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name       TEXT NOT NULL,
      row_id           TEXT NOT NULL,
      field            TEXT NOT NULL,
      kept_value       TEXT,
      discarded_value  TEXT,
      kept_device      TEXT,
      discarded_device TEXT,
      kept_hlc         TEXT,
      discarded_hlc    TEXT,
      detected_at      TEXT NOT NULL,
      resolved_at      TEXT,
      restored         INTEGER NOT NULL DEFAULT 0 CHECK (restored IN (0, 1))
    );
CREATE TABLE epoch_carry_report (id INTEGER PRIMARY KEY, epoch TEXT NOT NULL, cause TEXT NOT NULL CHECK (cause IN ('restore', 'concurrent', 'reset')), reporter TEXT NOT NULL, opener TEXT NOT NULL, mode TEXT NOT NULL CHECK (mode IN ('replace', 'merge')), authors TEXT NOT NULL, restored TEXT NOT NULL, recreated TEXT NOT NULL, parent_replaced TEXT NOT NULL, overflow INTEGER NOT NULL, overflow_by TEXT NOT NULL, banner INTEGER NOT NULL CHECK (banner IN (0, 1)), created_at TEXT NOT NULL, acknowledged_at TEXT);
CREATE TABLE equipment_profile (
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
    );
CREATE TABLE exercise (
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
    );
CREATE TABLE food (
      id TEXT PRIMARY KEY NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('custom', 'off')),
      barcode TEXT CHECK (barcode IS NULL OR (length(barcode) IN (8, 12, 13, 14) AND barcode NOT GLOB '*[^0-9]*')),
      name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
      brand TEXT CHECK (brand IS NULL OR length(brand) <= 120),
      kcal REAL CHECK (kcal IS NULL OR kcal BETWEEN 0 AND 900),
      protein_g REAL CHECK (protein_g IS NULL OR protein_g BETWEEN 0 AND 100),
      fat_g REAL CHECK (fat_g IS NULL OR fat_g BETWEEN 0 AND 100),
      carb_g REAL CHECK (carb_g IS NULL OR carb_g BETWEEN 0 AND 100),
      fiber_g REAL CHECK (fiber_g IS NULL OR fiber_g BETWEEN 0 AND 100),
      fetched_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL,
      CHECK (source = 'custom' OR (barcode IS NOT NULL AND fetched_at IS NOT NULL))
    );
CREATE TABLE food_portion (
      id TEXT PRIMARY KEY NOT NULL,
      food_id TEXT NOT NULL REFERENCES food(id),
      label TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 80),
      grams REAL NOT NULL CHECK (grams > 0 AND grams <= 5000),
      position INTEGER NOT NULL CHECK (position >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL
    );
CREATE TABLE meal_entry (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      time TEXT NOT NULL CHECK (time GLOB '[0-2][0-9]:[0-5][0-9]' AND time < '24:00'),
      food_id TEXT CHECK (food_id IS NULL OR length(food_id) BETWEEN 1 AND 128),
      food_name TEXT NOT NULL CHECK (length(food_name) BETWEEN 1 AND 200),
      source TEXT NOT NULL CHECK (source IN ('custom', 'ciqual', 'off', 'estimate', 'manual')),
      grams REAL CHECK (grams IS NULL OR grams > 0),
      kcal REAL CHECK (kcal IS NULL OR kcal >= 0),
      protein_g REAL CHECK (protein_g IS NULL OR protein_g >= 0),
      fat_g REAL CHECK (fat_g IS NULL OR fat_g >= 0),
      carb_g REAL CHECK (carb_g IS NULL OR carb_g >= 0),
      method TEXT NOT NULL CHECK (method IN ('search', 'scan', 'photo', 'quickadd')),
      confidence REAL CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL
    );
CREATE TABLE mesocycle (
      id TEXT PRIMARY KEY NOT NULL,
      routine_id TEXT NOT NULL CHECK (length(routine_id) BETWEEN 1 AND 128),
      start_date TEXT NOT NULL,
      weeks INTEGER NOT NULL CHECK (weeks BETWEEN 4 AND 7),
      unlimited INTEGER NOT NULL CHECK (unlimited IN (0, 1)),
      deload_week INTEGER CHECK (deload_week IS NULL OR deload_week >= 1),
      block_origin_week INTEGER NOT NULL CHECK (block_origin_week >= 1),
      block_origin_index INTEGER NOT NULL CHECK (block_origin_index >= 0),
      rotation_index INTEGER NOT NULL CHECK (rotation_index >= 0),
      pauses TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active', 'completed')),
      outcome TEXT CHECK (outcome IS NULL OR outcome IN ('repeat', 'regenerate', 'change', 'stopped')),
      ended_on TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL
    );
CREATE TABLE nutrition_target (
      id TEXT PRIMARY KEY NOT NULL,
      week_start TEXT NOT NULL CHECK (week_start GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      kcal REAL NOT NULL CHECK (kcal > 0),
      protein_g REAL NOT NULL CHECK (protein_g >= 0),
      fat_g REAL NOT NULL CHECK (fat_g >= 0),
      carb_g REAL NOT NULL CHECK (carb_g >= 0),
      source TEXT NOT NULL CHECK (source IN ('auto', 'manual')),
      accepted INTEGER NOT NULL CHECK (accepted IN (0, 1)),
      engine_version INTEGER CHECK (engine_version IS NULL OR engine_version >= 1),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL
    );
CREATE TABLE profile (
      id TEXT PRIMARY KEY NOT NULL CHECK (id = 'profile|singleton'),
      sex TEXT,
      birth_year INTEGER,
      height_cm REAL,
      goal TEXT,
      experience TEXT,
      units TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL
    );
CREATE TABLE progression_profile (
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
    );
CREATE TABLE recommendation_decision (
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
    );
CREATE TABLE routine (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      mode TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL
    );
CREATE TABLE routine_day (
      id TEXT PRIMARY KEY NOT NULL,
      routine_id TEXT NOT NULL REFERENCES routine(id),
      name TEXT NOT NULL,
      day_order INTEGER NOT NULL CHECK (day_order >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL
    );
CREATE TABLE routine_exercise (
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
    );
CREATE TABLE schema_migrations (
  version    INTEGER PRIMARY KEY,
  name       TEXT    NOT NULL,
  checksum   TEXT    NOT NULL,
  applied_at TEXT    NOT NULL
);
CREATE TABLE settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      device_id  TEXT NOT NULL,
      hlc        TEXT NOT NULL
    );
CREATE TABLE sync_field_clock (
      table_name TEXT NOT NULL,
      row_id     TEXT NOT NULL,
      field      TEXT NOT NULL,
      hlc        TEXT NOT NULL,
      base_hlc   TEXT,
      PRIMARY KEY (table_name, row_id, field)
    );
CREATE TABLE sync_guard (id INTEGER PRIMARY KEY);
CREATE TABLE sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE sync_outbox (
      seq        INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      row_id     TEXT NOT NULL,
      field      TEXT NOT NULL,
      UNIQUE (table_name, row_id, field)
    );
CREATE TABLE sync_parked (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      reason     TEXT NOT NULL CHECK (reason IN ('missing-parent', 'missing-row', 'epoch-carry')),
      table_name TEXT NOT NULL,
      row_id     TEXT NOT NULL,
      hlc        TEXT NOT NULL,
      op         TEXT NOT NULL,
      parked_at  TEXT NOT NULL
    );
CREATE TABLE sync_state (
      device_id      TEXT PRIMARY KEY,
      is_self        INTEGER NOT NULL DEFAULT 0 CHECK (is_self IN (0, 1)),
      platform       TEXT,
      app_version    TEXT,
      epoch          TEXT,
      cursor_segment INTEGER NOT NULL DEFAULT 0,
      cursor_record  INTEGER NOT NULL DEFAULT 0,
      ack_hlc        TEXT,
      head_segment   INTEGER NOT NULL DEFAULT 0,
      head_record    INTEGER NOT NULL DEFAULT 0,
      head_hlc       TEXT,
      state_epoch    TEXT,
      state_seq      INTEGER NOT NULL DEFAULT 0,
      state_digest   TEXT,
      last_acks      TEXT NOT NULL DEFAULT '{}',
      last_seen_hlc  TEXT,
      last_sync_at   TEXT,
      schema_version INTEGER,
      format_major   INTEGER,
      kid            TEXT,
      purge_horizon  TEXT,
      snapshot_seq   INTEGER,
      snapshot_hlc   TEXT,
      status         TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'expired', 'newer-major', 'clock-ahead', 'corrupt', 'foreign', 'rollback', 'forgotten'))
    );
CREATE TABLE sync_tombstone (
      table_name  TEXT NOT NULL,
      row_id      TEXT NOT NULL,
      deleted_hlc TEXT NOT NULL,
      purged_at   TEXT NOT NULL,
      PRIMARY KEY (table_name, row_id)
    );
CREATE TABLE sync_unknown (
      table_name TEXT NOT NULL,
      row_id     TEXT NOT NULL,
      field      TEXT NOT NULL,
      value      TEXT,
      hlc        TEXT NOT NULL,
      base_hlc   TEXT,
      sv         INTEGER NOT NULL,
      PRIMARY KEY (table_name, row_id, field)
    );
CREATE TABLE workout (
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
    );
CREATE TABLE workout_set (
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
      hlc TEXT NOT NULL, corrected_at TEXT, difficulty TEXT CHECK (difficulty IS NULL OR difficulty IN ('easy', 'ok', 'hard')),
      CHECK (target_reps_max IS NULL OR target_reps_min IS NULL OR target_reps_max >= target_reps_min)
    );
CREATE INDEX idx_body_weight_date ON body_weight(date);
CREATE INDEX idx_conflict_log_detected_at ON conflict_log(detected_at);
CREATE INDEX idx_conflict_log_row ON conflict_log(table_name, row_id, field);
CREATE INDEX idx_food_barcode ON food(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_food_name ON food(name COLLATE NOCASE);
CREATE INDEX idx_food_portion_food ON food_portion(food_id, position);
CREATE INDEX idx_meal_entry_date ON meal_entry(date, time);
CREATE INDEX idx_meal_entry_food ON meal_entry(food_id, date) WHERE food_id IS NOT NULL;
CREATE INDEX idx_mesocycle_status ON mesocycle(status, start_date);
CREATE INDEX idx_nutrition_target_week ON nutrition_target(week_start);
CREATE INDEX idx_recommendation_decision_exercise ON recommendation_decision(exercise_id, decided_at);
CREATE INDEX idx_routine_day_routine ON routine_day(routine_id, day_order);
CREATE INDEX idx_routine_exercise_day ON routine_exercise(routine_day_id, position);
CREATE INDEX idx_routine_exercise_exercise ON routine_exercise(exercise_id);
CREATE INDEX idx_settings_hlc ON settings(hlc);
CREATE INDEX idx_sync_field_clock_hlc ON sync_field_clock(hlc);
CREATE INDEX idx_sync_parked_reason ON sync_parked(reason, id);
CREATE INDEX idx_sync_parked_row ON sync_parked(reason, table_name, row_id);
CREATE INDEX idx_sync_tombstone_hlc ON sync_tombstone(deleted_hlc);
CREATE INDEX idx_workout_ended ON workout(ended_at) WHERE ended_at IS NOT NULL;
CREATE INDEX idx_workout_open ON workout(started_at) WHERE ended_at IS NULL AND deleted_at IS NULL;
CREATE INDEX idx_workout_set_exercise ON workout_set(exercise_id, created_at);
CREATE INDEX idx_workout_set_workout ON workout_set(workout_id, position, id);
CREATE INDEX idx_workout_started ON workout(started_at);
CREATE TRIGGER sync_body_weight_ai AFTER INSERT ON body_weight
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'body_weight' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('body_weight', NEW.id, '*');
     END;
CREATE TRIGGER sync_body_weight_au AFTER UPDATE ON body_weight
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'body_weight', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'body_weight', NEW.id, 'date', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field IN ('date', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'date')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'date'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.date IS NOT NEW.date
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'date' AND OLD.date IS NOT NEW.date;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'body_weight', NEW.id, 'date' WHERE OLD.date IS NOT NEW.date;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'body_weight', NEW.id, 'kg', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field IN ('kg', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'kg')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'kg'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.kg IS NOT NEW.kg
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'kg' AND OLD.kg IS NOT NEW.kg;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'body_weight', NEW.id, 'kg' WHERE OLD.kg IS NOT NEW.kg;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'body_weight', NEW.id, 'source', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field IN ('source', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'source')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'source'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.source IS NOT NEW.source
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'source' AND OLD.source IS NOT NEW.source;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'body_weight', NEW.id, 'source' WHERE OLD.source IS NOT NEW.source;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'body_weight', NEW.id, 'timezone', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field IN ('timezone', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'timezone')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'timezone'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.timezone IS NOT NEW.timezone
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'timezone' AND OLD.timezone IS NOT NEW.timezone;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'body_weight', NEW.id, 'timezone' WHERE OLD.timezone IS NOT NEW.timezone;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'body_weight', NEW.id, 'health_uuid', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field IN ('health_uuid', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'health_uuid')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'health_uuid'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.health_uuid IS NOT NEW.health_uuid
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'health_uuid' AND OLD.health_uuid IS NOT NEW.health_uuid;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'body_weight', NEW.id, 'health_uuid' WHERE OLD.health_uuid IS NOT NEW.health_uuid;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'body_weight', NEW.id, 'measured_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field IN ('measured_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'measured_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'measured_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.measured_at IS NOT NEW.measured_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'measured_at' AND OLD.measured_at IS NOT NEW.measured_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'body_weight', NEW.id, 'measured_at' WHERE OLD.measured_at IS NOT NEW.measured_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'body_weight', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'body_weight', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'body_weight', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'body_weight', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'body_weight', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END;
CREATE TRIGGER sync_equipment_profile_ai AFTER INSERT ON equipment_profile
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'equipment_profile' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('equipment_profile', NEW.id, '*');
     END;
CREATE TRIGGER sync_equipment_profile_au AFTER UPDATE ON equipment_profile
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'equipment_profile', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'equipment_profile', NEW.id, 'name', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field IN ('name', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'name')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'name'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.name IS NOT NEW.name
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'name' AND OLD.name IS NOT NEW.name;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'equipment_profile', NEW.id, 'name' WHERE OLD.name IS NOT NEW.name;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'equipment_profile', NEW.id, 'kind', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field IN ('kind', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'kind')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'kind'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.kind IS NOT NEW.kind
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'kind' AND OLD.kind IS NOT NEW.kind;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'equipment_profile', NEW.id, 'kind' WHERE OLD.kind IS NOT NEW.kind;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'equipment_profile', NEW.id, 'inventory', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field IN ('inventory', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'inventory')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'inventory'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.inventory IS NOT NEW.inventory
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'inventory' AND OLD.inventory IS NOT NEW.inventory;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'equipment_profile', NEW.id, 'inventory' WHERE OLD.inventory IS NOT NEW.inventory;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'equipment_profile', NEW.id, 'increments', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field IN ('increments', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'increments')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'increments'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.increments IS NOT NEW.increments
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'increments' AND OLD.increments IS NOT NEW.increments;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'equipment_profile', NEW.id, 'increments' WHERE OLD.increments IS NOT NEW.increments;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'equipment_profile', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'equipment_profile', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'equipment_profile', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'equipment_profile', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'equipment_profile', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END;
CREATE TRIGGER sync_exercise_ai AFTER INSERT ON exercise
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'exercise' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('exercise', NEW.id, '*');
     END;
CREATE TRIGGER sync_exercise_au AFTER UPDATE ON exercise
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'exercise', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'name_fr', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('name_fr', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'name_fr')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'name_fr'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.name_fr IS NOT NEW.name_fr
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'name_fr' AND OLD.name_fr IS NOT NEW.name_fr;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'name_fr' WHERE OLD.name_fr IS NOT NEW.name_fr;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'aliases_en', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('aliases_en', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'aliases_en')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'aliases_en'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.aliases_en IS NOT NEW.aliases_en
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'aliases_en' AND OLD.aliases_en IS NOT NEW.aliases_en;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'aliases_en' WHERE OLD.aliases_en IS NOT NEW.aliases_en;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'muscles', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('muscles', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'muscles')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'muscles'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.muscles IS NOT NEW.muscles
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'muscles' AND OLD.muscles IS NOT NEW.muscles;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'muscles' WHERE OLD.muscles IS NOT NEW.muscles;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'equipment', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('equipment', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'equipment')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'equipment'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.equipment IS NOT NEW.equipment
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'equipment' AND OLD.equipment IS NOT NEW.equipment;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'equipment' WHERE OLD.equipment IS NOT NEW.equipment;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'pattern', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('pattern', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'pattern')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'pattern'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.pattern IS NOT NEW.pattern
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'pattern' AND OLD.pattern IS NOT NEW.pattern;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'pattern' WHERE OLD.pattern IS NOT NEW.pattern;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'kind', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('kind', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'kind')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'kind'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.kind IS NOT NEW.kind
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'kind' AND OLD.kind IS NOT NEW.kind;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'kind' WHERE OLD.kind IS NOT NEW.kind;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'metric', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('metric', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'metric')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'metric'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.metric IS NOT NEW.metric
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'metric' AND OLD.metric IS NOT NEW.metric;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'metric' WHERE OLD.metric IS NOT NEW.metric;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'bodyweight_fraction', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('bodyweight_fraction', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'bodyweight_fraction')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'bodyweight_fraction'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.bodyweight_fraction IS NOT NEW.bodyweight_fraction
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'bodyweight_fraction' AND OLD.bodyweight_fraction IS NOT NEW.bodyweight_fraction;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'bodyweight_fraction' WHERE OLD.bodyweight_fraction IS NOT NEW.bodyweight_fraction;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'default_rep_min', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('default_rep_min', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'default_rep_min')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'default_rep_min'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.default_rep_min IS NOT NEW.default_rep_min
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'default_rep_min' AND OLD.default_rep_min IS NOT NEW.default_rep_min;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'default_rep_min' WHERE OLD.default_rep_min IS NOT NEW.default_rep_min;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'default_rep_max', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('default_rep_max', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'default_rep_max')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'default_rep_max'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.default_rep_max IS NOT NEW.default_rep_max
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'default_rep_max' AND OLD.default_rep_max IS NOT NEW.default_rep_max;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'default_rep_max' WHERE OLD.default_rep_max IS NOT NEW.default_rep_max;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'default_rest_sec', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('default_rest_sec', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'default_rest_sec')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'default_rest_sec'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.default_rest_sec IS NOT NEW.default_rest_sec
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'default_rest_sec' AND OLD.default_rest_sec IS NOT NEW.default_rest_sec;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'default_rest_sec' WHERE OLD.default_rest_sec IS NOT NEW.default_rest_sec;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'instructions', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('instructions', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'instructions')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'instructions'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.instructions IS NOT NEW.instructions
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'instructions' AND OLD.instructions IS NOT NEW.instructions;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'instructions' WHERE OLD.instructions IS NOT NEW.instructions;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'media', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('media', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'media')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'media'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.media IS NOT NEW.media
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'media' AND OLD.media IS NOT NEW.media;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'media' WHERE OLD.media IS NOT NEW.media;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'strength_standard_key', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('strength_standard_key', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'strength_standard_key')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'strength_standard_key'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.strength_standard_key IS NOT NEW.strength_standard_key
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'strength_standard_key' AND OLD.strength_standard_key IS NOT NEW.strength_standard_key;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'strength_standard_key' WHERE OLD.strength_standard_key IS NOT NEW.strength_standard_key;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'schema_version', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('schema_version', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'schema_version')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'schema_version'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.schema_version IS NOT NEW.schema_version
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'schema_version' AND OLD.schema_version IS NOT NEW.schema_version;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'schema_version' WHERE OLD.schema_version IS NOT NEW.schema_version;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END;
CREATE TRIGGER sync_food_ai AFTER INSERT ON food
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'food' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('food', NEW.id, '*');
     END;
CREATE TRIGGER sync_food_au AFTER UPDATE ON food
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'food', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food', NEW.id, 'source', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field IN ('source', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'source')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'source'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.source IS NOT NEW.source
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field = 'source' AND OLD.source IS NOT NEW.source;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food', NEW.id, 'source' WHERE OLD.source IS NOT NEW.source;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food', NEW.id, 'barcode', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field IN ('barcode', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'barcode')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'barcode'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.barcode IS NOT NEW.barcode
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field = 'barcode' AND OLD.barcode IS NOT NEW.barcode;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food', NEW.id, 'barcode' WHERE OLD.barcode IS NOT NEW.barcode;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food', NEW.id, 'name', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field IN ('name', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'name')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'name'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.name IS NOT NEW.name
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field = 'name' AND OLD.name IS NOT NEW.name;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food', NEW.id, 'name' WHERE OLD.name IS NOT NEW.name;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food', NEW.id, 'brand', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field IN ('brand', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'brand')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'brand'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.brand IS NOT NEW.brand
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field = 'brand' AND OLD.brand IS NOT NEW.brand;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food', NEW.id, 'brand' WHERE OLD.brand IS NOT NEW.brand;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food', NEW.id, 'kcal', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field IN ('kcal', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'kcal')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'kcal'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.kcal IS NOT NEW.kcal
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field = 'kcal' AND OLD.kcal IS NOT NEW.kcal;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food', NEW.id, 'kcal' WHERE OLD.kcal IS NOT NEW.kcal;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food', NEW.id, 'protein_g', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field IN ('protein_g', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'protein_g')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'protein_g'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.protein_g IS NOT NEW.protein_g
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field = 'protein_g' AND OLD.protein_g IS NOT NEW.protein_g;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food', NEW.id, 'protein_g' WHERE OLD.protein_g IS NOT NEW.protein_g;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food', NEW.id, 'fat_g', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field IN ('fat_g', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'fat_g')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'fat_g'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.fat_g IS NOT NEW.fat_g
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field = 'fat_g' AND OLD.fat_g IS NOT NEW.fat_g;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food', NEW.id, 'fat_g' WHERE OLD.fat_g IS NOT NEW.fat_g;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food', NEW.id, 'carb_g', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field IN ('carb_g', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'carb_g')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'carb_g'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.carb_g IS NOT NEW.carb_g
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field = 'carb_g' AND OLD.carb_g IS NOT NEW.carb_g;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food', NEW.id, 'carb_g' WHERE OLD.carb_g IS NOT NEW.carb_g;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food', NEW.id, 'fiber_g', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field IN ('fiber_g', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'fiber_g')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'fiber_g'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.fiber_g IS NOT NEW.fiber_g
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field = 'fiber_g' AND OLD.fiber_g IS NOT NEW.fiber_g;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food', NEW.id, 'fiber_g' WHERE OLD.fiber_g IS NOT NEW.fiber_g;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food', NEW.id, 'fetched_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field IN ('fetched_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'fetched_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'fetched_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.fetched_at IS NOT NEW.fetched_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field = 'fetched_at' AND OLD.fetched_at IS NOT NEW.fetched_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food', NEW.id, 'fetched_at' WHERE OLD.fetched_at IS NOT NEW.fetched_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END;
CREATE TRIGGER sync_food_portion_ai AFTER INSERT ON food_portion
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'food_portion' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('food_portion', NEW.id, '*');
     END;
CREATE TRIGGER sync_food_portion_au AFTER UPDATE ON food_portion
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'food_portion', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food_portion', NEW.id, 'food_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food_portion' AND row_id = NEW.id AND field IN ('food_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'food_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'food_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.food_id IS NOT NEW.food_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'food_id' AND OLD.food_id IS NOT NEW.food_id;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food_portion', NEW.id, 'food_id' WHERE OLD.food_id IS NOT NEW.food_id;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food_portion', NEW.id, 'label', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food_portion' AND row_id = NEW.id AND field IN ('label', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'label')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'label'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.label IS NOT NEW.label
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'label' AND OLD.label IS NOT NEW.label;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food_portion', NEW.id, 'label' WHERE OLD.label IS NOT NEW.label;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food_portion', NEW.id, 'grams', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food_portion' AND row_id = NEW.id AND field IN ('grams', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'grams')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'grams'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.grams IS NOT NEW.grams
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'grams' AND OLD.grams IS NOT NEW.grams;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food_portion', NEW.id, 'grams' WHERE OLD.grams IS NOT NEW.grams;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food_portion', NEW.id, 'position', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food_portion' AND row_id = NEW.id AND field IN ('position', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'position')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'position'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.position IS NOT NEW.position
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'position' AND OLD.position IS NOT NEW.position;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food_portion', NEW.id, 'position' WHERE OLD.position IS NOT NEW.position;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food_portion', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food_portion' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food_portion', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food_portion', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food_portion' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food_portion', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food_portion', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END;
CREATE TRIGGER sync_meal_entry_ai AFTER INSERT ON meal_entry
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'meal_entry' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('meal_entry', NEW.id, '*');
     END;
CREATE TRIGGER sync_meal_entry_au AFTER UPDATE ON meal_entry
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'meal_entry', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'meal_entry', NEW.id, 'date', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field IN ('date', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'date')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'date'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.date IS NOT NEW.date
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'date' AND OLD.date IS NOT NEW.date;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'meal_entry', NEW.id, 'date' WHERE OLD.date IS NOT NEW.date;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'meal_entry', NEW.id, 'time', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field IN ('time', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'time')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'time'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.time IS NOT NEW.time
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'time' AND OLD.time IS NOT NEW.time;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'meal_entry', NEW.id, 'time' WHERE OLD.time IS NOT NEW.time;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'meal_entry', NEW.id, 'food_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field IN ('food_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'food_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'food_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.food_id IS NOT NEW.food_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'food_id' AND OLD.food_id IS NOT NEW.food_id;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'meal_entry', NEW.id, 'food_id' WHERE OLD.food_id IS NOT NEW.food_id;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'meal_entry', NEW.id, 'food_name', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field IN ('food_name', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'food_name')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'food_name'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.food_name IS NOT NEW.food_name
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'food_name' AND OLD.food_name IS NOT NEW.food_name;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'meal_entry', NEW.id, 'food_name' WHERE OLD.food_name IS NOT NEW.food_name;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'meal_entry', NEW.id, 'source', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field IN ('source', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'source')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'source'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.source IS NOT NEW.source
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'source' AND OLD.source IS NOT NEW.source;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'meal_entry', NEW.id, 'source' WHERE OLD.source IS NOT NEW.source;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'meal_entry', NEW.id, 'grams', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field IN ('grams', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'grams')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'grams'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.grams IS NOT NEW.grams
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'grams' AND OLD.grams IS NOT NEW.grams;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'meal_entry', NEW.id, 'grams' WHERE OLD.grams IS NOT NEW.grams;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'meal_entry', NEW.id, 'kcal', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field IN ('kcal', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'kcal')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'kcal'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.kcal IS NOT NEW.kcal
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'kcal' AND OLD.kcal IS NOT NEW.kcal;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'meal_entry', NEW.id, 'kcal' WHERE OLD.kcal IS NOT NEW.kcal;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'meal_entry', NEW.id, 'protein_g', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field IN ('protein_g', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'protein_g')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'protein_g'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.protein_g IS NOT NEW.protein_g
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'protein_g' AND OLD.protein_g IS NOT NEW.protein_g;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'meal_entry', NEW.id, 'protein_g' WHERE OLD.protein_g IS NOT NEW.protein_g;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'meal_entry', NEW.id, 'fat_g', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field IN ('fat_g', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'fat_g')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'fat_g'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.fat_g IS NOT NEW.fat_g
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'fat_g' AND OLD.fat_g IS NOT NEW.fat_g;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'meal_entry', NEW.id, 'fat_g' WHERE OLD.fat_g IS NOT NEW.fat_g;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'meal_entry', NEW.id, 'carb_g', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field IN ('carb_g', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'carb_g')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'carb_g'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.carb_g IS NOT NEW.carb_g
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'carb_g' AND OLD.carb_g IS NOT NEW.carb_g;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'meal_entry', NEW.id, 'carb_g' WHERE OLD.carb_g IS NOT NEW.carb_g;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'meal_entry', NEW.id, 'method', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field IN ('method', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'method')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'method'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.method IS NOT NEW.method
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'method' AND OLD.method IS NOT NEW.method;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'meal_entry', NEW.id, 'method' WHERE OLD.method IS NOT NEW.method;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'meal_entry', NEW.id, 'confidence', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field IN ('confidence', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'confidence')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'confidence'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.confidence IS NOT NEW.confidence
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'confidence' AND OLD.confidence IS NOT NEW.confidence;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'meal_entry', NEW.id, 'confidence' WHERE OLD.confidence IS NOT NEW.confidence;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'meal_entry', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'meal_entry', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'meal_entry', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'meal_entry', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'meal_entry', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END;
CREATE TRIGGER sync_mesocycle_ai AFTER INSERT ON mesocycle
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'mesocycle' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('mesocycle', NEW.id, '*');
     END;
CREATE TRIGGER sync_mesocycle_au AFTER UPDATE ON mesocycle
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'mesocycle', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'mesocycle', NEW.id, 'routine_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field IN ('routine_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'routine_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'routine_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.routine_id IS NOT NEW.routine_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'routine_id' AND OLD.routine_id IS NOT NEW.routine_id;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'mesocycle', NEW.id, 'routine_id' WHERE OLD.routine_id IS NOT NEW.routine_id;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'mesocycle', NEW.id, 'start_date', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field IN ('start_date', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'start_date')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'start_date'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.start_date IS NOT NEW.start_date
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'start_date' AND OLD.start_date IS NOT NEW.start_date;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'mesocycle', NEW.id, 'start_date' WHERE OLD.start_date IS NOT NEW.start_date;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'mesocycle', NEW.id, 'weeks', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field IN ('weeks', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'weeks')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'weeks'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.weeks IS NOT NEW.weeks
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'weeks' AND OLD.weeks IS NOT NEW.weeks;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'mesocycle', NEW.id, 'weeks' WHERE OLD.weeks IS NOT NEW.weeks;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'mesocycle', NEW.id, 'unlimited', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field IN ('unlimited', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'unlimited')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'unlimited'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.unlimited IS NOT NEW.unlimited
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'unlimited' AND OLD.unlimited IS NOT NEW.unlimited;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'mesocycle', NEW.id, 'unlimited' WHERE OLD.unlimited IS NOT NEW.unlimited;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'mesocycle', NEW.id, 'deload_week', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field IN ('deload_week', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'deload_week')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'deload_week'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deload_week IS NOT NEW.deload_week
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'deload_week' AND OLD.deload_week IS NOT NEW.deload_week;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'mesocycle', NEW.id, 'deload_week' WHERE OLD.deload_week IS NOT NEW.deload_week;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'mesocycle', NEW.id, 'block_origin_week', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field IN ('block_origin_week', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'block_origin_week')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'block_origin_week'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.block_origin_week IS NOT NEW.block_origin_week
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'block_origin_week' AND OLD.block_origin_week IS NOT NEW.block_origin_week;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'mesocycle', NEW.id, 'block_origin_week' WHERE OLD.block_origin_week IS NOT NEW.block_origin_week;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'mesocycle', NEW.id, 'block_origin_index', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field IN ('block_origin_index', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'block_origin_index')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'block_origin_index'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.block_origin_index IS NOT NEW.block_origin_index
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'block_origin_index' AND OLD.block_origin_index IS NOT NEW.block_origin_index;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'mesocycle', NEW.id, 'block_origin_index' WHERE OLD.block_origin_index IS NOT NEW.block_origin_index;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'mesocycle', NEW.id, 'rotation_index', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field IN ('rotation_index', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'rotation_index')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'rotation_index'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.rotation_index IS NOT NEW.rotation_index
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'rotation_index' AND OLD.rotation_index IS NOT NEW.rotation_index;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'mesocycle', NEW.id, 'rotation_index' WHERE OLD.rotation_index IS NOT NEW.rotation_index;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'mesocycle', NEW.id, 'pauses', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field IN ('pauses', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'pauses')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'pauses'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.pauses IS NOT NEW.pauses
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'pauses' AND OLD.pauses IS NOT NEW.pauses;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'mesocycle', NEW.id, 'pauses' WHERE OLD.pauses IS NOT NEW.pauses;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'mesocycle', NEW.id, 'status', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field IN ('status', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'status')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'status'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.status IS NOT NEW.status
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'status' AND OLD.status IS NOT NEW.status;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'mesocycle', NEW.id, 'status' WHERE OLD.status IS NOT NEW.status;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'mesocycle', NEW.id, 'outcome', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field IN ('outcome', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'outcome')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'outcome'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.outcome IS NOT NEW.outcome
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'outcome' AND OLD.outcome IS NOT NEW.outcome;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'mesocycle', NEW.id, 'outcome' WHERE OLD.outcome IS NOT NEW.outcome;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'mesocycle', NEW.id, 'ended_on', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field IN ('ended_on', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'ended_on')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'ended_on'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.ended_on IS NOT NEW.ended_on
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'ended_on' AND OLD.ended_on IS NOT NEW.ended_on;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'mesocycle', NEW.id, 'ended_on' WHERE OLD.ended_on IS NOT NEW.ended_on;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'mesocycle', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'mesocycle', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'mesocycle', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'mesocycle', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'mesocycle', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END;
CREATE TRIGGER sync_nutrition_target_ai AFTER INSERT ON nutrition_target
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'nutrition_target' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('nutrition_target', NEW.id, '*');
     END;
CREATE TRIGGER sync_nutrition_target_au AFTER UPDATE ON nutrition_target
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'nutrition_target', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'nutrition_target', NEW.id, 'week_start', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field IN ('week_start', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'week_start')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'week_start'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.week_start IS NOT NEW.week_start
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'week_start' AND OLD.week_start IS NOT NEW.week_start;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'nutrition_target', NEW.id, 'week_start' WHERE OLD.week_start IS NOT NEW.week_start;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'nutrition_target', NEW.id, 'kcal', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field IN ('kcal', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'kcal')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'kcal'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.kcal IS NOT NEW.kcal
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'kcal' AND OLD.kcal IS NOT NEW.kcal;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'nutrition_target', NEW.id, 'kcal' WHERE OLD.kcal IS NOT NEW.kcal;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'nutrition_target', NEW.id, 'protein_g', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field IN ('protein_g', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'protein_g')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'protein_g'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.protein_g IS NOT NEW.protein_g
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'protein_g' AND OLD.protein_g IS NOT NEW.protein_g;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'nutrition_target', NEW.id, 'protein_g' WHERE OLD.protein_g IS NOT NEW.protein_g;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'nutrition_target', NEW.id, 'fat_g', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field IN ('fat_g', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'fat_g')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'fat_g'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.fat_g IS NOT NEW.fat_g
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'fat_g' AND OLD.fat_g IS NOT NEW.fat_g;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'nutrition_target', NEW.id, 'fat_g' WHERE OLD.fat_g IS NOT NEW.fat_g;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'nutrition_target', NEW.id, 'carb_g', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field IN ('carb_g', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'carb_g')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'carb_g'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.carb_g IS NOT NEW.carb_g
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'carb_g' AND OLD.carb_g IS NOT NEW.carb_g;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'nutrition_target', NEW.id, 'carb_g' WHERE OLD.carb_g IS NOT NEW.carb_g;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'nutrition_target', NEW.id, 'source', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field IN ('source', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'source')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'source'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.source IS NOT NEW.source
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'source' AND OLD.source IS NOT NEW.source;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'nutrition_target', NEW.id, 'source' WHERE OLD.source IS NOT NEW.source;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'nutrition_target', NEW.id, 'accepted', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field IN ('accepted', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'accepted')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'accepted'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.accepted IS NOT NEW.accepted
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'accepted' AND OLD.accepted IS NOT NEW.accepted;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'nutrition_target', NEW.id, 'accepted' WHERE OLD.accepted IS NOT NEW.accepted;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'nutrition_target', NEW.id, 'engine_version', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field IN ('engine_version', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'engine_version')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'engine_version'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.engine_version IS NOT NEW.engine_version
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'engine_version' AND OLD.engine_version IS NOT NEW.engine_version;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'nutrition_target', NEW.id, 'engine_version' WHERE OLD.engine_version IS NOT NEW.engine_version;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'nutrition_target', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'nutrition_target', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'nutrition_target', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'nutrition_target', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'nutrition_target', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END;
CREATE TRIGGER sync_profile_ai AFTER INSERT ON profile
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'profile' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('profile', NEW.id, '*');
     END;
CREATE TRIGGER sync_profile_au AFTER UPDATE ON profile
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'profile', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'profile', NEW.id, 'sex', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field IN ('sex', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'sex')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'sex'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.sex IS NOT NEW.sex
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'sex' AND OLD.sex IS NOT NEW.sex;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'profile', NEW.id, 'sex' WHERE OLD.sex IS NOT NEW.sex;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'profile', NEW.id, 'birth_year', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field IN ('birth_year', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'birth_year')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'birth_year'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.birth_year IS NOT NEW.birth_year
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'birth_year' AND OLD.birth_year IS NOT NEW.birth_year;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'profile', NEW.id, 'birth_year' WHERE OLD.birth_year IS NOT NEW.birth_year;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'profile', NEW.id, 'height_cm', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field IN ('height_cm', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'height_cm')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'height_cm'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.height_cm IS NOT NEW.height_cm
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'height_cm' AND OLD.height_cm IS NOT NEW.height_cm;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'profile', NEW.id, 'height_cm' WHERE OLD.height_cm IS NOT NEW.height_cm;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'profile', NEW.id, 'goal', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field IN ('goal', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'goal')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'goal'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.goal IS NOT NEW.goal
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'goal' AND OLD.goal IS NOT NEW.goal;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'profile', NEW.id, 'goal' WHERE OLD.goal IS NOT NEW.goal;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'profile', NEW.id, 'experience', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field IN ('experience', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'experience')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'experience'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.experience IS NOT NEW.experience
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'experience' AND OLD.experience IS NOT NEW.experience;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'profile', NEW.id, 'experience' WHERE OLD.experience IS NOT NEW.experience;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'profile', NEW.id, 'units', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field IN ('units', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'units')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'units'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.units IS NOT NEW.units
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'units' AND OLD.units IS NOT NEW.units;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'profile', NEW.id, 'units' WHERE OLD.units IS NOT NEW.units;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'profile', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'profile', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'profile', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'profile', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'profile', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END;
CREATE TRIGGER sync_progression_profile_ai AFTER INSERT ON progression_profile
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'progression_profile' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('progression_profile', NEW.id, '*');
     END;
CREATE TRIGGER sync_progression_profile_au AFTER UPDATE ON progression_profile
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'progression_profile', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'progression_profile', NEW.id, 'exercise_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field IN ('exercise_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'exercise_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'exercise_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.exercise_id IS NOT NEW.exercise_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'exercise_id' AND OLD.exercise_id IS NOT NEW.exercise_id;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'progression_profile', NEW.id, 'exercise_id' WHERE OLD.exercise_id IS NOT NEW.exercise_id;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'progression_profile', NEW.id, 'estimated_1rm_kg', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field IN ('estimated_1rm_kg', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'estimated_1rm_kg')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'estimated_1rm_kg'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.estimated_1rm_kg IS NOT NEW.estimated_1rm_kg
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'estimated_1rm_kg' AND OLD.estimated_1rm_kg IS NOT NEW.estimated_1rm_kg;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'progression_profile', NEW.id, 'estimated_1rm_kg' WHERE OLD.estimated_1rm_kg IS NOT NEW.estimated_1rm_kg;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'progression_profile', NEW.id, 'confidence', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field IN ('confidence', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'confidence')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'confidence'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.confidence IS NOT NEW.confidence
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'confidence' AND OLD.confidence IS NOT NEW.confidence;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'progression_profile', NEW.id, 'confidence' WHERE OLD.confidence IS NOT NEW.confidence;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'progression_profile', NEW.id, 'last_easy_recalibration_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field IN ('last_easy_recalibration_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'last_easy_recalibration_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'last_easy_recalibration_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.last_easy_recalibration_at IS NOT NEW.last_easy_recalibration_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'last_easy_recalibration_at' AND OLD.last_easy_recalibration_at IS NOT NEW.last_easy_recalibration_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'progression_profile', NEW.id, 'last_easy_recalibration_at' WHERE OLD.last_easy_recalibration_at IS NOT NEW.last_easy_recalibration_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'progression_profile', NEW.id, 'engine_version', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field IN ('engine_version', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'engine_version')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'engine_version'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.engine_version IS NOT NEW.engine_version
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'engine_version' AND OLD.engine_version IS NOT NEW.engine_version;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'progression_profile', NEW.id, 'engine_version' WHERE OLD.engine_version IS NOT NEW.engine_version;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'progression_profile', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'progression_profile', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'progression_profile', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'progression_profile', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'progression_profile', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END;
CREATE TRIGGER sync_recommendation_decision_ai AFTER INSERT ON recommendation_decision
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) AND (SELECT ended_at FROM workout WHERE id = NEW.workout_id) IS NOT NULL BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'recommendation_decision' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('recommendation_decision', NEW.id, '*');
     END;
CREATE TRIGGER sync_recommendation_decision_au AFTER UPDATE ON recommendation_decision
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) AND (SELECT ended_at FROM workout WHERE id = NEW.workout_id) IS NOT NULL BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'recommendation_decision', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recommendation_decision', NEW.id, 'exercise_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field IN ('exercise_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'exercise_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'exercise_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.exercise_id IS NOT NEW.exercise_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'exercise_id' AND OLD.exercise_id IS NOT NEW.exercise_id;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recommendation_decision', NEW.id, 'exercise_id' WHERE OLD.exercise_id IS NOT NEW.exercise_id;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recommendation_decision', NEW.id, 'workout_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field IN ('workout_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'workout_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'workout_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.workout_id IS NOT NEW.workout_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'workout_id' AND OLD.workout_id IS NOT NEW.workout_id;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recommendation_decision', NEW.id, 'workout_id' WHERE OLD.workout_id IS NOT NEW.workout_id;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recommendation_decision', NEW.id, 'workout_set_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field IN ('workout_set_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'workout_set_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'workout_set_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.workout_set_id IS NOT NEW.workout_set_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'workout_set_id' AND OLD.workout_set_id IS NOT NEW.workout_set_id;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recommendation_decision', NEW.id, 'workout_set_id' WHERE OLD.workout_set_id IS NOT NEW.workout_set_id;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recommendation_decision', NEW.id, 'engine_version', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field IN ('engine_version', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'engine_version')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'engine_version'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.engine_version IS NOT NEW.engine_version
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'engine_version' AND OLD.engine_version IS NOT NEW.engine_version;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recommendation_decision', NEW.id, 'engine_version' WHERE OLD.engine_version IS NOT NEW.engine_version;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recommendation_decision', NEW.id, 'prescription', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field IN ('prescription', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'prescription')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'prescription'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.prescription IS NOT NEW.prescription
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'prescription' AND OLD.prescription IS NOT NEW.prescription;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recommendation_decision', NEW.id, 'prescription' WHERE OLD.prescription IS NOT NEW.prescription;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recommendation_decision', NEW.id, 'reasons', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field IN ('reasons', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'reasons')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'reasons'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.reasons IS NOT NEW.reasons
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'reasons' AND OLD.reasons IS NOT NEW.reasons;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recommendation_decision', NEW.id, 'reasons' WHERE OLD.reasons IS NOT NEW.reasons;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recommendation_decision', NEW.id, 'accepted', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field IN ('accepted', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'accepted')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'accepted'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.accepted IS NOT NEW.accepted
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'accepted' AND OLD.accepted IS NOT NEW.accepted;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recommendation_decision', NEW.id, 'accepted' WHERE OLD.accepted IS NOT NEW.accepted;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recommendation_decision', NEW.id, 'chosen_load_kg', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field IN ('chosen_load_kg', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'chosen_load_kg')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'chosen_load_kg'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.chosen_load_kg IS NOT NEW.chosen_load_kg
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'chosen_load_kg' AND OLD.chosen_load_kg IS NOT NEW.chosen_load_kg;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recommendation_decision', NEW.id, 'chosen_load_kg' WHERE OLD.chosen_load_kg IS NOT NEW.chosen_load_kg;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recommendation_decision', NEW.id, 'chosen_reps', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field IN ('chosen_reps', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'chosen_reps')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'chosen_reps'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.chosen_reps IS NOT NEW.chosen_reps
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'chosen_reps' AND OLD.chosen_reps IS NOT NEW.chosen_reps;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recommendation_decision', NEW.id, 'chosen_reps' WHERE OLD.chosen_reps IS NOT NEW.chosen_reps;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recommendation_decision', NEW.id, 'decided_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field IN ('decided_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'decided_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'decided_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.decided_at IS NOT NEW.decided_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'decided_at' AND OLD.decided_at IS NOT NEW.decided_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recommendation_decision', NEW.id, 'decided_at' WHERE OLD.decided_at IS NOT NEW.decided_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recommendation_decision', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recommendation_decision', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recommendation_decision', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recommendation_decision', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recommendation_decision', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END;
CREATE TRIGGER sync_routine_ai AFTER INSERT ON routine
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'routine' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'routine' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('routine', NEW.id, '*');
     END;
CREATE TRIGGER sync_routine_au AFTER UPDATE ON routine
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'routine', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'routine' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine', NEW.id, 'name', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine' AND row_id = NEW.id AND field IN ('name', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine' AND row_id = NEW.id AND field = 'name')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine' AND row_id = NEW.id AND field = 'name'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.name IS NOT NEW.name
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine' AND row_id = NEW.id AND field = 'name' AND OLD.name IS NOT NEW.name;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine', NEW.id, 'name' WHERE OLD.name IS NOT NEW.name;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine', NEW.id, 'mode', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine' AND row_id = NEW.id AND field IN ('mode', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine' AND row_id = NEW.id AND field = 'mode')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine' AND row_id = NEW.id AND field = 'mode'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.mode IS NOT NEW.mode
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine' AND row_id = NEW.id AND field = 'mode' AND OLD.mode IS NOT NEW.mode;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine', NEW.id, 'mode' WHERE OLD.mode IS NOT NEW.mode;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'routine' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END;
CREATE TRIGGER sync_routine_day_ai AFTER INSERT ON routine_day
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'routine_day' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('routine_day', NEW.id, '*');
     END;
CREATE TRIGGER sync_routine_day_au AFTER UPDATE ON routine_day
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'routine_day', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_day', NEW.id, 'routine_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_day' AND row_id = NEW.id AND field IN ('routine_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = 'routine_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = 'routine_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.routine_id IS NOT NEW.routine_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = 'routine_id' AND OLD.routine_id IS NOT NEW.routine_id;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_day', NEW.id, 'routine_id' WHERE OLD.routine_id IS NOT NEW.routine_id;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_day', NEW.id, 'name', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_day' AND row_id = NEW.id AND field IN ('name', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = 'name')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = 'name'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.name IS NOT NEW.name
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = 'name' AND OLD.name IS NOT NEW.name;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_day', NEW.id, 'name' WHERE OLD.name IS NOT NEW.name;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_day', NEW.id, 'day_order', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_day' AND row_id = NEW.id AND field IN ('day_order', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = 'day_order')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = 'day_order'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.day_order IS NOT NEW.day_order
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = 'day_order' AND OLD.day_order IS NOT NEW.day_order;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_day', NEW.id, 'day_order' WHERE OLD.day_order IS NOT NEW.day_order;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_day', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_day' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_day', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_day', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_day' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_day', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_day', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END;
CREATE TRIGGER sync_routine_exercise_ai AFTER INSERT ON routine_exercise
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'routine_exercise' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('routine_exercise', NEW.id, '*');
     END;
CREATE TRIGGER sync_routine_exercise_au AFTER UPDATE ON routine_exercise
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'routine_exercise', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_exercise', NEW.id, 'routine_day_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field IN ('routine_day_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'routine_day_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'routine_day_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.routine_day_id IS NOT NEW.routine_day_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'routine_day_id' AND OLD.routine_day_id IS NOT NEW.routine_day_id;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_exercise', NEW.id, 'routine_day_id' WHERE OLD.routine_day_id IS NOT NEW.routine_day_id;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_exercise', NEW.id, 'exercise_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field IN ('exercise_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'exercise_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'exercise_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.exercise_id IS NOT NEW.exercise_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'exercise_id' AND OLD.exercise_id IS NOT NEW.exercise_id;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_exercise', NEW.id, 'exercise_id' WHERE OLD.exercise_id IS NOT NEW.exercise_id;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_exercise', NEW.id, 'exercise_name', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field IN ('exercise_name', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'exercise_name')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'exercise_name'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.exercise_name IS NOT NEW.exercise_name
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'exercise_name' AND OLD.exercise_name IS NOT NEW.exercise_name;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_exercise', NEW.id, 'exercise_name' WHERE OLD.exercise_name IS NOT NEW.exercise_name;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_exercise', NEW.id, 'sets', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field IN ('sets', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'sets')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'sets'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.sets IS NOT NEW.sets
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'sets' AND OLD.sets IS NOT NEW.sets;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_exercise', NEW.id, 'sets' WHERE OLD.sets IS NOT NEW.sets;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_exercise', NEW.id, 'rep_min', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field IN ('rep_min', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'rep_min')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'rep_min'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.rep_min IS NOT NEW.rep_min
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'rep_min' AND OLD.rep_min IS NOT NEW.rep_min;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_exercise', NEW.id, 'rep_min' WHERE OLD.rep_min IS NOT NEW.rep_min;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_exercise', NEW.id, 'rep_max', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field IN ('rep_max', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'rep_max')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'rep_max'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.rep_max IS NOT NEW.rep_max
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'rep_max' AND OLD.rep_max IS NOT NEW.rep_max;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_exercise', NEW.id, 'rep_max' WHERE OLD.rep_max IS NOT NEW.rep_max;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_exercise', NEW.id, 'rir', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field IN ('rir', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'rir')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'rir'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.rir IS NOT NEW.rir
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'rir' AND OLD.rir IS NOT NEW.rir;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_exercise', NEW.id, 'rir' WHERE OLD.rir IS NOT NEW.rir;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_exercise', NEW.id, 'rest_sec', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field IN ('rest_sec', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'rest_sec')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'rest_sec'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.rest_sec IS NOT NEW.rest_sec
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'rest_sec' AND OLD.rest_sec IS NOT NEW.rest_sec;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_exercise', NEW.id, 'rest_sec' WHERE OLD.rest_sec IS NOT NEW.rest_sec;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_exercise', NEW.id, 'position', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field IN ('position', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'position')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'position'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.position IS NOT NEW.position
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'position' AND OLD.position IS NOT NEW.position;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_exercise', NEW.id, 'position' WHERE OLD.position IS NOT NEW.position;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_exercise', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_exercise', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_exercise', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_exercise', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_exercise', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END;
CREATE TRIGGER sync_workout_ai AFTER INSERT ON workout
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) AND NEW.ended_at IS NOT NULL BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'workout' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('workout', NEW.id, '*');
     END;
CREATE TRIGGER sync_workout_au AFTER UPDATE ON workout
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) AND NEW.ended_at IS NOT NULL BEGIN
       DELETE FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND OLD.ended_at IS NULL;
       DELETE FROM sync_tombstone WHERE table_name = 'workout' AND row_id = NEW.id AND OLD.ended_at IS NULL;
       DELETE FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND OLD.ended_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout', NEW.id, '*' WHERE OLD.ended_at IS NULL;
       DELETE FROM sync_field_clock WHERE table_name = 'workout_set' AND OLD.ended_at IS NULL AND row_id IN (SELECT id FROM workout_set WHERE workout_id = NEW.id);
       DELETE FROM sync_tombstone WHERE table_name = 'workout_set' AND OLD.ended_at IS NULL AND row_id IN (SELECT id FROM workout_set WHERE workout_id = NEW.id);
       DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND OLD.ended_at IS NULL AND row_id IN (SELECT id FROM workout_set WHERE workout_id = NEW.id);
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', id, '*' FROM workout_set WHERE workout_id = NEW.id AND OLD.ended_at IS NULL ORDER BY position, id;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'workout', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = '*') AND OLD.ended_at IS NOT NULL;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout', NEW.id, 'routine_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field IN ('routine_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'routine_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'routine_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.routine_id IS NOT NEW.routine_id AND OLD.ended_at IS NOT NULL
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'routine_id' AND OLD.routine_id IS NOT NEW.routine_id AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout', NEW.id, 'routine_id' WHERE OLD.routine_id IS NOT NEW.routine_id AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout', NEW.id, 'routine_day_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field IN ('routine_day_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'routine_day_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'routine_day_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.routine_day_id IS NOT NEW.routine_day_id AND OLD.ended_at IS NOT NULL
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'routine_day_id' AND OLD.routine_day_id IS NOT NEW.routine_day_id AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout', NEW.id, 'routine_day_id' WHERE OLD.routine_day_id IS NOT NEW.routine_day_id AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout', NEW.id, 'name', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field IN ('name', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'name')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'name'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.name IS NOT NEW.name AND OLD.ended_at IS NOT NULL
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'name' AND OLD.name IS NOT NEW.name AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout', NEW.id, 'name' WHERE OLD.name IS NOT NEW.name AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout', NEW.id, 'started_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field IN ('started_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'started_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'started_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.started_at IS NOT NEW.started_at AND OLD.ended_at IS NOT NULL
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'started_at' AND OLD.started_at IS NOT NEW.started_at AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout', NEW.id, 'started_at' WHERE OLD.started_at IS NOT NEW.started_at AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout', NEW.id, 'ended_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field IN ('ended_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'ended_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'ended_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.ended_at IS NOT NEW.ended_at AND OLD.ended_at IS NOT NULL
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'ended_at' AND OLD.ended_at IS NOT NEW.ended_at AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout', NEW.id, 'ended_at' WHERE OLD.ended_at IS NOT NEW.ended_at AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout', NEW.id, 'source', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field IN ('source', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'source')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'source'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.source IS NOT NEW.source AND OLD.ended_at IS NOT NULL
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'source' AND OLD.source IS NOT NEW.source AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout', NEW.id, 'source' WHERE OLD.source IS NOT NEW.source AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout', NEW.id, 'copied_from_workout_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field IN ('copied_from_workout_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'copied_from_workout_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'copied_from_workout_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.copied_from_workout_id IS NOT NEW.copied_from_workout_id AND OLD.ended_at IS NOT NULL
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'copied_from_workout_id' AND OLD.copied_from_workout_id IS NOT NEW.copied_from_workout_id AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout', NEW.id, 'copied_from_workout_id' WHERE OLD.copied_from_workout_id IS NOT NEW.copied_from_workout_id AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout', NEW.id, 'notes', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field IN ('notes', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'notes')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'notes'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.notes IS NOT NEW.notes AND OLD.ended_at IS NOT NULL
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'notes' AND OLD.notes IS NOT NEW.notes AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout', NEW.id, 'notes' WHERE OLD.notes IS NOT NEW.notes AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at AND OLD.ended_at IS NOT NULL
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at AND OLD.ended_at IS NOT NULL
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at AND OLD.ended_at IS NOT NULL;
       DELETE FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL AND OLD.ended_at IS NOT NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL AND OLD.ended_at IS NOT NULL;
     END;
CREATE TRIGGER sync_workout_close_decisions_au AFTER UPDATE OF ended_at ON workout
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) AND OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL BEGIN
       DELETE FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id IN (SELECT id FROM recommendation_decision WHERE workout_id = NEW.id);
       DELETE FROM sync_tombstone WHERE table_name = 'recommendation_decision' AND row_id IN (SELECT id FROM recommendation_decision WHERE workout_id = NEW.id);
       DELETE FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id IN (SELECT id FROM recommendation_decision WHERE workout_id = NEW.id);
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recommendation_decision', id, '*' FROM recommendation_decision WHERE workout_id = NEW.id ORDER BY decided_at, id;
     END;
CREATE TRIGGER sync_workout_set_ai AFTER INSERT ON workout_set
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) AND (SELECT ended_at FROM workout WHERE id = NEW.workout_id) IS NOT NULL BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'workout_set' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('workout_set', NEW.id, '*');
     END;
CREATE TRIGGER sync_workout_set_au AFTER UPDATE ON workout_set
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) AND (SELECT ended_at FROM workout WHERE id = NEW.workout_id) IS NOT NULL BEGIN
       
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'workout_set', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'workout_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('workout_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'workout_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'workout_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.workout_id IS NOT NEW.workout_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'workout_id' AND OLD.workout_id IS NOT NEW.workout_id;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'workout_id' WHERE OLD.workout_id IS NOT NEW.workout_id;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'exercise_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('exercise_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'exercise_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'exercise_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.exercise_id IS NOT NEW.exercise_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'exercise_id' AND OLD.exercise_id IS NOT NEW.exercise_id;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'exercise_id' WHERE OLD.exercise_id IS NOT NEW.exercise_id;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'exercise_name', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('exercise_name', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'exercise_name')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'exercise_name'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.exercise_name IS NOT NEW.exercise_name
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'exercise_name' AND OLD.exercise_name IS NOT NEW.exercise_name;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'exercise_name' WHERE OLD.exercise_name IS NOT NEW.exercise_name;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'position', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('position', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'position')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'position'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.position IS NOT NEW.position
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'position' AND OLD.position IS NOT NEW.position;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'position' WHERE OLD.position IS NOT NEW.position;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'set_kind', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('set_kind', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'set_kind')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'set_kind'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.set_kind IS NOT NEW.set_kind
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'set_kind' AND OLD.set_kind IS NOT NEW.set_kind;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'set_kind' WHERE OLD.set_kind IS NOT NEW.set_kind;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'target_reps_min', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('target_reps_min', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'target_reps_min')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'target_reps_min'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.target_reps_min IS NOT NEW.target_reps_min
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'target_reps_min' AND OLD.target_reps_min IS NOT NEW.target_reps_min;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'target_reps_min' WHERE OLD.target_reps_min IS NOT NEW.target_reps_min;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'target_reps_max', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('target_reps_max', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'target_reps_max')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'target_reps_max'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.target_reps_max IS NOT NEW.target_reps_max
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'target_reps_max' AND OLD.target_reps_max IS NOT NEW.target_reps_max;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'target_reps_max' WHERE OLD.target_reps_max IS NOT NEW.target_reps_max;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'target_load_kg', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('target_load_kg', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'target_load_kg')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'target_load_kg'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.target_load_kg IS NOT NEW.target_load_kg
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'target_load_kg' AND OLD.target_load_kg IS NOT NEW.target_load_kg;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'target_load_kg' WHERE OLD.target_load_kg IS NOT NEW.target_load_kg;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'target_rest_sec', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('target_rest_sec', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'target_rest_sec')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'target_rest_sec'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.target_rest_sec IS NOT NEW.target_rest_sec
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'target_rest_sec' AND OLD.target_rest_sec IS NOT NEW.target_rest_sec;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'target_rest_sec' WHERE OLD.target_rest_sec IS NOT NEW.target_rest_sec;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'reps', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('reps', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'reps')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'reps'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.reps IS NOT NEW.reps
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'reps' AND OLD.reps IS NOT NEW.reps;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'reps' WHERE OLD.reps IS NOT NEW.reps;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'load_kg', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('load_kg', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'load_kg')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'load_kg'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.load_kg IS NOT NEW.load_kg
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'load_kg' AND OLD.load_kg IS NOT NEW.load_kg;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'load_kg' WHERE OLD.load_kg IS NOT NEW.load_kg;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'duration_sec', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('duration_sec', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'duration_sec')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'duration_sec'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.duration_sec IS NOT NEW.duration_sec
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'duration_sec' AND OLD.duration_sec IS NOT NEW.duration_sec;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'duration_sec' WHERE OLD.duration_sec IS NOT NEW.duration_sec;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'rir', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('rir', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'rir')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'rir'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.rir IS NOT NEW.rir
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'rir' AND OLD.rir IS NOT NEW.rir;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'rir' WHERE OLD.rir IS NOT NEW.rir;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'done', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('done', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'done')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'done'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.done IS NOT NEW.done
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'done' AND OLD.done IS NOT NEW.done;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'done' WHERE OLD.done IS NOT NEW.done;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'done_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('done_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'done_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'done_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.done_at IS NOT NEW.done_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'done_at' AND OLD.done_at IS NOT NEW.done_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'done_at' WHERE OLD.done_at IS NOT NEW.done_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'corrected_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('corrected_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'corrected_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'corrected_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.corrected_at IS NOT NEW.corrected_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'corrected_at' AND OLD.corrected_at IS NOT NEW.corrected_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'corrected_at' WHERE OLD.corrected_at IS NOT NEW.corrected_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END;
CREATE TRIGGER sync_workout_set_difficulty_au AFTER UPDATE OF difficulty ON workout_set
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) AND (SELECT ended_at FROM workout WHERE id = NEW.workout_id) IS NOT NULL BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'workout_set', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'difficulty', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('difficulty', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'difficulty')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'difficulty'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.difficulty IS NOT NEW.difficulty
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'difficulty' AND OLD.difficulty IS NOT NEW.difficulty;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'difficulty' WHERE OLD.difficulty IS NOT NEW.difficulty;
     END;
