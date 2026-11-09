//! DEP-01 (0.9.4, D-84, option 2) : garde-fou avant toute restauration. Un fichier de base dont le `-wal` voisin annonce une taille de page
//! différente de la sienne est refusé (scénario de RUSTSEC-2026-0459 : base et `-wal` forgés), avec un événement de journal de nom fixe.

use rusqlite::Connection;
use spartiate_lib::backup::{check_backup_file, APP_SCHEMA_VERSION};
use std::fs;
use std::path::Path;

fn scratch() -> tempfile::TempDir {
    tempfile::tempdir_in(env!("CARGO_TARGET_TMPDIR")).unwrap()
}

fn make_db(path: &Path) {
    let conn = Connection::open(path).unwrap();
    conn.execute_batch(
        "CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY);
         INSERT INTO schema_migrations (version) VALUES (9);",
    )
    .unwrap();
}

/// En-tête de `-wal` de 32 octets : magie, version du format, taille de page (grand-boutiste).
fn wal_header(page_size: u32) -> Vec<u8> {
    let mut h = vec![0u8; 32];
    h[0..4].copy_from_slice(&0x377f_0682u32.to_be_bytes());
    h[4..8].copy_from_slice(&3_007_000u32.to_be_bytes());
    h[8..12].copy_from_slice(&page_size.to_be_bytes());
    h
}

#[test]
fn dep01_a_wal_with_another_page_size_refuses_the_file_and_logs_a_fixed_event() {
    let _log_dir = crate::support::applog_dir_lock();
    let logs = scratch();
    spartiate_lib::applog::reset_for_tests();
    spartiate_lib::applog::init(logs.path().to_path_buf());
    let dir = scratch();
    let db = dir.path().join("spartiate-daily-20261109.db");
    make_db(&db);
    fs::write(dir.path().join("spartiate-daily-20261109.db-wal"), wal_header(8192)).unwrap();
    let error = check_backup_file(&db, APP_SCHEMA_VERSION).unwrap_err();
    assert_eq!(error.code, "wal-page-size");
    let entries = spartiate_lib::applog::read_entries(logs.path(), 50).unwrap();
    assert!(
        entries
            .iter()
            .any(|e| e.scope == "backup" && e.code == "wal-page-size-mismatch"),
        "événement journalisé : {entries:?}"
    );
}

#[test]
fn dep01_a_wal_with_the_same_page_size_does_not_block_the_check() {
    let dir = scratch();
    let db = dir.path().join("spartiate-daily-20261109.db");
    make_db(&db);
    fs::write(dir.path().join("spartiate-daily-20261109.db-wal"), wal_header(4096)).unwrap();
    assert_ne!(
        check_backup_file(&db, APP_SCHEMA_VERSION)
            .err()
            .map(|e| e.code),
        Some("wal-page-size")
    );
}

#[test]
fn dep01_no_wal_beside_the_file_changes_nothing() {
    let dir = scratch();
    let db = dir.path().join("spartiate-daily-20261109.db");
    make_db(&db);
    assert_eq!(check_backup_file(&db, APP_SCHEMA_VERSION).unwrap(), 9);
}
