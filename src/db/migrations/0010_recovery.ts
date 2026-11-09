import type { Migration } from '../migrator';

/**
 * I5-01 point 1.5 : récupération (PRD § 16.4, § 20.2 ; D-69, D-88). QUATRE TABLES NEUVES ; AUCUNE table existante n'est modifiée, aucune donnée
 * migrée (schéma strictement additif).
 *
 * PUBLIÉES (iPhone vers PC, le PC lit sans recalculer), identifiant naturel comme `day_completeness` : deux appareils qui écrivent le même
 * jour écrivent la même ligne ; fusion champ par champ par HLC.
 * - `recovery_day` : une ligne par date locale, identifiant `recovery|AAAA-MM-JJ`. Niveau A/B/C, `recovery` NULL avec sa raison d'abstention
 *   (jamais 0 : CHECK `recovery IS NULL` <=> `abstain_reason IS NOT NULL`), qualité, Exertion (musculation seule, D-88), sommeil (durée, besoin,
 *   score), régularité, zone cible, mesures du jour (HRV, FC repos : NULL = non mesuré), nuits d'apprentissage, contributeurs et clés
 *   d'explication en JSON (validés par `src/db/parse/recoveryJson.ts`), instant de calcul, version du moteur.
 * - `muscle_recovery` : identifiant `muscle|AAAA-MM-JJ|<muscle>`, pourcentage entier 0 à 100, durée retenue, dernière séance, prêt à. Pas de ligne
 *   pour un muscle non travaillé (inconnu, jamais 100 % par défaut). `muscle_group` (et non « group », mot réservé).
 *
 * LOCALES, NON PUBLIÉES (aucune colonne de synchro, aucun déclencheur, aucun contenu dans une sauvegarde publiée) :
 * - `recovery_sample` : échantillons importés des fichiers Raccourcis (hrv, fc-repos, sommeil, pas). Un échantillon d'un instant a `start_at = end_at`.
 *   Sommeil : un segment par ligne, stade obligatoire, pas de valeur ; autres types : valeur obligatoire, pas de stade. Clé d'unicité (type,
 *   début, fin, stade) : réimporter un fichier n'ajoute rien (`INSERT OR IGNORE`) ; la source (nom du fichier) ne fait pas partie de la clé.
 * - `recovery_import_state` : dernier import par type (instant, échantillon le plus récent, ajoutés, doublons, refusés : des comptes, jamais une valeur).
 *
 * Copie figée `CAPTURE_TABLES_V10` (jamais lue depuis le catalogue vivant), quatre déclencheurs sur le modèle de la 0009. Aucune migration publiée
 * n'est modifiée. Le catalogue de synchro (`syncTables.ts`) est ajouté par sync-icloud dans une étape distincte.
 */

/** Copie figée (version 10) des colonnes capturées : colonnes métier, `created_at` et `deleted_at` (ni `id`, ni `updated_at`, `device_id`, `hlc`). */
export const CAPTURE_TABLES_V10 = [
  [
    'recovery_day',
    [
      'date', 'level', 'recovery', 'abstain_reason', 'quality', 'exertion', 'exertion_prev_day', 'sleep_minutes', 'sleep_need_minutes', 'sleep_score',
      'bedtime_sigma_minutes', 'target_zone_from', 'target_zone_to', 'hrv_ms', 'resting_hr', 'learning_nights', 'contributors', 'explanation_keys', 'computed_at',
      'engine_version', 'created_at', 'deleted_at',
    ],
  ],
  ['muscle_recovery', ['date', 'muscle_id', 'muscle_group', 'percent', 'hours', 'last_worked_at', 'ready_at', 'created_at', 'deleted_at']],
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

/** Modèle de la 0002 (et des 0006 à 0009) : un `_ai` (ligne entière) et un `_au` (champ par champ, `base_hlc`, `'+'` à la restauration). */
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

const [[DAY, DAY_COLUMNS], [MUSCLE, MUSCLE_COLUMNS]] = CAPTURE_TABLES_V10;

const DATE_GLOB = "[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]";

export const migration0010Recovery: Migration = {
  version: 10,
  name: 'recovery',
  statements: [
    `CREATE TABLE recovery_day (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL CHECK (date GLOB '${DATE_GLOB}'),
      level TEXT NOT NULL CHECK (level IN ('A', 'B', 'C')),
      recovery INTEGER CHECK (recovery IS NULL OR (typeof(recovery) = 'integer' AND recovery BETWEEN 0 AND 100)),
      abstain_reason TEXT CHECK (abstain_reason IS NULL OR abstain_reason IN ('measure_missing_hrv', 'measure_missing_rhr', 'baseline_incomplete', 'zero_variance')),
      quality TEXT NOT NULL CHECK (quality IN ('good', 'partial', 'insufficient')),
      exertion REAL NOT NULL CHECK (exertion >= 0 AND exertion <= 1000),
      exertion_prev_day REAL NOT NULL CHECK (exertion_prev_day >= 0 AND exertion_prev_day <= 1000),
      sleep_minutes REAL CHECK (sleep_minutes IS NULL OR (sleep_minutes >= 0 AND sleep_minutes <= 1440)),
      sleep_need_minutes REAL NOT NULL CHECK (sleep_need_minutes > 0 AND sleep_need_minutes <= 1440),
      sleep_score INTEGER CHECK (sleep_score IS NULL OR (typeof(sleep_score) = 'integer' AND sleep_score BETWEEN 0 AND 100)),
      bedtime_sigma_minutes REAL CHECK (bedtime_sigma_minutes IS NULL OR (bedtime_sigma_minutes >= 0 AND bedtime_sigma_minutes <= 1440)),
      target_zone_from REAL CHECK (target_zone_from IS NULL OR target_zone_from BETWEEN 0 AND 1000),
      target_zone_to REAL CHECK (target_zone_to IS NULL OR target_zone_to BETWEEN 0 AND 1000),
      hrv_ms REAL CHECK (hrv_ms IS NULL OR (hrv_ms > 0 AND hrv_ms <= 1000)),
      resting_hr REAL CHECK (resting_hr IS NULL OR (resting_hr > 0 AND resting_hr <= 300)),
      learning_nights INTEGER NOT NULL CHECK (typeof(learning_nights) = 'integer' AND learning_nights BETWEEN 0 AND 365),
      contributors TEXT NOT NULL CHECK (json_valid(contributors) AND json_type(contributors) = 'array'),
      explanation_keys TEXT NOT NULL CHECK (json_valid(explanation_keys) AND json_type(explanation_keys) = 'array'),
      computed_at TEXT NOT NULL,
      engine_version INTEGER NOT NULL CHECK (typeof(engine_version) = 'integer' AND engine_version >= 1),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL,
      UNIQUE (date),
      CHECK (id = 'recovery|' || date),
      CHECK ((recovery IS NULL) = (abstain_reason IS NOT NULL)),
      CHECK ((target_zone_from IS NULL) = (target_zone_to IS NULL)),
      CHECK (target_zone_from IS NULL OR target_zone_from <= target_zone_to)
    )`,
    `CREATE TABLE muscle_recovery (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL CHECK (date GLOB '${DATE_GLOB}'),
      muscle_id TEXT NOT NULL CHECK (length(muscle_id) BETWEEN 1 AND 64),
      muscle_group TEXT NOT NULL CHECK (length(muscle_group) BETWEEN 1 AND 64),
      percent INTEGER NOT NULL CHECK (typeof(percent) = 'integer' AND percent BETWEEN 0 AND 100),
      hours REAL NOT NULL CHECK (hours > 0 AND hours <= 1000),
      last_worked_at TEXT NOT NULL,
      ready_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL,
      UNIQUE (date, muscle_id),
      CHECK (id = 'muscle|' || date || '|' || muscle_id)
    )`,
    `CREATE TABLE recovery_sample (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('hrv', 'fc-repos', 'sommeil', 'pas')),
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      value REAL CHECK (value IS NULL OR value >= 0),
      stage TEXT CHECK (stage IS NULL OR stage IN ('in_bed', 'asleep', 'awake', 'rem', 'deep', 'core')),
      source TEXT NOT NULL CHECK (length(source) BETWEEN 1 AND 128),
      imported_at TEXT NOT NULL,
      CHECK (end_at >= start_at),
      CHECK (
        (type = 'sommeil' AND stage IS NOT NULL AND value IS NULL)
        OR (type = 'hrv' AND stage IS NULL AND value IS NOT NULL AND value > 0)
        OR (type = 'fc-repos' AND stage IS NULL AND value IS NOT NULL AND value > 0)
        OR (type = 'pas' AND stage IS NULL AND value IS NOT NULL)
      )
    )`,
    "CREATE UNIQUE INDEX idx_recovery_sample_key ON recovery_sample(type, start_at, end_at, COALESCE(stage, ''))",
    'CREATE INDEX idx_recovery_sample_end ON recovery_sample(end_at)',
    `CREATE TABLE recovery_import_state (
      type TEXT PRIMARY KEY NOT NULL CHECK (type IN ('hrv', 'fc-repos', 'sommeil', 'pas')),
      imported_at TEXT NOT NULL,
      newest_sample_at TEXT,
      added INTEGER NOT NULL CHECK (typeof(added) = 'integer' AND added >= 0),
      duplicates INTEGER NOT NULL CHECK (typeof(duplicates) = 'integer' AND duplicates >= 0),
      rejected INTEGER NOT NULL CHECK (typeof(rejected) = 'integer' AND rejected >= 0)
    )`,
    ...captureTriggers(DAY, DAY_COLUMNS),
    ...captureTriggers(MUSCLE, MUSCLE_COLUMNS),
  ],
};
