import type { Migration } from '../migrator';

/**
 * I1-03, publication des séances closes (PRD § 9.1, § 13.4, § 20.2 ; D-26, D-27).
 *
 * Une séance OUVERTE (`ended_at` nul) n'est jamais capturée : aucun déclencheur ne touche `sync_outbox`, `sync_field_clock` ni
 * `sync_tombstone` tant qu'elle est ouverte, y compris pour ses séries. La CLÔTURE (`ended_at` qui passe de nul à une valeur) met en file,
 * dans la même instruction, la séance ET toutes ses séries en ligne entière (`'*'`) : l'agrégat devient publiable d'un bloc, dans la
 * transaction de clôture (`WorkoutRepository.close`), ou pas du tout. Ensuite, une séance close se capture comme toute ligne publiée
 * (champ par champ, `base_hlc`, `'+'` à la restauration).
 *
 * Le repository de clôture tamponne d'abord chaque série avec le tampon de la clôture (séance encore ouverte : rien n'est capturé), puis
 * pose `ended_at` avec ce même tampon : toutes les opérations de l'agrégat partagent un hlc, donc un même enregistrement de journal, un
 * même appel d'ajout et une même transaction d'application chez l'autre appareil (le lecteur ne coupe jamais un groupe de même hlc).
 *
 * `workout_set.corrected_at` (nouvelle colonne publiée) date la dernière correction d'une série d'une séance close (§ 13.8, « correction
 * tracée ») ; les horloges par champ gardent le détail de chaque valeur. Les colonnes `workout.rest_timer_end_at` et `rest_timer_seconds`
 * restent locales (catalogue : `local`), absentes des déclencheurs.
 *
 * Déclencheurs : copie figée (`CAPTURE_TABLES_V4`, jamais lue depuis le catalogue vivant) ; `0004_workout_sync.test.ts` vérifie copie =
 * catalogue. Aucune migration publiée n'est modifiée.
 */

/** Copie figée (version 4) des colonnes capturées, dans l'ordre du catalogue de synchro. */
export const CAPTURE_TABLES_V4 = [
  ['workout', ['routine_id', 'routine_day_id', 'name', 'started_at', 'ended_at', 'source', 'copied_from_workout_id', 'notes', 'created_at', 'deleted_at']],
  [
    'workout_set',
    [
      'workout_id',
      'exercise_id',
      'exercise_name',
      'position',
      'set_kind',
      'target_reps_min',
      'target_reps_max',
      'target_load_kg',
      'target_rest_sec',
      'reps',
      'load_kg',
      'duration_sec',
      'rir',
      'done',
      'done_at',
      'corrected_at',
      'created_at',
      'deleted_at',
    ],
  ],
] as const;

/**
 * Corps d'un déclencheur de capture (modèle de la 0002) dont chaque instruction est gardée par `rowGuard` (déjà close pour une mise à
 * jour de `workout`) ; `when` est la condition du déclencheur entier.
 */
function captureTriggers(table: string, columns: readonly string[], when: string, rowGuard: string): string[] {
  const row = `table_name = '${table}' AND row_id = NEW.id`;
  const clock = (field: string): string => `(SELECT hlc FROM sync_field_clock WHERE ${row} AND field = '${field}')`;
  const g = rowGuard === '' ? '' : ` AND ${rowGuard}`;
  const changes = columns.flatMap((column) => [
    `INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT '${table}', NEW.id, '${column}', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE ${row} AND field IN ('${column}', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE ${row} AND field = '${column}')
           ELSE COALESCE(${clock(column)}, ${clock('*')}, OLD.hlc) END
       WHERE OLD.${column} IS NOT NEW.${column}${g}
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;`,
    `DELETE FROM sync_outbox WHERE ${row} AND field = '${column}' AND OLD.${column} IS NOT NEW.${column}${g};`,
    `INSERT INTO sync_outbox (table_name, row_id, field) SELECT '${table}', NEW.id, '${column}' WHERE OLD.${column} IS NOT NEW.${column}${g};`,
  ]);
  return [
    `CREATE TRIGGER sync_${table}_ai AFTER INSERT ON ${table}
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) AND ${when} BEGIN
       DELETE FROM sync_tombstone WHERE ${row};
       DELETE FROM sync_outbox WHERE ${row} AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('${table}', NEW.id, '*');
     END`,
    `CREATE TRIGGER sync_${table}_au AFTER UPDATE ON ${table}
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) AND ${when} BEGIN
       ${table === 'workout' ? CLOSE_STATEMENTS : ''}
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT '${table}', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE ${row} AND field = '*')${g};
       ${changes.join('\n')}
       DELETE FROM sync_outbox WHERE ${row} AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL${g};
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT '${table}', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL${g};
     END`,
  ];
}

/**
 * Clôture (`OLD.ended_at` nul, `NEW.ended_at` posé) : la séance et toutes ses séries partent en ligne entière, horloges et traces locales
 * de ces identifiants effacées (une séance ouverte n'en a jamais : défense en profondeur, la ligne entière part au hlc de la ligne).
 */
const CLOSE_STATEMENTS = `DELETE FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND OLD.ended_at IS NULL;
       DELETE FROM sync_tombstone WHERE table_name = 'workout' AND row_id = NEW.id AND OLD.ended_at IS NULL;
       DELETE FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND OLD.ended_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout', NEW.id, '*' WHERE OLD.ended_at IS NULL;
       DELETE FROM sync_field_clock WHERE table_name = 'workout_set' AND OLD.ended_at IS NULL AND row_id IN (SELECT id FROM workout_set WHERE workout_id = NEW.id);
       DELETE FROM sync_tombstone WHERE table_name = 'workout_set' AND OLD.ended_at IS NULL AND row_id IN (SELECT id FROM workout_set WHERE workout_id = NEW.id);
       DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND OLD.ended_at IS NULL AND row_id IN (SELECT id FROM workout_set WHERE workout_id = NEW.id);
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', id, '*' FROM workout_set WHERE workout_id = NEW.id AND OLD.ended_at IS NULL ORDER BY position, id;`;

const [WORKOUT_COLUMNS, SET_COLUMNS] = [CAPTURE_TABLES_V4[0][1], CAPTURE_TABLES_V4[1][1]];

export const migration0004WorkoutSync: Migration = {
  version: 4,
  name: 'workout_sync',
  statements: [
    'ALTER TABLE workout_set ADD COLUMN corrected_at TEXT',
    ...captureTriggers('workout', WORKOUT_COLUMNS, 'NEW.ended_at IS NOT NULL', 'OLD.ended_at IS NOT NULL'),
    ...captureTriggers('workout_set', SET_COLUMNS, '(SELECT ended_at FROM workout WHERE id = NEW.workout_id) IS NOT NULL', ''),
    'CREATE INDEX idx_workout_ended ON workout(ended_at) WHERE ended_at IS NOT NULL',
  ],
};
