//! DATA-0295 (§ 23.1 c, H-18) : parité de la base Wasm des tests et du plugin SQL natif vendored, par le chemin de production (le pool
//! `open_sqlite_pool` et `DbPool::execute` / `select`, garde SEC-01 comprise), sur les scénarios de `src/db/migrator.test.ts` qui dépendent
//! du moteur : migrations de l'app appliquées dans l'ordre, chacune dans `BEGIN IMMEDIATE … COMMIT` (comme `serializedDriver.ts`), avec
//! `schema_migrations` ; second passage sans effet ; migration annulée entière si une instruction échoue ; même schéma (tables et déclencheurs)
//! que la base migrée par TypeScript (`spartiate-migrations.json`). Puis le scénario partagé `tests/fixtures/db/wasm-native-parity.json`,
//! rejoué aussi par `src/db/wasmNativeParity.test.ts` sur Wasm : mêmes valeurs attendues des deux côtés. Les contrôles propres au
//! migrateur TypeScript (somme de contrôle, base plus récente, liste déclarée) ne dépendent pas du moteur et restent dans Vitest.

use serde_json::Value;
use tauri_plugin_sql::{open_sqlite_pool, DbPool};

fn migrations_fixture() -> Value {
    serde_json::from_str(include_str!("../fixtures/spartiate-migrations.json")).unwrap()
}

fn parity_scenario() -> Value {
    serde_json::from_str(include_str!(
        "../../../tests/fixtures/db/wasm-native-parity.json"
    ))
    .unwrap()
}

const CREATE_MIGRATIONS: &str = "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)";

fn runtime() -> tokio::runtime::Runtime {
    tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap()
}

async fn open(dir: &tempfile::TempDir) -> DbPool {
    let path = dir.path().join("spartiate.db");
    std::fs::File::create(&path).unwrap();
    DbPool::Sqlite(
        open_sqlite_pool(&format!("sqlite:{}", path.to_string_lossy()))
            .await
            .unwrap(),
    )
}

async fn exec(db: &DbPool, sql: &str, params: Vec<Value>) -> Result<(), String> {
    db.execute(sql.to_owned(), params)
        .await
        .map(|_| ())
        .map_err(|e| e.to_string())
}

async fn rows(db: &DbPool, sql: &str) -> Vec<Vec<Value>> {
    db.select(sql.to_owned(), vec![])
        .await
        .unwrap_or_else(|e| panic!("{sql} : {e}"))
        .into_iter()
        .map(|row| row.into_values().collect())
        .collect()
}

/// Applique une migration comme le migrateur TypeScript : `BEGIN IMMEDIATE`, instructions, ligne de suivi, `COMMIT` ; `ROLLBACK` sur échec.
async fn apply(db: &DbPool, version: u64, name: &str, statements: &[&str]) -> Result<(), String> {
    exec(db, "BEGIN IMMEDIATE", vec![]).await?;
    for statement in statements {
        if let Err(error) = exec(db, statement, vec![]).await {
            exec(db, "ROLLBACK", vec![]).await?;
            return Err(error);
        }
    }
    exec(
        db,
        "INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, 'c', 'now')",
        vec![Value::from(version), Value::from(name)],
    )
    .await?;
    exec(db, "COMMIT", vec![]).await
}

async fn migrate_all(db: &DbPool, fixture: &Value) {
    exec(db, CREATE_MIGRATIONS, vec![]).await.unwrap();
    for migration in fixture["migrations"].as_array().unwrap() {
        let version = migration["version"].as_u64().unwrap();
        let statements: Vec<&str> = migration["statements"]
            .as_array()
            .unwrap()
            .iter()
            .map(|s| s.as_str().unwrap())
            .collect();
        apply(
            db,
            version,
            migration["name"].as_str().unwrap(),
            &statements,
        )
        .await
        .unwrap_or_else(|e| panic!("migration {version} refusée par le plugin natif : {e}"));
    }
}

fn names(rows: Vec<Vec<Value>>) -> Vec<String> {
    let mut out: Vec<String> = rows
        .into_iter()
        .map(|r| r[0].as_str().unwrap().to_owned())
        .collect();
    out.sort();
    out
}

/// Nombres comparés en valeur (le pilote natif rend un REAL `70.0`, le JSON attendu `70`).
fn same(actual: &Value, expected: &Value) -> bool {
    match (actual.as_f64(), expected.as_f64()) {
        (Some(a), Some(b)) => a == b,
        _ => actual == expected,
    }
}

#[test]
fn data0295_h18_app_migrations_apply_in_order_through_the_native_plugin_and_match_the_wasm_schema()
{
    let fixture = migrations_fixture();
    let dir = tempfile::tempdir_in(env!("CARGO_TARGET_TMPDIR")).unwrap();
    runtime().block_on(async {
        let db = open(&dir).await;
        migrate_all(&db, &fixture).await;
        let versions = rows(
            &db,
            "SELECT version FROM schema_migrations ORDER BY version",
        )
        .await;
        let declared: Vec<u64> = fixture["migrations"]
            .as_array()
            .unwrap()
            .iter()
            .map(|m| m["version"].as_u64().unwrap())
            .collect();
        assert_eq!(
            versions
                .iter()
                .map(|r| r[0].as_u64().unwrap())
                .collect::<Vec<_>>(),
            declared
        );
        // Second passage (`ensureMigrationsTable` idempotent) : rien de plus.
        exec(&db, CREATE_MIGRATIONS, vec![]).await.unwrap();
        assert_eq!(
            rows(&db, "SELECT version FROM schema_migrations")
                .await
                .len(),
            declared.len()
        );
        // Même schéma que la base migrée par TypeScript sur Wasm, à la dernière version.
        let last = fixture["versions"].as_array().unwrap().last().unwrap();
        let version = last["version"].as_u64().unwrap();
        let mut tables: Vec<String> = last["tables"]
            .as_array()
            .unwrap()
            .iter()
            .map(|t| t.as_str().unwrap().to_owned())
            .collect();
        tables.sort();
        let native_tables = names(
            rows(
                &db,
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
            )
            .await,
        );
        assert_eq!(native_tables, tables, "tables du plugin natif et de Wasm");
        let mut triggers: Vec<String> = fixture["triggers"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|t| {
                t["versions"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .any(|v| v.as_u64() == Some(version))
            })
            .map(|t| t["name"].as_str().unwrap().to_owned())
            .collect();
        triggers.sort();
        let native_triggers =
            names(rows(&db, "SELECT name FROM sqlite_master WHERE type = 'trigger'").await);
        assert_eq!(
            native_triggers, triggers,
            "déclencheurs du plugin natif et de Wasm"
        );
        db.close().await;
    });
}

#[test]
fn data0295_h18_a_failing_statement_rolls_back_the_whole_migration_on_the_native_plugin() {
    let dir = tempfile::tempdir_in(env!("CARGO_TARGET_TMPDIR")).unwrap();
    runtime().block_on(async {
        let db = open(&dir).await;
        exec(&db, CREATE_MIGRATIONS, vec![]).await.unwrap();
        apply(&db, 1, "un", &["CREATE TABLE a (x INTEGER)"])
            .await
            .unwrap();
        let failed = apply(
            &db,
            2,
            "deux",
            &[
                "CREATE TABLE b (x INTEGER)",
                "INSERT INTO table_absente VALUES (1)",
            ],
        )
        .await;
        assert!(failed.is_err());
        assert_eq!(
            names(
                rows(
                    &db,
                    "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('a', 'b')"
                )
                .await
            ),
            vec!["a".to_owned()]
        );
        assert_eq!(
            rows(&db, "SELECT version FROM schema_migrations")
                .await
                .len(),
            1
        );
        // Plus aucune transaction ouverte : la suivante s'ouvre.
        apply(&db, 2, "deux", &["CREATE TABLE b (x INTEGER)"])
            .await
            .unwrap();
        db.close().await;
    });
}

#[test]
fn data0295_h18_the_shared_scenario_gives_the_same_values_as_wasm() {
    let fixture = migrations_fixture();
    let scenario = parity_scenario();
    let dir = tempfile::tempdir_in(env!("CARGO_TARGET_TMPDIR")).unwrap();
    runtime().block_on(async {
        let db = open(&dir).await;
        migrate_all(&db, &fixture).await;
        for step in scenario["steps"].as_array().unwrap() {
            let sql = step["sql"].as_str().unwrap();
            exec(&db, sql, step["params"].as_array().unwrap().clone())
                .await
                .unwrap_or_else(|e| panic!("{sql} : {e}"));
        }
        for bad in scenario["failing"].as_array().unwrap() {
            let sql = bad["sql"].as_str().unwrap();
            assert!(
                exec(&db, sql, vec![]).await.is_err(),
                "accepté à tort : {sql}"
            );
        }
        for check in scenario["checks"].as_array().unwrap() {
            let sql = check["sql"].as_str().unwrap();
            let actual = rows(&db, sql).await;
            let expected: Vec<Vec<Value>> = check["expect"]
                .as_array()
                .unwrap()
                .iter()
                .map(|r| r.as_array().unwrap().clone())
                .collect();
            let equal = actual.len() == expected.len()
                && actual
                    .iter()
                    .zip(&expected)
                    .all(|(a, e)| a.len() == e.len() && a.iter().zip(e).all(|(x, y)| same(x, y)));
            assert!(equal, "{sql} : natif {actual:?}, Wasm {expected:?}");
        }
        db.close().await;
    });
}
