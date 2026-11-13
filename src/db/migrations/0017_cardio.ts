import type { Migration } from '../migrator';

/**
 * I6-06 (D-221, D-222) : cardio saisi et tracé GPS. DEUX TABLES NEUVES ; AUCUNE table existante n'est modifiée, aucune donnée migrée (schéma strictement
 * additif, schéma 17).
 *
 * PUBLIÉE (écrite par les deux appareils) :
 * - `cardio_session` : une séance cardio, identifiant UUID. Type au format court NON fermé en SQL (un type ajouté par une version plus récente ne bloque
 *   pas la ligne : le domaine le lit « autre »), début (instant UTC), durée en secondes (1 s à 24 h), distance en mètres facultative (au plus 1 000 km),
 *   FC moyenne facultative (30 à 250), ressenti 1 à 10, source (`manual` ou `gps`), notes (2 000 caractères au plus). Bornes = domaine
 *   (`src/domain/cardio/session.ts`). Aucune contrainte croisée entre colonnes : le catalogue fusionne champ par champ (leçon d'I6-01).
 *
 * LOCALE, NON PUBLIÉE (aucune colonne de synchro, aucun déclencheur, jamais exportée) :
 * - `cardio_track` : le tracé GPS codé (`src/domain/cardio/track.ts`), clé = identifiant de la séance. Les positions ne quittent jamais l'appareil
 *   (§ 4, § 22, D-222) ; un appareil qui reçoit une séance GPS n'en a que la durée et la distance.
 *
 * Copie figée `CAPTURE_TABLES_V17` (jamais lue depuis le catalogue vivant), deux déclencheurs sur le modèle de la 0016. Aucune migration publiée n'est
 * modifiée.
 */

/** Copie figée (version 17) des colonnes capturées : colonnes métier, `created_at` et `deleted_at` (ni `id`, ni `updated_at`, `device_id`, `hlc`). */
export const CAPTURE_TABLES_V17 = [['cardio_session', ['kind', 'started_at', 'duration_sec', 'distance_m', 'avg_hr', 'rpe', 'source', 'notes', 'created_at', 'deleted_at']]] as const;

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

/** Modèle de la 0016 : un `_ai` (ligne entière) et un `_au` (champ par champ, `base_hlc`, `'+'` au rétablissement). */
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

const [[CARDIO, CARDIO_COLUMNS]] = CAPTURE_TABLES_V17;

export const migration0017Cardio: Migration = {
  version: 17,
  name: 'cardio',
  statements: [
    `CREATE TABLE cardio_session (
      id TEXT PRIMARY KEY NOT NULL,
      kind TEXT NOT NULL CHECK (length(kind) BETWEEN 1 AND 32 AND kind NOT GLOB '*[^a-z]*'),
      started_at TEXT NOT NULL CHECK (started_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]*'),
      duration_sec INTEGER NOT NULL CHECK (typeof(duration_sec) = 'integer' AND duration_sec BETWEEN 1 AND 86400),
      distance_m REAL CHECK (distance_m IS NULL OR (typeof(distance_m) IN ('real', 'integer') AND distance_m > 0 AND distance_m <= 1000000)),
      avg_hr INTEGER CHECK (avg_hr IS NULL OR (typeof(avg_hr) = 'integer' AND avg_hr BETWEEN 30 AND 250)),
      rpe INTEGER NOT NULL CHECK (typeof(rpe) = 'integer' AND rpe BETWEEN 1 AND 10),
      source TEXT NOT NULL CHECK (source IN ('manual', 'gps')),
      notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL
    )`,
    'CREATE INDEX cardio_session_started_idx ON cardio_session (started_at)',
    `CREATE TABLE cardio_track (
      session_id TEXT PRIMARY KEY NOT NULL,
      points TEXT NOT NULL CHECK (length(points) BETWEEN 2 AND 2000000),
      point_count INTEGER NOT NULL CHECK (typeof(point_count) = 'integer' AND point_count >= 0),
      saved_at TEXT NOT NULL
    )`,
    ...captureTriggers(CARDIO, CARDIO_COLUMNS),
  ],
};
