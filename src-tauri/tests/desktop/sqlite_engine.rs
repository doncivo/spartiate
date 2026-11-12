//! DEP-01 (0.18.1) : le moteur SQLite embarqué corrige RUSTSEC-2026-0459 (CVE-2026-119375, SQLite >= 3.54.0). Un seul
//! `libsqlite3-sys` dans le graphe (`links = "sqlite3"`) : rusqlite (sauvegardes, restauration, synchro) et sqlx (plugin SQL vendored,
//! base de l'app) lisent le même moteur ; les deux chemins sont vérifiés.

use tauri_plugin_sql::{open_sqlite_pool, DbPool};

/// Plus petite version de SQLite qui corrige RUSTSEC-2026-0459.
const MIN_SQLITE: (u32, u32, u32) = (3, 54, 0);

fn parse(version: &str) -> (u32, u32, u32) {
    let mut parts = version.split('.').map(|p| {
        p.parse::<u32>()
            .unwrap_or_else(|_| panic!("version SQLite illisible : {version}"))
    });
    (
        parts.next().unwrap(),
        parts.next().unwrap_or(0),
        parts.next().unwrap_or(0),
    )
}

#[test]
fn dep01_rusqlite_engine_is_at_least_3_54_0() {
    let conn = rusqlite::Connection::open_in_memory().unwrap();
    let v: String = conn
        .query_row("select sqlite_version()", [], |r| r.get(0))
        .unwrap();
    assert!(
        parse(&v) >= MIN_SQLITE,
        "SQLite {v} (rusqlite) < 3.54.0 : RUSTSEC-2026-0459 non corrigé"
    );
}

#[test]
fn dep01_plugin_sql_engine_is_at_least_3_54_0() {
    let dir = tempfile::tempdir_in(env!("CARGO_TARGET_TMPDIR")).unwrap();
    let path = dir.path().join("spartiate.db");
    // `open_sqlite_pool` n'ouvre pas en création : fichier vide posé comme le fait `DbPool::connect`.
    std::fs::File::create(&path).unwrap();
    let url = format!("sqlite:{}", path.to_string_lossy());
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();
    runtime.block_on(async {
        let db = DbPool::Sqlite(open_sqlite_pool(&url).await.unwrap());
        let rows = db
            .select("select sqlite_version() as v".to_string(), vec![])
            .await
            .unwrap();
        let v = rows[0]["v"].as_str().unwrap().to_string();
        db.close().await;
        assert!(
            parse(&v) >= MIN_SQLITE,
            "SQLite {v} (plugin SQL, sqlx) < 3.54.0 : RUSTSEC-2026-0459 non corrigé"
        );
    });
}
