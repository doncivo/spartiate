//! I1-01 / I1-02 / I1-03 : les versions 2 (migration 0002, bibliothèque, matériel et routines), 3 (migration 0003, séance locale `workout` /
//! `workout_set`, sans déclencheur de capture : D-27) et 4 (migration 0004, déclencheurs gardés des séances closes) sont admises par la
//! vérification des sauvegardes, comme la 5 (I2-01, migration 0005 : `progression_profile` et `recommendation_decision`, locales, sans
//! déclencheur), la 6 (I2-01 PR 2/2, migration 0006 : captures des deux tables de progression et de `workout_set.difficulty`) et la 7
//! (I3-02, migration 0007 : captures de `mesocycle`), la 8 (I4-02, migration 0008 : captures de `food`, `food_portion`, `meal_entry` et
//! `nutrition_target`) et la 9 (I4-07, migration 0009 : captures de `day_completeness`, `recipe` et `recipe_ingredient`) ; la version 11, inconnue
//! de cette app, est refusée. Les déclencheurs de capture sont ceux de la référence.

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

/// Tables supplémentaires et leurs deux déclencheurs de capture, corps de la référence à cette version (base déjà créée par `make_db`).
fn make_tables(path: &Path, version: u32, tables: &[&str]) {
    let conn = Connection::open(path).unwrap();
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
fn i5_01_the_app_schema_version_is_10() {
    assert_eq!(APP_SCHEMA_VERSION, 10);
}

#[test]
fn i1_02_a_version_3_backup_is_accepted_and_has_no_workout_trigger() {
    let dir = scratch();
    let path = dir.path().join("v3.db");
    make_db(&path, 3, &TABLES);
    Connection::open(&path)
        .unwrap()
        .execute_batch(
            "CREATE TABLE workout (id TEXT PRIMARY KEY); CREATE TABLE workout_set (id TEXT PRIMARY KEY);",
        )
        .unwrap();
    assert_eq!(check_backup_file(&path, APP_SCHEMA_VERSION).unwrap(), 3);
    for table in ["workout", "workout_set"] {
        for suffix in ["ai", "au"] {
            let name = format!("sync_{table}_{suffix}");
            assert_eq!(trigger_body_for(&name, table, 3), None, "{name}");
        }
    }
}

#[test]
fn i1_03_a_version_4_backup_with_the_guarded_workout_triggers_is_accepted() {
    let dir = scratch();
    let path = dir.path().join("v4.db");
    make_db(&path, 4, &TABLES);
    Connection::open(&path)
        .unwrap()
        .execute_batch(
            "CREATE TABLE workout (id TEXT PRIMARY KEY, ended_at TEXT); CREATE TABLE workout_set (id TEXT PRIMARY KEY, workout_id TEXT);",
        )
        .unwrap();
    for table in ["workout", "workout_set"] {
        for suffix in ["ai", "au"] {
            let name = format!("sync_{table}_{suffix}");
            let sql = trigger_body_for(&name, table, 4).unwrap_or_else(|| panic!("{name}"));
            // Gardé : une séance ouverte n'est jamais capturée (D-27).
            assert!(sql.contains("ended_at"), "{name}");
            let count = REFERENCE_TRIGGERS
                .iter()
                .filter(|(n, t, _)| *n == name && *t == table)
                .count();
            assert_eq!(count, 1, "{name}");
            Connection::open(&path).unwrap().execute_batch(sql).unwrap();
        }
    }
    assert_eq!(check_backup_file(&path, APP_SCHEMA_VERSION).unwrap(), 4);
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
fn i2_01_a_version_5_backup_with_the_local_progression_tables_is_accepted_and_adds_no_trigger() {
    let dir = scratch();
    let path = dir.path().join("v5.db");
    make_db(&path, 5, &TABLES);
    Connection::open(&path)
        .unwrap()
        .execute_batch(
            "CREATE TABLE workout (id TEXT PRIMARY KEY, ended_at TEXT); CREATE TABLE workout_set (id TEXT PRIMARY KEY, workout_id TEXT); CREATE TABLE progression_profile (id TEXT PRIMARY KEY); CREATE TABLE recommendation_decision (id TEXT PRIMARY KEY);",
        )
        .unwrap();
    for table in ["workout", "workout_set"] {
        for suffix in ["ai", "au"] {
            let name = format!("sync_{table}_{suffix}");
            let sql = trigger_body_for(&name, table, 5).unwrap_or_else(|| panic!("{name}"));
            Connection::open(&path).unwrap().execute_batch(sql).unwrap();
        }
    }
    for table in ["progression_profile", "recommendation_decision"] {
        for suffix in ["ai", "au"] {
            let name = format!("sync_{table}_{suffix}");
            assert_eq!(trigger_body_for(&name, table, 5), None, "{name}");
        }
    }
    assert_eq!(check_backup_file(&path, APP_SCHEMA_VERSION).unwrap(), 5);
}

#[test]
fn i2_01_a_version_6_backup_with_the_published_progression_tables_is_accepted() {
    let dir = scratch();
    let path = dir.path().join("v6.db");
    make_db(&path, 6, &TABLES);
    Connection::open(&path)
        .unwrap()
        .execute_batch(
            "CREATE TABLE workout (id TEXT PRIMARY KEY, ended_at TEXT); CREATE TABLE workout_set (id TEXT PRIMARY KEY, workout_id TEXT, difficulty TEXT);",
        )
        .unwrap();
    for (table, names) in [
        (
            "workout",
            &[
                "sync_workout_ai",
                "sync_workout_au",
                "sync_workout_close_decisions_au",
            ][..],
        ),
        (
            "workout_set",
            &[
                "sync_workout_set_ai",
                "sync_workout_set_au",
                "sync_workout_set_difficulty_au",
            ][..],
        ),
    ] {
        for name in names {
            let sql = trigger_body_for(name, table, 6).unwrap_or_else(|| panic!("{name}"));
            Connection::open(&path).unwrap().execute_batch(sql).unwrap();
        }
    }
    make_tables(
        &path,
        6,
        &["progression_profile", "recommendation_decision"],
    );
    assert_eq!(check_backup_file(&path, APP_SCHEMA_VERSION).unwrap(), 6);
}

#[test]
fn i2_01_the_version_6_triggers_do_not_exist_before_version_6() {
    for (name, table) in [
        ("sync_progression_profile_ai", "progression_profile"),
        ("sync_progression_profile_au", "progression_profile"),
        ("sync_recommendation_decision_ai", "recommendation_decision"),
        ("sync_recommendation_decision_au", "recommendation_decision"),
        ("sync_workout_set_difficulty_au", "workout_set"),
        ("sync_workout_close_decisions_au", "workout"),
    ] {
        assert_eq!(trigger_body_for(name, table, 5), None, "{name}");
        assert!(trigger_body_for(name, table, 6).is_some(), "{name}");
    }
    // Le corps publié de la 0004 n'est pas remplacé : même corps en version 4, 5 et 6.
    assert_eq!(
        trigger_body_for("sync_workout_set_au", "workout_set", 4),
        trigger_body_for("sync_workout_set_au", "workout_set", 6)
    );
}

#[test]
fn i3_02_a_version_7_backup_with_the_published_mesocycle_table_is_accepted() {
    let dir = scratch();
    let path = dir.path().join("v7.db");
    make_db(&path, 7, &TABLES);
    Connection::open(&path)
        .unwrap()
        .execute_batch(
            "CREATE TABLE workout (id TEXT PRIMARY KEY, ended_at TEXT); CREATE TABLE workout_set (id TEXT PRIMARY KEY, workout_id TEXT, difficulty TEXT);",
        )
        .unwrap();
    for (table, names) in [
        (
            "workout",
            &[
                "sync_workout_ai",
                "sync_workout_au",
                "sync_workout_close_decisions_au",
            ][..],
        ),
        (
            "workout_set",
            &[
                "sync_workout_set_ai",
                "sync_workout_set_au",
                "sync_workout_set_difficulty_au",
            ][..],
        ),
    ] {
        for name in names {
            let sql = trigger_body_for(name, table, 7).unwrap_or_else(|| panic!("{name}"));
            Connection::open(&path).unwrap().execute_batch(sql).unwrap();
        }
    }
    make_tables(
        &path,
        7,
        &[
            "progression_profile",
            "recommendation_decision",
            "mesocycle",
        ],
    );
    assert_eq!(check_backup_file(&path, APP_SCHEMA_VERSION).unwrap(), 7);
}

#[test]
fn i3_02_the_mesocycle_triggers_do_not_exist_before_version_7() {
    for name in ["sync_mesocycle_ai", "sync_mesocycle_au"] {
        assert_eq!(trigger_body_for(name, "mesocycle", 6), None, "{name}");
        assert!(trigger_body_for(name, "mesocycle", 7).is_some(), "{name}");
    }
}

#[test]
fn i4_02_a_version_8_backup_with_the_published_nutrition_tables_is_accepted() {
    let dir = scratch();
    let path = dir.path().join("v8.db");
    make_db(&path, 8, &TABLES);
    Connection::open(&path)
        .unwrap()
        .execute_batch(
            "CREATE TABLE workout (id TEXT PRIMARY KEY, ended_at TEXT); CREATE TABLE workout_set (id TEXT PRIMARY KEY, workout_id TEXT, difficulty TEXT);",
        )
        .unwrap();
    for (table, names) in [
        (
            "workout",
            &[
                "sync_workout_ai",
                "sync_workout_au",
                "sync_workout_close_decisions_au",
            ][..],
        ),
        (
            "workout_set",
            &[
                "sync_workout_set_ai",
                "sync_workout_set_au",
                "sync_workout_set_difficulty_au",
            ][..],
        ),
    ] {
        for name in names {
            let sql = trigger_body_for(name, table, 8).unwrap_or_else(|| panic!("{name}"));
            Connection::open(&path).unwrap().execute_batch(sql).unwrap();
        }
    }
    make_tables(
        &path,
        8,
        &[
            "progression_profile",
            "recommendation_decision",
            "mesocycle",
            "food",
            "food_portion",
            "meal_entry",
            "nutrition_target",
        ],
    );
    assert_eq!(check_backup_file(&path, APP_SCHEMA_VERSION).unwrap(), 8);
}

#[test]
fn i4_02_the_nutrition_triggers_do_not_exist_before_version_8() {
    for table in ["food", "food_portion", "meal_entry", "nutrition_target"] {
        for suffix in ["ai", "au"] {
            let name = format!("sync_{table}_{suffix}");
            assert_eq!(trigger_body_for(&name, table, 7), None, "{name}");
            assert!(trigger_body_for(&name, table, 8).is_some(), "{name}");
        }
    }
}

#[test]
fn i4_07_the_recipe_and_day_triggers_do_not_exist_before_version_9() {
    for table in ["day_completeness", "recipe", "recipe_ingredient"] {
        for suffix in ["ai", "au"] {
            let name = format!("sync_{table}_{suffix}");
            assert_eq!(trigger_body_for(&name, table, 8), None, "{name}");
            assert!(trigger_body_for(&name, table, 9).is_some(), "{name}");
        }
    }
}

#[test]
fn i4_07_a_version_9_backup_with_the_recipe_tables_is_accepted_and_a_tampered_one_is_refused() {
    let dir = scratch();
    let path = dir.path().join("v9.db");
    make_db(&path, 9, &TABLES);
    make_tables(
        &path,
        9,
        &["day_completeness", "recipe", "recipe_ingredient"],
    );
    Connection::open(&path)
        .unwrap()
        .execute_batch(
            "CREATE TABLE workout (id TEXT PRIMARY KEY, ended_at TEXT); CREATE TABLE workout_set (id TEXT PRIMARY KEY, workout_id TEXT, difficulty TEXT);",
        )
        .unwrap();
    for (table, names) in [
        (
            "workout",
            &[
                "sync_workout_ai",
                "sync_workout_au",
                "sync_workout_close_decisions_au",
            ][..],
        ),
        (
            "workout_set",
            &[
                "sync_workout_set_ai",
                "sync_workout_set_au",
                "sync_workout_set_difficulty_au",
            ][..],
        ),
    ] {
        for name in names {
            let sql = trigger_body_for(name, table, 9).unwrap_or_else(|| panic!("{name}"));
            Connection::open(&path).unwrap().execute_batch(sql).unwrap();
        }
    }
    make_tables(
        &path,
        9,
        &[
            "progression_profile",
            "recommendation_decision",
            "mesocycle",
            "food",
            "food_portion",
            "meal_entry",
            "nutrition_target",
        ],
    );
    assert_eq!(check_backup_file(&path, APP_SCHEMA_VERSION).unwrap(), 9);
    // Un corps modifié d'un déclencheur de recette est refusé.
    Connection::open(&path)
        .unwrap()
        .execute_batch(
            "DROP TRIGGER sync_recipe_au; CREATE TRIGGER sync_recipe_au AFTER UPDATE ON recipe BEGIN SELECT 1; END;",
        )
        .unwrap();
    assert!(check_backup_file(&path, APP_SCHEMA_VERSION).is_err());
}

#[test]
fn i5_01_a_version_11_backup_is_refused_as_newer_schema() {
    let dir = scratch();
    let path = dir.path().join("v11.db");
    make_db(&path, 3, &TABLES);
    Connection::open(&path)
        .unwrap()
        .execute_batch("INSERT INTO schema_migrations (version) VALUES (4); INSERT INTO schema_migrations (version) VALUES (5); INSERT INTO schema_migrations (version) VALUES (6); INSERT INTO schema_migrations (version) VALUES (7); INSERT INTO schema_migrations (version) VALUES (8); INSERT INTO schema_migrations (version) VALUES (9); INSERT INTO schema_migrations (version) VALUES (10); INSERT INTO schema_migrations (version) VALUES (11);")
        .unwrap();
    assert_eq!(error_code(&path), "newer-schema");
}

#[test]
fn i5_01_the_recovery_triggers_do_not_exist_before_version_10_and_the_local_tables_have_none() {
    for table in ["recovery_day", "muscle_recovery"] {
        for suffix in ["ai", "au"] {
            let name = format!("sync_{table}_{suffix}");
            assert_eq!(trigger_body_for(&name, table, 9), None, "{name}");
            assert!(trigger_body_for(&name, table, 10).is_some(), "{name}");
        }
    }
    // recovery_sample et recovery_import_state sont locales : aucun déclencheur de capture n'est admis dessus, à aucune version.
    for table in ["recovery_sample", "recovery_import_state"] {
        for suffix in ["ai", "au"] {
            assert_eq!(trigger_body_for(&format!("sync_{table}_{suffix}"), table, 10), None);
        }
    }
}

#[test]
fn i5_01_a_version_10_backup_with_the_recovery_tables_is_accepted_and_a_tampered_one_is_refused() {
    let dir = scratch();
    let path = dir.path().join("v10.db");
    make_db(&path, 10, &TABLES);
    make_tables(&path, 10, &["recovery_day", "muscle_recovery"]);
    assert_eq!(check_backup_file(&path, APP_SCHEMA_VERSION).unwrap(), 10);
    Connection::open(&path)
        .unwrap()
        .execute_batch(
            "DROP TRIGGER sync_recovery_day_au; CREATE TRIGGER sync_recovery_day_au AFTER UPDATE ON recovery_day BEGIN SELECT 1; END;",
        )
        .unwrap();
    assert!(check_backup_file(&path, APP_SCHEMA_VERSION).is_err());
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
