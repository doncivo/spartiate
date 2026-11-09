import type { Migration } from '../migrator';

/**
 * I4-07 : journée déclarée complète ou incomplète, recettes et ingrédients (PRD § 15.1, § 15.3, § 20.2 ; D-26, D-80, D-81). TROIS TABLES
 * NEUVES, publiées ; AUCUNE table existante n'est modifiée : ni liste ni CHECK de `meal_entry` ou de `food` ne sont élargis (une ligne
 * nouvelle dont un champ serait hors liste resterait bloquée sans fin sur un appareil en schéma 8, relecture sync-icloud de I4-06).
 *
 * - `day_completeness` : une ligne par date locale, identifiant naturel `day|AAAA-MM-JJ` (CHECK, comme `body_weight`) : deux appareils qui
 *   déclarent le même jour écrivent la même ligne. « Non déclarée » = aucune ligne ou ligne supprimée logiquement. Conflit : fusion champ par
 *   champ par HLC, dernière écriture gagne (règle par défaut du catalogue).
 * - `recipe` : nom, portions entières (1 à 100), poids cuit facultatif (]0 ; 20 000 g]).
 * - `recipe_ingredient` : ingrédient d'une recette, clé étrangère vers `recipe` (parent publié, sans CASCADE : suppressions logiques) ; valeurs
 *   pour 100 g NULLABLES (inconnu = NULL, jamais 0), mêmes bornes que `food` : instantané pris à l'ajout, la recette ne dépend d'aucune
 *   fiche. Rang unique par recette non imposé en SQL (deux appareils peuvent insérer le même rang hors ligne) : la lecture trie par rang puis
 *   création.
 * - Une prise de recette est une `meal_entry` ordinaire (source `custom`, méthode `search`, `food_id` = `recipe:<UUID>`) : aucune colonne.
 * - Copie figée `CAPTURE_TABLES_V9` (jamais lue depuis le catalogue vivant ; `0009_recipes.test.ts` vérifie copie = catalogue), six
 *   déclencheurs sur le modèle de la 0008. Aucune migration publiée n'est modifiée.
 */

/** Copie figée (version 9) des colonnes capturées, dans l'ordre du catalogue de synchro. */
export const CAPTURE_TABLES_V9 = [
  ['day_completeness', ['date', 'state', 'created_at', 'deleted_at']],
  ['recipe', ['name', 'servings', 'cooked_weight_g', 'created_at', 'deleted_at']],
  [
    'recipe_ingredient',
    ['recipe_id', 'position', 'name', 'source', 'food_ref', 'grams', 'kcal_100g', 'protein_100g', 'fat_100g', 'carb_100g', 'fiber_100g', 'created_at', 'deleted_at'],
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

/** Modèle de la 0002 (et des 0006 à 0008) : un `_ai` (ligne entière) et un `_au` (champ par champ, `base_hlc`, `'+'` à la restauration). */
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

const [[DAY, DAY_COLUMNS], [RECIPE, RECIPE_COLUMNS], [INGREDIENT, INGREDIENT_COLUMNS]] = CAPTURE_TABLES_V9;

export const migration0009Recipes: Migration = {
  version: 9,
  name: 'recipes',
  statements: [
    `CREATE TABLE day_completeness (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      state TEXT NOT NULL CHECK (state IN ('complete', 'incomplete')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL,
      UNIQUE (date),
      CHECK (id = 'day|' || date)
    )`,
    `CREATE TABLE recipe (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
      servings INTEGER NOT NULL CHECK (typeof(servings) = 'integer' AND servings BETWEEN 1 AND 100),
      cooked_weight_g REAL CHECK (cooked_weight_g IS NULL OR (cooked_weight_g > 0 AND cooked_weight_g <= 20000)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL
    )`,
    `CREATE TABLE recipe_ingredient (
      id TEXT PRIMARY KEY NOT NULL,
      recipe_id TEXT NOT NULL REFERENCES recipe(id),
      position INTEGER NOT NULL CHECK (typeof(position) = 'integer' AND position >= 0),
      name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
      source TEXT NOT NULL CHECK (source IN ('custom', 'ciqual', 'off')),
      food_ref TEXT CHECK (food_ref IS NULL OR length(food_ref) BETWEEN 1 AND 128),
      grams REAL NOT NULL CHECK (grams > 0 AND grams <= 10000),
      kcal_100g REAL CHECK (kcal_100g IS NULL OR kcal_100g BETWEEN 0 AND 900),
      protein_100g REAL CHECK (protein_100g IS NULL OR protein_100g BETWEEN 0 AND 100),
      fat_100g REAL CHECK (fat_100g IS NULL OR fat_100g BETWEEN 0 AND 100),
      carb_100g REAL CHECK (carb_100g IS NULL OR carb_100g BETWEEN 0 AND 100),
      fiber_100g REAL CHECK (fiber_100g IS NULL OR fiber_100g BETWEEN 0 AND 100),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL
    )`,
    'CREATE INDEX idx_recipe_ingredient_recipe ON recipe_ingredient(recipe_id, position)',
    ...captureTriggers(DAY, DAY_COLUMNS),
    ...captureTriggers(RECIPE, RECIPE_COLUMNS),
    ...captureTriggers(INGREDIENT, INGREDIENT_COLUMNS),
  ],
};
