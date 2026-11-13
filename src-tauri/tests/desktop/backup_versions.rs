//! K-05 critère 4 (ADR 0008 §10.2) : déclencheurs de référence d'une sauvegarde selon la version de schéma. Une sauvegarde de version 17 porte
//! les corps de la migration 0015 (capture de `task` et de `settings` sans les Rappels Apple) : elle est admise, et recréée avec ces corps ;
//! les corps de la migration 0018 ne sont valables qu'à partir de la version 18.

use std::path::Path;

use rusqlite::Connection;
use spartiate_lib::backup::{check_backup_file, normalize_sql, reset_triggers, APP_SCHEMA_VERSION};
use spartiate_lib::backup_triggers::{
    introduced_in, trigger_body_for, REFERENCE_TRIGGERS, SPARTIATE_TABLES,
    SPARTIATE_TRIGGERS_BY_VERSION, SUPERSEDED_TRIGGERS,
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
        "recovery_day",
        "muscle_recovery",
        "recovery_factor",
        "measurement",
        "progress_photo",
        "progress_photo_file",
        "food_favorite",
        "data_reset",
        "cardio_session",
        "cardio_track",
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
            Some(18),
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
        if table == "settings" {
            // I5-01 point 1.1 : `settings` est une table Spartiate ; les déclencheurs hérités n'y sont admis à aucune version.
            for version in [15, 17, 18, 99] {
                assert_eq!(
                    trigger_body_for(name, table, version),
                    None,
                    "{name}@{version}"
                );
            }
            continue;
        }
        assert_eq!(trigger_body_for(name, table, 17), Some(sql));
        assert_eq!(trigger_body_for(name, table, 15), Some(sql));
        assert_eq!(trigger_body_for(name, table, 18), Some(current));
        assert_eq!(trigger_body_for(name, table, 99), Some(current));
    }
    // Les autres déclencheurs ont le même corps à toute version, sauf les hérités sur une table Spartiate (jamais admis).
    for (name, table, sql) in REFERENCE_TRIGGERS {
        if REPLACED.contains(&name) {
            continue;
        }
        let expected = if name.starts_with("search_routine_") {
            None
        } else {
            Some(sql)
        };
        assert_eq!(trigger_body_for(name, table, 17), expected, "{name}");
        assert_eq!(trigger_body_for(name, table, 18), expected, "{name}");
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
            if name.starts_with("sync_settings_") {
                // I5-01 point 1.1 : jamais recréés sur la table Spartiate `settings`.
                let count: u64 = conn
                    .query_row(
                        "SELECT COUNT(*) FROM sqlite_master WHERE name = ?1",
                        [name],
                        |r| r.get(0),
                    )
                    .unwrap();
                assert_eq!(count, 0, "{name} en version {version}");
                continue;
            }
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

// ---------------------------------------------------------------------------------------------------------------------------------------------
// I5-01 point 1.1 (relecture sync-icloud, suite du point 9 d'I4-08) : référentiel des déclencheurs = base neuve migrée, à chaque version.
// Fixture `spartiate-migrations.json` : instructions des migrations TypeScript et déclencheurs d'une base migrée par le vrai migrateur à chaque
// version, tenue à jour par `scripts/release/backupMigrationsFixture.test.ts` (régénération : `node scripts/backup/export-migrations-fixture.mjs`).
// ---------------------------------------------------------------------------------------------------------------------------------------------

fn migrations_fixture() -> serde_json::Value {
    serde_json::from_str(include_str!("../fixtures/spartiate-migrations.json")).unwrap()
}

/// Versions de schéma décrites par la fixture (1 à la dernière migration TypeScript), dans l'ordre.
fn fixture_versions(fixture: &serde_json::Value) -> Vec<u32> {
    fixture["versions"]
        .as_array()
        .unwrap()
        .iter()
        .map(|v| v["version"].as_u64().unwrap() as u32)
        .collect()
}

/// Tables d'une base migrée à cette version (fixture).
fn fixture_tables(fixture: &serde_json::Value, version: u32) -> Vec<String> {
    fixture["versions"]
        .as_array()
        .unwrap()
        .iter()
        .find(|v| v["version"].as_u64() == Some(version as u64))
        .unwrap()["tables"]
        .as_array()
        .unwrap()
        .iter()
        .map(|t| t.as_str().unwrap().to_owned())
        .collect()
}

/// Déclencheurs (nom, table, corps compacté) d'une base migrée par les migrations TypeScript à cette version (fixture), triés par nom.
fn fixture_triggers(fixture: &serde_json::Value, version: u32) -> Vec<(String, String, String)> {
    let mut out: Vec<(String, String, String)> = fixture["triggers"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|t| {
            t["versions"]
                .as_array()
                .unwrap()
                .iter()
                .any(|v| v.as_u64() == Some(version as u64))
        })
        .map(|t| {
            (
                t["name"].as_str().unwrap().to_owned(),
                t["table"].as_str().unwrap().to_owned(),
                normalize_sql(t["sql"].as_str().unwrap()),
            )
        })
        .collect();
    out.sort();
    out
}

/// Base neuve migrée jusqu'à `version` : table de suivi du migrateur, puis instructions de chaque migration rejouées dans sa transaction.
fn make_migrated_db(path: &Path, fixture: &serde_json::Value, version: u32) {
    let mut conn = Connection::open(path).unwrap();
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)",
    )
    .unwrap();
    for migration in fixture["migrations"].as_array().unwrap() {
        let v = migration["version"].as_u64().unwrap() as u32;
        if v > version {
            break;
        }
        let tx = conn.transaction().unwrap();
        for statement in migration["statements"].as_array().unwrap() {
            tx.execute_batch(statement.as_str().unwrap())
                .unwrap_or_else(|e| panic!("migration {v} : {e}"));
        }
        tx.execute(
            "INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?1, ?2, 'c', 'now')",
            rusqlite::params![v, migration["name"].as_str().unwrap()],
        )
        .unwrap();
        tx.commit().unwrap();
    }
}

/// Déclencheurs (nom, table, corps compacté) présents dans le fichier, triés par nom.
fn triggers_of(path: &Path) -> Vec<(String, String, String)> {
    let conn = Connection::open(path).unwrap();
    let mut statement = conn
        .prepare(
            "SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'trigger' ORDER BY name",
        )
        .unwrap();
    let rows = statement
        .query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                normalize_sql(&r.get::<_, String>(2)?),
            ))
        })
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();
    rows
}

#[test]
fn i5_01_the_migrations_fixture_covers_every_schema_version_up_to_the_app_one() {
    let fixture = migrations_fixture();
    // Une version de schéma sans entrée (migration 0010 ajoutée sans régénérer la fixture, ou APP_SCHEMA_VERSION oubliée) échoue ici.
    assert_eq!(
        fixture_versions(&fixture),
        (1..=APP_SCHEMA_VERSION).collect::<Vec<_>>(),
        "fixture périmée ou APP_SCHEMA_VERSION non alignée : node scripts/backup/export-migrations-fixture.mjs"
    );
}

/// Pour chaque version de 1 à la courante : la base rejouée côté Rust porte exactement les déclencheurs de la base migrée par TypeScript ;
/// chacun est connu du référentiel avec ce corps à cette version (sinon la sauvegarde serait refusée) ; et `reset_triggers` recrée exactement
/// cet ensemble (noms et corps), ni plus (une migration suivante échouerait sur « trigger already exists »), ni moins (capture perdue).
#[test]
fn i5_01_for_every_schema_version_reset_triggers_recreates_exactly_the_triggers_of_a_migrated_base()
{
    let fixture = migrations_fixture();
    let dir = scratch();
    for version in fixture_versions(&fixture) {
        let path = dir.path().join(format!("migree-{version}.db"));
        make_migrated_db(&path, &fixture, version);
        let migrated = triggers_of(&path);
        assert_eq!(
            migrated,
            fixture_triggers(&fixture, version),
            "version {version} : la base rejouée diffère de la base migrée par TypeScript"
        );
        for (name, table, sql) in &migrated {
            let known = trigger_body_for(name, table, version).unwrap_or_else(|| {
                panic!("version {version} : déclencheur {name} (table {table}) de la base migrée absent du référentiel (backup_triggers.rs)")
            });
            assert_eq!(
                &normalize_sql(known),
                sql,
                "version {version} : corps de {name} différent du référentiel"
            );
        }
        assert_eq!(
            check_backup_file(&path, APP_SCHEMA_VERSION).unwrap(),
            version
        );
        reset_triggers(&path).unwrap();
        assert_eq!(
            triggers_of(&path),
            migrated,
            "version {version} : la restauration ne recrée pas exactement l'ensemble migré"
        );
        // Même résultat avec un déclencheur étranger posé avant (il disparaît).
        Connection::open(&path)
            .unwrap()
            .execute_batch("CREATE TRIGGER evil AFTER INSERT ON profile BEGIN SELECT 1; END;")
            .unwrap();
        reset_triggers(&path).unwrap();
        assert_eq!(triggers_of(&path), migrated, "version {version}");
    }
}

/// Déclarations du référentiel : une entrée par version de 1 à `APP_SCHEMA_VERSION` (même vide), et à chaque version exactement les
/// déclencheurs qu'une base migrée gagne à cette version ; tables Spartiate = tables d'une base migrée (toutes versions). C'est la garde de la
/// migration 0010 : `recovery_day`, `muscle_recovery` et leurs déclencheurs de capture devront être déclarés.
#[test]
fn i5_01_every_schema_version_declares_exactly_the_triggers_it_introduces_and_every_table() {
    let fixture = migrations_fixture();
    let versions = fixture_versions(&fixture);
    assert_eq!(
        SPARTIATE_TRIGGERS_BY_VERSION
            .iter()
            .map(|(v, _)| *v)
            .collect::<Vec<_>>(),
        versions,
        "une version de schéma sans entrée dans SPARTIATE_TRIGGERS_BY_VERSION (backup_triggers.rs)"
    );
    let mut previous: Vec<String> = Vec::new();
    for version in versions {
        let now: Vec<String> = fixture_triggers(&fixture, version)
            .into_iter()
            .map(|(n, ..)| n)
            .collect();
        let mut introduced: Vec<String> = now
            .iter()
            .filter(|n| !previous.contains(n))
            .cloned()
            .collect();
        introduced.sort();
        let mut declared: Vec<String> = SPARTIATE_TRIGGERS_BY_VERSION
            .iter()
            .find(|(v, _)| *v == version)
            .unwrap()
            .1
            .iter()
            .map(|n| (*n).to_owned())
            .collect();
        declared.sort();
        assert_eq!(declared, introduced, "version {version}");
        for name in &declared {
            assert_eq!(introduced_in(name), Some(version), "{name}");
            assert!(
                REFERENCE_TRIGGERS.iter().any(|(n, _, _)| n == name),
                "{name} absent de REFERENCE_TRIGGERS"
            );
        }
        previous = now;
    }
    let mut tables: Vec<String> = Vec::new();
    for version in fixture_versions(&fixture) {
        for table in fixture_tables(&fixture, version) {
            if !tables.contains(&table) {
                tables.push(table);
            }
        }
    }
    tables.sort();
    let mut declared: Vec<String> = SPARTIATE_TABLES.iter().map(|t| (*t).to_owned()).collect();
    declared.sort();
    assert_eq!(
        declared, tables,
        "SPARTIATE_TABLES (backup_triggers.rs) différent des tables d'une base migrée"
    );
    assert_eq!(
        introduced_in("evil"),
        None,
        "nom inconnu : aucune version par défaut"
    );
}

/// Point 9 (1) : aucun déclencheur hérité de l'ancien projet (nom qu'aucune migration Spartiate ne crée) n'est admis ni recréé sur une table
/// d'une base Spartiate, à aucune version de schéma : `sync_settings_*` (valables à partir de la version 15 dans l'ancien projet) sur
/// `settings`, `search_routine_*` sur `routine`.
#[test]
fn i5_01_no_legacy_trigger_is_admitted_on_a_spartiate_table_at_any_version() {
    let fixture = migrations_fixture();
    let tables = fixture_tables(&fixture, APP_SCHEMA_VERSION);
    let spartiate_names: Vec<String> = fixture["triggers"]
        .as_array()
        .unwrap()
        .iter()
        .map(|t| t["name"].as_str().unwrap().to_owned())
        .collect();
    let legacy = REFERENCE_TRIGGERS
        .iter()
        .map(|(n, t, _)| (*n, *t))
        .chain(SUPERSEDED_TRIGGERS.iter().map(|(n, t, ..)| (*n, *t)))
        .filter(|(n, t)| !spartiate_names.iter().any(|s| s == n) && tables.iter().any(|x| x == t));
    let mut offending = Vec::new();
    for (name, table) in legacy {
        if let Some(version) = (1..=99).find(|v| trigger_body_for(name, table, *v).is_some()) {
            offending.push(format!("{name}@{version}"));
        }
    }
    assert!(
        offending.is_empty(),
        "déclencheurs hérités admis sur une table Spartiate : {offending:?}"
    );
}

/// Point 9 (1), par la restauration : une base Spartiate dont la table de versions annonce 15 à 30 (et une table `search_index_doc`
/// fabriquée) ne reçoit ni `sync_settings_*` ni `search_routine_*` de `reset_triggers`.
#[test]
fn i5_01_reset_triggers_never_puts_legacy_triggers_on_settings_or_routine() {
    let fixture = migrations_fixture();
    let dir = scratch();
    for announced in [15u32, 17, 18, 30] {
        let path = dir.path().join(format!("annoncee-{announced}.db"));
        make_migrated_db(&path, &fixture, APP_SCHEMA_VERSION);
        {
            let conn = Connection::open(&path).unwrap();
            for v in (APP_SCHEMA_VERSION + 1)..=announced {
                conn.execute(
                    "INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?1, 'n', 'c', 'now')",
                    [v],
                )
                .unwrap();
            }
            conn.execute_batch(
                "CREATE TABLE search_index_doc (id INTEGER PRIMARY KEY, type TEXT, ref_id TEXT);",
            )
            .unwrap();
        }
        reset_triggers(&path).unwrap();
        let names = trigger_names(&path);
        assert!(
            !names
                .iter()
                .any(|n| n.starts_with("sync_settings_") || n.starts_with("search_routine_")),
            "version annoncée {announced} : {names:?}"
        );
    }
}
