//! I1-01 : la version 2 du schéma (migration 0002, bibliothèque, matériel et routines) est admise par la vérification des sauvegardes ;
//! la version 3, inconnue de cette app, est refusée. Les déclencheurs de capture des cinq nouvelles tables sont ceux de la référence.

use std::path::Path;

use rusqlite::Connection;
use spartiate_lib::backup::{check_backup_file, APP_SCHEMA_VERSION};
use spartiate_lib::backup_triggers::{trigger_body_for, REFERENCE_TRIGGERS};

/// Tables publiées de la version 1 (I0) puis de la version 2 (I1-01) : chacune porte un déclencheur `_ai` et un `_au` de capture.
const TABLES: [&str; 7] = [
    "profile",
    "body_weight",
    "exercise",
    "equipment_profile",
    "routine",
    "routine_day",
    "routine_exercise",
];

fn scratch() -> tempfile::TempDir {
    tempfile::tempdir_in(env!("CARGO_TARGET_TMPDIR")).unwrap()
}

/// Base minimale d'une version de l'app : ses tables publiées et leurs déclencheurs de capture, avec les corps de la référence.
fn make_db(path: &Path, version: u32, tables: &[&str]) {
    let conn = Connection::open(path).unwrap();
    conn.execute_batch(
        "CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY); CREATE TABLE sync_guard (id INTEGER PRIMARY KEY);",
    )
    .unwrap();
    for v in 1..=version {
        conn.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [v])
            .unwrap();
    }
    for table in tables {
        conn.execute_batch(&format!("CREATE TABLE {table} (id TEXT PRIMARY KEY);"))
            .unwrap();
        for suffix in ["ai", "au"] {
            let name = format!("sync_{table}_{suffix}");
            let sql = trigger_body_for(&name, table, version)
                .unwrap_or_else(|| panic!("{name} absent de la référence en version {version}"));
            conn.execute_batch(sql).unwrap();
        }
    }
}

fn error_code(path: &Path) -> &'static str {
    check_backup_file(path, APP_SCHEMA_VERSION)
        .unwrap_err()
        .code
}

#[test]
fn i1_01_the_app_schema_version_is_2() {
    assert_eq!(APP_SCHEMA_VERSION, 2);
}

#[test]
fn i1_01_a_version_2_backup_with_the_training_tables_is_accepted() {
    let dir = scratch();
    let path = dir.path().join("v2.db");
    make_db(&path, 2, &TABLES);
    assert_eq!(check_backup_file(&path, APP_SCHEMA_VERSION).unwrap(), 2);
}

#[test]
fn i1_01_a_version_1_backup_without_the_training_tables_is_still_accepted() {
    let dir = scratch();
    let path = dir.path().join("v1.db");
    make_db(&path, 1, &TABLES[..2]);
    assert_eq!(check_backup_file(&path, APP_SCHEMA_VERSION).unwrap(), 1);
}

#[test]
fn i1_01_the_training_triggers_do_not_exist_in_version_1() {
    for table in &TABLES[2..] {
        for suffix in ["ai", "au"] {
            let name = format!("sync_{table}_{suffix}");
            assert_eq!(trigger_body_for(&name, table, 1), None, "{name}");
            assert!(trigger_body_for(&name, table, 2).is_some(), "{name}");
        }
    }
}

#[test]
fn i1_01_every_published_table_has_its_two_capture_triggers_in_the_reference() {
    for table in TABLES {
        for suffix in ["ai", "au"] {
            let name = format!("sync_{table}_{suffix}");
            let count = REFERENCE_TRIGGERS
                .iter()
                .filter(|(n, t, _)| *n == name && *t == table)
                .count();
            assert_eq!(count, 1, "{name}");
        }
    }
}

#[test]
fn i1_01_a_version_3_backup_is_refused_as_newer_schema() {
    let dir = scratch();
    let path = dir.path().join("v3.db");
    make_db(&path, 2, &TABLES);
    Connection::open(&path)
        .unwrap()
        .execute("INSERT INTO schema_migrations (version) VALUES (3)", [])
        .unwrap();
    assert_eq!(error_code(&path), "newer-schema");
}

#[test]
fn i1_01_a_tampered_training_trigger_is_refused() {
    let dir = scratch();
    let path = dir.path().join("v2-tampered.db");
    make_db(&path, 2, &TABLES);
    Connection::open(&path)
        .unwrap()
        .execute_batch(
            "DROP TRIGGER sync_routine_exercise_au; CREATE TRIGGER sync_routine_exercise_au AFTER UPDATE ON routine_exercise BEGIN SELECT 1; END;",
        )
        .unwrap();
    assert_eq!(error_code(&path), "corrupt");
}
