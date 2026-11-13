import type { Migration } from '../migrator';

/**
 * FIX-0181 (D-171 ; D-79 révisée par Ali le 12 novembre 2026 : favoris synchronisés) : favoris de la recherche d'aliments. UNE TABLE NEUVE, publiée,
 * écrite par les deux appareils ; AUCUNE table existante n'est modifiée (schéma strictement additif, schéma 15).
 *
 * - `food_favorite` : un favori par aliment, identifiant naturel `favorite|<ref>` (CHECK, comme `recovery_factor`) : le même aliment mis en favori sur
 *   les deux appareils donne UNE ligne. `ref` = `ciqual:<code>` ou UUID d'une fiche (perso ou cache Open Food Facts), sans `|`. `source` n'est PAS une
 *   liste fermée en SQL (une provenance ajoutée plus tard par une version plus récente ne doit pas bloquer la ligne) : seul son format est contrôlé ;
 *   la liste et la cohérence provenance / référence sont dans `src/domain/nutrition/favorites.ts`. `added_at` (publié) range la liste, le plus récent
 *   d'abord, identiquement sur les deux appareils (`updated_at` n'est pas publié). Aucune contrainte croisée entre colonnes.
 * - Aucune donnée migrée en SQL : la reprise des favoris locaux (réglage `nutrition.favorites`, D-79) se fait une fois par le dépôt, horodatée par
 *   l'horloge de synchro de l'appareil (`FoodFavoriteRepository.importLocal`).
 *
 * Copie figée `CAPTURE_TABLES_V15` (jamais lue depuis le catalogue vivant), deux déclencheurs sur le modèle de la 0011 et de la 0012. Aucune migration
 * publiée n'est modifiée.
 */

/** Copie figée (version 15) des colonnes capturées : colonnes métier, `created_at` et `deleted_at` (ni `id`, ni `updated_at`, `device_id`, `hlc`). */
export const CAPTURE_TABLES_V15 = [['food_favorite', ['source', 'ref', 'added_at', 'created_at', 'deleted_at']]] as const;

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

/** Modèle de la 0002 (et des 0006 à 0012) : un `_ai` (ligne entière) et un `_au` (champ par champ, `base_hlc`, `'+'` à la restauration). */
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

const [[FAVORITE, FAVORITE_COLUMNS]] = CAPTURE_TABLES_V15;

export const migration0015FoodFavorite: Migration = {
  version: 15,
  name: 'food_favorite',
  statements: [
    `CREATE TABLE food_favorite (
      id TEXT PRIMARY KEY NOT NULL,
      source TEXT NOT NULL CHECK (length(source) BETWEEN 1 AND 16 AND source NOT GLOB '*[^a-z]*'),
      ref TEXT NOT NULL CHECK (length(ref) BETWEEN 1 AND 64 AND instr(ref, '|') = 0),
      added_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL,
      CHECK (id = 'favorite|' || ref)
    )`,
    'CREATE INDEX food_favorite_added_idx ON food_favorite (added_at)',
    ...captureTriggers(FAVORITE, FAVORITE_COLUMNS),
  ],
};
