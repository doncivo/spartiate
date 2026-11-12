import type { Migration } from '../migrator';

/**
 * I6-03b : groupe de circuit (superset, triset, circuit ; PRD § 13.8) défini dans un jour de routine, retrouvé dans la séance démarrée depuis ce jour.
 *
 * - `routine_exercise.circuit_id` : identifiant du groupe (texte de 1 à 64 caractères) porté par chaque ligne du groupe, nul hors groupe.
 * - `routine_exercise.circuit_rest_sec` : repos entre deux exercices d'un même tour (0 à 3 600 s, 0 = aucun), nul hors groupe. Le repos de fin de tour
 *   est le repos de la ligne (`rest_sec`, déjà publié) ; le nombre de tours se déduit des séries (aucune colonne). Mêmes bornes que la séance (0013).
 *
 * Schéma additif, deux colonnes PUBLIÉES. Contrairement à la séance (0013), une routine se modifie à tout moment : l'écriture des deux colonnes sur une
 * ligne existante est capturée champ par champ par un déclencheur PROPRE (`sync_routine_exercise_circuit_au`, `AFTER UPDATE OF circuit_id,
 * circuit_rest_sec`), sur le modèle et avec la garde de la difficulté (0006) : le corps publié de `sync_routine_exercise_au` (0002) n'est pas modifié
 * (aucun corps remplacé côté Rust). Les deux déclencheurs calculent la même horloge de base (`'*'`, sinon `OLD.hlc`), quel que soit l'ordre où SQLite
 * les exécute. Une ligne créée part en ligne entière (`sync_routine_exercise_ai`, 0002), colonnes comprises (lues depuis le catalogue). Aucune contrainte
 * croisée entre colonnes (leçon A1 d'I6-01) ; un groupe incomplet reçu (une seule ligne) se lit comme une ligne libre. Un appareil resté au schéma 13
 * garde ces deux champs dans `sync_unknown` (ADR 0011 § 7.2) et les réintègre après sa migration. Aucune ligne existante n'est mise en file.
 */

const row = "table_name = 'routine_exercise' AND row_id = NEW.id";
const clock = (field: string): string => `(SELECT hlc FROM sync_field_clock WHERE ${row} AND field = '${field}')`;
const fieldCapture = (column: string): string[] => [
  `INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_exercise', NEW.id, '${column}', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE ${row} AND field IN ('${column}', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE ${row} AND field = '${column}')
           ELSE COALESCE(${clock(column)}, ${clock('*')}, OLD.hlc) END
       WHERE OLD.${column} IS NOT NEW.${column}
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;`,
  `DELETE FROM sync_outbox WHERE ${row} AND field = '${column}' AND OLD.${column} IS NOT NEW.${column};`,
  `INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_exercise', NEW.id, '${column}' WHERE OLD.${column} IS NOT NEW.${column};`,
];

const CIRCUIT_TRIGGER = `CREATE TRIGGER sync_routine_exercise_circuit_au AFTER UPDATE OF circuit_id, circuit_rest_sec ON routine_exercise
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'routine_exercise', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE ${row} AND field = '*');
       ${[...fieldCapture('circuit_id'), ...fieldCapture('circuit_rest_sec')].join('\n')}
     END`;

export const migration0014RoutineCircuit: Migration = {
  version: 14,
  name: 'routine_circuit',
  statements: [
    'ALTER TABLE routine_exercise ADD COLUMN circuit_id TEXT CHECK (circuit_id IS NULL OR length(circuit_id) BETWEEN 1 AND 64)',
    'ALTER TABLE routine_exercise ADD COLUMN circuit_rest_sec INTEGER CHECK (circuit_rest_sec IS NULL OR circuit_rest_sec BETWEEN 0 AND 3600)',
    CIRCUIT_TRIGGER,
  ],
};
