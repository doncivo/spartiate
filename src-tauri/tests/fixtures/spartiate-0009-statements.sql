-- Généré par src/db/migrations/spartiateSchemaFixture.test.ts (UPDATE_SPARTIATE_FIXTURES=1) ; ne pas modifier à la main.
CREATE TABLE day_completeness (
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
    );
CREATE TABLE recipe (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
      servings INTEGER NOT NULL CHECK (typeof(servings) = 'integer' AND servings BETWEEN 1 AND 100),
      cooked_weight_g REAL CHECK (cooked_weight_g IS NULL OR (cooked_weight_g > 0 AND cooked_weight_g <= 20000)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL
    );
CREATE TABLE recipe_ingredient (
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
    );
CREATE INDEX idx_recipe_ingredient_recipe ON recipe_ingredient(recipe_id, position);
CREATE TRIGGER sync_day_completeness_ai AFTER INSERT ON day_completeness
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'day_completeness' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'day_completeness' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('day_completeness', NEW.id, '*');
     END;
CREATE TRIGGER sync_day_completeness_au AFTER UPDATE ON day_completeness
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'day_completeness', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'day_completeness' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'day_completeness', NEW.id, 'date', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'day_completeness' AND row_id = NEW.id AND field IN ('date', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'day_completeness' AND row_id = NEW.id AND field = 'date')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'day_completeness' AND row_id = NEW.id AND field = 'date'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'day_completeness' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.date IS NOT NEW.date
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'day_completeness' AND row_id = NEW.id AND field = 'date' AND OLD.date IS NOT NEW.date;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'day_completeness', NEW.id, 'date' WHERE OLD.date IS NOT NEW.date;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'day_completeness', NEW.id, 'state', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'day_completeness' AND row_id = NEW.id AND field IN ('state', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'day_completeness' AND row_id = NEW.id AND field = 'state')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'day_completeness' AND row_id = NEW.id AND field = 'state'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'day_completeness' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.state IS NOT NEW.state
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'day_completeness' AND row_id = NEW.id AND field = 'state' AND OLD.state IS NOT NEW.state;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'day_completeness', NEW.id, 'state' WHERE OLD.state IS NOT NEW.state;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'day_completeness', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'day_completeness' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'day_completeness' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'day_completeness' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'day_completeness' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'day_completeness' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'day_completeness', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'day_completeness', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'day_completeness' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'day_completeness' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'day_completeness' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'day_completeness' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'day_completeness' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'day_completeness', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'day_completeness' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'day_completeness', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END;
CREATE TRIGGER sync_recipe_ai AFTER INSERT ON recipe
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'recipe' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'recipe' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('recipe', NEW.id, '*');
     END;
CREATE TRIGGER sync_recipe_au AFTER UPDATE ON recipe
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'recipe', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'recipe' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recipe', NEW.id, 'name', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recipe' AND row_id = NEW.id AND field IN ('name', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recipe' AND row_id = NEW.id AND field = 'name')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe' AND row_id = NEW.id AND field = 'name'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.name IS NOT NEW.name
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recipe' AND row_id = NEW.id AND field = 'name' AND OLD.name IS NOT NEW.name;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recipe', NEW.id, 'name' WHERE OLD.name IS NOT NEW.name;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recipe', NEW.id, 'servings', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recipe' AND row_id = NEW.id AND field IN ('servings', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recipe' AND row_id = NEW.id AND field = 'servings')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe' AND row_id = NEW.id AND field = 'servings'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.servings IS NOT NEW.servings
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recipe' AND row_id = NEW.id AND field = 'servings' AND OLD.servings IS NOT NEW.servings;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recipe', NEW.id, 'servings' WHERE OLD.servings IS NOT NEW.servings;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recipe', NEW.id, 'cooked_weight_g', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recipe' AND row_id = NEW.id AND field IN ('cooked_weight_g', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recipe' AND row_id = NEW.id AND field = 'cooked_weight_g')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe' AND row_id = NEW.id AND field = 'cooked_weight_g'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.cooked_weight_g IS NOT NEW.cooked_weight_g
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recipe' AND row_id = NEW.id AND field = 'cooked_weight_g' AND OLD.cooked_weight_g IS NOT NEW.cooked_weight_g;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recipe', NEW.id, 'cooked_weight_g' WHERE OLD.cooked_weight_g IS NOT NEW.cooked_weight_g;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recipe', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recipe' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recipe' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recipe' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recipe', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recipe', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recipe' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recipe' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recipe' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recipe', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'recipe' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recipe', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END;
CREATE TRIGGER sync_recipe_ingredient_ai AFTER INSERT ON recipe_ingredient
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('recipe_ingredient', NEW.id, '*');
     END;
CREATE TRIGGER sync_recipe_ingredient_au AFTER UPDATE ON recipe_ingredient
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'recipe_ingredient', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recipe_ingredient', NEW.id, 'recipe_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field IN ('recipe_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'recipe_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'recipe_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.recipe_id IS NOT NEW.recipe_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'recipe_id' AND OLD.recipe_id IS NOT NEW.recipe_id;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recipe_ingredient', NEW.id, 'recipe_id' WHERE OLD.recipe_id IS NOT NEW.recipe_id;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recipe_ingredient', NEW.id, 'position', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field IN ('position', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'position')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'position'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.position IS NOT NEW.position
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'position' AND OLD.position IS NOT NEW.position;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recipe_ingredient', NEW.id, 'position' WHERE OLD.position IS NOT NEW.position;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recipe_ingredient', NEW.id, 'name', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field IN ('name', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'name')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'name'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.name IS NOT NEW.name
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'name' AND OLD.name IS NOT NEW.name;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recipe_ingredient', NEW.id, 'name' WHERE OLD.name IS NOT NEW.name;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recipe_ingredient', NEW.id, 'source', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field IN ('source', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'source')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'source'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.source IS NOT NEW.source
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'source' AND OLD.source IS NOT NEW.source;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recipe_ingredient', NEW.id, 'source' WHERE OLD.source IS NOT NEW.source;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recipe_ingredient', NEW.id, 'food_ref', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field IN ('food_ref', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'food_ref')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'food_ref'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.food_ref IS NOT NEW.food_ref
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'food_ref' AND OLD.food_ref IS NOT NEW.food_ref;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recipe_ingredient', NEW.id, 'food_ref' WHERE OLD.food_ref IS NOT NEW.food_ref;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recipe_ingredient', NEW.id, 'grams', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field IN ('grams', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'grams')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'grams'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.grams IS NOT NEW.grams
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'grams' AND OLD.grams IS NOT NEW.grams;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recipe_ingredient', NEW.id, 'grams' WHERE OLD.grams IS NOT NEW.grams;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recipe_ingredient', NEW.id, 'kcal_100g', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field IN ('kcal_100g', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'kcal_100g')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'kcal_100g'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.kcal_100g IS NOT NEW.kcal_100g
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'kcal_100g' AND OLD.kcal_100g IS NOT NEW.kcal_100g;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recipe_ingredient', NEW.id, 'kcal_100g' WHERE OLD.kcal_100g IS NOT NEW.kcal_100g;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recipe_ingredient', NEW.id, 'protein_100g', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field IN ('protein_100g', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'protein_100g')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'protein_100g'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.protein_100g IS NOT NEW.protein_100g
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'protein_100g' AND OLD.protein_100g IS NOT NEW.protein_100g;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recipe_ingredient', NEW.id, 'protein_100g' WHERE OLD.protein_100g IS NOT NEW.protein_100g;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recipe_ingredient', NEW.id, 'fat_100g', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field IN ('fat_100g', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'fat_100g')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'fat_100g'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.fat_100g IS NOT NEW.fat_100g
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'fat_100g' AND OLD.fat_100g IS NOT NEW.fat_100g;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recipe_ingredient', NEW.id, 'fat_100g' WHERE OLD.fat_100g IS NOT NEW.fat_100g;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recipe_ingredient', NEW.id, 'carb_100g', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field IN ('carb_100g', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'carb_100g')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'carb_100g'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.carb_100g IS NOT NEW.carb_100g
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'carb_100g' AND OLD.carb_100g IS NOT NEW.carb_100g;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recipe_ingredient', NEW.id, 'carb_100g' WHERE OLD.carb_100g IS NOT NEW.carb_100g;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recipe_ingredient', NEW.id, 'fiber_100g', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field IN ('fiber_100g', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'fiber_100g')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'fiber_100g'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.fiber_100g IS NOT NEW.fiber_100g
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'fiber_100g' AND OLD.fiber_100g IS NOT NEW.fiber_100g;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recipe_ingredient', NEW.id, 'fiber_100g' WHERE OLD.fiber_100g IS NOT NEW.fiber_100g;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recipe_ingredient', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recipe_ingredient', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recipe_ingredient', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recipe_ingredient', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recipe_ingredient', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END;
