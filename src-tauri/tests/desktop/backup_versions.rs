//! K-05 critère 4 (ADR 0008 §10.2) : déclencheurs de référence d'une sauvegarde selon la version de schéma. Une sauvegarde de version 17 porte
//! les corps de la migration 0015 (capture de `task` et de `settings` sans les Rappels Apple) : elle est admise, et recréée avec ces corps ;
//! les corps de la migration 0018 ne sont valables qu'à partir de la version 18.

use std::path::Path;

use rusqlite::Connection;
use spartiate_lib::backup::{check_backup_file, normalize_sql, reset_triggers, APP_SCHEMA_VERSION};
use spartiate_lib::backup_triggers::{
    introduced_in, trigger_body_for, REFERENCE_TRIGGERS, SUPERSEDED_TRIGGERS,
};

const REPLACED: [&str; 3] = ["sync_settings_ai", "sync_settings_au", "sync_task_au"];

fn scratch() -> tempfile::TempDir {
    tempfile::tempdir_in(env!("CARGO_TARGET_TMPDIR")).unwrap()
}

/// Base minimale de cette version, avec les tables qui rendent les déclencheurs de l'app admissibles et leurs corps valables à `bodies_version`.
fn make_db(path: &Path, version: u32, bodies_version: u32) {
    let conn = Connection::open(path).unwrap();
    conn.execute_batch("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY); CREATE TABLE sync_guard (id INTEGER PRIMARY KEY);").unwrap();
    for v in 1..=version {
        conn.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [v])
            .unwrap();
    }
    for table in [
        "task",
        "settings",
        "space",
        "project",
        "recurrence",
        "goal",
        "routine",
        "routine_log",
        "routine_pause",
        "reminder",
        "event",
        "checklist",
        "checklist_item",
        "focus_session",
        "calendar_account",
        "holiday",
        "profile",
        "body_weight",
        "exercise",
        "equipment_profile",
        "routine_day",
        "routine_exercise",
        "workout",
        "workout_set",
        "progression_profile",
        "recommendation_decision",
        "mesocycle",
        "food",
        "food_portion",
        "meal_entry",
        "nutrition_target",
        "day_completeness",
        "recipe",
        "recipe_ingredient",
        "search_index_doc",
    ] {
        conn.execute_batch(&format!(
            "CREATE TABLE {table} (id INTEGER PRIMARY KEY, key TEXT);"
        ))
        .unwrap();
    }
    for (name, table, _) in REFERENCE_TRIGGERS {
        if name.starts_with("search_") {
            // Les déclencheurs de recherche citent des tables d'index absentes de cette base minimale : seuls ceux de capture comptent ici.
            continue;
        }
        // Pas de corps à cette version (ex. `sync_task_au` en version 8 : une base Spartiate n'a ni `task` ni ses déclencheurs) : rien à poser.
        let Some(sql) = trigger_body_for(name, table, bodies_version) else {
            continue;
        };
        conn.execute_batch(sql).unwrap();
    }
}

fn error_code(path: &Path) -> &'static str {
    check_backup_file(path, APP_SCHEMA_VERSION)
        .unwrap_err()
        .code
}

#[test]
fn k05_4_the_three_replaced_triggers_have_a_superseded_body_valid_from_15_to_17() {
    assert_eq!(SUPERSEDED_TRIGGERS.len(), 3);
    for (name, table, sql, since, until) in SUPERSEDED_TRIGGERS {
        assert!(REPLACED.contains(&name));
        assert_eq!((since, until), (15, 18));
        assert_eq!(
            introduced_in(name),
            18,
            "le corps actuel de {name} date de la version 18"
        );
        let current = REFERENCE_TRIGGERS
            .iter()
            .find(|(n, _, _)| *n == name)
            .unwrap()
            .2;
        assert_ne!(normalize_sql(sql), normalize_sql(current), "{name}");
        assert!(
            !sql.contains("apple_"),
            "{name} : le corps de la version 17 ignore les colonnes des Rappels Apple"
        );
        assert!(
            current.contains("apple_") || name.starts_with("sync_settings"),
            "{name}"
        );
        assert_eq!(trigger_body_for(name, table, 17), Some(sql));
        assert_eq!(trigger_body_for(name, table, 15), Some(sql));
        assert_eq!(trigger_body_for(name, table, 18), Some(current));
        assert_eq!(trigger_body_for(name, table, 99), Some(current));
    }
    // Les autres déclencheurs ont le même corps à toute version.
    for (name, table, sql) in REFERENCE_TRIGGERS {
        if !REPLACED.contains(&name) {
            assert_eq!(trigger_body_for(name, table, 17), Some(sql));
            assert_eq!(trigger_body_for(name, table, 18), Some(sql));
        }
    }
    assert_eq!(
        trigger_body_for("sync_task_au", "settings", 17),
        None,
        "table différente : inconnu"
    );
    assert_eq!(trigger_body_for("evil", "task", 17), None);
}

#[test]
fn k05_4_a_version_17_or_18_backup_is_refused_by_the_schema_1_app() {
    // Base neuve Spartiate (SPA-001b, D-54, D-67) : les sauvegardes de l'ancien projet 17 à 19 deviennent des cas de refus.
    let dir = scratch();
    for version in [17u32, 18, 19] {
        let path = dir.path().join(format!("v{version}.db"));
        make_db(&path, version, version.min(18));
        let err = check_backup_file(&path, APP_SCHEMA_VERSION).unwrap_err();
        assert_eq!(err.code, "newer-schema", "version {version}");
    }
}

#[test]
fn k05_4_a_body_of_another_version_is_refused() {
    let dir = scratch();
    // Corps de la version 15 dans une base déclarée en 18 : refusé (la migration 0018 les aurait remplacés).
    let old_bodies = dir.path().join("v18-old-bodies.db");
    make_db(&old_bodies, 18, 17);
    assert_eq!(error_code(&old_bodies), "corrupt");
    // Corps de la version 18 dans une base de version 17 : refusé (ils citent des colonnes que la base n'a pas).
    let new_bodies = dir.path().join("v17-new-bodies.db");
    make_db(&new_bodies, 17, 18);
    assert_eq!(error_code(&new_bodies), "corrupt");
    // Corps modifié à la main, version 17 : refusé.
    let tampered = dir.path().join("v17-tampered.db");
    make_db(&tampered, 17, 17);
    Connection::open(&tampered).unwrap().execute_batch("DROP TRIGGER sync_task_au; CREATE TRIGGER sync_task_au AFTER UPDATE ON task BEGIN SELECT 1; END;").unwrap();
    assert_eq!(error_code(&tampered), "corrupt");
}

#[test]
fn k05_4_a_backup_newer_than_the_app_is_still_refused_as_newer_schema() {
    let dir = scratch();
    // Y-TECH-05 : l'app est en version 19 (migration 0019) ; la plus récente est donc la 20.
    let newer = dir.path().join("v20.db");
    make_db(&newer, 20, 18);
    assert_eq!(
        check_backup_file(&newer, APP_SCHEMA_VERSION)
            .unwrap_err()
            .code,
        "newer-schema"
    );
}

#[test]
fn k05_4_reset_triggers_recreates_the_bodies_of_the_backup_version_and_never_a_column_the_backup_lacks(
) {
    let dir = scratch();
    for (version, bodies) in [(17u32, 17u32), (18, 18)] {
        let path = dir.path().join(format!("restauree-{version}.db"));
        make_db(&path, version, bodies);
        Connection::open(&path).unwrap().execute_batch("CREATE TABLE journal (x); CREATE TRIGGER evil AFTER INSERT ON task BEGIN INSERT INTO journal VALUES (1); END;").unwrap();
        reset_triggers(&path).unwrap();
        let conn = Connection::open(&path).unwrap();
        for name in REPLACED {
            let sql: String = conn
                .query_row(
                    "SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = ?1",
                    [name],
                    |r| r.get(0),
                )
                .unwrap();
            let table = REFERENCE_TRIGGERS
                .iter()
                .find(|(n, _, _)| *n == name)
                .unwrap()
                .1;
            assert_eq!(
                normalize_sql(&sql),
                normalize_sql(trigger_body_for(name, table, version).unwrap()),
                "{name} en version {version}"
            );
        }
        let evil: u64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE name = 'evil'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(evil, 0);
        drop(conn);
        // Une sauvegarde d'une version de l'ancien projet reste refusée par l'app au schéma 1 (D-54).
        assert_eq!(
            check_backup_file(&path, APP_SCHEMA_VERSION)
                .unwrap_err()
                .code,
            "newer-schema"
        );
    }
}

/// 0.8.1 (relecture sync-icloud rattrapée de #75 et #79) : une base Spartiate n'a AUCUNE table `search_index_doc` (reste de l'ancien projet,
/// aucune migration 0001 à 0009 ne la crée). La restauration d'une sauvegarde ne doit pas laisser la base sans déclencheur de capture de
/// synchro : sans eux, un repas ou une séance saisis ensuite n'entrent jamais dans `sync_outbox`.
#[test]
fn restore_recreates_sync_capture_triggers_even_without_search_index_doc() {
    let dir = scratch();
    let path = dir.path().join("spartiate.db");
    make_db(&path, APP_SCHEMA_VERSION, APP_SCHEMA_VERSION);
    {
        let conn = Connection::open(&path).unwrap();
        conn.execute_batch("DROP TABLE search_index_doc;").unwrap();
    }
    reset_triggers(&path).unwrap();
    let conn = Connection::open(&path).unwrap();
    let names: Vec<String> = conn
        .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'")
        .unwrap()
        .query_map([], |r| r.get::<_, String>(0))
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap();
    for expected in [
        "sync_meal_entry_ai",
        "sync_meal_entry_au",
        "sync_mesocycle_ai",
        "sync_food_ai",
        "sync_nutrition_target_ai",
        "sync_recipe_ingredient_ai",
        "sync_day_completeness_au",
        "sync_workout_ai",
    ] {
        assert!(
            names.iter().any(|n| n == expected),
            "déclencheur {expected} absent après la restauration : {names:?}"
        );
    }
    assert!(
        !names.iter().any(|n| n.starts_with("search_")),
        "aucun déclencheur de recherche sans table d'index"
    );
}

/// Base Spartiate RÉELLE de version 8 : schéma rejoué depuis les migrations TypeScript (fixture `spartiate-v8-schema.sql`, tenue à jour par
/// `src/db/migrations/spartiateSchemaFixture.test.ts`). Aucune table `search_index_doc`, aucun déclencheur `search_*`.
fn make_real_spartiate_db(path: &Path) {
    let conn = Connection::open(path).unwrap();
    conn.execute_batch(include_str!("../fixtures/spartiate-v8-schema.sql"))
        .unwrap();
    for v in 1..=8 {
        conn.execute(
            "INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?1, 'n', 'c', 'now')",
            [v],
        )
        .unwrap();
    }
}

fn trigger_names(path: &Path) -> Vec<String> {
    let conn = Connection::open(path).unwrap();
    let mut statement = conn
        .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name")
        .unwrap();
    let names = statement
        .query_map([], |r| r.get::<_, String>(0))
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap();
    names
}

#[test]
fn a_real_spartiate_v8_backup_is_admitted_and_reset_triggers_restores_exactly_its_triggers() {
    let dir = scratch();
    let path = dir.path().join("reelle.db");
    make_real_spartiate_db(&path);
    let before = trigger_names(&path);
    assert_eq!(before.len(), 34, "{before:?}");
    assert!(!before.iter().any(|n| n.starts_with("search_")));
    assert_eq!(check_backup_file(&path, APP_SCHEMA_VERSION).unwrap(), 8);
    // Un déclencheur étranger est retiré, tous ceux de l'app reviennent, aucun de recherche n'apparaît.
    Connection::open(&path)
        .unwrap()
        .execute_batch("CREATE TRIGGER evil AFTER INSERT ON food BEGIN SELECT 1; END;")
        .unwrap();
    reset_triggers(&path).unwrap();
    assert_eq!(trigger_names(&path), before);
    assert_eq!(check_backup_file(&path, APP_SCHEMA_VERSION).unwrap(), 8);
}

/// Restauration puis migration : une sauvegarde Spartiate de version 7 (migrations 0001 à 0007 rejouées) passe par `reset_triggers`, puis la
/// migration 0008 s'applique à l'ouverture. Elle ne doit pas échouer sur « trigger already exists » (`reset_triggers` ne recrée jamais un
/// déclencheur d'une version supérieure) et la base finit avec les 34 déclencheurs `sync_*` de la version 8.
#[test]
fn a_restored_v7_backup_then_migration_0008_ends_with_the_34_sync_triggers() {
    let dir = scratch();
    let path = dir.path().join("v7.db");
    {
        let conn = Connection::open(&path).unwrap();
        conn.execute_batch(include_str!("../fixtures/spartiate-v7-schema.sql"))
            .unwrap();
        for v in 1..=7 {
            conn.execute(
                "INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?1, 'n', 'c', 'now')",
                [v],
            )
            .unwrap();
        }
    }
    assert_eq!(check_backup_file(&path, APP_SCHEMA_VERSION).unwrap(), 7);
    let before = trigger_names(&path);
    assert_eq!(before.len(), 26, "{before:?}");
    reset_triggers(&path).unwrap();
    assert_eq!(trigger_names(&path), before);
    Connection::open(&path)
        .unwrap()
        .execute_batch(include_str!("../fixtures/spartiate-0008-statements.sql"))
        .unwrap();
    let after = trigger_names(&path);
    assert_eq!(after.len(), 34, "{after:?}");
    assert!(after.iter().all(|n| n.starts_with("sync_")));
}

/// Base Spartiate RÉELLE de version 9 (I4-07) : schéma rejoué depuis les migrations TypeScript (fixture `spartiate-v9-schema.sql`).
fn make_real_spartiate_v9_db(path: &Path) {
    let conn = Connection::open(path).unwrap();
    conn.execute_batch(include_str!("../fixtures/spartiate-v9-schema.sql"))
        .unwrap();
    for v in 1..=9 {
        conn.execute(
            "INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?1, 'n', 'c', 'now')",
            [v],
        )
        .unwrap();
    }
}

#[test]
fn a_real_spartiate_v9_backup_is_admitted_and_reset_triggers_restores_exactly_its_40_triggers() {
    let dir = scratch();
    let path = dir.path().join("reelle9.db");
    make_real_spartiate_v9_db(&path);
    let before = trigger_names(&path);
    assert_eq!(before.len(), 40, "{before:?}");
    assert!(!before.iter().any(|n| n.starts_with("search_")));
    assert_eq!(check_backup_file(&path, APP_SCHEMA_VERSION).unwrap(), 9);
    Connection::open(&path)
        .unwrap()
        .execute_batch("CREATE TRIGGER evil AFTER INSERT ON recipe BEGIN SELECT 1; END;")
        .unwrap();
    reset_triggers(&path).unwrap();
    assert_eq!(trigger_names(&path), before);
    assert_eq!(check_backup_file(&path, APP_SCHEMA_VERSION).unwrap(), 9);
}

/// Restauration puis migration : une sauvegarde Spartiate de version 8 passe par `reset_triggers`, puis la migration 0009 s'applique à
/// l'ouverture sans échouer sur « trigger already exists » ; la base finit avec les 40 déclencheurs `sync_*` de la version 9.
#[test]
fn a_restored_v8_backup_then_migration_0009_ends_with_the_40_sync_triggers() {
    let dir = scratch();
    let path = dir.path().join("v8.db");
    make_real_spartiate_db(&path);
    assert_eq!(check_backup_file(&path, APP_SCHEMA_VERSION).unwrap(), 8);
    let before = trigger_names(&path);
    assert_eq!(before.len(), 34, "{before:?}");
    reset_triggers(&path).unwrap();
    assert_eq!(trigger_names(&path), before);
    Connection::open(&path)
        .unwrap()
        .execute_batch(include_str!("../fixtures/spartiate-0009-statements.sql"))
        .unwrap();
    let after = trigger_names(&path);
    assert_eq!(after.len(), 40, "{after:?}");
    assert!(after.iter().all(|n| n.starts_with("sync_")));
}
