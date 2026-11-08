import type { Migration } from '../migrator';

/**
 * I4-02 : fiches alimentaires, portions, journal et cibles (PRD § 15.3–15.4, § 20.2 ; D-26, D-74).
 *
 * - `food` : fiches STOCKÉES seulement, UUID : `custom` (fiche personnelle) et `off` (cache Open Food Facts, `fetched_at` obligatoire,
 *   validité 90 jours lue par le domaine). Ciqual n'a aucune ligne (contenu embarqué, comme les exercices du JSON, P-09). Valeurs pour 100 g
 *   NULLABLES : une valeur inconnue est NULL, jamais 0. AUCUN index unique sur `barcode` : deux appareils hors ligne peuvent chacun créer
 *   la même ligne (UUID différents), une contrainte ferait échouer l'application d'une ligne reçue ; la lecture départage (fiche perso,
 *   puis récupération la plus récente).
 * - `food_portion` : portions d'une fiche stockée ; clé étrangère vers `food` (parent publié, sans CASCADE : suppressions logiques).
 * - `meal_entry` : journal. `food_id` est une référence LOGIQUE sans clé étrangère (`ciqual:<code>` ou UUID d'une fiche, éventuellement
 *   supprimée ou pas encore reçue), `food_name` en fige le nom, kcal et macros sont un instantané NULLABLE. `method` (search, scan, photo,
 *   quickadd) et `source` (custom, ciqual, off, estimate, manual) sont admises dès maintenant, photo comprise, sans flux photo ici.
 * - `nutrition_target` : une ligne par décision (D-74), jamais modifiée.
 * - Les quatre tables sont publiées : un `_ai` (ligne entière) et un `_au` (champ par champ, `base_hlc`, `'+'` à la restauration) chacune,
 *   modèle de la 0002 et de la 0007. Copie figée `CAPTURE_TABLES_V8` (jamais lue depuis le catalogue vivant ; `0008_nutrition.test.ts` vérifie
 *   copie = catalogue). `ai_call` (local) arrive avec l'IA (I4-04), jamais par anticipation. Aucune migration publiée n'est modifiée.
 */

/** Copie figée (version 8) des colonnes capturées, dans l'ordre du catalogue de synchro. */
export const CAPTURE_TABLES_V8 = [
  ['food', ['source', 'barcode', 'name', 'brand', 'kcal', 'protein_g', 'fat_g', 'carb_g', 'fiber_g', 'fetched_at', 'created_at', 'deleted_at']],
  ['food_portion', ['food_id', 'label', 'grams', 'position', 'created_at', 'deleted_at']],
  [
    'meal_entry',
    ['date', 'time', 'food_id', 'food_name', 'source', 'grams', 'kcal', 'protein_g', 'fat_g', 'carb_g', 'method', 'confidence', 'created_at', 'deleted_at'],
  ],
  ['nutrition_target', ['week_start', 'kcal', 'protein_g', 'fat_g', 'carb_g', 'source', 'accepted', 'engine_version', 'created_at', 'deleted_at']],
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

/** Modèle de la 0002 (et des 0006 et 0007) : un `_ai` (ligne entière) et un `_au` (champ par champ, `base_hlc`, `'+'` à la restauration). */
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

const [[FOOD, FOOD_COLUMNS], [PORTION, PORTION_COLUMNS], [ENTRY, ENTRY_COLUMNS], [TARGET, TARGET_COLUMNS]] = CAPTURE_TABLES_V8;

export const migration0008Nutrition: Migration = {
  version: 8,
  name: 'nutrition',
  statements: [
    `CREATE TABLE food (
      id TEXT PRIMARY KEY NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('custom', 'off')),
      barcode TEXT CHECK (barcode IS NULL OR (length(barcode) IN (8, 12, 13, 14) AND barcode NOT GLOB '*[^0-9]*')),
      name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
      brand TEXT CHECK (brand IS NULL OR length(brand) <= 120),
      kcal REAL CHECK (kcal IS NULL OR kcal BETWEEN 0 AND 900),
      protein_g REAL CHECK (protein_g IS NULL OR protein_g BETWEEN 0 AND 100),
      fat_g REAL CHECK (fat_g IS NULL OR fat_g BETWEEN 0 AND 100),
      carb_g REAL CHECK (carb_g IS NULL OR carb_g BETWEEN 0 AND 100),
      fiber_g REAL CHECK (fiber_g IS NULL OR fiber_g BETWEEN 0 AND 100),
      fetched_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL,
      CHECK (source = 'custom' OR (barcode IS NOT NULL AND fetched_at IS NOT NULL))
    )`,
    'CREATE INDEX idx_food_barcode ON food(barcode) WHERE barcode IS NOT NULL',
    'CREATE INDEX idx_food_name ON food(name COLLATE NOCASE)',
    `CREATE TABLE food_portion (
      id TEXT PRIMARY KEY NOT NULL,
      food_id TEXT NOT NULL REFERENCES food(id),
      label TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 80),
      grams REAL NOT NULL CHECK (grams > 0 AND grams <= 5000),
      position INTEGER NOT NULL CHECK (position >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL
    )`,
    'CREATE INDEX idx_food_portion_food ON food_portion(food_id, position)',
    `CREATE TABLE meal_entry (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      time TEXT NOT NULL CHECK (time GLOB '[0-2][0-9]:[0-5][0-9]' AND time < '24:00'),
      food_id TEXT CHECK (food_id IS NULL OR length(food_id) BETWEEN 1 AND 128),
      food_name TEXT NOT NULL CHECK (length(food_name) BETWEEN 1 AND 200),
      source TEXT NOT NULL CHECK (source IN ('custom', 'ciqual', 'off', 'estimate', 'manual')),
      grams REAL CHECK (grams IS NULL OR grams > 0),
      kcal REAL CHECK (kcal IS NULL OR kcal >= 0),
      protein_g REAL CHECK (protein_g IS NULL OR protein_g >= 0),
      fat_g REAL CHECK (fat_g IS NULL OR fat_g >= 0),
      carb_g REAL CHECK (carb_g IS NULL OR carb_g >= 0),
      method TEXT NOT NULL CHECK (method IN ('search', 'scan', 'photo', 'quickadd')),
      confidence REAL CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL
    )`,
    'CREATE INDEX idx_meal_entry_date ON meal_entry(date, time)',
    'CREATE INDEX idx_meal_entry_food ON meal_entry(food_id, date) WHERE food_id IS NOT NULL',
    `CREATE TABLE nutrition_target (
      id TEXT PRIMARY KEY NOT NULL,
      week_start TEXT NOT NULL CHECK (week_start GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      kcal REAL NOT NULL CHECK (kcal > 0),
      protein_g REAL NOT NULL CHECK (protein_g >= 0),
      fat_g REAL NOT NULL CHECK (fat_g >= 0),
      carb_g REAL NOT NULL CHECK (carb_g >= 0),
      source TEXT NOT NULL CHECK (source IN ('auto', 'manual')),
      accepted INTEGER NOT NULL CHECK (accepted IN (0, 1)),
      engine_version INTEGER CHECK (engine_version IS NULL OR engine_version >= 1),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL
    )`,
    'CREATE INDEX idx_nutrition_target_week ON nutrition_target(week_start)',
    ...captureTriggers(FOOD, FOOD_COLUMNS),
    ...captureTriggers(PORTION, PORTION_COLUMNS),
    ...captureTriggers(ENTRY, ENTRY_COLUMNS),
    ...captureTriggers(TARGET, TARGET_COLUMNS),
  ],
};
