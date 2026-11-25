import type { Migration } from '../migrator';

/**
 * DATA-0293 : schéma 23, additif.
 *
 * - `recovery_sample.utc_offset_min` (LOCALE, C-058, D-478) : décalage de la cellule d'origine, en minutes (±840) ; nul : « Z » ou ligne d'avant.
 * - `workout_set.distance_m` (BL-112), `added` (BL-135, D-481 : série ajoutée en séance), `corrected_from` (C-072, Q-13 B : valeurs d'avant la
 *   dernière correction, JSON) : colonnes PUBLIÉES avec la séance close (modèle de la 0013) : `distance_m` et `added` n'ont AUCUN déclencheur (elles ne s'écrivent que sur
 *   une séance ouverte, la clôture met la ligne entière en file) ; `corrected_from` a un déclencheur PROPRE (`sync_workout_set_corrected_from_au`, séance close
 *   seulement : une correction après clôture part champ par champ). Toutes nulles pour les lignes d'avant.
 * - `progression_profile.config_overrides` (§ 11, D-510) : surcharges par exercice (JSON), PUBLIÉE, capturée par un déclencheur PROPRE (modèle de la 0020).
 *
 * Un appareil resté au schéma 22 garde ces champs dans `sync_unknown` (ADR 0011 § 7.2) et les réintègre après sa migration.
 */
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
const ownTrigger = (name: string, table: string, columns: readonly string[], also = ''): string => {
  const row = `table_name = '${table}' AND row_id = NEW.id`;
  return `CREATE TRIGGER ${name} AFTER UPDATE OF ${columns.join(', ')} ON ${table}
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard)${also} BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT '${table}', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE ${row} AND field = '*');
       ${columns.flatMap((column) => fieldCapture(table, column)).join('\n')}
     END`;
};

export const migration0023Data0293: Migration = {
  version: 23,
  name: 'data_0293',
  statements: [
    'ALTER TABLE recovery_sample ADD COLUMN utc_offset_min INTEGER CHECK (utc_offset_min IS NULL OR utc_offset_min BETWEEN -840 AND 840)',
    'ALTER TABLE workout_set ADD COLUMN distance_m REAL CHECK (distance_m IS NULL OR distance_m >= 0)',
    'ALTER TABLE workout_set ADD COLUMN added INTEGER CHECK (added IS NULL OR added IN (0, 1))',
    'ALTER TABLE workout_set ADD COLUMN corrected_from TEXT CHECK (corrected_from IS NULL OR length(corrected_from) BETWEEN 1 AND 200)',
    'ALTER TABLE progression_profile ADD COLUMN config_overrides TEXT CHECK (config_overrides IS NULL OR length(config_overrides) BETWEEN 2 AND 512)',
    ownTrigger('sync_progression_profile_overrides_au', 'progression_profile', ['config_overrides']),
    // Correction d'une série d'une séance CLOSE (correctSet) : capturée champ par champ, avec la garde de la 0006 (difficulty). Sur une séance ouverte : rien (la clôture met la ligne entière en file).
    ownTrigger('sync_workout_set_corrected_from_au', 'workout_set', ['corrected_from'], ' AND (SELECT ended_at FROM workout WHERE id = NEW.workout_id) IS NOT NULL'),
  ],
};
