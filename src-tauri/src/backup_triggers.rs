//! Définitions de référence des déclencheurs de l'app (index de recherche, migration 0011 ; capture de la synchro `sync_*`, migration 0015), telles
//! que SQLite les enregistre dans
//! `sqlite_master` après les migrations. Elles servent (1) à refuser une sauvegarde dont un déclencheur a un corps modifié et (2) à recréer les
//! déclencheurs après une restauration. `src/platform/backup/triggers.test.ts` vérifie qu'elles sont identiques à celles des migrations :
//! à régénérer avec ce test si la migration 0011 change (jamais, une migration publiée ne se modifie plus) ou si un déclencheur est ajouté.

/// (nom, table, SQL) de chaque déclencheur, triés par nom.
pub const REFERENCE_TRIGGERS: [(&str, &str, &str); 88] = [
    (
        "search_checklist_ad",
        "checklist",
        r##"CREATE TRIGGER search_checklist_ad AFTER DELETE ON checklist BEGIN DELETE FROM search_index WHERE rowid IN (SELECT id FROM search_index_doc WHERE type = 'checklist' AND ref_id = OLD.id);
   DELETE FROM search_index_doc WHERE type = 'checklist' AND ref_id = OLD.id; END"##,
    ),
    (
        "search_checklist_ai",
        "checklist",
        r##"CREATE TRIGGER search_checklist_ai AFTER INSERT ON checklist BEGIN DELETE FROM search_index WHERE rowid IN (SELECT id FROM search_index_doc WHERE type = 'checklist' AND ref_id = NEW.id);
   DELETE FROM search_index_doc WHERE type = 'checklist' AND ref_id = NEW.id;
   INSERT INTO search_index_doc (type, ref_id) SELECT 'checklist', c.id FROM checklist c WHERE c.id = NEW.id AND c.deleted_at IS NULL;
   INSERT INTO search_index (rowid, type, ref_id, title, body)
     SELECT d.id, 'checklist', c.id, c.title, (SELECT COALESCE(group_concat(text, char(10)), '') FROM checklist_item WHERE checklist_id = c.id AND deleted_at IS NULL)
     FROM checklist c JOIN search_index_doc d ON d.type = 'checklist' AND d.ref_id = c.id WHERE c.id = NEW.id AND c.deleted_at IS NULL; END"##,
    ),
    (
        "search_checklist_au",
        "checklist",
        r##"CREATE TRIGGER search_checklist_au AFTER UPDATE OF title, deleted_at ON checklist BEGIN DELETE FROM search_index WHERE rowid IN (SELECT id FROM search_index_doc WHERE type = 'checklist' AND ref_id = NEW.id);
   DELETE FROM search_index_doc WHERE type = 'checklist' AND ref_id = NEW.id;
   INSERT INTO search_index_doc (type, ref_id) SELECT 'checklist', c.id FROM checklist c WHERE c.id = NEW.id AND c.deleted_at IS NULL;
   INSERT INTO search_index (rowid, type, ref_id, title, body)
     SELECT d.id, 'checklist', c.id, c.title, (SELECT COALESCE(group_concat(text, char(10)), '') FROM checklist_item WHERE checklist_id = c.id AND deleted_at IS NULL)
     FROM checklist c JOIN search_index_doc d ON d.type = 'checklist' AND d.ref_id = c.id WHERE c.id = NEW.id AND c.deleted_at IS NULL; END"##,
    ),
    (
        "search_checklist_item_ad",
        "checklist_item",
        r##"CREATE TRIGGER search_checklist_item_ad AFTER DELETE ON checklist_item BEGIN DELETE FROM search_index WHERE rowid IN (SELECT id FROM search_index_doc WHERE type = 'checklist' AND ref_id = OLD.checklist_id);
   DELETE FROM search_index_doc WHERE type = 'checklist' AND ref_id = OLD.checklist_id;
   INSERT INTO search_index_doc (type, ref_id) SELECT 'checklist', c.id FROM checklist c WHERE c.id = OLD.checklist_id AND c.deleted_at IS NULL;
   INSERT INTO search_index (rowid, type, ref_id, title, body)
     SELECT d.id, 'checklist', c.id, c.title, (SELECT COALESCE(group_concat(text, char(10)), '') FROM checklist_item WHERE checklist_id = c.id AND deleted_at IS NULL)
     FROM checklist c JOIN search_index_doc d ON d.type = 'checklist' AND d.ref_id = c.id WHERE c.id = OLD.checklist_id AND c.deleted_at IS NULL; END"##,
    ),
    (
        "search_checklist_item_ai",
        "checklist_item",
        r##"CREATE TRIGGER search_checklist_item_ai AFTER INSERT ON checklist_item BEGIN DELETE FROM search_index WHERE rowid IN (SELECT id FROM search_index_doc WHERE type = 'checklist' AND ref_id = NEW.checklist_id);
   DELETE FROM search_index_doc WHERE type = 'checklist' AND ref_id = NEW.checklist_id;
   INSERT INTO search_index_doc (type, ref_id) SELECT 'checklist', c.id FROM checklist c WHERE c.id = NEW.checklist_id AND c.deleted_at IS NULL;
   INSERT INTO search_index (rowid, type, ref_id, title, body)
     SELECT d.id, 'checklist', c.id, c.title, (SELECT COALESCE(group_concat(text, char(10)), '') FROM checklist_item WHERE checklist_id = c.id AND deleted_at IS NULL)
     FROM checklist c JOIN search_index_doc d ON d.type = 'checklist' AND d.ref_id = c.id WHERE c.id = NEW.checklist_id AND c.deleted_at IS NULL; END"##,
    ),
    (
        "search_checklist_item_au",
        "checklist_item",
        r##"CREATE TRIGGER search_checklist_item_au AFTER UPDATE OF text, deleted_at, checklist_id ON checklist_item BEGIN DELETE FROM search_index WHERE rowid IN (SELECT id FROM search_index_doc WHERE type = 'checklist' AND ref_id = NEW.checklist_id);
   DELETE FROM search_index_doc WHERE type = 'checklist' AND ref_id = NEW.checklist_id;
   INSERT INTO search_index_doc (type, ref_id) SELECT 'checklist', c.id FROM checklist c WHERE c.id = NEW.checklist_id AND c.deleted_at IS NULL;
   INSERT INTO search_index (rowid, type, ref_id, title, body)
     SELECT d.id, 'checklist', c.id, c.title, (SELECT COALESCE(group_concat(text, char(10)), '') FROM checklist_item WHERE checklist_id = c.id AND deleted_at IS NULL)
     FROM checklist c JOIN search_index_doc d ON d.type = 'checklist' AND d.ref_id = c.id WHERE c.id = NEW.checklist_id AND c.deleted_at IS NULL; DELETE FROM search_index WHERE rowid IN (SELECT id FROM search_index_doc WHERE type = 'checklist' AND ref_id = OLD.checklist_id);
   DELETE FROM search_index_doc WHERE type = 'checklist' AND ref_id = OLD.checklist_id;
   INSERT INTO search_index_doc (type, ref_id) SELECT 'checklist', c.id FROM checklist c WHERE c.id = OLD.checklist_id AND c.deleted_at IS NULL;
   INSERT INTO search_index (rowid, type, ref_id, title, body)
     SELECT d.id, 'checklist', c.id, c.title, (SELECT COALESCE(group_concat(text, char(10)), '') FROM checklist_item WHERE checklist_id = c.id AND deleted_at IS NULL)
     FROM checklist c JOIN search_index_doc d ON d.type = 'checklist' AND d.ref_id = c.id WHERE c.id = OLD.checklist_id AND c.deleted_at IS NULL; END"##,
    ),
    (
        "search_event_ad",
        "event",
        r##"CREATE TRIGGER search_event_ad AFTER DELETE ON event BEGIN DELETE FROM search_index WHERE rowid IN (SELECT id FROM search_index_doc WHERE type = 'event' AND ref_id = OLD.id);
   DELETE FROM search_index_doc WHERE type = 'event' AND ref_id = OLD.id; END"##,
    ),
    (
        "search_event_ai",
        "event",
        r##"CREATE TRIGGER search_event_ai AFTER INSERT ON event BEGIN DELETE FROM search_index WHERE rowid IN (SELECT id FROM search_index_doc WHERE type = 'event' AND ref_id = NEW.id);
   DELETE FROM search_index_doc WHERE type = 'event' AND ref_id = NEW.id; INSERT INTO search_index_doc (type, ref_id) SELECT 'event', NEW.id WHERE NEW.deleted_at IS NULL;
   INSERT INTO search_index (rowid, type, ref_id, title, body) SELECT last_insert_rowid(), 'event', NEW.id, NEW.title, '' WHERE NEW.deleted_at IS NULL; END"##,
    ),
    (
        "search_event_au",
        "event",
        r##"CREATE TRIGGER search_event_au AFTER UPDATE OF title, deleted_at ON event BEGIN DELETE FROM search_index WHERE rowid IN (SELECT id FROM search_index_doc WHERE type = 'event' AND ref_id = NEW.id);
   DELETE FROM search_index_doc WHERE type = 'event' AND ref_id = NEW.id; INSERT INTO search_index_doc (type, ref_id) SELECT 'event', NEW.id WHERE NEW.deleted_at IS NULL;
   INSERT INTO search_index (rowid, type, ref_id, title, body) SELECT last_insert_rowid(), 'event', NEW.id, NEW.title, '' WHERE NEW.deleted_at IS NULL; END"##,
    ),
    (
        "search_goal_ad",
        "goal",
        r##"CREATE TRIGGER search_goal_ad AFTER DELETE ON goal BEGIN DELETE FROM search_index WHERE rowid IN (SELECT id FROM search_index_doc WHERE type = 'goal' AND ref_id = OLD.id);
   DELETE FROM search_index_doc WHERE type = 'goal' AND ref_id = OLD.id; END"##,
    ),
    (
        "search_goal_ai",
        "goal",
        r##"CREATE TRIGGER search_goal_ai AFTER INSERT ON goal BEGIN DELETE FROM search_index WHERE rowid IN (SELECT id FROM search_index_doc WHERE type = 'goal' AND ref_id = NEW.id);
   DELETE FROM search_index_doc WHERE type = 'goal' AND ref_id = NEW.id; INSERT INTO search_index_doc (type, ref_id) SELECT 'goal', NEW.id WHERE NEW.deleted_at IS NULL;
   INSERT INTO search_index (rowid, type, ref_id, title, body) SELECT last_insert_rowid(), 'goal', NEW.id, NEW.title, '' WHERE NEW.deleted_at IS NULL; END"##,
    ),
    (
        "search_goal_au",
        "goal",
        r##"CREATE TRIGGER search_goal_au AFTER UPDATE OF title, deleted_at ON goal BEGIN DELETE FROM search_index WHERE rowid IN (SELECT id FROM search_index_doc WHERE type = 'goal' AND ref_id = NEW.id);
   DELETE FROM search_index_doc WHERE type = 'goal' AND ref_id = NEW.id; INSERT INTO search_index_doc (type, ref_id) SELECT 'goal', NEW.id WHERE NEW.deleted_at IS NULL;
   INSERT INTO search_index (rowid, type, ref_id, title, body) SELECT last_insert_rowid(), 'goal', NEW.id, NEW.title, '' WHERE NEW.deleted_at IS NULL; END"##,
    ),
    (
        "search_routine_ad",
        "routine",
        r##"CREATE TRIGGER search_routine_ad AFTER DELETE ON routine BEGIN DELETE FROM search_index WHERE rowid IN (SELECT id FROM search_index_doc WHERE type = 'routine' AND ref_id = OLD.id);
   DELETE FROM search_index_doc WHERE type = 'routine' AND ref_id = OLD.id; END"##,
    ),
    (
        "search_routine_ai",
        "routine",
        r##"CREATE TRIGGER search_routine_ai AFTER INSERT ON routine BEGIN DELETE FROM search_index WHERE rowid IN (SELECT id FROM search_index_doc WHERE type = 'routine' AND ref_id = NEW.id);
   DELETE FROM search_index_doc WHERE type = 'routine' AND ref_id = NEW.id; INSERT INTO search_index_doc (type, ref_id) SELECT 'routine', NEW.id WHERE NEW.deleted_at IS NULL;
   INSERT INTO search_index (rowid, type, ref_id, title, body) SELECT last_insert_rowid(), 'routine', NEW.id, NEW.title, '' WHERE NEW.deleted_at IS NULL; END"##,
    ),
    (
        "search_routine_au",
        "routine",
        r##"CREATE TRIGGER search_routine_au AFTER UPDATE OF title, deleted_at ON routine BEGIN DELETE FROM search_index WHERE rowid IN (SELECT id FROM search_index_doc WHERE type = 'routine' AND ref_id = NEW.id);
   DELETE FROM search_index_doc WHERE type = 'routine' AND ref_id = NEW.id; INSERT INTO search_index_doc (type, ref_id) SELECT 'routine', NEW.id WHERE NEW.deleted_at IS NULL;
   INSERT INTO search_index (rowid, type, ref_id, title, body) SELECT last_insert_rowid(), 'routine', NEW.id, NEW.title, '' WHERE NEW.deleted_at IS NULL; END"##,
    ),
    (
        "search_task_ad",
        "task",
        r##"CREATE TRIGGER search_task_ad AFTER DELETE ON task BEGIN DELETE FROM search_index WHERE rowid IN (SELECT id FROM search_index_doc WHERE type = 'task' AND ref_id = OLD.id);
   DELETE FROM search_index_doc WHERE type = 'task' AND ref_id = OLD.id; END"##,
    ),
    (
        "search_task_ai",
        "task",
        r##"CREATE TRIGGER search_task_ai AFTER INSERT ON task BEGIN DELETE FROM search_index WHERE rowid IN (SELECT id FROM search_index_doc WHERE type = 'task' AND ref_id = NEW.id);
   DELETE FROM search_index_doc WHERE type = 'task' AND ref_id = NEW.id; INSERT INTO search_index_doc (type, ref_id) SELECT 'task', NEW.id WHERE NEW.deleted_at IS NULL;
   INSERT INTO search_index (rowid, type, ref_id, title, body) SELECT last_insert_rowid(), 'task', NEW.id, NEW.title, NEW.note WHERE NEW.deleted_at IS NULL; END"##,
    ),
    (
        "search_task_au",
        "task",
        r##"CREATE TRIGGER search_task_au AFTER UPDATE OF title, note, deleted_at ON task BEGIN DELETE FROM search_index WHERE rowid IN (SELECT id FROM search_index_doc WHERE type = 'task' AND ref_id = NEW.id);
   DELETE FROM search_index_doc WHERE type = 'task' AND ref_id = NEW.id; INSERT INTO search_index_doc (type, ref_id) SELECT 'task', NEW.id WHERE NEW.deleted_at IS NULL;
   INSERT INTO search_index (rowid, type, ref_id, title, body) SELECT last_insert_rowid(), 'task', NEW.id, NEW.title, NEW.note WHERE NEW.deleted_at IS NULL; END"##,
    ),
    (
        "sync_body_weight_ai",
        "body_weight",
        r##"CREATE TRIGGER sync_body_weight_ai AFTER INSERT ON body_weight
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'body_weight' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('body_weight', NEW.id, '*');
     END"##,
    ),
    (
        "sync_body_weight_au",
        "body_weight",
        r##"CREATE TRIGGER sync_body_weight_au AFTER UPDATE ON body_weight
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'body_weight', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'body_weight', NEW.id, 'date', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field IN ('date', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'date')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'date'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.date IS NOT NEW.date
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'date' AND OLD.date IS NOT NEW.date;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'body_weight', NEW.id, 'date' WHERE OLD.date IS NOT NEW.date;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'body_weight', NEW.id, 'kg', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field IN ('kg', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'kg')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'kg'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.kg IS NOT NEW.kg
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'kg' AND OLD.kg IS NOT NEW.kg;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'body_weight', NEW.id, 'kg' WHERE OLD.kg IS NOT NEW.kg;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'body_weight', NEW.id, 'source', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field IN ('source', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'source')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'source'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.source IS NOT NEW.source
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'source' AND OLD.source IS NOT NEW.source;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'body_weight', NEW.id, 'source' WHERE OLD.source IS NOT NEW.source;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'body_weight', NEW.id, 'timezone', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field IN ('timezone', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'timezone')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'timezone'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.timezone IS NOT NEW.timezone
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'timezone' AND OLD.timezone IS NOT NEW.timezone;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'body_weight', NEW.id, 'timezone' WHERE OLD.timezone IS NOT NEW.timezone;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'body_weight', NEW.id, 'health_uuid', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field IN ('health_uuid', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'health_uuid')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'health_uuid'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.health_uuid IS NOT NEW.health_uuid
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'health_uuid' AND OLD.health_uuid IS NOT NEW.health_uuid;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'body_weight', NEW.id, 'health_uuid' WHERE OLD.health_uuid IS NOT NEW.health_uuid;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'body_weight', NEW.id, 'measured_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field IN ('measured_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'measured_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'measured_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.measured_at IS NOT NEW.measured_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'measured_at' AND OLD.measured_at IS NOT NEW.measured_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'body_weight', NEW.id, 'measured_at' WHERE OLD.measured_at IS NOT NEW.measured_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'body_weight', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'body_weight', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'body_weight', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'body_weight', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'body_weight' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'body_weight', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END"##,
    ),
    (
        "sync_calendar_account_ai",
        "calendar_account",
        r##"CREATE TRIGGER sync_calendar_account_ai AFTER INSERT ON calendar_account WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'calendar_account' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'calendar_account' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('calendar_account', NEW.id, '*');
     END"##,
    ),
    (
        "sync_calendar_account_au",
        "calendar_account",
        r##"CREATE TRIGGER sync_calendar_account_au AFTER UPDATE ON calendar_account WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'calendar_account', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'calendar_account' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'calendar_account', NEW.id, 'provider', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'calendar_account' AND row_id = NEW.id AND field IN ('provider', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'calendar_account' AND row_id = NEW.id AND field = 'provider')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'calendar_account' AND row_id = NEW.id AND field = 'provider'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'calendar_account' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.provider IS NOT NEW.provider
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'calendar_account' AND row_id = NEW.id AND field = 'provider' AND OLD.provider IS NOT NEW.provider;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'calendar_account', NEW.id, 'provider' WHERE OLD.provider IS NOT NEW.provider;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'calendar_account', NEW.id, 'label', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'calendar_account' AND row_id = NEW.id AND field IN ('label', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'calendar_account' AND row_id = NEW.id AND field = 'label')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'calendar_account' AND row_id = NEW.id AND field = 'label'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'calendar_account' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.label IS NOT NEW.label
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'calendar_account' AND row_id = NEW.id AND field = 'label' AND OLD.label IS NOT NEW.label;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'calendar_account', NEW.id, 'label' WHERE OLD.label IS NOT NEW.label;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'calendar_account', NEW.id, 'calendars', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'calendar_account' AND row_id = NEW.id AND field IN ('calendars', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'calendar_account' AND row_id = NEW.id AND field = 'calendars')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'calendar_account' AND row_id = NEW.id AND field = 'calendars'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'calendar_account' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.calendars IS NOT NEW.calendars
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'calendar_account' AND row_id = NEW.id AND field = 'calendars' AND OLD.calendars IS NOT NEW.calendars;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'calendar_account', NEW.id, 'calendars' WHERE OLD.calendars IS NOT NEW.calendars;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'calendar_account', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'calendar_account' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'calendar_account' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'calendar_account' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'calendar_account' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'calendar_account' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'calendar_account', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'calendar_account', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'calendar_account' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'calendar_account' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'calendar_account' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'calendar_account' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'calendar_account' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'calendar_account', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'calendar_account' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'calendar_account', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END"##,
    ),
    (
        "sync_checklist_ai",
        "checklist",
        r##"CREATE TRIGGER sync_checklist_ai AFTER INSERT ON checklist WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'checklist' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'checklist' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('checklist', NEW.id, '*');
     END"##,
    ),
    (
        "sync_checklist_au",
        "checklist",
        r##"CREATE TRIGGER sync_checklist_au AFTER UPDATE ON checklist WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'checklist', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'checklist' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'checklist', NEW.id, 'space_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'checklist' AND row_id = NEW.id AND field IN ('space_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'checklist' AND row_id = NEW.id AND field = 'space_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'checklist' AND row_id = NEW.id AND field = 'space_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'checklist' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.space_id IS NOT NEW.space_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'checklist' AND row_id = NEW.id AND field = 'space_id' AND OLD.space_id IS NOT NEW.space_id;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'checklist', NEW.id, 'space_id' WHERE OLD.space_id IS NOT NEW.space_id;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'checklist', NEW.id, 'title', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'checklist' AND row_id = NEW.id AND field IN ('title', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'checklist' AND row_id = NEW.id AND field = 'title')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'checklist' AND row_id = NEW.id AND field = 'title'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'checklist' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.title IS NOT NEW.title
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'checklist' AND row_id = NEW.id AND field = 'title' AND OLD.title IS NOT NEW.title;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'checklist', NEW.id, 'title' WHERE OLD.title IS NOT NEW.title;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'checklist', NEW.id, 'date', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'checklist' AND row_id = NEW.id AND field IN ('date', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'checklist' AND row_id = NEW.id AND field = 'date')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'checklist' AND row_id = NEW.id AND field = 'date'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'checklist' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.date IS NOT NEW.date
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'checklist' AND row_id = NEW.id AND field = 'date' AND OLD.date IS NOT NEW.date;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'checklist', NEW.id, 'date' WHERE OLD.date IS NOT NEW.date;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'checklist', NEW.id, 'is_template', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'checklist' AND row_id = NEW.id AND field IN ('is_template', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'checklist' AND row_id = NEW.id AND field = 'is_template')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'checklist' AND row_id = NEW.id AND field = 'is_template'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'checklist' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.is_template IS NOT NEW.is_template
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'checklist' AND row_id = NEW.id AND field = 'is_template' AND OLD.is_template IS NOT NEW.is_template;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'checklist', NEW.id, 'is_template' WHERE OLD.is_template IS NOT NEW.is_template;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'checklist', NEW.id, 'icon', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'checklist' AND row_id = NEW.id AND field IN ('icon', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'checklist' AND row_id = NEW.id AND field = 'icon')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'checklist' AND row_id = NEW.id AND field = 'icon'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'checklist' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.icon IS NOT NEW.icon
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'checklist' AND row_id = NEW.id AND field = 'icon' AND OLD.icon IS NOT NEW.icon;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'checklist', NEW.id, 'icon' WHERE OLD.icon IS NOT NEW.icon;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'checklist', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'checklist' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'checklist' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'checklist' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'checklist' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'checklist' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'checklist', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'checklist', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'checklist' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'checklist' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'checklist' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'checklist' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'checklist' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'checklist', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'checklist' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'checklist', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END"##,
    ),
    (
        "sync_checklist_item_ai",
        "checklist_item",
        r##"CREATE TRIGGER sync_checklist_item_ai AFTER INSERT ON checklist_item WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'checklist_item' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('checklist_item', NEW.id, '*');
     END"##,
    ),
    (
        "sync_checklist_item_au",
        "checklist_item",
        r##"CREATE TRIGGER sync_checklist_item_au AFTER UPDATE ON checklist_item WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'checklist_item', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'checklist_item', NEW.id, 'checklist_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field IN ('checklist_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field = 'checklist_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field = 'checklist_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.checklist_id IS NOT NEW.checklist_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field = 'checklist_id' AND OLD.checklist_id IS NOT NEW.checklist_id;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'checklist_item', NEW.id, 'checklist_id' WHERE OLD.checklist_id IS NOT NEW.checklist_id;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'checklist_item', NEW.id, 'text', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field IN ('text', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field = 'text')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field = 'text'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.text IS NOT NEW.text
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field = 'text' AND OLD.text IS NOT NEW.text;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'checklist_item', NEW.id, 'text' WHERE OLD.text IS NOT NEW.text;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'checklist_item', NEW.id, 'checked', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field IN ('checked', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field = 'checked')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field = 'checked'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.checked IS NOT NEW.checked
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field = 'checked' AND OLD.checked IS NOT NEW.checked;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'checklist_item', NEW.id, 'checked' WHERE OLD.checked IS NOT NEW.checked;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'checklist_item', NEW.id, 'sort_order', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field IN ('sort_order', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field = 'sort_order')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field = 'sort_order'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.sort_order IS NOT NEW.sort_order
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field = 'sort_order' AND OLD.sort_order IS NOT NEW.sort_order;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'checklist_item', NEW.id, 'sort_order' WHERE OLD.sort_order IS NOT NEW.sort_order;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'checklist_item', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'checklist_item', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'checklist_item', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'checklist_item', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'checklist_item' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'checklist_item', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END"##,
    ),
    (
        "sync_day_completeness_ai",
        "day_completeness",
        r##"CREATE TRIGGER sync_day_completeness_ai AFTER INSERT ON day_completeness
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'day_completeness' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'day_completeness' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('day_completeness', NEW.id, '*');
     END"##,
    ),
    (
        "sync_day_completeness_au",
        "day_completeness",
        r##"CREATE TRIGGER sync_day_completeness_au AFTER UPDATE ON day_completeness
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
     END"##,
    ),
    (
        "sync_equipment_profile_ai",
        "equipment_profile",
        r##"CREATE TRIGGER sync_equipment_profile_ai AFTER INSERT ON equipment_profile
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'equipment_profile' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('equipment_profile', NEW.id, '*');
     END"##,
    ),
    (
        "sync_equipment_profile_au",
        "equipment_profile",
        r##"CREATE TRIGGER sync_equipment_profile_au AFTER UPDATE ON equipment_profile
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'equipment_profile', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'equipment_profile', NEW.id, 'name', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field IN ('name', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'name')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'name'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.name IS NOT NEW.name
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'name' AND OLD.name IS NOT NEW.name;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'equipment_profile', NEW.id, 'name' WHERE OLD.name IS NOT NEW.name;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'equipment_profile', NEW.id, 'kind', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field IN ('kind', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'kind')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'kind'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.kind IS NOT NEW.kind
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'kind' AND OLD.kind IS NOT NEW.kind;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'equipment_profile', NEW.id, 'kind' WHERE OLD.kind IS NOT NEW.kind;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'equipment_profile', NEW.id, 'inventory', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field IN ('inventory', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'inventory')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'inventory'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.inventory IS NOT NEW.inventory
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'inventory' AND OLD.inventory IS NOT NEW.inventory;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'equipment_profile', NEW.id, 'inventory' WHERE OLD.inventory IS NOT NEW.inventory;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'equipment_profile', NEW.id, 'increments', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field IN ('increments', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'increments')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'increments'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.increments IS NOT NEW.increments
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'increments' AND OLD.increments IS NOT NEW.increments;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'equipment_profile', NEW.id, 'increments' WHERE OLD.increments IS NOT NEW.increments;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'equipment_profile', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'equipment_profile', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'equipment_profile', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'equipment_profile', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'equipment_profile' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'equipment_profile', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END"##,
    ),
    (
        "sync_event_ai",
        "event",
        r##"CREATE TRIGGER sync_event_ai AFTER INSERT ON event WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'event' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'event' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('event', NEW.id, '*');
     END"##,
    ),
    (
        "sync_event_au",
        "event",
        r##"CREATE TRIGGER sync_event_au AFTER UPDATE ON event WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'event', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'event', NEW.id, 'space_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'event' AND row_id = NEW.id AND field IN ('space_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = 'space_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = 'space_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.space_id IS NOT NEW.space_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'event' AND row_id = NEW.id AND field = 'space_id' AND OLD.space_id IS NOT NEW.space_id;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'event', NEW.id, 'space_id' WHERE OLD.space_id IS NOT NEW.space_id;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'event', NEW.id, 'title', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'event' AND row_id = NEW.id AND field IN ('title', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = 'title')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = 'title'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.title IS NOT NEW.title
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'event' AND row_id = NEW.id AND field = 'title' AND OLD.title IS NOT NEW.title;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'event', NEW.id, 'title' WHERE OLD.title IS NOT NEW.title;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'event', NEW.id, 'start_date', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'event' AND row_id = NEW.id AND field IN ('start_date', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = 'start_date')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = 'start_date'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.start_date IS NOT NEW.start_date
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'event' AND row_id = NEW.id AND field = 'start_date' AND OLD.start_date IS NOT NEW.start_date;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'event', NEW.id, 'start_date' WHERE OLD.start_date IS NOT NEW.start_date;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'event', NEW.id, 'start_time', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'event' AND row_id = NEW.id AND field IN ('start_time', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = 'start_time')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = 'start_time'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.start_time IS NOT NEW.start_time
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'event' AND row_id = NEW.id AND field = 'start_time' AND OLD.start_time IS NOT NEW.start_time;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'event', NEW.id, 'start_time' WHERE OLD.start_time IS NOT NEW.start_time;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'event', NEW.id, 'end_date', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'event' AND row_id = NEW.id AND field IN ('end_date', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = 'end_date')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = 'end_date'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.end_date IS NOT NEW.end_date
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'event' AND row_id = NEW.id AND field = 'end_date' AND OLD.end_date IS NOT NEW.end_date;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'event', NEW.id, 'end_date' WHERE OLD.end_date IS NOT NEW.end_date;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'event', NEW.id, 'end_time', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'event' AND row_id = NEW.id AND field IN ('end_time', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = 'end_time')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = 'end_time'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.end_time IS NOT NEW.end_time
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'event' AND row_id = NEW.id AND field = 'end_time' AND OLD.end_time IS NOT NEW.end_time;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'event', NEW.id, 'end_time' WHERE OLD.end_time IS NOT NEW.end_time;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'event', NEW.id, 'all_day', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'event' AND row_id = NEW.id AND field IN ('all_day', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = 'all_day')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = 'all_day'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.all_day IS NOT NEW.all_day
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'event' AND row_id = NEW.id AND field = 'all_day' AND OLD.all_day IS NOT NEW.all_day;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'event', NEW.id, 'all_day' WHERE OLD.all_day IS NOT NEW.all_day;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'event', NEW.id, 'kind', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'event' AND row_id = NEW.id AND field IN ('kind', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = 'kind')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = 'kind'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.kind IS NOT NEW.kind
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'event' AND row_id = NEW.id AND field = 'kind' AND OLD.kind IS NOT NEW.kind;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'event', NEW.id, 'kind' WHERE OLD.kind IS NOT NEW.kind;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'event', NEW.id, 'repeat', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'event' AND row_id = NEW.id AND field IN ('repeat', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = 'repeat')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = 'repeat'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.repeat IS NOT NEW.repeat
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'event' AND row_id = NEW.id AND field = 'repeat' AND OLD.repeat IS NOT NEW.repeat;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'event', NEW.id, 'repeat' WHERE OLD.repeat IS NOT NEW.repeat;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'event', NEW.id, 'important', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'event' AND row_id = NEW.id AND field IN ('important', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = 'important')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = 'important'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.important IS NOT NEW.important
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'event' AND row_id = NEW.id AND field = 'important' AND OLD.important IS NOT NEW.important;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'event', NEW.id, 'important' WHERE OLD.important IS NOT NEW.important;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'event', NEW.id, 'icon', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'event' AND row_id = NEW.id AND field IN ('icon', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = 'icon')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = 'icon'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.icon IS NOT NEW.icon
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'event' AND row_id = NEW.id AND field = 'icon' AND OLD.icon IS NOT NEW.icon;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'event', NEW.id, 'icon' WHERE OLD.icon IS NOT NEW.icon;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'event', NEW.id, 'birth_year', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'event' AND row_id = NEW.id AND field IN ('birth_year', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = 'birth_year')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = 'birth_year'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.birth_year IS NOT NEW.birth_year
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'event' AND row_id = NEW.id AND field = 'birth_year' AND OLD.birth_year IS NOT NEW.birth_year;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'event', NEW.id, 'birth_year' WHERE OLD.birth_year IS NOT NEW.birth_year;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'event', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'event' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'event' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'event', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'event', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'event' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'event' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'event' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'event', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'event' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'event', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT OR IGNORE INTO sync_outbox (table_name, row_id, field) SELECT 'reminder', r.id, '+' FROM reminder r WHERE r.target_type = 'event' AND r.target_id = NEW.id AND r.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END"##,
    ),
    (
        "sync_exercise_ai",
        "exercise",
        r##"CREATE TRIGGER sync_exercise_ai AFTER INSERT ON exercise
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'exercise' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('exercise', NEW.id, '*');
     END"##,
    ),
    (
        "sync_exercise_au",
        "exercise",
        r##"CREATE TRIGGER sync_exercise_au AFTER UPDATE ON exercise
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'exercise', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'name_fr', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('name_fr', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'name_fr')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'name_fr'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.name_fr IS NOT NEW.name_fr
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'name_fr' AND OLD.name_fr IS NOT NEW.name_fr;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'name_fr' WHERE OLD.name_fr IS NOT NEW.name_fr;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'aliases_en', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('aliases_en', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'aliases_en')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'aliases_en'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.aliases_en IS NOT NEW.aliases_en
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'aliases_en' AND OLD.aliases_en IS NOT NEW.aliases_en;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'aliases_en' WHERE OLD.aliases_en IS NOT NEW.aliases_en;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'muscles', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('muscles', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'muscles')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'muscles'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.muscles IS NOT NEW.muscles
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'muscles' AND OLD.muscles IS NOT NEW.muscles;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'muscles' WHERE OLD.muscles IS NOT NEW.muscles;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'equipment', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('equipment', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'equipment')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'equipment'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.equipment IS NOT NEW.equipment
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'equipment' AND OLD.equipment IS NOT NEW.equipment;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'equipment' WHERE OLD.equipment IS NOT NEW.equipment;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'pattern', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('pattern', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'pattern')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'pattern'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.pattern IS NOT NEW.pattern
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'pattern' AND OLD.pattern IS NOT NEW.pattern;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'pattern' WHERE OLD.pattern IS NOT NEW.pattern;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'kind', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('kind', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'kind')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'kind'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.kind IS NOT NEW.kind
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'kind' AND OLD.kind IS NOT NEW.kind;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'kind' WHERE OLD.kind IS NOT NEW.kind;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'metric', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('metric', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'metric')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'metric'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.metric IS NOT NEW.metric
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'metric' AND OLD.metric IS NOT NEW.metric;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'metric' WHERE OLD.metric IS NOT NEW.metric;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'bodyweight_fraction', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('bodyweight_fraction', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'bodyweight_fraction')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'bodyweight_fraction'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.bodyweight_fraction IS NOT NEW.bodyweight_fraction
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'bodyweight_fraction' AND OLD.bodyweight_fraction IS NOT NEW.bodyweight_fraction;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'bodyweight_fraction' WHERE OLD.bodyweight_fraction IS NOT NEW.bodyweight_fraction;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'default_rep_min', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('default_rep_min', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'default_rep_min')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'default_rep_min'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.default_rep_min IS NOT NEW.default_rep_min
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'default_rep_min' AND OLD.default_rep_min IS NOT NEW.default_rep_min;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'default_rep_min' WHERE OLD.default_rep_min IS NOT NEW.default_rep_min;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'default_rep_max', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('default_rep_max', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'default_rep_max')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'default_rep_max'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.default_rep_max IS NOT NEW.default_rep_max
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'default_rep_max' AND OLD.default_rep_max IS NOT NEW.default_rep_max;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'default_rep_max' WHERE OLD.default_rep_max IS NOT NEW.default_rep_max;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'default_rest_sec', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('default_rest_sec', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'default_rest_sec')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'default_rest_sec'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.default_rest_sec IS NOT NEW.default_rest_sec
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'default_rest_sec' AND OLD.default_rest_sec IS NOT NEW.default_rest_sec;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'default_rest_sec' WHERE OLD.default_rest_sec IS NOT NEW.default_rest_sec;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'instructions', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('instructions', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'instructions')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'instructions'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.instructions IS NOT NEW.instructions
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'instructions' AND OLD.instructions IS NOT NEW.instructions;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'instructions' WHERE OLD.instructions IS NOT NEW.instructions;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'media', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('media', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'media')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'media'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.media IS NOT NEW.media
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'media' AND OLD.media IS NOT NEW.media;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'media' WHERE OLD.media IS NOT NEW.media;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'strength_standard_key', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('strength_standard_key', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'strength_standard_key')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'strength_standard_key'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.strength_standard_key IS NOT NEW.strength_standard_key
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'strength_standard_key' AND OLD.strength_standard_key IS NOT NEW.strength_standard_key;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'strength_standard_key' WHERE OLD.strength_standard_key IS NOT NEW.strength_standard_key;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'schema_version', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('schema_version', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'schema_version')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'schema_version'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.schema_version IS NOT NEW.schema_version
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'schema_version' AND OLD.schema_version IS NOT NEW.schema_version;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'schema_version' WHERE OLD.schema_version IS NOT NEW.schema_version;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'exercise', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'exercise' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'exercise', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END"##,
    ),
    (
        "sync_focus_session_ai",
        "focus_session",
        r##"CREATE TRIGGER sync_focus_session_ai AFTER INSERT ON focus_session WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'focus_session' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('focus_session', NEW.id, '*');
     END"##,
    ),
    (
        "sync_focus_session_au",
        "focus_session",
        r##"CREATE TRIGGER sync_focus_session_au AFTER UPDATE ON focus_session WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'focus_session', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'focus_session', NEW.id, 'task_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'focus_session' AND row_id = NEW.id AND field IN ('task_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = 'task_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = 'task_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.task_id IS NOT NEW.task_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = 'task_id' AND OLD.task_id IS NOT NEW.task_id;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'focus_session', NEW.id, 'task_id' WHERE OLD.task_id IS NOT NEW.task_id;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'focus_session', NEW.id, 'space_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'focus_session' AND row_id = NEW.id AND field IN ('space_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = 'space_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = 'space_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.space_id IS NOT NEW.space_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = 'space_id' AND OLD.space_id IS NOT NEW.space_id;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'focus_session', NEW.id, 'space_id' WHERE OLD.space_id IS NOT NEW.space_id;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'focus_session', NEW.id, 'planned_min', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'focus_session' AND row_id = NEW.id AND field IN ('planned_min', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = 'planned_min')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = 'planned_min'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.planned_min IS NOT NEW.planned_min
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = 'planned_min' AND OLD.planned_min IS NOT NEW.planned_min;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'focus_session', NEW.id, 'planned_min' WHERE OLD.planned_min IS NOT NEW.planned_min;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'focus_session', NEW.id, 'started_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'focus_session' AND row_id = NEW.id AND field IN ('started_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = 'started_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = 'started_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.started_at IS NOT NEW.started_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = 'started_at' AND OLD.started_at IS NOT NEW.started_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'focus_session', NEW.id, 'started_at' WHERE OLD.started_at IS NOT NEW.started_at;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'focus_session', NEW.id, 'ended_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'focus_session' AND row_id = NEW.id AND field IN ('ended_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = 'ended_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = 'ended_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.ended_at IS NOT NEW.ended_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = 'ended_at' AND OLD.ended_at IS NOT NEW.ended_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'focus_session', NEW.id, 'ended_at' WHERE OLD.ended_at IS NOT NEW.ended_at;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'focus_session', NEW.id, 'paused_sec', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'focus_session' AND row_id = NEW.id AND field IN ('paused_sec', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = 'paused_sec')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = 'paused_sec'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.paused_sec IS NOT NEW.paused_sec
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = 'paused_sec' AND OLD.paused_sec IS NOT NEW.paused_sec;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'focus_session', NEW.id, 'paused_sec' WHERE OLD.paused_sec IS NOT NEW.paused_sec;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'focus_session', NEW.id, 'paused_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'focus_session' AND row_id = NEW.id AND field IN ('paused_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = 'paused_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = 'paused_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.paused_at IS NOT NEW.paused_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = 'paused_at' AND OLD.paused_at IS NOT NEW.paused_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'focus_session', NEW.id, 'paused_at' WHERE OLD.paused_at IS NOT NEW.paused_at;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'focus_session', NEW.id, 'project_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'focus_session' AND row_id = NEW.id AND field IN ('project_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = 'project_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = 'project_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.project_id IS NOT NEW.project_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = 'project_id' AND OLD.project_id IS NOT NEW.project_id;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'focus_session', NEW.id, 'project_id' WHERE OLD.project_id IS NOT NEW.project_id;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'focus_session', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'focus_session' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'focus_session', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'focus_session', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'focus_session' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'focus_session', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'focus_session' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'focus_session', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END"##,
    ),
    (
        "sync_food_ai",
        "food",
        r##"CREATE TRIGGER sync_food_ai AFTER INSERT ON food
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'food' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'food' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('food', NEW.id, '*');
     END"##,
    ),
    (
        "sync_food_au",
        "food",
        r##"CREATE TRIGGER sync_food_au AFTER UPDATE ON food
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
     END"##,
    ),
    (
        "sync_food_portion_ai",
        "food_portion",
        r##"CREATE TRIGGER sync_food_portion_ai AFTER INSERT ON food_portion
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'food_portion' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'food_portion' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('food_portion', NEW.id, '*');
     END"##,
    ),
    (
        "sync_food_portion_au",
        "food_portion",
        r##"CREATE TRIGGER sync_food_portion_au AFTER UPDATE ON food_portion
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
     END"##,
    ),
    (
        "sync_goal_ai",
        "goal",
        r##"CREATE TRIGGER sync_goal_ai AFTER INSERT ON goal WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'goal' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'goal' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('goal', NEW.id, '*');
     END"##,
    ),
    (
        "sync_goal_au",
        "goal",
        r##"CREATE TRIGGER sync_goal_au AFTER UPDATE ON goal WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'goal', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'goal' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'goal', NEW.id, 'space_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'goal' AND row_id = NEW.id AND field IN ('space_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'goal' AND row_id = NEW.id AND field = 'space_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'goal' AND row_id = NEW.id AND field = 'space_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'goal' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.space_id IS NOT NEW.space_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'goal' AND row_id = NEW.id AND field = 'space_id' AND OLD.space_id IS NOT NEW.space_id;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'goal', NEW.id, 'space_id' WHERE OLD.space_id IS NOT NEW.space_id;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'goal', NEW.id, 'week_start', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'goal' AND row_id = NEW.id AND field IN ('week_start', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'goal' AND row_id = NEW.id AND field = 'week_start')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'goal' AND row_id = NEW.id AND field = 'week_start'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'goal' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.week_start IS NOT NEW.week_start
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'goal' AND row_id = NEW.id AND field = 'week_start' AND OLD.week_start IS NOT NEW.week_start;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'goal', NEW.id, 'week_start' WHERE OLD.week_start IS NOT NEW.week_start;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'goal', NEW.id, 'title', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'goal' AND row_id = NEW.id AND field IN ('title', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'goal' AND row_id = NEW.id AND field = 'title')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'goal' AND row_id = NEW.id AND field = 'title'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'goal' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.title IS NOT NEW.title
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'goal' AND row_id = NEW.id AND field = 'title' AND OLD.title IS NOT NEW.title;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'goal', NEW.id, 'title' WHERE OLD.title IS NOT NEW.title;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'goal', NEW.id, 'icon', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'goal' AND row_id = NEW.id AND field IN ('icon', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'goal' AND row_id = NEW.id AND field = 'icon')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'goal' AND row_id = NEW.id AND field = 'icon'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'goal' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.icon IS NOT NEW.icon
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'goal' AND row_id = NEW.id AND field = 'icon' AND OLD.icon IS NOT NEW.icon;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'goal', NEW.id, 'icon' WHERE OLD.icon IS NOT NEW.icon;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'goal', NEW.id, 'pinned', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'goal' AND row_id = NEW.id AND field IN ('pinned', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'goal' AND row_id = NEW.id AND field = 'pinned')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'goal' AND row_id = NEW.id AND field = 'pinned'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'goal' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.pinned IS NOT NEW.pinned
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'goal' AND row_id = NEW.id AND field = 'pinned' AND OLD.pinned IS NOT NEW.pinned;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'goal', NEW.id, 'pinned' WHERE OLD.pinned IS NOT NEW.pinned;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'goal', NEW.id, 'status', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'goal' AND row_id = NEW.id AND field IN ('status', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'goal' AND row_id = NEW.id AND field = 'status')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'goal' AND row_id = NEW.id AND field = 'status'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'goal' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.status IS NOT NEW.status
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'goal' AND row_id = NEW.id AND field = 'status' AND OLD.status IS NOT NEW.status;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'goal', NEW.id, 'status' WHERE OLD.status IS NOT NEW.status;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'goal', NEW.id, 'carried_from_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'goal' AND row_id = NEW.id AND field IN ('carried_from_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'goal' AND row_id = NEW.id AND field = 'carried_from_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'goal' AND row_id = NEW.id AND field = 'carried_from_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'goal' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.carried_from_id IS NOT NEW.carried_from_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'goal' AND row_id = NEW.id AND field = 'carried_from_id' AND OLD.carried_from_id IS NOT NEW.carried_from_id;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'goal', NEW.id, 'carried_from_id' WHERE OLD.carried_from_id IS NOT NEW.carried_from_id;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'goal', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'goal' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'goal' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'goal' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'goal' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'goal' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'goal', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'goal', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'goal' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'goal' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'goal' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'goal' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'goal' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'goal', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'goal' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'goal', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END"##,
    ),
    (
        "sync_holiday_ai",
        "holiday",
        r##"CREATE TRIGGER sync_holiday_ai AFTER INSERT ON holiday WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'holiday' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'holiday' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('holiday', NEW.id, '*');
     END"##,
    ),
    (
        "sync_holiday_au",
        "holiday",
        r##"CREATE TRIGGER sync_holiday_au AFTER UPDATE ON holiday WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'holiday', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'holiday', NEW.id, 'country', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'holiday' AND row_id = NEW.id AND field IN ('country', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = 'country')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = 'country'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.country IS NOT NEW.country
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'holiday' AND row_id = NEW.id AND field = 'country' AND OLD.country IS NOT NEW.country;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'holiday', NEW.id, 'country' WHERE OLD.country IS NOT NEW.country;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'holiday', NEW.id, 'year', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'holiday' AND row_id = NEW.id AND field IN ('year', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = 'year')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = 'year'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.year IS NOT NEW.year
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'holiday' AND row_id = NEW.id AND field = 'year' AND OLD.year IS NOT NEW.year;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'holiday', NEW.id, 'year' WHERE OLD.year IS NOT NEW.year;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'holiday', NEW.id, 'key', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'holiday' AND row_id = NEW.id AND field IN ('key', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = 'key')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = 'key'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.key IS NOT NEW.key
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'holiday' AND row_id = NEW.id AND field = 'key' AND OLD.key IS NOT NEW.key;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'holiday', NEW.id, 'key' WHERE OLD.key IS NOT NEW.key;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'holiday', NEW.id, 'date', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'holiday' AND row_id = NEW.id AND field IN ('date', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = 'date')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = 'date'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.date IS NOT NEW.date
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'holiday' AND row_id = NEW.id AND field = 'date' AND OLD.date IS NOT NEW.date;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'holiday', NEW.id, 'date' WHERE OLD.date IS NOT NEW.date;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'holiday', NEW.id, 'name', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'holiday' AND row_id = NEW.id AND field IN ('name', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = 'name')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = 'name'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.name IS NOT NEW.name
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'holiday' AND row_id = NEW.id AND field = 'name' AND OLD.name IS NOT NEW.name;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'holiday', NEW.id, 'name' WHERE OLD.name IS NOT NEW.name;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'holiday', NEW.id, 'kind', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'holiday' AND row_id = NEW.id AND field IN ('kind', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = 'kind')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = 'kind'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.kind IS NOT NEW.kind
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'holiday' AND row_id = NEW.id AND field = 'kind' AND OLD.kind IS NOT NEW.kind;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'holiday', NEW.id, 'kind' WHERE OLD.kind IS NOT NEW.kind;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'holiday', NEW.id, 'source', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'holiday' AND row_id = NEW.id AND field IN ('source', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = 'source')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = 'source'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.source IS NOT NEW.source
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'holiday' AND row_id = NEW.id AND field = 'source' AND OLD.source IS NOT NEW.source;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'holiday', NEW.id, 'source' WHERE OLD.source IS NOT NEW.source;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'holiday', NEW.id, 'overridden', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'holiday' AND row_id = NEW.id AND field IN ('overridden', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = 'overridden')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = 'overridden'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.overridden IS NOT NEW.overridden
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'holiday' AND row_id = NEW.id AND field = 'overridden' AND OLD.overridden IS NOT NEW.overridden;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'holiday', NEW.id, 'overridden' WHERE OLD.overridden IS NOT NEW.overridden;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'holiday', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'holiday' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'holiday' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'holiday', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'holiday', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'holiday' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'holiday' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'holiday' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'holiday', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'holiday' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'holiday', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END"##,
    ),
    (
        "sync_meal_entry_ai",
        "meal_entry",
        r##"CREATE TRIGGER sync_meal_entry_ai AFTER INSERT ON meal_entry
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'meal_entry' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'meal_entry' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('meal_entry', NEW.id, '*');
     END"##,
    ),
    (
        "sync_meal_entry_au",
        "meal_entry",
        r##"CREATE TRIGGER sync_meal_entry_au AFTER UPDATE ON meal_entry
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
     END"##,
    ),
    (
        "sync_mesocycle_ai",
        "mesocycle",
        r##"CREATE TRIGGER sync_mesocycle_ai AFTER INSERT ON mesocycle
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'mesocycle' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('mesocycle', NEW.id, '*');
     END"##,
    ),
    (
        "sync_mesocycle_au",
        "mesocycle",
        r##"CREATE TRIGGER sync_mesocycle_au AFTER UPDATE ON mesocycle
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'mesocycle', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'mesocycle', NEW.id, 'routine_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field IN ('routine_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'routine_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'routine_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.routine_id IS NOT NEW.routine_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'routine_id' AND OLD.routine_id IS NOT NEW.routine_id;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'mesocycle', NEW.id, 'routine_id' WHERE OLD.routine_id IS NOT NEW.routine_id;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'mesocycle', NEW.id, 'start_date', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field IN ('start_date', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'start_date')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'start_date'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.start_date IS NOT NEW.start_date
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'start_date' AND OLD.start_date IS NOT NEW.start_date;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'mesocycle', NEW.id, 'start_date' WHERE OLD.start_date IS NOT NEW.start_date;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'mesocycle', NEW.id, 'weeks', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field IN ('weeks', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'weeks')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'weeks'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.weeks IS NOT NEW.weeks
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'weeks' AND OLD.weeks IS NOT NEW.weeks;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'mesocycle', NEW.id, 'weeks' WHERE OLD.weeks IS NOT NEW.weeks;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'mesocycle', NEW.id, 'unlimited', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field IN ('unlimited', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'unlimited')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'unlimited'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.unlimited IS NOT NEW.unlimited
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'unlimited' AND OLD.unlimited IS NOT NEW.unlimited;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'mesocycle', NEW.id, 'unlimited' WHERE OLD.unlimited IS NOT NEW.unlimited;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'mesocycle', NEW.id, 'deload_week', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field IN ('deload_week', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'deload_week')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'deload_week'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deload_week IS NOT NEW.deload_week
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'deload_week' AND OLD.deload_week IS NOT NEW.deload_week;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'mesocycle', NEW.id, 'deload_week' WHERE OLD.deload_week IS NOT NEW.deload_week;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'mesocycle', NEW.id, 'block_origin_week', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field IN ('block_origin_week', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'block_origin_week')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'block_origin_week'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.block_origin_week IS NOT NEW.block_origin_week
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'block_origin_week' AND OLD.block_origin_week IS NOT NEW.block_origin_week;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'mesocycle', NEW.id, 'block_origin_week' WHERE OLD.block_origin_week IS NOT NEW.block_origin_week;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'mesocycle', NEW.id, 'block_origin_index', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field IN ('block_origin_index', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'block_origin_index')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'block_origin_index'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.block_origin_index IS NOT NEW.block_origin_index
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'block_origin_index' AND OLD.block_origin_index IS NOT NEW.block_origin_index;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'mesocycle', NEW.id, 'block_origin_index' WHERE OLD.block_origin_index IS NOT NEW.block_origin_index;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'mesocycle', NEW.id, 'rotation_index', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field IN ('rotation_index', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'rotation_index')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'rotation_index'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.rotation_index IS NOT NEW.rotation_index
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'rotation_index' AND OLD.rotation_index IS NOT NEW.rotation_index;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'mesocycle', NEW.id, 'rotation_index' WHERE OLD.rotation_index IS NOT NEW.rotation_index;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'mesocycle', NEW.id, 'pauses', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field IN ('pauses', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'pauses')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'pauses'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.pauses IS NOT NEW.pauses
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'pauses' AND OLD.pauses IS NOT NEW.pauses;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'mesocycle', NEW.id, 'pauses' WHERE OLD.pauses IS NOT NEW.pauses;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'mesocycle', NEW.id, 'status', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field IN ('status', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'status')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'status'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.status IS NOT NEW.status
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'status' AND OLD.status IS NOT NEW.status;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'mesocycle', NEW.id, 'status' WHERE OLD.status IS NOT NEW.status;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'mesocycle', NEW.id, 'outcome', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field IN ('outcome', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'outcome')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'outcome'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.outcome IS NOT NEW.outcome
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'outcome' AND OLD.outcome IS NOT NEW.outcome;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'mesocycle', NEW.id, 'outcome' WHERE OLD.outcome IS NOT NEW.outcome;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'mesocycle', NEW.id, 'ended_on', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field IN ('ended_on', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'ended_on')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'ended_on'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.ended_on IS NOT NEW.ended_on
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'ended_on' AND OLD.ended_on IS NOT NEW.ended_on;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'mesocycle', NEW.id, 'ended_on' WHERE OLD.ended_on IS NOT NEW.ended_on;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'mesocycle', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'mesocycle', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'mesocycle', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'mesocycle', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'mesocycle' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'mesocycle', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END"##,
    ),
    (
        "sync_nutrition_target_ai",
        "nutrition_target",
        r##"CREATE TRIGGER sync_nutrition_target_ai AFTER INSERT ON nutrition_target
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'nutrition_target' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'nutrition_target' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('nutrition_target', NEW.id, '*');
     END"##,
    ),
    (
        "sync_nutrition_target_au",
        "nutrition_target",
        r##"CREATE TRIGGER sync_nutrition_target_au AFTER UPDATE ON nutrition_target
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
     END"##,
    ),
    (
        "sync_profile_ai",
        "profile",
        r##"CREATE TRIGGER sync_profile_ai AFTER INSERT ON profile
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'profile' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('profile', NEW.id, '*');
     END"##,
    ),
    (
        "sync_profile_au",
        "profile",
        r##"CREATE TRIGGER sync_profile_au AFTER UPDATE ON profile
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'profile', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'profile', NEW.id, 'sex', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field IN ('sex', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'sex')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'sex'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.sex IS NOT NEW.sex
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'sex' AND OLD.sex IS NOT NEW.sex;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'profile', NEW.id, 'sex' WHERE OLD.sex IS NOT NEW.sex;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'profile', NEW.id, 'birth_year', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field IN ('birth_year', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'birth_year')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'birth_year'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.birth_year IS NOT NEW.birth_year
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'birth_year' AND OLD.birth_year IS NOT NEW.birth_year;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'profile', NEW.id, 'birth_year' WHERE OLD.birth_year IS NOT NEW.birth_year;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'profile', NEW.id, 'height_cm', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field IN ('height_cm', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'height_cm')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'height_cm'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.height_cm IS NOT NEW.height_cm
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'height_cm' AND OLD.height_cm IS NOT NEW.height_cm;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'profile', NEW.id, 'height_cm' WHERE OLD.height_cm IS NOT NEW.height_cm;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'profile', NEW.id, 'goal', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field IN ('goal', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'goal')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'goal'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.goal IS NOT NEW.goal
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'goal' AND OLD.goal IS NOT NEW.goal;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'profile', NEW.id, 'goal' WHERE OLD.goal IS NOT NEW.goal;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'profile', NEW.id, 'experience', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field IN ('experience', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'experience')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'experience'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.experience IS NOT NEW.experience
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'experience' AND OLD.experience IS NOT NEW.experience;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'profile', NEW.id, 'experience' WHERE OLD.experience IS NOT NEW.experience;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'profile', NEW.id, 'units', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field IN ('units', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'units')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'units'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.units IS NOT NEW.units
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'units' AND OLD.units IS NOT NEW.units;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'profile', NEW.id, 'units' WHERE OLD.units IS NOT NEW.units;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'profile', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'profile', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'profile', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'profile', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'profile' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'profile', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END"##,
    ),
    (
        "sync_progression_profile_ai",
        "progression_profile",
        r##"CREATE TRIGGER sync_progression_profile_ai AFTER INSERT ON progression_profile
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'progression_profile' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('progression_profile', NEW.id, '*');
     END"##,
    ),
    (
        "sync_progression_profile_au",
        "progression_profile",
        r##"CREATE TRIGGER sync_progression_profile_au AFTER UPDATE ON progression_profile
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'progression_profile', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'progression_profile', NEW.id, 'exercise_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field IN ('exercise_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'exercise_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'exercise_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.exercise_id IS NOT NEW.exercise_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'exercise_id' AND OLD.exercise_id IS NOT NEW.exercise_id;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'progression_profile', NEW.id, 'exercise_id' WHERE OLD.exercise_id IS NOT NEW.exercise_id;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'progression_profile', NEW.id, 'estimated_1rm_kg', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field IN ('estimated_1rm_kg', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'estimated_1rm_kg')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'estimated_1rm_kg'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.estimated_1rm_kg IS NOT NEW.estimated_1rm_kg
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'estimated_1rm_kg' AND OLD.estimated_1rm_kg IS NOT NEW.estimated_1rm_kg;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'progression_profile', NEW.id, 'estimated_1rm_kg' WHERE OLD.estimated_1rm_kg IS NOT NEW.estimated_1rm_kg;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'progression_profile', NEW.id, 'confidence', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field IN ('confidence', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'confidence')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'confidence'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.confidence IS NOT NEW.confidence
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'confidence' AND OLD.confidence IS NOT NEW.confidence;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'progression_profile', NEW.id, 'confidence' WHERE OLD.confidence IS NOT NEW.confidence;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'progression_profile', NEW.id, 'last_easy_recalibration_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field IN ('last_easy_recalibration_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'last_easy_recalibration_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'last_easy_recalibration_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.last_easy_recalibration_at IS NOT NEW.last_easy_recalibration_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'last_easy_recalibration_at' AND OLD.last_easy_recalibration_at IS NOT NEW.last_easy_recalibration_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'progression_profile', NEW.id, 'last_easy_recalibration_at' WHERE OLD.last_easy_recalibration_at IS NOT NEW.last_easy_recalibration_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'progression_profile', NEW.id, 'engine_version', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field IN ('engine_version', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'engine_version')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'engine_version'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.engine_version IS NOT NEW.engine_version
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'engine_version' AND OLD.engine_version IS NOT NEW.engine_version;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'progression_profile', NEW.id, 'engine_version' WHERE OLD.engine_version IS NOT NEW.engine_version;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'progression_profile', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'progression_profile', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'progression_profile', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'progression_profile', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'progression_profile' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'progression_profile', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END"##,
    ),
    (
        "sync_project_ai",
        "project",
        r##"CREATE TRIGGER sync_project_ai AFTER INSERT ON project WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'project' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'project' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('project', NEW.id, '*');
     END"##,
    ),
    (
        "sync_project_au",
        "project",
        r##"CREATE TRIGGER sync_project_au AFTER UPDATE ON project WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'project', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'project' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'project', NEW.id, 'space_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'project' AND row_id = NEW.id AND field IN ('space_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'project' AND row_id = NEW.id AND field = 'space_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'project' AND row_id = NEW.id AND field = 'space_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'project' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.space_id IS NOT NEW.space_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'project' AND row_id = NEW.id AND field = 'space_id' AND OLD.space_id IS NOT NEW.space_id;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'project', NEW.id, 'space_id' WHERE OLD.space_id IS NOT NEW.space_id;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'project', NEW.id, 'name', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'project' AND row_id = NEW.id AND field IN ('name', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'project' AND row_id = NEW.id AND field = 'name')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'project' AND row_id = NEW.id AND field = 'name'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'project' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.name IS NOT NEW.name
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'project' AND row_id = NEW.id AND field = 'name' AND OLD.name IS NOT NEW.name;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'project', NEW.id, 'name' WHERE OLD.name IS NOT NEW.name;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'project', NEW.id, 'color', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'project' AND row_id = NEW.id AND field IN ('color', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'project' AND row_id = NEW.id AND field = 'color')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'project' AND row_id = NEW.id AND field = 'color'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'project' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.color IS NOT NEW.color
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'project' AND row_id = NEW.id AND field = 'color' AND OLD.color IS NOT NEW.color;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'project', NEW.id, 'color' WHERE OLD.color IS NOT NEW.color;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'project', NEW.id, 'archived', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'project' AND row_id = NEW.id AND field IN ('archived', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'project' AND row_id = NEW.id AND field = 'archived')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'project' AND row_id = NEW.id AND field = 'archived'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'project' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.archived IS NOT NEW.archived
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'project' AND row_id = NEW.id AND field = 'archived' AND OLD.archived IS NOT NEW.archived;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'project', NEW.id, 'archived' WHERE OLD.archived IS NOT NEW.archived;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'project', NEW.id, 'sort_order', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'project' AND row_id = NEW.id AND field IN ('sort_order', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'project' AND row_id = NEW.id AND field = 'sort_order')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'project' AND row_id = NEW.id AND field = 'sort_order'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'project' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.sort_order IS NOT NEW.sort_order
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'project' AND row_id = NEW.id AND field = 'sort_order' AND OLD.sort_order IS NOT NEW.sort_order;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'project', NEW.id, 'sort_order' WHERE OLD.sort_order IS NOT NEW.sort_order;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'project', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'project' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'project' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'project' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'project' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'project' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'project', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'project', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'project' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'project' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'project' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'project' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'project' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'project', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'project' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'project', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END"##,
    ),
    (
        "sync_recipe_ai",
        "recipe",
        r##"CREATE TRIGGER sync_recipe_ai AFTER INSERT ON recipe
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'recipe' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'recipe' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('recipe', NEW.id, '*');
     END"##,
    ),
    (
        "sync_recipe_au",
        "recipe",
        r##"CREATE TRIGGER sync_recipe_au AFTER UPDATE ON recipe
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
     END"##,
    ),
    (
        "sync_recipe_ingredient_ai",
        "recipe_ingredient",
        r##"CREATE TRIGGER sync_recipe_ingredient_ai AFTER INSERT ON recipe_ingredient
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'recipe_ingredient' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('recipe_ingredient', NEW.id, '*');
     END"##,
    ),
    (
        "sync_recipe_ingredient_au",
        "recipe_ingredient",
        r##"CREATE TRIGGER sync_recipe_ingredient_au AFTER UPDATE ON recipe_ingredient
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
     END"##,
    ),
    (
        "sync_recommendation_decision_ai",
        "recommendation_decision",
        r##"CREATE TRIGGER sync_recommendation_decision_ai AFTER INSERT ON recommendation_decision
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) AND (SELECT ended_at FROM workout WHERE id = NEW.workout_id) IS NOT NULL BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'recommendation_decision' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('recommendation_decision', NEW.id, '*');
     END"##,
    ),
    (
        "sync_recommendation_decision_au",
        "recommendation_decision",
        r##"CREATE TRIGGER sync_recommendation_decision_au AFTER UPDATE ON recommendation_decision
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) AND (SELECT ended_at FROM workout WHERE id = NEW.workout_id) IS NOT NULL BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'recommendation_decision', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recommendation_decision', NEW.id, 'exercise_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field IN ('exercise_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'exercise_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'exercise_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.exercise_id IS NOT NEW.exercise_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'exercise_id' AND OLD.exercise_id IS NOT NEW.exercise_id;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recommendation_decision', NEW.id, 'exercise_id' WHERE OLD.exercise_id IS NOT NEW.exercise_id;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recommendation_decision', NEW.id, 'workout_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field IN ('workout_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'workout_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'workout_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.workout_id IS NOT NEW.workout_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'workout_id' AND OLD.workout_id IS NOT NEW.workout_id;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recommendation_decision', NEW.id, 'workout_id' WHERE OLD.workout_id IS NOT NEW.workout_id;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recommendation_decision', NEW.id, 'workout_set_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field IN ('workout_set_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'workout_set_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'workout_set_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.workout_set_id IS NOT NEW.workout_set_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'workout_set_id' AND OLD.workout_set_id IS NOT NEW.workout_set_id;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recommendation_decision', NEW.id, 'workout_set_id' WHERE OLD.workout_set_id IS NOT NEW.workout_set_id;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recommendation_decision', NEW.id, 'engine_version', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field IN ('engine_version', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'engine_version')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'engine_version'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.engine_version IS NOT NEW.engine_version
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'engine_version' AND OLD.engine_version IS NOT NEW.engine_version;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recommendation_decision', NEW.id, 'engine_version' WHERE OLD.engine_version IS NOT NEW.engine_version;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recommendation_decision', NEW.id, 'prescription', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field IN ('prescription', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'prescription')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'prescription'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.prescription IS NOT NEW.prescription
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'prescription' AND OLD.prescription IS NOT NEW.prescription;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recommendation_decision', NEW.id, 'prescription' WHERE OLD.prescription IS NOT NEW.prescription;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recommendation_decision', NEW.id, 'reasons', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field IN ('reasons', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'reasons')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'reasons'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.reasons IS NOT NEW.reasons
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'reasons' AND OLD.reasons IS NOT NEW.reasons;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recommendation_decision', NEW.id, 'reasons' WHERE OLD.reasons IS NOT NEW.reasons;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recommendation_decision', NEW.id, 'accepted', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field IN ('accepted', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'accepted')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'accepted'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.accepted IS NOT NEW.accepted
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'accepted' AND OLD.accepted IS NOT NEW.accepted;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recommendation_decision', NEW.id, 'accepted' WHERE OLD.accepted IS NOT NEW.accepted;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recommendation_decision', NEW.id, 'chosen_load_kg', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field IN ('chosen_load_kg', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'chosen_load_kg')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'chosen_load_kg'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.chosen_load_kg IS NOT NEW.chosen_load_kg
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'chosen_load_kg' AND OLD.chosen_load_kg IS NOT NEW.chosen_load_kg;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recommendation_decision', NEW.id, 'chosen_load_kg' WHERE OLD.chosen_load_kg IS NOT NEW.chosen_load_kg;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recommendation_decision', NEW.id, 'chosen_reps', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field IN ('chosen_reps', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'chosen_reps')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'chosen_reps'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.chosen_reps IS NOT NEW.chosen_reps
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'chosen_reps' AND OLD.chosen_reps IS NOT NEW.chosen_reps;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recommendation_decision', NEW.id, 'chosen_reps' WHERE OLD.chosen_reps IS NOT NEW.chosen_reps;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recommendation_decision', NEW.id, 'decided_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field IN ('decided_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'decided_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'decided_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.decided_at IS NOT NEW.decided_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'decided_at' AND OLD.decided_at IS NOT NEW.decided_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recommendation_decision', NEW.id, 'decided_at' WHERE OLD.decided_at IS NOT NEW.decided_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recommendation_decision', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recommendation_decision', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recommendation_decision', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recommendation_decision', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recommendation_decision', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END"##,
    ),
    (
        "sync_recurrence_ai",
        "recurrence",
        r##"CREATE TRIGGER sync_recurrence_ai AFTER INSERT ON recurrence WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'recurrence' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('recurrence', NEW.id, '*');
     END"##,
    ),
    (
        "sync_recurrence_au",
        "recurrence",
        r##"CREATE TRIGGER sync_recurrence_au AFTER UPDATE ON recurrence WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'recurrence', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recurrence', NEW.id, 'freq', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recurrence' AND row_id = NEW.id AND field IN ('freq', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = 'freq')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = 'freq'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.freq IS NOT NEW.freq
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = 'freq' AND OLD.freq IS NOT NEW.freq;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recurrence', NEW.id, 'freq' WHERE OLD.freq IS NOT NEW.freq;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recurrence', NEW.id, 'interval', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recurrence' AND row_id = NEW.id AND field IN ('interval', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = 'interval')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = 'interval'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.interval IS NOT NEW.interval
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = 'interval' AND OLD.interval IS NOT NEW.interval;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recurrence', NEW.id, 'interval' WHERE OLD.interval IS NOT NEW.interval;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recurrence', NEW.id, 'weekdays', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recurrence' AND row_id = NEW.id AND field IN ('weekdays', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = 'weekdays')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = 'weekdays'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.weekdays IS NOT NEW.weekdays
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = 'weekdays' AND OLD.weekdays IS NOT NEW.weekdays;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recurrence', NEW.id, 'weekdays' WHERE OLD.weekdays IS NOT NEW.weekdays;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recurrence', NEW.id, 'month_day', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recurrence' AND row_id = NEW.id AND field IN ('month_day', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = 'month_day')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = 'month_day'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.month_day IS NOT NEW.month_day
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = 'month_day' AND OLD.month_day IS NOT NEW.month_day;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recurrence', NEW.id, 'month_day' WHERE OLD.month_day IS NOT NEW.month_day;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recurrence', NEW.id, 'nth_weekday', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recurrence' AND row_id = NEW.id AND field IN ('nth_weekday', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = 'nth_weekday')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = 'nth_weekday'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.nth_weekday IS NOT NEW.nth_weekday
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = 'nth_weekday' AND OLD.nth_weekday IS NOT NEW.nth_weekday;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recurrence', NEW.id, 'nth_weekday' WHERE OLD.nth_weekday IS NOT NEW.nth_weekday;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recurrence', NEW.id, 'until', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recurrence' AND row_id = NEW.id AND field IN ('until', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = 'until')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = 'until'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.until IS NOT NEW.until
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = 'until' AND OLD.until IS NOT NEW.until;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recurrence', NEW.id, 'until' WHERE OLD.until IS NOT NEW.until;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recurrence', NEW.id, 'count', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recurrence' AND row_id = NEW.id AND field IN ('count', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = 'count')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = 'count'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.count IS NOT NEW.count
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = 'count' AND OLD.count IS NOT NEW.count;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recurrence', NEW.id, 'count' WHERE OLD.count IS NOT NEW.count;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recurrence', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recurrence' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recurrence', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'recurrence', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'recurrence' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recurrence', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'recurrence' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recurrence', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END"##,
    ),
    (
        "sync_reminder_ai",
        "reminder",
        r##"CREATE TRIGGER sync_reminder_ai AFTER INSERT ON reminder WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'reminder' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'reminder' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('reminder', NEW.id, '*');
     END"##,
    ),
    (
        "sync_reminder_au",
        "reminder",
        r##"CREATE TRIGGER sync_reminder_au AFTER UPDATE ON reminder WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'reminder', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'reminder' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'reminder', NEW.id, 'target_type', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'reminder' AND row_id = NEW.id AND field IN ('target_type', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'reminder' AND row_id = NEW.id AND field = 'target_type')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'reminder' AND row_id = NEW.id AND field = 'target_type'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'reminder' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.target_type IS NOT NEW.target_type
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'reminder' AND row_id = NEW.id AND field = 'target_type' AND OLD.target_type IS NOT NEW.target_type;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'reminder', NEW.id, 'target_type' WHERE OLD.target_type IS NOT NEW.target_type;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'reminder', NEW.id, 'target_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'reminder' AND row_id = NEW.id AND field IN ('target_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'reminder' AND row_id = NEW.id AND field = 'target_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'reminder' AND row_id = NEW.id AND field = 'target_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'reminder' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.target_id IS NOT NEW.target_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'reminder' AND row_id = NEW.id AND field = 'target_id' AND OLD.target_id IS NOT NEW.target_id;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'reminder', NEW.id, 'target_id' WHERE OLD.target_id IS NOT NEW.target_id;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'reminder', NEW.id, 'offset_min', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'reminder' AND row_id = NEW.id AND field IN ('offset_min', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'reminder' AND row_id = NEW.id AND field = 'offset_min')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'reminder' AND row_id = NEW.id AND field = 'offset_min'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'reminder' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.offset_min IS NOT NEW.offset_min
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'reminder' AND row_id = NEW.id AND field = 'offset_min' AND OLD.offset_min IS NOT NEW.offset_min;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'reminder', NEW.id, 'offset_min' WHERE OLD.offset_min IS NOT NEW.offset_min;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'reminder', NEW.id, 'fire_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'reminder' AND row_id = NEW.id AND field IN ('fire_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'reminder' AND row_id = NEW.id AND field = 'fire_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'reminder' AND row_id = NEW.id AND field = 'fire_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'reminder' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.fire_at IS NOT NEW.fire_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'reminder' AND row_id = NEW.id AND field = 'fire_at' AND OLD.fire_at IS NOT NEW.fire_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'reminder', NEW.id, 'fire_at' WHERE OLD.fire_at IS NOT NEW.fire_at;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'reminder', NEW.id, 'delivered', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'reminder' AND row_id = NEW.id AND field IN ('delivered', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'reminder' AND row_id = NEW.id AND field = 'delivered')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'reminder' AND row_id = NEW.id AND field = 'delivered'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'reminder' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.delivered IS NOT NEW.delivered
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'reminder' AND row_id = NEW.id AND field = 'delivered' AND OLD.delivered IS NOT NEW.delivered;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'reminder', NEW.id, 'delivered' WHERE OLD.delivered IS NOT NEW.delivered;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'reminder', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'reminder' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'reminder' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'reminder' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'reminder' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'reminder' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'reminder', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'reminder', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'reminder' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'reminder' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'reminder' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'reminder' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'reminder' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'reminder', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'reminder' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'reminder', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END"##,
    ),
    (
        "sync_routine_ai",
        "routine",
        r##"CREATE TRIGGER sync_routine_ai AFTER INSERT ON routine
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'routine' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'routine' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('routine', NEW.id, '*');
     END"##,
    ),
    (
        "sync_routine_au",
        "routine",
        r##"CREATE TRIGGER sync_routine_au AFTER UPDATE ON routine
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'routine', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'routine' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine', NEW.id, 'name', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine' AND row_id = NEW.id AND field IN ('name', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine' AND row_id = NEW.id AND field = 'name')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine' AND row_id = NEW.id AND field = 'name'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.name IS NOT NEW.name
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine' AND row_id = NEW.id AND field = 'name' AND OLD.name IS NOT NEW.name;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine', NEW.id, 'name' WHERE OLD.name IS NOT NEW.name;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine', NEW.id, 'mode', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine' AND row_id = NEW.id AND field IN ('mode', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine' AND row_id = NEW.id AND field = 'mode')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine' AND row_id = NEW.id AND field = 'mode'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.mode IS NOT NEW.mode
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine' AND row_id = NEW.id AND field = 'mode' AND OLD.mode IS NOT NEW.mode;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine', NEW.id, 'mode' WHERE OLD.mode IS NOT NEW.mode;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'routine' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END"##,
    ),
    (
        "sync_routine_day_ai",
        "routine_day",
        r##"CREATE TRIGGER sync_routine_day_ai AFTER INSERT ON routine_day
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'routine_day' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('routine_day', NEW.id, '*');
     END"##,
    ),
    (
        "sync_routine_day_au",
        "routine_day",
        r##"CREATE TRIGGER sync_routine_day_au AFTER UPDATE ON routine_day
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'routine_day', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_day', NEW.id, 'routine_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_day' AND row_id = NEW.id AND field IN ('routine_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = 'routine_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = 'routine_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.routine_id IS NOT NEW.routine_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = 'routine_id' AND OLD.routine_id IS NOT NEW.routine_id;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_day', NEW.id, 'routine_id' WHERE OLD.routine_id IS NOT NEW.routine_id;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_day', NEW.id, 'name', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_day' AND row_id = NEW.id AND field IN ('name', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = 'name')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = 'name'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.name IS NOT NEW.name
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = 'name' AND OLD.name IS NOT NEW.name;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_day', NEW.id, 'name' WHERE OLD.name IS NOT NEW.name;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_day', NEW.id, 'day_order', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_day' AND row_id = NEW.id AND field IN ('day_order', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = 'day_order')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = 'day_order'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.day_order IS NOT NEW.day_order
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = 'day_order' AND OLD.day_order IS NOT NEW.day_order;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_day', NEW.id, 'day_order' WHERE OLD.day_order IS NOT NEW.day_order;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_day', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_day' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_day', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_day', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_day' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_day', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'routine_day' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_day', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END"##,
    ),
    (
        "sync_routine_exercise_ai",
        "routine_exercise",
        r##"CREATE TRIGGER sync_routine_exercise_ai AFTER INSERT ON routine_exercise
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'routine_exercise' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('routine_exercise', NEW.id, '*');
     END"##,
    ),
    (
        "sync_routine_exercise_au",
        "routine_exercise",
        r##"CREATE TRIGGER sync_routine_exercise_au AFTER UPDATE ON routine_exercise
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'routine_exercise', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_exercise', NEW.id, 'routine_day_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field IN ('routine_day_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'routine_day_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'routine_day_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.routine_day_id IS NOT NEW.routine_day_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'routine_day_id' AND OLD.routine_day_id IS NOT NEW.routine_day_id;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_exercise', NEW.id, 'routine_day_id' WHERE OLD.routine_day_id IS NOT NEW.routine_day_id;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_exercise', NEW.id, 'exercise_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field IN ('exercise_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'exercise_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'exercise_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.exercise_id IS NOT NEW.exercise_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'exercise_id' AND OLD.exercise_id IS NOT NEW.exercise_id;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_exercise', NEW.id, 'exercise_id' WHERE OLD.exercise_id IS NOT NEW.exercise_id;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_exercise', NEW.id, 'exercise_name', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field IN ('exercise_name', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'exercise_name')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'exercise_name'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.exercise_name IS NOT NEW.exercise_name
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'exercise_name' AND OLD.exercise_name IS NOT NEW.exercise_name;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_exercise', NEW.id, 'exercise_name' WHERE OLD.exercise_name IS NOT NEW.exercise_name;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_exercise', NEW.id, 'sets', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field IN ('sets', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'sets')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'sets'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.sets IS NOT NEW.sets
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'sets' AND OLD.sets IS NOT NEW.sets;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_exercise', NEW.id, 'sets' WHERE OLD.sets IS NOT NEW.sets;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_exercise', NEW.id, 'rep_min', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field IN ('rep_min', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'rep_min')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'rep_min'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.rep_min IS NOT NEW.rep_min
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'rep_min' AND OLD.rep_min IS NOT NEW.rep_min;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_exercise', NEW.id, 'rep_min' WHERE OLD.rep_min IS NOT NEW.rep_min;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_exercise', NEW.id, 'rep_max', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field IN ('rep_max', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'rep_max')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'rep_max'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.rep_max IS NOT NEW.rep_max
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'rep_max' AND OLD.rep_max IS NOT NEW.rep_max;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_exercise', NEW.id, 'rep_max' WHERE OLD.rep_max IS NOT NEW.rep_max;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_exercise', NEW.id, 'rir', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field IN ('rir', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'rir')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'rir'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.rir IS NOT NEW.rir
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'rir' AND OLD.rir IS NOT NEW.rir;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_exercise', NEW.id, 'rir' WHERE OLD.rir IS NOT NEW.rir;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_exercise', NEW.id, 'rest_sec', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field IN ('rest_sec', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'rest_sec')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'rest_sec'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.rest_sec IS NOT NEW.rest_sec
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'rest_sec' AND OLD.rest_sec IS NOT NEW.rest_sec;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_exercise', NEW.id, 'rest_sec' WHERE OLD.rest_sec IS NOT NEW.rest_sec;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_exercise', NEW.id, 'position', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field IN ('position', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'position')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'position'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.position IS NOT NEW.position
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'position' AND OLD.position IS NOT NEW.position;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_exercise', NEW.id, 'position' WHERE OLD.position IS NOT NEW.position;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_exercise', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_exercise', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_exercise', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_exercise', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'routine_exercise' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_exercise', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END"##,
    ),
    (
        "sync_routine_log_ai",
        "routine_log",
        r##"CREATE TRIGGER sync_routine_log_ai AFTER INSERT ON routine_log WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'routine_log' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'routine_log' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('routine_log', NEW.id, '*');
     END"##,
    ),
    (
        "sync_routine_log_au",
        "routine_log",
        r##"CREATE TRIGGER sync_routine_log_au AFTER UPDATE ON routine_log WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'routine_log', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'routine_log' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_log', NEW.id, 'routine_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_log' AND row_id = NEW.id AND field IN ('routine_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_log' AND row_id = NEW.id AND field = 'routine_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_log' AND row_id = NEW.id AND field = 'routine_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_log' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.routine_id IS NOT NEW.routine_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'routine_log' AND row_id = NEW.id AND field = 'routine_id' AND OLD.routine_id IS NOT NEW.routine_id;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_log', NEW.id, 'routine_id' WHERE OLD.routine_id IS NOT NEW.routine_id;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_log', NEW.id, 'date', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_log' AND row_id = NEW.id AND field IN ('date', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_log' AND row_id = NEW.id AND field = 'date')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_log' AND row_id = NEW.id AND field = 'date'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_log' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.date IS NOT NEW.date
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'routine_log' AND row_id = NEW.id AND field = 'date' AND OLD.date IS NOT NEW.date;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_log', NEW.id, 'date' WHERE OLD.date IS NOT NEW.date;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_log', NEW.id, 'done_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_log' AND row_id = NEW.id AND field IN ('done_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_log' AND row_id = NEW.id AND field = 'done_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_log' AND row_id = NEW.id AND field = 'done_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_log' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.done_at IS NOT NEW.done_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'routine_log' AND row_id = NEW.id AND field = 'done_at' AND OLD.done_at IS NOT NEW.done_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_log', NEW.id, 'done_at' WHERE OLD.done_at IS NOT NEW.done_at;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_log', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_log' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_log' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_log' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_log' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'routine_log' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_log', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_log', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_log' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_log' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_log' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_log' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'routine_log' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_log', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'routine_log' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_log', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END"##,
    ),
    (
        "sync_routine_pause_ai",
        "routine_pause",
        r##"CREATE TRIGGER sync_routine_pause_ai AFTER INSERT ON routine_pause WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'routine_pause' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'routine_pause' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('routine_pause', NEW.id, '*');
     END"##,
    ),
    (
        "sync_routine_pause_au",
        "routine_pause",
        r##"CREATE TRIGGER sync_routine_pause_au AFTER UPDATE ON routine_pause WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'routine_pause', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'routine_pause' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_pause', NEW.id, 'routine_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_pause' AND row_id = NEW.id AND field IN ('routine_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_pause' AND row_id = NEW.id AND field = 'routine_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_pause' AND row_id = NEW.id AND field = 'routine_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_pause' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.routine_id IS NOT NEW.routine_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'routine_pause' AND row_id = NEW.id AND field = 'routine_id' AND OLD.routine_id IS NOT NEW.routine_id;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_pause', NEW.id, 'routine_id' WHERE OLD.routine_id IS NOT NEW.routine_id;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_pause', NEW.id, 'from_date', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_pause' AND row_id = NEW.id AND field IN ('from_date', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_pause' AND row_id = NEW.id AND field = 'from_date')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_pause' AND row_id = NEW.id AND field = 'from_date'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_pause' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.from_date IS NOT NEW.from_date
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'routine_pause' AND row_id = NEW.id AND field = 'from_date' AND OLD.from_date IS NOT NEW.from_date;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_pause', NEW.id, 'from_date' WHERE OLD.from_date IS NOT NEW.from_date;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_pause', NEW.id, 'to_date', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_pause' AND row_id = NEW.id AND field IN ('to_date', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_pause' AND row_id = NEW.id AND field = 'to_date')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_pause' AND row_id = NEW.id AND field = 'to_date'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_pause' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.to_date IS NOT NEW.to_date
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'routine_pause' AND row_id = NEW.id AND field = 'to_date' AND OLD.to_date IS NOT NEW.to_date;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_pause', NEW.id, 'to_date' WHERE OLD.to_date IS NOT NEW.to_date;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_pause', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_pause' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_pause' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_pause' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_pause' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'routine_pause' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_pause', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'routine_pause', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'routine_pause' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'routine_pause' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_pause' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'routine_pause' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'routine_pause' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_pause', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'routine_pause' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'routine_pause', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END"##,
    ),
    (
        "sync_settings_ai",
        "settings",
        r##"CREATE TRIGGER sync_settings_ai AFTER INSERT ON settings WHEN NOT EXISTS (SELECT 1 FROM sync_guard) AND NEW.key IN ('appleReminders.create', 'appleReminders.lastPassAt', 'appleReminders.lists', 'appleReminders.pending', 'general.firstWeekday', 'general.locale', 'general.theme', 'general.timeFormat', 'holidays.countries', 'reminders.defaultOffsets', 'reminders.eveningRecap', 'reminders.morningRecap', 'spaces.defaultSpaceId', 'tasks.carryOverUndone', 'today.hideRoutines') BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'settings' AND row_id = NEW.key;
       DELETE FROM sync_outbox WHERE table_name = 'settings' AND row_id = NEW.key AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('settings', NEW.key, '*');
     END"##,
    ),
    (
        "sync_settings_au",
        "settings",
        r##"CREATE TRIGGER sync_settings_au AFTER UPDATE ON settings WHEN NOT EXISTS (SELECT 1 FROM sync_guard) AND NEW.key IN ('appleReminders.create', 'appleReminders.lastPassAt', 'appleReminders.lists', 'appleReminders.pending', 'general.firstWeekday', 'general.locale', 'general.theme', 'general.timeFormat', 'holidays.countries', 'reminders.defaultOffsets', 'reminders.eveningRecap', 'reminders.morningRecap', 'spaces.defaultSpaceId', 'tasks.carryOverUndone', 'today.hideRoutines') BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'settings', NEW.key, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'settings' AND row_id = NEW.key AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'settings', NEW.key, 'value', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'settings' AND row_id = NEW.key AND field IN ('value', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'settings' AND row_id = NEW.key AND field = 'value')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'settings' AND row_id = NEW.key AND field = 'value'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'settings' AND row_id = NEW.key AND field = '*'), OLD.hlc) END
       WHERE OLD.value IS NOT NEW.value
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'settings' AND row_id = NEW.key AND field = 'value' AND OLD.value IS NOT NEW.value;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'settings', NEW.key, 'value' WHERE OLD.value IS NOT NEW.value;
     END"##,
    ),
    (
        "sync_space_ai",
        "space",
        r##"CREATE TRIGGER sync_space_ai AFTER INSERT ON space WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'space' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'space' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('space', NEW.id, '*');
     END"##,
    ),
    (
        "sync_space_au",
        "space",
        r##"CREATE TRIGGER sync_space_au AFTER UPDATE ON space WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'space', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'space' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'space', NEW.id, 'name', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'space' AND row_id = NEW.id AND field IN ('name', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'space' AND row_id = NEW.id AND field = 'name')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'space' AND row_id = NEW.id AND field = 'name'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'space' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.name IS NOT NEW.name
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'space' AND row_id = NEW.id AND field = 'name' AND OLD.name IS NOT NEW.name;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'space', NEW.id, 'name' WHERE OLD.name IS NOT NEW.name;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'space', NEW.id, 'color', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'space' AND row_id = NEW.id AND field IN ('color', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'space' AND row_id = NEW.id AND field = 'color')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'space' AND row_id = NEW.id AND field = 'color'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'space' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.color IS NOT NEW.color
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'space' AND row_id = NEW.id AND field = 'color' AND OLD.color IS NOT NEW.color;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'space', NEW.id, 'color' WHERE OLD.color IS NOT NEW.color;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'space', NEW.id, 'sort_order', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'space' AND row_id = NEW.id AND field IN ('sort_order', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'space' AND row_id = NEW.id AND field = 'sort_order')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'space' AND row_id = NEW.id AND field = 'sort_order'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'space' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.sort_order IS NOT NEW.sort_order
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'space' AND row_id = NEW.id AND field = 'sort_order' AND OLD.sort_order IS NOT NEW.sort_order;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'space', NEW.id, 'sort_order' WHERE OLD.sort_order IS NOT NEW.sort_order;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'space', NEW.id, 'quiet_hours', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'space' AND row_id = NEW.id AND field IN ('quiet_hours', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'space' AND row_id = NEW.id AND field = 'quiet_hours')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'space' AND row_id = NEW.id AND field = 'quiet_hours'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'space' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.quiet_hours IS NOT NEW.quiet_hours
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'space' AND row_id = NEW.id AND field = 'quiet_hours' AND OLD.quiet_hours IS NOT NEW.quiet_hours;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'space', NEW.id, 'quiet_hours' WHERE OLD.quiet_hours IS NOT NEW.quiet_hours;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'space', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'space' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'space' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'space' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'space' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'space' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'space', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'space', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'space' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'space' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'space' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'space' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'space' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'space', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'space' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'space', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END"##,
    ),
    (
        "sync_task_ai",
        "task",
        r##"CREATE TRIGGER sync_task_ai AFTER INSERT ON task WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'task' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('task', NEW.id, '*');
     END"##,
    ),
    (
        "sync_task_au",
        "task",
        r##"CREATE TRIGGER sync_task_au AFTER UPDATE ON task WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'task', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'space_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('space_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'space_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'space_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.space_id IS NOT NEW.space_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'space_id' AND OLD.space_id IS NOT NEW.space_id;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'space_id' WHERE OLD.space_id IS NOT NEW.space_id;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'project_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('project_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'project_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'project_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.project_id IS NOT NEW.project_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'project_id' AND OLD.project_id IS NOT NEW.project_id;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'project_id' WHERE OLD.project_id IS NOT NEW.project_id;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'title', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('title', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'title')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'title'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.title IS NOT NEW.title
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'title' AND OLD.title IS NOT NEW.title;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'title' WHERE OLD.title IS NOT NEW.title;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'note', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('note', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'note')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'note'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.note IS NOT NEW.note
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'note' AND OLD.note IS NOT NEW.note;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'note' WHERE OLD.note IS NOT NEW.note;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'date', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('date', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'date')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'date'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.date IS NOT NEW.date
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'date' AND OLD.date IS NOT NEW.date;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'date' WHERE OLD.date IS NOT NEW.date;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'time', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('time', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'time')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'time'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.time IS NOT NEW.time
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'time' AND OLD.time IS NOT NEW.time;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'time' WHERE OLD.time IS NOT NEW.time;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'status', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('status', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'status')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'status'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.status IS NOT NEW.status
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'status' AND OLD.status IS NOT NEW.status;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'status' WHERE OLD.status IS NOT NEW.status;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'done_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('done_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'done_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'done_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.done_at IS NOT NEW.done_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'done_at' AND OLD.done_at IS NOT NEW.done_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'done_at' WHERE OLD.done_at IS NOT NEW.done_at;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'sort_order', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('sort_order', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'sort_order')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'sort_order'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.sort_order IS NOT NEW.sort_order
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'sort_order' AND OLD.sort_order IS NOT NEW.sort_order;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'sort_order' WHERE OLD.sort_order IS NOT NEW.sort_order;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'carried_over', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('carried_over', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'carried_over')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'carried_over'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.carried_over IS NOT NEW.carried_over
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'carried_over' AND OLD.carried_over IS NOT NEW.carried_over;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'carried_over' WHERE OLD.carried_over IS NOT NEW.carried_over;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'recurrence_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('recurrence_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'recurrence_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'recurrence_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.recurrence_id IS NOT NEW.recurrence_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'recurrence_id' AND OLD.recurrence_id IS NOT NEW.recurrence_id;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'recurrence_id' WHERE OLD.recurrence_id IS NOT NEW.recurrence_id;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'series_index', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('series_index', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'series_index')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'series_index'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.series_index IS NOT NEW.series_index
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'series_index' AND OLD.series_index IS NOT NEW.series_index;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'series_index' WHERE OLD.series_index IS NOT NEW.series_index;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'goal_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('goal_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'goal_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'goal_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.goal_id IS NOT NEW.goal_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'goal_id' AND OLD.goal_id IS NOT NEW.goal_id;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'goal_id' WHERE OLD.goal_id IS NOT NEW.goal_id;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'icon', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('icon', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'icon')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'icon'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.icon IS NOT NEW.icon
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'icon' AND OLD.icon IS NOT NEW.icon;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'icon' WHERE OLD.icon IS NOT NEW.icon;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'someday', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('someday', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'someday')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'someday'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.someday IS NOT NEW.someday
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'someday' AND OLD.someday IS NOT NEW.someday;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'someday' WHERE OLD.someday IS NOT NEW.someday;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'source', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('source', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'source')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'source'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.source IS NOT NEW.source
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'source' AND OLD.source IS NOT NEW.source;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'source' WHERE OLD.source IS NOT NEW.source;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'external_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('external_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'external_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'external_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.external_id IS NOT NEW.external_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'external_id' AND OLD.external_id IS NOT NEW.external_id;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'external_id' WHERE OLD.external_id IS NOT NEW.external_id;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'series_template', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('series_template', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'series_template')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'series_template'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.series_template IS NOT NEW.series_template
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'series_template' AND OLD.series_template IS NOT NEW.series_template;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'series_template' WHERE OLD.series_template IS NOT NEW.series_template;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'external_event_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('external_event_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'external_event_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'external_event_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.external_event_id IS NOT NEW.external_event_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'external_event_id' AND OLD.external_event_id IS NOT NEW.external_event_id;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'external_event_id' WHERE OLD.external_event_id IS NOT NEW.external_event_id;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'apple_list_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('apple_list_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'apple_list_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'apple_list_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.apple_list_id IS NOT NEW.apple_list_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'apple_list_id' AND OLD.apple_list_id IS NOT NEW.apple_list_id;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'apple_list_id' WHERE OLD.apple_list_id IS NOT NEW.apple_list_id;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'apple_recurring', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('apple_recurring', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'apple_recurring')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'apple_recurring'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.apple_recurring IS NOT NEW.apple_recurring
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'apple_recurring' AND OLD.apple_recurring IS NOT NEW.apple_recurring;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'apple_recurring' WHERE OLD.apple_recurring IS NOT NEW.apple_recurring;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT OR IGNORE INTO sync_outbox (table_name, row_id, field) SELECT 'reminder', r.id, '+' FROM reminder r WHERE r.target_type = 'task' AND r.target_id = NEW.id AND r.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END"##,
    ),
    (
        "sync_workout_ai",
        "workout",
        r##"CREATE TRIGGER sync_workout_ai AFTER INSERT ON workout
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) AND NEW.ended_at IS NOT NULL BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'workout' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('workout', NEW.id, '*');
     END"##,
    ),
    (
        "sync_workout_au",
        "workout",
        r##"CREATE TRIGGER sync_workout_au AFTER UPDATE ON workout
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) AND NEW.ended_at IS NOT NULL BEGIN
       DELETE FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND OLD.ended_at IS NULL;
       DELETE FROM sync_tombstone WHERE table_name = 'workout' AND row_id = NEW.id AND OLD.ended_at IS NULL;
       DELETE FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND OLD.ended_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout', NEW.id, '*' WHERE OLD.ended_at IS NULL;
       DELETE FROM sync_field_clock WHERE table_name = 'workout_set' AND OLD.ended_at IS NULL AND row_id IN (SELECT id FROM workout_set WHERE workout_id = NEW.id);
       DELETE FROM sync_tombstone WHERE table_name = 'workout_set' AND OLD.ended_at IS NULL AND row_id IN (SELECT id FROM workout_set WHERE workout_id = NEW.id);
       DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND OLD.ended_at IS NULL AND row_id IN (SELECT id FROM workout_set WHERE workout_id = NEW.id);
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', id, '*' FROM workout_set WHERE workout_id = NEW.id AND OLD.ended_at IS NULL ORDER BY position, id;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'workout', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = '*') AND OLD.ended_at IS NOT NULL;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout', NEW.id, 'routine_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field IN ('routine_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'routine_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'routine_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.routine_id IS NOT NEW.routine_id AND OLD.ended_at IS NOT NULL
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'routine_id' AND OLD.routine_id IS NOT NEW.routine_id AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout', NEW.id, 'routine_id' WHERE OLD.routine_id IS NOT NEW.routine_id AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout', NEW.id, 'routine_day_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field IN ('routine_day_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'routine_day_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'routine_day_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.routine_day_id IS NOT NEW.routine_day_id AND OLD.ended_at IS NOT NULL
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'routine_day_id' AND OLD.routine_day_id IS NOT NEW.routine_day_id AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout', NEW.id, 'routine_day_id' WHERE OLD.routine_day_id IS NOT NEW.routine_day_id AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout', NEW.id, 'name', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field IN ('name', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'name')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'name'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.name IS NOT NEW.name AND OLD.ended_at IS NOT NULL
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'name' AND OLD.name IS NOT NEW.name AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout', NEW.id, 'name' WHERE OLD.name IS NOT NEW.name AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout', NEW.id, 'started_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field IN ('started_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'started_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'started_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.started_at IS NOT NEW.started_at AND OLD.ended_at IS NOT NULL
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'started_at' AND OLD.started_at IS NOT NEW.started_at AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout', NEW.id, 'started_at' WHERE OLD.started_at IS NOT NEW.started_at AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout', NEW.id, 'ended_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field IN ('ended_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'ended_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'ended_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.ended_at IS NOT NEW.ended_at AND OLD.ended_at IS NOT NULL
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'ended_at' AND OLD.ended_at IS NOT NEW.ended_at AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout', NEW.id, 'ended_at' WHERE OLD.ended_at IS NOT NEW.ended_at AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout', NEW.id, 'source', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field IN ('source', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'source')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'source'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.source IS NOT NEW.source AND OLD.ended_at IS NOT NULL
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'source' AND OLD.source IS NOT NEW.source AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout', NEW.id, 'source' WHERE OLD.source IS NOT NEW.source AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout', NEW.id, 'copied_from_workout_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field IN ('copied_from_workout_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'copied_from_workout_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'copied_from_workout_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.copied_from_workout_id IS NOT NEW.copied_from_workout_id AND OLD.ended_at IS NOT NULL
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'copied_from_workout_id' AND OLD.copied_from_workout_id IS NOT NEW.copied_from_workout_id AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout', NEW.id, 'copied_from_workout_id' WHERE OLD.copied_from_workout_id IS NOT NEW.copied_from_workout_id AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout', NEW.id, 'notes', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field IN ('notes', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'notes')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'notes'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.notes IS NOT NEW.notes AND OLD.ended_at IS NOT NULL
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'notes' AND OLD.notes IS NOT NEW.notes AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout', NEW.id, 'notes' WHERE OLD.notes IS NOT NEW.notes AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at AND OLD.ended_at IS NOT NULL
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at AND OLD.ended_at IS NOT NULL
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at AND OLD.ended_at IS NOT NULL;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at AND OLD.ended_at IS NOT NULL;
       DELETE FROM sync_outbox WHERE table_name = 'workout' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL AND OLD.ended_at IS NOT NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL AND OLD.ended_at IS NOT NULL;
     END"##,
    ),
    (
        "sync_workout_close_decisions_au",
        "workout",
        r##"CREATE TRIGGER sync_workout_close_decisions_au AFTER UPDATE OF ended_at ON workout
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) AND OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL BEGIN
       DELETE FROM sync_field_clock WHERE table_name = 'recommendation_decision' AND row_id IN (SELECT id FROM recommendation_decision WHERE workout_id = NEW.id);
       DELETE FROM sync_tombstone WHERE table_name = 'recommendation_decision' AND row_id IN (SELECT id FROM recommendation_decision WHERE workout_id = NEW.id);
       DELETE FROM sync_outbox WHERE table_name = 'recommendation_decision' AND row_id IN (SELECT id FROM recommendation_decision WHERE workout_id = NEW.id);
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'recommendation_decision', id, '*' FROM recommendation_decision WHERE workout_id = NEW.id ORDER BY decided_at, id;
     END"##,
    ),
    (
        "sync_workout_set_ai",
        "workout_set",
        r##"CREATE TRIGGER sync_workout_set_ai AFTER INSERT ON workout_set
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) AND (SELECT ended_at FROM workout WHERE id = NEW.workout_id) IS NOT NULL BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'workout_set' AND row_id = NEW.id;
       DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('workout_set', NEW.id, '*');
     END"##,
    ),
    (
        "sync_workout_set_au",
        "workout_set",
        r##"CREATE TRIGGER sync_workout_set_au AFTER UPDATE ON workout_set
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) AND (SELECT ended_at FROM workout WHERE id = NEW.workout_id) IS NOT NULL BEGIN
       
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'workout_set', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'workout_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('workout_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'workout_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'workout_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.workout_id IS NOT NEW.workout_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'workout_id' AND OLD.workout_id IS NOT NEW.workout_id;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'workout_id' WHERE OLD.workout_id IS NOT NEW.workout_id;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'exercise_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('exercise_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'exercise_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'exercise_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.exercise_id IS NOT NEW.exercise_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'exercise_id' AND OLD.exercise_id IS NOT NEW.exercise_id;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'exercise_id' WHERE OLD.exercise_id IS NOT NEW.exercise_id;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'exercise_name', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('exercise_name', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'exercise_name')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'exercise_name'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.exercise_name IS NOT NEW.exercise_name
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'exercise_name' AND OLD.exercise_name IS NOT NEW.exercise_name;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'exercise_name' WHERE OLD.exercise_name IS NOT NEW.exercise_name;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'position', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('position', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'position')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'position'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.position IS NOT NEW.position
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'position' AND OLD.position IS NOT NEW.position;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'position' WHERE OLD.position IS NOT NEW.position;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'set_kind', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('set_kind', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'set_kind')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'set_kind'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.set_kind IS NOT NEW.set_kind
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'set_kind' AND OLD.set_kind IS NOT NEW.set_kind;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'set_kind' WHERE OLD.set_kind IS NOT NEW.set_kind;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'target_reps_min', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('target_reps_min', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'target_reps_min')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'target_reps_min'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.target_reps_min IS NOT NEW.target_reps_min
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'target_reps_min' AND OLD.target_reps_min IS NOT NEW.target_reps_min;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'target_reps_min' WHERE OLD.target_reps_min IS NOT NEW.target_reps_min;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'target_reps_max', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('target_reps_max', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'target_reps_max')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'target_reps_max'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.target_reps_max IS NOT NEW.target_reps_max
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'target_reps_max' AND OLD.target_reps_max IS NOT NEW.target_reps_max;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'target_reps_max' WHERE OLD.target_reps_max IS NOT NEW.target_reps_max;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'target_load_kg', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('target_load_kg', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'target_load_kg')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'target_load_kg'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.target_load_kg IS NOT NEW.target_load_kg
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'target_load_kg' AND OLD.target_load_kg IS NOT NEW.target_load_kg;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'target_load_kg' WHERE OLD.target_load_kg IS NOT NEW.target_load_kg;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'target_rest_sec', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('target_rest_sec', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'target_rest_sec')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'target_rest_sec'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.target_rest_sec IS NOT NEW.target_rest_sec
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'target_rest_sec' AND OLD.target_rest_sec IS NOT NEW.target_rest_sec;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'target_rest_sec' WHERE OLD.target_rest_sec IS NOT NEW.target_rest_sec;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'reps', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('reps', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'reps')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'reps'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.reps IS NOT NEW.reps
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'reps' AND OLD.reps IS NOT NEW.reps;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'reps' WHERE OLD.reps IS NOT NEW.reps;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'load_kg', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('load_kg', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'load_kg')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'load_kg'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.load_kg IS NOT NEW.load_kg
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'load_kg' AND OLD.load_kg IS NOT NEW.load_kg;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'load_kg' WHERE OLD.load_kg IS NOT NEW.load_kg;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'duration_sec', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('duration_sec', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'duration_sec')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'duration_sec'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.duration_sec IS NOT NEW.duration_sec
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'duration_sec' AND OLD.duration_sec IS NOT NEW.duration_sec;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'duration_sec' WHERE OLD.duration_sec IS NOT NEW.duration_sec;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'rir', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('rir', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'rir')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'rir'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.rir IS NOT NEW.rir
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'rir' AND OLD.rir IS NOT NEW.rir;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'rir' WHERE OLD.rir IS NOT NEW.rir;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'done', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('done', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'done')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'done'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.done IS NOT NEW.done
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'done' AND OLD.done IS NOT NEW.done;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'done' WHERE OLD.done IS NOT NEW.done;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'done_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('done_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'done_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'done_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.done_at IS NOT NEW.done_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'done_at' AND OLD.done_at IS NOT NEW.done_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'done_at' WHERE OLD.done_at IS NOT NEW.done_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'corrected_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('corrected_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'corrected_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'corrected_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.corrected_at IS NOT NEW.corrected_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'corrected_at' AND OLD.corrected_at IS NOT NEW.corrected_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'corrected_at' WHERE OLD.corrected_at IS NOT NEW.corrected_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END"##,
    ),
    (
        "sync_workout_set_difficulty_au",
        "workout_set",
        r##"CREATE TRIGGER sync_workout_set_difficulty_au AFTER UPDATE OF difficulty ON workout_set
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) AND (SELECT ended_at FROM workout WHERE id = NEW.workout_id) IS NOT NULL BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'workout_set', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'workout_set', NEW.id, 'difficulty', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field IN ('difficulty', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'difficulty')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'difficulty'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.difficulty IS NOT NEW.difficulty
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
DELETE FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = NEW.id AND field = 'difficulty' AND OLD.difficulty IS NOT NEW.difficulty;
INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'workout_set', NEW.id, 'difficulty' WHERE OLD.difficulty IS NOT NEW.difficulty;
     END"##,
    ),
];

/// Corps de déclencheurs remplacés par une migration ultérieure, valables pour une base dont la version de schéma est dans `[since, until)` :
/// (nom, table, SQL, since, until). Une sauvegarde de version 17 porte ceux de la migration 0015 (capture de `task` et de `settings` sans les Rappels
/// Apple) ; elle doit être admise, et recréée avec ces corps (jamais un corps qui cite une colonne absente de la sauvegarde). La migration 0018
/// les remplace à l'ouverture (ADR 0008 §10.2, solde la dette « Lot P » des déclencheurs).
pub const SUPERSEDED_TRIGGERS: [(&str, &str, &str, u32, u32); 3] = [
    (
        "sync_settings_ai",
        "settings",
        r##"CREATE TRIGGER sync_settings_ai AFTER INSERT ON settings WHEN NOT EXISTS (SELECT 1 FROM sync_guard) AND NEW.key IN ('general.firstWeekday', 'general.locale', 'general.theme', 'general.timeFormat', 'holidays.countries', 'reminders.defaultOffsets', 'reminders.eveningRecap', 'reminders.morningRecap', 'spaces.defaultSpaceId', 'tasks.carryOverUndone', 'today.hideRoutines') BEGIN
       DELETE FROM sync_tombstone WHERE table_name = 'settings' AND row_id = NEW.key;
       DELETE FROM sync_outbox WHERE table_name = 'settings' AND row_id = NEW.key AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('settings', NEW.key, '*');
     END"##,
        15,
        18,
    ),
    (
        "sync_settings_au",
        "settings",
        r##"CREATE TRIGGER sync_settings_au AFTER UPDATE ON settings WHEN NOT EXISTS (SELECT 1 FROM sync_guard) AND NEW.key IN ('general.firstWeekday', 'general.locale', 'general.theme', 'general.timeFormat', 'holidays.countries', 'reminders.defaultOffsets', 'reminders.eveningRecap', 'reminders.morningRecap', 'spaces.defaultSpaceId', 'tasks.carryOverUndone', 'today.hideRoutines') BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'settings', NEW.key, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'settings' AND row_id = NEW.key AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'settings', NEW.key, 'value', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'settings' AND row_id = NEW.key AND field IN ('value', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'settings' AND row_id = NEW.key AND field = 'value')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'settings' AND row_id = NEW.key AND field = 'value'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'settings' AND row_id = NEW.key AND field = '*'), OLD.hlc) END
       WHERE OLD.value IS NOT NEW.value
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'settings' AND row_id = NEW.key AND field = 'value' AND OLD.value IS NOT NEW.value;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'settings', NEW.key, 'value' WHERE OLD.value IS NOT NEW.value;
     END"##,
        15,
        18,
    ),
    (
        "sync_task_au",
        "task",
        r##"CREATE TRIGGER sync_task_au AFTER UPDATE ON task WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT 'task', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*');
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'space_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('space_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'space_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'space_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.space_id IS NOT NEW.space_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'space_id' AND OLD.space_id IS NOT NEW.space_id;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'space_id' WHERE OLD.space_id IS NOT NEW.space_id;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'project_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('project_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'project_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'project_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.project_id IS NOT NEW.project_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'project_id' AND OLD.project_id IS NOT NEW.project_id;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'project_id' WHERE OLD.project_id IS NOT NEW.project_id;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'title', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('title', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'title')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'title'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.title IS NOT NEW.title
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'title' AND OLD.title IS NOT NEW.title;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'title' WHERE OLD.title IS NOT NEW.title;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'note', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('note', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'note')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'note'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.note IS NOT NEW.note
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'note' AND OLD.note IS NOT NEW.note;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'note' WHERE OLD.note IS NOT NEW.note;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'date', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('date', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'date')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'date'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.date IS NOT NEW.date
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'date' AND OLD.date IS NOT NEW.date;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'date' WHERE OLD.date IS NOT NEW.date;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'time', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('time', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'time')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'time'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.time IS NOT NEW.time
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'time' AND OLD.time IS NOT NEW.time;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'time' WHERE OLD.time IS NOT NEW.time;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'status', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('status', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'status')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'status'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.status IS NOT NEW.status
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'status' AND OLD.status IS NOT NEW.status;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'status' WHERE OLD.status IS NOT NEW.status;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'done_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('done_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'done_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'done_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.done_at IS NOT NEW.done_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'done_at' AND OLD.done_at IS NOT NEW.done_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'done_at' WHERE OLD.done_at IS NOT NEW.done_at;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'sort_order', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('sort_order', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'sort_order')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'sort_order'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.sort_order IS NOT NEW.sort_order
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'sort_order' AND OLD.sort_order IS NOT NEW.sort_order;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'sort_order' WHERE OLD.sort_order IS NOT NEW.sort_order;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'carried_over', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('carried_over', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'carried_over')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'carried_over'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.carried_over IS NOT NEW.carried_over
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'carried_over' AND OLD.carried_over IS NOT NEW.carried_over;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'carried_over' WHERE OLD.carried_over IS NOT NEW.carried_over;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'recurrence_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('recurrence_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'recurrence_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'recurrence_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.recurrence_id IS NOT NEW.recurrence_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'recurrence_id' AND OLD.recurrence_id IS NOT NEW.recurrence_id;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'recurrence_id' WHERE OLD.recurrence_id IS NOT NEW.recurrence_id;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'series_index', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('series_index', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'series_index')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'series_index'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.series_index IS NOT NEW.series_index
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'series_index' AND OLD.series_index IS NOT NEW.series_index;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'series_index' WHERE OLD.series_index IS NOT NEW.series_index;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'goal_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('goal_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'goal_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'goal_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.goal_id IS NOT NEW.goal_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'goal_id' AND OLD.goal_id IS NOT NEW.goal_id;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'goal_id' WHERE OLD.goal_id IS NOT NEW.goal_id;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'icon', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('icon', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'icon')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'icon'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.icon IS NOT NEW.icon
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'icon' AND OLD.icon IS NOT NEW.icon;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'icon' WHERE OLD.icon IS NOT NEW.icon;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'someday', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('someday', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'someday')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'someday'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.someday IS NOT NEW.someday
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'someday' AND OLD.someday IS NOT NEW.someday;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'someday' WHERE OLD.someday IS NOT NEW.someday;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'source', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('source', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'source')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'source'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.source IS NOT NEW.source
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'source' AND OLD.source IS NOT NEW.source;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'source' WHERE OLD.source IS NOT NEW.source;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'external_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('external_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'external_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'external_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.external_id IS NOT NEW.external_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'external_id' AND OLD.external_id IS NOT NEW.external_id;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'external_id' WHERE OLD.external_id IS NOT NEW.external_id;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'series_template', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('series_template', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'series_template')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'series_template'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.series_template IS NOT NEW.series_template
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'series_template' AND OLD.series_template IS NOT NEW.series_template;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'series_template' WHERE OLD.series_template IS NOT NEW.series_template;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'external_event_id', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('external_event_id', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'external_event_id')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'external_event_id'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.external_event_id IS NOT NEW.external_event_id
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'external_event_id' AND OLD.external_event_id IS NOT NEW.external_event_id;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'external_event_id' WHERE OLD.external_event_id IS NOT NEW.external_event_id;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'created_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('created_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'created_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'created_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.created_at IS NOT NEW.created_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'created_at' AND OLD.created_at IS NOT NEW.created_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'created_at' WHERE OLD.created_at IS NOT NEW.created_at;
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT 'task', NEW.id, 'deleted_at', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field IN ('deleted_at', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'deleted_at')
           ELSE COALESCE((SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = 'deleted_at'), (SELECT hlc FROM sync_field_clock WHERE table_name = 'task' AND row_id = NEW.id AND field = '*'), OLD.hlc) END
       WHERE OLD.deleted_at IS NOT NEW.deleted_at
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = 'deleted_at' AND OLD.deleted_at IS NOT NEW.deleted_at;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, 'deleted_at' WHERE OLD.deleted_at IS NOT NEW.deleted_at;
       DELETE FROM sync_outbox WHERE table_name = 'task' AND row_id = NEW.id AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT 'task', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT OR IGNORE INTO sync_outbox (table_name, row_id, field) SELECT 'reminder', r.id, '+' FROM reminder r WHERE r.target_type = 'task' AND r.target_id = NEW.id AND r.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END"##,
        15,
        18,
    ),
];

/// I5-01 point 1.1 : déclencheurs créés par les migrations Spartiate, rangés par la version de schéma qui les introduit. UNE entrée par version
/// de 1 à `APP_SCHEMA_VERSION`, même vide (migration sans déclencheur) : une version sans entrée, ou un déclencheur d'une base migrée absent
/// d'ici, fait échouer `backup_versions.rs` (`i5_01_*`, comparaison avec `tests/fixtures/spartiate-migrations.json`). Jamais de version
/// par défaut : un oubli ferait recréer à la restauration un déclencheur qu'une migration suivante créerait encore (« trigger already exists »).
pub const SPARTIATE_TRIGGERS_BY_VERSION: [(u32, &[&str]); 9] = [
    // SPA-001b (migration 0001) : profil et poids.
    (
        1,
        &[
            "sync_body_weight_ai",
            "sync_body_weight_au",
            "sync_profile_ai",
            "sync_profile_au",
        ],
    ),
    // I1-01 (migration 0002) : bibliothèque, matériel et routines.
    (
        2,
        &[
            "sync_equipment_profile_ai",
            "sync_equipment_profile_au",
            "sync_exercise_ai",
            "sync_exercise_au",
            "sync_routine_ai",
            "sync_routine_au",
            "sync_routine_day_ai",
            "sync_routine_day_au",
            "sync_routine_exercise_ai",
            "sync_routine_exercise_au",
        ],
    ),
    // I1-02 (migration 0003) : séance active locale, aucun déclencheur.
    (3, &[]),
    // I1-03 (migration 0004) : capture des séances closes.
    (
        4,
        &[
            "sync_workout_ai",
            "sync_workout_au",
            "sync_workout_set_ai",
            "sync_workout_set_au",
        ],
    ),
    // I2-01 (migration 0005) : profil de progression et décisions locales, aucun déclencheur.
    (5, &[]),
    // I2-01 (migration 0006) : publication de la progression et capture de la difficulté.
    (
        6,
        &[
            "sync_progression_profile_ai",
            "sync_progression_profile_au",
            "sync_recommendation_decision_ai",
            "sync_recommendation_decision_au",
            "sync_workout_close_decisions_au",
            "sync_workout_set_difficulty_au",
        ],
    ),
    // I3-02 (migration 0007) : publication des cycles d'entraînement.
    (7, &["sync_mesocycle_ai", "sync_mesocycle_au"]),
    // I4-02 (migration 0008) : fiches, portions, entrées de journal et cibles de nutrition.
    (
        8,
        &[
            "sync_food_ai",
            "sync_food_au",
            "sync_food_portion_ai",
            "sync_food_portion_au",
            "sync_meal_entry_ai",
            "sync_meal_entry_au",
            "sync_nutrition_target_ai",
            "sync_nutrition_target_au",
        ],
    ),
    // I4-07 (migration 0009) : journée déclarée, recettes et ingrédients.
    (
        9,
        &[
            "sync_day_completeness_ai",
            "sync_day_completeness_au",
            "sync_recipe_ai",
            "sync_recipe_au",
            "sync_recipe_ingredient_ai",
            "sync_recipe_ingredient_au",
        ],
    ),
];

/// I5-01 point 1.1 : tables créées par les migrations Spartiate (toutes versions). Un déclencheur hérité de l'ancien projet (nom absent de
/// `SPARTIATE_TRIGGERS_BY_VERSION`) n'est jamais admis ni recréé sur l'une d'elles, à aucune version : `sync_settings_*` (valables à partir de la
/// version 15 dans l'ancien projet) ne reviennent pas sur `settings`, ni `search_routine_*` sur `routine`. Tenue égale aux tables d'une base
/// migrée par `backup_versions.rs` (une table nouvelle, `recovery_day` par exemple, doit être ajoutée ici).
pub const SPARTIATE_TABLES: [&str; 31] = [
    "body_weight",
    "conflict_log",
    "day_completeness",
    "epoch_carry_report",
    "equipment_profile",
    "exercise",
    "food",
    "food_portion",
    "meal_entry",
    "mesocycle",
    "nutrition_target",
    "profile",
    "progression_profile",
    "recipe",
    "recipe_ingredient",
    "recommendation_decision",
    "routine",
    "routine_day",
    "routine_exercise",
    "schema_migrations",
    "settings",
    "sync_field_clock",
    "sync_guard",
    "sync_meta",
    "sync_outbox",
    "sync_parked",
    "sync_state",
    "sync_tombstone",
    "sync_unknown",
    "workout",
    "workout_set",
];

/// Version de schéma à partir de laquelle le corps de référence actuel est valable. Déclencheur Spartiate : sa version déclarée dans
/// `SPARTIATE_TRIGGERS_BY_VERSION`. Déclencheur hérité de l'ancien projet (présent dans `REFERENCE_TRIGGERS`, absent des déclarations
/// Spartiate) : 18 pour les trois remplacés par sa migration 0018, 1 pour les autres. `None` : nom inconnu (la sauvegarde est refusée).
pub fn introduced_in(name: &str) -> Option<u32> {
    if let Some((version, _)) = SPARTIATE_TRIGGERS_BY_VERSION
        .iter()
        .find(|(_, names)| names.contains(&name))
    {
        return Some(*version);
    }
    if !REFERENCE_TRIGGERS.iter().any(|(n, _, _)| *n == name) {
        return None;
    }
    Some(match name {
        "sync_task_au" | "sync_settings_ai" | "sync_settings_au" => 18,
        _ => 1,
    })
}

/// Déclencheur hérité de l'ancien projet (aucune migration Spartiate ne le crée).
fn is_legacy(name: &str) -> bool {
    !SPARTIATE_TRIGGERS_BY_VERSION
        .iter()
        .any(|(_, names)| names.contains(&name))
}

/// Corps admis pour ce déclencheur dans une base de cette version de schéma : un corps remplacé valable à cette version, sinon le corps de
/// référence s'il existe déjà à cette version ; `None` : déclencheur inconnu, pas encore introduit, ou hérité de l'ancien projet sur une table
/// Spartiate (la sauvegarde est refusée, la restauration ne le recrée pas).
pub fn trigger_body_for(name: &str, table: &str, version: u32) -> Option<&'static str> {
    if is_legacy(name) && SPARTIATE_TABLES.contains(&table) {
        return None;
    }
    if let Some((_, _, sql, _, _)) = SUPERSEDED_TRIGGERS.iter().find(|(n, t, _, since, until)| {
        *n == name && *t == table && version >= *since && version < *until
    }) {
        return Some(sql);
    }
    let since = introduced_in(name)?;
    REFERENCE_TRIGGERS
        .iter()
        .find(|(n, t, _)| *n == name && *t == table)
        .filter(|_| version >= since)
        .map(|(_, _, sql)| *sql)
}
