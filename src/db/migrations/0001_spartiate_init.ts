import type { Migration } from '../migrator';

/**
 * SPA-001b, base neuve Spartiate (D-23, D-24, D-54, D-55, D-65) : seule migration du registre.
 *
 * Contenu : `settings` locale, les neuf tables techniques de la synchro (reprises du DDL final des anciennes 0015 et 0019, sans le
 * DML de 0016), `epoch_carry_report`, les deux tables métier I0 `profile` et `body_weight` avec leurs identités naturelles, et les
 * quatre déclencheurs de capture. `schema_migrations` est créée par le migrateur, pas ici.
 *
 * Copie figée : le générateur de déclencheurs ne lit jamais le catalogue vivant (la somme de contrôle dépend du SQL produit). Elle
 * ne se modifie plus ; toute évolution passe par une nouvelle migration. Aucune base de l'ancien projet n'est lue, migrée ni purgée :
 * une base au schéma 19 est refusée par le migrateur.
 */

/** Copie figée (version 1) des colonnes capturées, dans l'ordre du catalogue de synchro. */
export const CAPTURE_TABLES_V1 = [
  ['profile', ['sex', 'birth_year', 'height_cm', 'goal', 'experience', 'units', 'created_at', 'deleted_at']],
  ['body_weight', ['date', 'kg', 'source', 'timezone', 'health_uuid', 'measured_at', 'created_at', 'deleted_at']],
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

export const migration0001SpartiateInit: Migration = {
  version: 1,
  name: 'spartiate_init',
  statements: [
    `CREATE TABLE settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      device_id  TEXT NOT NULL,
      hlc        TEXT NOT NULL
    )`,
    'CREATE INDEX idx_settings_hlc ON settings(hlc)',
    'CREATE TABLE sync_guard (id INTEGER PRIMARY KEY)',
    `CREATE TABLE sync_field_clock (
      table_name TEXT NOT NULL,
      row_id     TEXT NOT NULL,
      field      TEXT NOT NULL,
      hlc        TEXT NOT NULL,
      base_hlc   TEXT,
      PRIMARY KEY (table_name, row_id, field)
    )`,
    'CREATE INDEX idx_sync_field_clock_hlc ON sync_field_clock(hlc)',
    `CREATE TABLE sync_outbox (
      seq        INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      row_id     TEXT NOT NULL,
      field      TEXT NOT NULL,
      UNIQUE (table_name, row_id, field)
    )`,
    `CREATE TABLE sync_state (
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
    )`,
    `CREATE TABLE sync_tombstone (
      table_name  TEXT NOT NULL,
      row_id      TEXT NOT NULL,
      deleted_hlc TEXT NOT NULL,
      purged_at   TEXT NOT NULL,
      PRIMARY KEY (table_name, row_id)
    )`,
    'CREATE INDEX idx_sync_tombstone_hlc ON sync_tombstone(deleted_hlc)',
    `CREATE TABLE sync_unknown (
      table_name TEXT NOT NULL,
      row_id     TEXT NOT NULL,
      field      TEXT NOT NULL,
      value      TEXT,
      hlc        TEXT NOT NULL,
      base_hlc   TEXT,
      sv         INTEGER NOT NULL,
      PRIMARY KEY (table_name, row_id, field)
    )`,
    `CREATE TABLE sync_parked (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      reason     TEXT NOT NULL CHECK (reason IN ('missing-parent', 'missing-row', 'epoch-carry')),
      table_name TEXT NOT NULL,
      row_id     TEXT NOT NULL,
      hlc        TEXT NOT NULL,
      op         TEXT NOT NULL,
      parked_at  TEXT NOT NULL
    )`,
    'CREATE INDEX idx_sync_parked_reason ON sync_parked(reason, id)',
    'CREATE INDEX idx_sync_parked_row ON sync_parked(reason, table_name, row_id)',
    `CREATE TABLE conflict_log (
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
    )`,
    'CREATE INDEX idx_conflict_log_detected_at ON conflict_log(detected_at)',
    'CREATE INDEX idx_conflict_log_row ON conflict_log(table_name, row_id, field)',
    'CREATE TABLE sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
    "CREATE TABLE epoch_carry_report (id INTEGER PRIMARY KEY, epoch TEXT NOT NULL, cause TEXT NOT NULL CHECK (cause IN ('restore', 'concurrent', 'reset')), reporter TEXT NOT NULL, opener TEXT NOT NULL, mode TEXT NOT NULL CHECK (mode IN ('replace', 'merge')), authors TEXT NOT NULL, restored TEXT NOT NULL, recreated TEXT NOT NULL, parent_replaced TEXT NOT NULL, overflow INTEGER NOT NULL, overflow_by TEXT NOT NULL, banner INTEGER NOT NULL CHECK (banner IN (0, 1)), created_at TEXT NOT NULL, acknowledged_at TEXT)",
    `CREATE TABLE profile (
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
    )`,
    `CREATE TABLE body_weight (
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
    )`,
    'CREATE INDEX idx_body_weight_date ON body_weight(date)',
    ...CAPTURE_TABLES_V1.flatMap(([table, columns]) => captureTriggers(table, columns)),
  ],
};
