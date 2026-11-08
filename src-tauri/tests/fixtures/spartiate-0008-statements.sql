-- Généré par src/db/migrations/spartiateSchemaFixture.test.ts (UPDATE_SPARTIATE_FIXTURES=1) ; ne pas modifier à la main.
CREATE TABLE food (
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
    );
CREATE INDEX idx_food_barcode ON food(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_food_name ON food(name COLLATE NOCASE);
CREATE TABLE food_portion (
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
    );
CREATE INDEX idx_food_portion_food ON food_portion(food_id, position);
CREATE TABLE meal_entry (
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
    );
CREATE INDEX idx_meal_entry_date ON meal_entry(date, time);
CREATE INDEX idx_meal_entry_food ON meal_entry(food_id, date) WHERE food_id IS NOT NULL;
CREATE TABLE nutrition_target (
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
    );
CREATE INDEX idx_nutrition_target_week ON nutrition_target(week_start);
CREATE TRIGGER sync_food_ai AFTER INSERT ON food
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'food' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('food', NEW.id, '*');
     END;
CREATE TRIGGER sync_food_au AFTER UPDATE ON food
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'food', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food', NEW.id, 'source', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field IN ('source', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'source')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'source'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.source IS NOT NEW.source
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field = 'source' AND OLD.source IS NOT NEW.source;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food', NEW.id, 'source' WHERE OLD.source IS NOT NEW.source;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food', NEW.id, 'barcode', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field IN ('barcode', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'barcode')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'barcode'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.barcode IS NOT NEW.barcode
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field = 'barcode' AND OLD.barcode IS NOT NEW.barcode;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food', NEW.id, 'barcode' WHERE OLD.barcode IS NOT NEW.barcode;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food', NEW.id, 'name', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field IN ('name', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'name')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'name'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.name IS NOT NEW.name
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field = 'name' AND OLD.name IS NOT NEW.name;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food', NEW.id, 'name' WHERE OLD.name IS NOT NEW.name;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food', NEW.id, 'brand', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field IN ('brand', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'brand')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'brand'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.brand IS NOT NEW.brand
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field = 'brand' AND OLD.brand IS NOT NEW.brand;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food', NEW.id, 'brand' WHERE OLD.brand IS NOT NEW.brand;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food', NEW.id, 'kcal', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field IN ('kcal', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'kcal')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'kcal'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.kcal IS NOT NEW.kcal
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field = 'kcal' AND OLD.kcal IS NOT NEW.kcal;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food', NEW.id, 'kcal' WHERE OLD.kcal IS NOT NEW.kcal;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food', NEW.id, 'protein_g', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field IN ('protein_g', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'protein_g')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'protein_g'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.protein_g IS NOT NEW.protein_g
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field = 'protein_g' AND OLD.protein_g IS NOT NEW.protein_g;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food', NEW.id, 'protein_g' WHERE OLD.protein_g IS NOT NEW.protein_g;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food', NEW.id, 'fat_g', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field IN ('fat_g', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'fat_g')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'fat_g'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.fat_g IS NOT NEW.fat_g
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field = 'fat_g' AND OLD.fat_g IS NOT NEW.fat_g;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food', NEW.id, 'fat_g' WHERE OLD.fat_g IS NOT NEW.fat_g;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food', NEW.id, 'carb_g', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field IN ('carb_g', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'carb_g')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'carb_g'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.carb_g IS NOT NEW.carb_g
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field = 'carb_g' AND OLD.carb_g IS NOT NEW.carb_g;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food', NEW.id, 'carb_g' WHERE OLD.carb_g IS NOT NEW.carb_g;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food', NEW.id, 'fiber_g', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field IN ('fiber_g', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'fiber_g')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'fiber_g'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.fiber_g IS NOT NEW.fiber_g
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field = 'fiber_g' AND OLD.fiber_g IS NOT NEW.fiber_g;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food', NEW.id, 'fiber_g' WHERE OLD.fiber_g IS NOT NEW.fiber_g;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food', NEW.id, 'fetched_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field IN ('fetched_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'fetched_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'fetched_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.fetched_at IS NOT NEW.fetched_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field = 'fetched_at' AND OLD.fetched_at IS NOT NEW.fetched_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food', NEW.id, 'fetched_at' WHERE OLD.fetched_at IS NOT NEW.fetched_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END;
CREATE TRIGGER sync_food_portion_ai AFTER INSERT ON food_portion
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'food_portion' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('food_portion', NEW.id, '*');
     END;
CREATE TRIGGER sync_food_portion_au AFTER UPDATE ON food_portion
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'food_portion', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food_portion', NEW.id, 'food_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food_portion' AND row_id = NEW.id AND field IN ('food_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'food_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'food_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.food_id IS NOT NEW.food_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'food_id' AND OLD.food_id IS NOT NEW.food_id;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food_portion', NEW.id, 'food_id' WHERE OLD.food_id IS NOT NEW.food_id;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food_portion', NEW.id, 'label', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food_portion' AND row_id = NEW.id AND field IN ('label', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'label')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'label'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.label IS NOT NEW.label
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'label' AND OLD.label IS NOT NEW.label;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food_portion', NEW.id, 'label' WHERE OLD.label IS NOT NEW.label;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food_portion', NEW.id, 'grams', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food_portion' AND row_id = NEW.id AND field IN ('grams', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'grams')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'grams'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.grams IS NOT NEW.grams
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'grams' AND OLD.grams IS NOT NEW.grams;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food_portion', NEW.id, 'grams' WHERE OLD.grams IS NOT NEW.grams;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food_portion', NEW.id, 'position', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food_portion' AND row_id = NEW.id AND field IN ('position', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'position')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'position'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.position IS NOT NEW.position
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'position' AND OLD.position IS NOT NEW.position;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food_portion', NEW.id, 'position' WHERE OLD.position IS NOT NEW.position;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food_portion', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food_portion' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food_portion', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'food_portion', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'food_portion' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food_portion', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'food_portion', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END;
CREATE TRIGGER sync_meal_entry_ai AFTER INSERT ON meal_entry
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'meal_entry' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('meal_entry', NEW.id, '*');
     END;
CREATE TRIGGER sync_meal_entry_au AFTER UPDATE ON meal_entry
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'meal_entry', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'meal_entry', NEW.id, 'date', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field IN ('date', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'date')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'date'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.date IS NOT NEW.date
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'date' AND OLD.date IS NOT NEW.date;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'meal_entry', NEW.id, 'date' WHERE OLD.date IS NOT NEW.date;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'meal_entry', NEW.id, 'time', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field IN ('time', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'time')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'time'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.time IS NOT NEW.time
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'time' AND OLD.time IS NOT NEW.time;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'meal_entry', NEW.id, 'time' WHERE OLD.time IS NOT NEW.time;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'meal_entry', NEW.id, 'food_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field IN ('food_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'food_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'food_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.food_id IS NOT NEW.food_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'food_id' AND OLD.food_id IS NOT NEW.food_id;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'meal_entry', NEW.id, 'food_id' WHERE OLD.food_id IS NOT NEW.food_id;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'meal_entry', NEW.id, 'food_name', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field IN ('food_name', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'food_name')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'food_name'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.food_name IS NOT NEW.food_name
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'food_name' AND OLD.food_name IS NOT NEW.food_name;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'meal_entry', NEW.id, 'food_name' WHERE OLD.food_name IS NOT NEW.food_name;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'meal_entry', NEW.id, 'source', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field IN ('source', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'source')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'source'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.source IS NOT NEW.source
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'source' AND OLD.source IS NOT NEW.source;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'meal_entry', NEW.id, 'source' WHERE OLD.source IS NOT NEW.source;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'meal_entry', NEW.id, 'grams', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field IN ('grams', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'grams')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'grams'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.grams IS NOT NEW.grams
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'grams' AND OLD.grams IS NOT NEW.grams;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'meal_entry', NEW.id, 'grams' WHERE OLD.grams IS NOT NEW.grams;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'meal_entry', NEW.id, 'kcal', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field IN ('kcal', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'kcal')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'kcal'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.kcal IS NOT NEW.kcal
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'kcal' AND OLD.kcal IS NOT NEW.kcal;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'meal_entry', NEW.id, 'kcal' WHERE OLD.kcal IS NOT NEW.kcal;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'meal_entry', NEW.id, 'protein_g', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field IN ('protein_g', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'protein_g')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'protein_g'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.protein_g IS NOT NEW.protein_g
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'protein_g' AND OLD.protein_g IS NOT NEW.protein_g;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'meal_entry', NEW.id, 'protein_g' WHERE OLD.protein_g IS NOT NEW.protein_g;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'meal_entry', NEW.id, 'fat_g', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field IN ('fat_g', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'fat_g')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'fat_g'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.fat_g IS NOT NEW.fat_g
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'fat_g' AND OLD.fat_g IS NOT NEW.fat_g;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'meal_entry', NEW.id, 'fat_g' WHERE OLD.fat_g IS NOT NEW.fat_g;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'meal_entry', NEW.id, 'carb_g', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field IN ('carb_g', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'carb_g')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'carb_g'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.carb_g IS NOT NEW.carb_g
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'carb_g' AND OLD.carb_g IS NOT NEW.carb_g;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'meal_entry', NEW.id, 'carb_g' WHERE OLD.carb_g IS NOT NEW.carb_g;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'meal_entry', NEW.id, 'method', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field IN ('method', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'method')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'method'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.method IS NOT NEW.method
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'method' AND OLD.method IS NOT NEW.method;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'meal_entry', NEW.id, 'method' WHERE OLD.method IS NOT NEW.method;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'meal_entry', NEW.id, 'confidence', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field IN ('confidence', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'confidence')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'confidence'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.confidence IS NOT NEW.confidence
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'confidence' AND OLD.confidence IS NOT NEW.confidence;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'meal_entry', NEW.id, 'confidence' WHERE OLD.confidence IS NOT NEW.confidence;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'meal_entry', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'meal_entry', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'meal_entry', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'meal_entry', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'meal_entry', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END;
CREATE TRIGGER sync_nutrition_target_ai AFTER INSERT ON nutrition_target
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'nutrition_target' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('nutrition_target', NEW.id, '*');
     END;
CREATE TRIGGER sync_nutrition_target_au AFTER UPDATE ON nutrition_target
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'nutrition_target', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'nutrition_target', NEW.id, 'week_start', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field IN ('week_start', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'week_start')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'week_start'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.week_start IS NOT NEW.week_start
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'week_start' AND OLD.week_start IS NOT NEW.week_start;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'nutrition_target', NEW.id, 'week_start' WHERE OLD.week_start IS NOT NEW.week_start;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'nutrition_target', NEW.id, 'kcal', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field IN ('kcal', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'kcal')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'kcal'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.kcal IS NOT NEW.kcal
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'kcal' AND OLD.kcal IS NOT NEW.kcal;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'nutrition_target', NEW.id, 'kcal' WHERE OLD.kcal IS NOT NEW.kcal;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'nutrition_target', NEW.id, 'protein_g', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field IN ('protein_g', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'protein_g')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'protein_g'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.protein_g IS NOT NEW.protein_g
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'protein_g' AND OLD.protein_g IS NOT NEW.protein_g;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'nutrition_target', NEW.id, 'protein_g' WHERE OLD.protein_g IS NOT NEW.protein_g;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'nutrition_target', NEW.id, 'fat_g', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field IN ('fat_g', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'fat_g')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'fat_g'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.fat_g IS NOT NEW.fat_g
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'fat_g' AND OLD.fat_g IS NOT NEW.fat_g;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'nutrition_target', NEW.id, 'fat_g' WHERE OLD.fat_g IS NOT NEW.fat_g;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'nutrition_target', NEW.id, 'carb_g', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field IN ('carb_g', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'carb_g')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'carb_g'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.carb_g IS NOT NEW.carb_g
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'carb_g' AND OLD.carb_g IS NOT NEW.carb_g;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'nutrition_target', NEW.id, 'carb_g' WHERE OLD.carb_g IS NOT NEW.carb_g;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'nutrition_target', NEW.id, 'source', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field IN ('source', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'source')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'source'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.source IS NOT NEW.source
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'source' AND OLD.source IS NOT NEW.source;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'nutrition_target', NEW.id, 'source' WHERE OLD.source IS NOT NEW.source;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'nutrition_target', NEW.id, 'accepted', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field IN ('accepted', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'accepted')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'accepted'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.accepted IS NOT NEW.accepted
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'accepted' AND OLD.accepted IS NOT NEW.accepted;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'nutrition_target', NEW.id, 'accepted' WHERE OLD.accepted IS NOT NEW.accepted;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'nutrition_target', NEW.id, 'engine_version', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field IN ('engine_version', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'engine_version')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'engine_version'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.engine_version IS NOT NEW.engine_version
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'engine_version' AND OLD.engine_version IS NOT NEW.engine_version;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'nutrition_target', NEW.id, 'engine_version' WHERE OLD.engine_version IS NOT NEW.engine_version;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'nutrition_target', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'nutrition_target', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'nutrition_target', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'nutrition_target', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'nutrition_target', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END;
