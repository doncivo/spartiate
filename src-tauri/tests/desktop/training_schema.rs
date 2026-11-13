//! I1-01 / I1-02 / I1-03 : les versions 2 (migration 0002, bibliothèque, matériel et routines), 3 (migration 0003, séance locale `workout` /
//! `workout_set`, sans déclencheur de capture : D-27) et 4 (migration 0004, déclencheurs gardés des séances closes) sont admises par la
//! vérification des sauvegardes, comme la 5 (I2-01, migration 0005 : `progression_profile` et `recommendation_decision`, locales, sans
//! déclencheur), la 6 (I2-01 PR 2/2, migration 0006 : captures des deux tables de progression et de `workout_set.difficulty`) et la 7
//! (I3-02, migration 0007 : captures de `mesocycle`), la 8 (I4-02, migration 0008 : captures de `food`, `food_portion`, `meal_entry` et
//! `nutrition_target`) et la 9 (I4-07, migration 0009 : captures de `day_completeness`, `recipe` et `recipe_ingredient`), jusqu'à la 14
//! (I6-03b, migration 0014 : capture propre des colonnes de groupe de `routine_exercise`) et la 15 (FIX-0181, migration 0015 : captures de
//! `food_favorite`) et la 16 (RESET-01, migration 0016 : captures de `data_reset`), la 17 (I6-05, migration 0017 : captures de `supplement` et `supplement_intake`) et celle du cardio (I6-06, `CARDIO_VERSION`,
//! migration 0018 : captures de `cardio_session`, tracé local sans déclencheur) ; la version suivante, inconnue de cette app, est refusée. Les
//! déclencheurs de capture sont ceux de la référence.

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

/// I6-06 : version de la migration du cardio (`src/db/migrations/00NN_cardio.ts`), la dernière du registre.
const CARDIO_VERSION: u32 = 18;

#[test]
fn i6_06_the_app_schema_version_is_the_cardio_version() {
    assert_eq!(APP_SCHEMA_VERSION, CARDIO_VERSION);
}

/// I6-06 : les deux déclencheurs de capture de `cardio_session` n'existent qu'à partir de la version du cardio ; aucun sur le tracé local
/// `cardio_track` ; une sauvegarde dont le corps est modifié est refusée.
#[test]
fn i6_06_the_cardio_triggers_exist_only_from_the_cardio_version_and_the_track_has_none() {
    for suffix in ["ai", "au"] {
        let name = format!("sync_cardio_session_{suffix}");
        assert_eq!(
            trigger_body_for(&name, "cardio_session", CARDIO_VERSION - 1),
            None
        );
        assert!(trigger_body_for(&name, "cardio_session", CARDIO_VERSION).is_some());
    }
    assert!(REFERENCE_TRIGGERS
        .iter()
        .all(|(_, table, _)| *table != "cardio_track"));
}

/// I6-06 : une sauvegarde Spartiate de la version du cardio (déclencheurs de `cardio_session`) est admise ; un corps modifié est refusé ; la même
/// version portant un déclencheur de l'ancien projet (CircleTasks, numérotation 17 à 19) est refusée comme d'un schéma inconnu (D-54).
#[test]
fn i6_06_a_cardio_version_backup_is_accepted_a_tampered_or_old_project_one_is_refused() {
    let dir = scratch();
    let build = |name: &str| {
        let path = dir.path().join(name);
        make_db(&path, CARDIO_VERSION, &TABLES);
        let circuit = trigger_body_for(
            "sync_routine_exercise_circuit_au",
            "routine_exercise",
            CARDIO_VERSION,
        )
        .unwrap();
        let conn = Connection::open(&path).unwrap();
        conn.execute_batch(
            "ALTER TABLE routine_exercise ADD COLUMN circuit_id TEXT; ALTER TABLE routine_exercise ADD COLUMN circuit_rest_sec INTEGER;",
        )
        .unwrap();
        conn.execute_batch(circuit).unwrap();
        drop(conn);
        make_tables(&path, CARDIO_VERSION, &["cardio_session"]);
        path
    };
    let good = build("cardio.db");
    assert_eq!(
        check_backup_file(&good, APP_SCHEMA_VERSION).unwrap(),
        CARDIO_VERSION
    );
    let tampered = build("tampered.db");
    Connection::open(&tampered)
        .unwrap()
        .execute_batch(
            "DROP TRIGGER sync_cardio_session_au; CREATE TRIGGER sync_cardio_session_au AFTER UPDATE ON cardio_session BEGIN SELECT 1; END;",
        )
        .unwrap();
    assert!(check_backup_file(&tampered, APP_SCHEMA_VERSION).is_err());
    let old = build("old-project.db");
    let task = trigger_body_for("sync_task_ai", "task", CARDIO_VERSION).unwrap();
    let conn = Connection::open(&old).unwrap();
    conn.execute_batch("CREATE TABLE task (id TEXT PRIMARY KEY);")
        .unwrap();
    conn.execute_batch(task).unwrap();
    drop(conn);
    assert_eq!(error_code(&old), "newer-schema");
}


/// I6-05 (migration 0017) : les quatre déclencheurs de capture des compléments n'existent qu'à partir de la version 17 ; une sauvegarde de version 17
/// qui les porte est admise, une dont un corps est modifié est refusée.
#[test]
fn i6_05_a_version_17_backup_with_the_supplement_triggers_is_accepted_and_a_tampered_one_is_refused(
) {
    for table in ["supplement", "supplement_intake"] {
        for suffix in ["ai", "au"] {
            let name = format!("sync_{table}_{suffix}");
            assert_eq!(trigger_body_for(&name, table, 16), None);
            assert!(trigger_body_for(&name, table, 17).is_some());
        }
    }
    let dir = scratch();
    let path = dir.path().join("v17.db");
    make_db(&path, 17, &TABLES);
    let circuit =
        trigger_body_for("sync_routine_exercise_circuit_au", "routine_exercise", 17).unwrap();
    Connection::open(&path)
        .unwrap()
        .execute_batch(
            "ALTER TABLE routine_exercise ADD COLUMN circuit_id TEXT; ALTER TABLE routine_exercise ADD COLUMN circuit_rest_sec INTEGER;",
        )
        .unwrap();
    Connection::open(&path)
        .unwrap()
        .execute_batch(circuit)
        .unwrap();
    make_tables(
        &path,
        17,
        &[
            "food_favorite",
            "data_reset",
            "supplement",
            "supplement_intake",
        ],
    );
    assert_eq!(check_backup_file(&path, APP_SCHEMA_VERSION).unwrap(), 17);
    Connection::open(&path)
        .unwrap()
        .execute_batch(
            "DROP TRIGGER sync_supplement_intake_au; CREATE TRIGGER sync_supplement_intake_au AFTER UPDATE ON supplement_intake BEGIN SELECT 1; END;",
        )
        .unwrap();
    assert!(check_backup_file(&path, APP_SCHEMA_VERSION).is_err());
}

/// RESET-01 (migration 0016) : les deux déclencheurs de capture de `data_reset` n'existent qu'à partir de la version 16.
#[test]
fn reset_01_the_data_reset_triggers_do_not_exist_before_version_16() {
    for suffix in ["ai", "au"] {
        let name = format!("sync_data_reset_{suffix}");
        assert_eq!(trigger_body_for(&name, "data_reset", 15), None);
        assert!(trigger_body_for(&name, "data_reset", 16).is_some());
    }
}

/// FIX-0181 (migration 0015) : les deux déclencheurs de capture de `food_favorite` n'existent qu'à partir de la version 15 ; une sauvegarde de version 15
/// qui les porte est admise, une dont le corps est modifié est refusée.
#[test]
fn fix_0181_a_version_15_backup_with_the_favorite_triggers_is_accepted_and_a_tampered_one_is_refused(
) {
    for suffix in ["ai", "au"] {
        let name = format!("sync_food_favorite_{suffix}");
        assert_eq!(trigger_body_for(&name, "food_favorite", 14), None);
        assert!(trigger_body_for(&name, "food_favorite", 15).is_some());
    }
    let dir = scratch();
    let path = dir.path().join("v15.db");
    make_db(&path, 15, &TABLES);
    let circuit =
        trigger_body_for("sync_routine_exercise_circuit_au", "routine_exercise", 15).unwrap();
    Connection::open(&path)
        .unwrap()
        .execute_batch(
            "ALTER TABLE routine_exercise ADD COLUMN circuit_id TEXT; ALTER TABLE routine_exercise ADD COLUMN circuit_rest_sec INTEGER;",
        )
        .unwrap();
    Connection::open(&path)
        .unwrap()
        .execute_batch(circuit)
        .unwrap();
    make_tables(&path, 15, &["food_favorite"]);
    assert_eq!(check_backup_file(&path, APP_SCHEMA_VERSION).unwrap(), 15);
    Connection::open(&path)
        .unwrap()
        .execute_batch(
            "DROP TRIGGER sync_food_favorite_au; CREATE TRIGGER sync_food_favorite_au AFTER UPDATE ON food_favorite BEGIN SELECT 1; END;",
        )
        .unwrap();
    assert!(check_backup_file(&path, APP_SCHEMA_VERSION).is_err());
}

/// I6-03b (migration 0014) : le déclencheur propre des colonnes de groupe de `routine_exercise` n'existe qu'à partir de la version 14 ; le corps publié
/// de `sync_routine_exercise_au` (0002) n'est pas remplacé.
#[test]
fn i6_03b_the_routine_circuit_trigger_does_not_exist_before_version_14() {
    let name = "sync_routine_exercise_circuit_au";
    assert_eq!(trigger_body_for(name, "routine_exercise", 13), None);
    let body = trigger_body_for(name, "routine_exercise", 14).expect(name);
    assert!(body.contains("AFTER UPDATE OF circuit_id, circuit_rest_sec ON routine_exercise"));
    assert_eq!(
        trigger_body_for("sync_routine_exercise_au", "routine_exercise", 2),
        trigger_body_for("sync_routine_exercise_au", "routine_exercise", 14)
    );
}

#[test]
fn i6_03b_a_version_14_backup_with_the_routine_circuit_trigger_is_accepted_and_a_tampered_one_is_refused(
) {
    let dir = scratch();
    let path = dir.path().join("v14.db");
    make_db(&path, 14, &TABLES);
    let sql = trigger_body_for("sync_routine_exercise_circuit_au", "routine_exercise", 14).unwrap();
    Connection::open(&path)
        .unwrap()
        .execute_batch(
            "ALTER TABLE routine_exercise ADD COLUMN circuit_id TEXT; ALTER TABLE routine_exercise ADD COLUMN circuit_rest_sec INTEGER;",
        )
        .unwrap();
    Connection::open(&path).unwrap().execute_batch(sql).unwrap();
    assert_eq!(check_backup_file(&path, APP_SCHEMA_VERSION).unwrap(), 14);
    Connection::open(&path)
        .unwrap()
        .execute_batch(
            "DROP TRIGGER sync_routine_exercise_circuit_au; CREATE TRIGGER sync_routine_exercise_circuit_au AFTER UPDATE OF circuit_id ON routine_exercise BEGIN SELECT 1; END;",
        )
        .unwrap();
    assert!(check_backup_file(&path, APP_SCHEMA_VERSION).is_err());
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
fn i6_06_a_backup_newer_than_the_cardio_version_is_refused_as_newer_schema() {
    let dir = scratch();
    let path = dir.path().join("newer.db");
    make_db(&path, 3, &TABLES);
    let inserts: String = (4..=CARDIO_VERSION + 1)
        .map(|v| format!("INSERT INTO schema_migrations (version) VALUES ({v}); "))
        .collect();
    Connection::open(&path)
        .unwrap()
        .execute_batch(&inserts)
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
            assert_eq!(
                trigger_body_for(&format!("sync_{table}_{suffix}"), table, 10),
                None
            );
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
