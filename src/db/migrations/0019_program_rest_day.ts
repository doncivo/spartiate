import type { Migration } from '../migrator';

/**
 * PROG-01 : durée du prochain mésocycle et semaine de reprise (D-267), cible calorique des jours de repos (D-269 à D-272). Schéma 19, additif.
 *
 * - `mesocycle.next_weeks` : durée choisie pendant le cycle (4 à 7, nul : même durée), appliquée au cycle suivant, jamais au cycle en cours (D-267 (3)).
 * - `mesocycle.ramp_up` : semaine de reprise (0 / 1, nulle ou 0 : désactivée, D-267 (4)).
 * - `nutrition_target.rest_kcal`, `rest_carb_g` : cible des jours de repos (nulles : aucune, la cible vaut tous les jours) ; protéines et lipides
 *   identiques. `training_days` : jours d'entraînement prévus, jours ISO 1 (lundi) à 7 séparés par des virgules (« 1,2,4,5,6 »), nul sans cible de repos.
 *
 * Quatre colonnes PUBLIÉES (cinq). Une ligne créée part en ligne entière (`_ai` de la 0007 et de la 0008, colonnes lues depuis le catalogue) ; une
 * écriture sur une ligne existante est capturée champ par champ par un déclencheur PROPRE par table (`AFTER UPDATE OF`, modèle de la 0014) : les corps
 * publiés des `_au` de la 0007 et de la 0008 ne changent pas. Aucune contrainte croisée entre colonnes (leçon A1 d'I6-01). Un appareil resté au schéma
 * 18 garde ces champs dans `sync_unknown` (ADR 0011 § 7.2). Aucune ligne existante n'est mise en file ; une archive sv 18 s'importe sans ces colonnes.
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

const ownTrigger = (name: string, table: string, columns: readonly string[]): string => {
  const row = `table_name = '${table}' AND row_id = NEW.id`;
  return `CREATE TRIGGER ${name} AFTER UPDATE OF ${columns.join(', ')} ON ${table}
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT '${table}', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE ${row} AND field = '*');
       ${columns.flatMap((column) => fieldCapture(table, column)).join('\n')}
     END`;
};

export const migration0019ProgramRestDay: Migration = {
  version: 19,
  name: 'program_rest_day',
  statements: [
    'ALTER TABLE mesocycle ADD COLUMN next_weeks INTEGER CHECK (next_weeks IS NULL OR next_weeks BETWEEN 4 AND 7)',
    'ALTER TABLE mesocycle ADD COLUMN ramp_up INTEGER CHECK (ramp_up IS NULL OR ramp_up IN (0, 1))',
    'ALTER TABLE nutrition_target ADD COLUMN rest_kcal REAL CHECK (rest_kcal IS NULL OR rest_kcal > 0)',
    'ALTER TABLE nutrition_target ADD COLUMN rest_carb_g REAL CHECK (rest_carb_g IS NULL OR rest_carb_g >= 0)',
    "ALTER TABLE nutrition_target ADD COLUMN training_days TEXT CHECK (training_days IS NULL OR (length(training_days) BETWEEN 1 AND 13 AND training_days GLOB '[1-7]*'))",
    ownTrigger('sync_mesocycle_program_au', 'mesocycle', ['next_weeks', 'ramp_up']),
    ownTrigger('sync_nutrition_target_rest_au', 'nutrition_target', ['rest_kcal', 'rest_carb_g', 'training_days']),
  ],
};
