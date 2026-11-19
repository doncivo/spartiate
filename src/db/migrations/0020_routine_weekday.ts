import type { Migration } from '../migrator';

/**
 * PROG-04 : jour de la semaine d'un jour de routine (D-316, D-317). Schéma 20, additif.
 *
 * - `routine_day.weekday` : jour ISO 1 (lundi) à 7 (dimanche), nul : jour sans date (la séance du jour suit la rotation d'avant).
 *
 * Colonne PUBLIÉE. Une ligne créée part en ligne entière (`_ai` de la 0002, colonnes lues depuis le catalogue) ; une écriture sur une ligne
 * existante est capturée par un déclencheur PROPRE (`AFTER UPDATE OF`, modèle de la 0014 et de la 0019) : le corps publié du `_au` de la 0002
 * ne change pas. Un appareil resté au schéma 19 garde ce champ dans `sync_unknown` (ADR 0011 § 7.2).
 *
 * Rattachement des jours existants (D-317) : un jour vivant dont le nom commence par un jour de la semaine (mot entier, casse indifférente),
 * seul de sa routine à porter ce jour, reçoit ce jour. L'écriture se fait sous la garde de synchro, avant la création du déclencheur propre :
 * rien n'est mis en file, chaque appareil faisant le même calcul sur les mêmes lignes en migrant.
 */

const WEEKDAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;
/** Jour ISO lu dans le nom (expression SQL sur la colonne `col`), nul sinon. */
const weekdayOfName = (col: string): string =>
  `(CASE ${WEEKDAYS.map((w, i) => `WHEN lower(trim(${col})) = '${w}' OR lower(trim(${col})) GLOB '${w}[^a-z]*' THEN ${String(i + 1)}`).join(' ')} END)`;

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

export const migration0020RoutineWeekday: Migration = {
  version: 20,
  name: 'routine_weekday',
  statements: [
    'ALTER TABLE routine_day ADD COLUMN weekday INTEGER CHECK (weekday IS NULL OR weekday BETWEEN 1 AND 7)',
    'INSERT OR IGNORE INTO sync_guard (id) VALUES (1)',
    `UPDATE routine_day SET weekday = ${weekdayOfName('name')}
       WHERE deleted_at IS NULL AND ${weekdayOfName('name')} IS NOT NULL
         AND (SELECT COUNT(*) FROM routine_day o WHERE o.routine_id = routine_day.routine_id AND o.deleted_at IS NULL AND ${weekdayOfName('o.name')} = ${weekdayOfName('routine_day.name')}) = 1`,
    'DELETE FROM sync_guard',
    ownTrigger('sync_routine_day_weekday_au', 'routine_day', ['weekday']),
  ],
};
