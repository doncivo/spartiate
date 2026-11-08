import type { Migration } from '../migrator';

/**
 * I3-02 : mésocycle (PRD § 12.2, § 12.6, § 20.2 ; D-26, D-73 points 3, 8, 9).
 *
 * - `mesocycle` : un cycle d'entraînement par ligne, UUID. `routine_id` est une référence LOGIQUE (routine supprimée ou jamais reçue : le
 *   cycle reste lisible), sans clé étrangère. Durée `weeks` 4 à 7 (illimité : `unlimited = 1`, `weeks` = longueur d'un bloc) ; `deload_week`
 *   (deload anticipé), `block_origin_week` / `block_origin_index` (bloc courant d'un cycle illimité après un deload anticipé), `rotation_index`
 *   (rotation Varied), `pauses` (JSON `[{ from, to, lightWeek }]`, écrit et relu par le repository seul, aucun CHECK `json_valid`), `status`
 *   (`active` | `completed`), `outcome` (issue du bilan) et `ended_on`.
 * - Publiée : un `_ai` (ligne entière) et un `_au` (champ par champ, `base_hlc`, `'+'` à la restauration), modèle de la 0002 ; aucune séance
 *   ouverte en jeu (D-27 inchangé). Copie figée `CAPTURE_TABLES_V7` (jamais lue depuis le catalogue vivant ; `0007_mesocycle.test.ts` vérifie
 *   copie = catalogue). Aucune migration publiée n'est modifiée ; aucune ligne existante à reporter (table neuve).
 */

/** Copie figée (version 7) des colonnes capturées de `mesocycle`, dans l'ordre du catalogue de synchro. */
export const CAPTURE_TABLES_V7 = [
  [
    'mesocycle',
    [
      'routine_id',
      'start_date',
      'weeks',
      'unlimited',
      'deload_week',
      'block_origin_week',
      'block_origin_index',
      'rotation_index',
      'pauses',
      'status',
      'outcome',
      'ended_on',
      'created_at',
      'deleted_at',
    ],
  ],
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

/** Modèle de la 0002 (et de la 0006) : un `_ai` (ligne entière) et un `_au` (champ par champ, `base_hlc`, `'+'` à la restauration). */
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

const [[MESOCYCLE, MESOCYCLE_COLUMNS]] = CAPTURE_TABLES_V7;

export const migration0007Mesocycle: Migration = {
  version: 7,
  name: 'mesocycle',
  statements: [
    `CREATE TABLE mesocycle (
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
    )`,
    'CREATE INDEX idx_mesocycle_status ON mesocycle(status, start_date)',
    ...captureTriggers(MESOCYCLE, MESOCYCLE_COLUMNS),
  ],
};
