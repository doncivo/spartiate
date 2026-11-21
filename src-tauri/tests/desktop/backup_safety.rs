//! SAUV-RUST (C-137, C-138) : la sauvegarde créée n'est jamais purgée ; une seule opération à la fois sur la base ; aucun remplacement.

use rusqlite::Connection;
use spartiate_lib::backup::{
    create_daily_backup, create_migration_backup, recover_interrupted_restore, restore_backup_file,
    RestoreStep, BACKUP_DIR, DB_FILE,
};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::thread;

fn scratch() -> tempfile::TempDir {
    tempfile::tempdir_in(env!("CARGO_TARGET_TMPDIR")).unwrap()
}

fn make_db(dir: &Path, version: u32) {
    let conn = Connection::open(dir.join(DB_FILE)).unwrap();
    conn.execute("CREATE TABLE task (id INTEGER PRIMARY KEY, title TEXT)", [])
        .unwrap();
    conn.execute(
        "CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY)",
        [],
    )
    .unwrap();
    for v in 1..=version {
        conn.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [v])
            .unwrap();
    }
    conn.execute("INSERT INTO task (title) VALUES ('synthétique')", [])
        .unwrap();
}

fn count_prefix(dir: &Path, prefix: &str) -> usize {
    fs::read_dir(dir)
        .unwrap()
        .filter(|e| {
            e.as_ref()
                .unwrap()
                .file_name()
                .to_string_lossy()
                .starts_with(prefix)
        })
        .count()
}

const NO_FAIL: &dyn Fn(RestoreStep) -> std::io::Result<()> = &|_| Ok(());

/// Dossier avec une base v4 et une sauvegarde quotidienne v4 à restaurer.
fn restorable() -> (tempfile::TempDir, PathBuf, PathBuf) {
    let dir = scratch();
    make_db(dir.path(), 4);
    let db = dir.path().join(DB_FILE);
    let backups = dir.path().join(BACKUP_DIR);
    create_daily_backup(&db, &backups, "20261003", false, 14).unwrap();
    (dir, db, backups)
}

#[test]
fn c137_migration_backup_survives_rotation_when_the_clock_goes_back() {
    let dir = scratch();
    make_db(dir.path(), 4);
    let backups = dir.path().join(BACKUP_DIR);
    fs::create_dir_all(&backups).unwrap();
    for i in 1..=5 {
        fs::write(
            backups.join(format!(
                "spartiate-pre-migration-v0003-to-v0004-2099010{i}T000000Z.db"
            )),
            b"x",
        )
        .unwrap();
    }
    let out = create_migration_backup(
        &dir.path().join(DB_FILE),
        &backups,
        4,
        5,
        "20261001T000000Z",
        5,
    )
    .unwrap();
    let path = out.path.expect("chemin rendu");
    assert!(Path::new(&path).is_file(), "le fichier rendu existe");
    assert_eq!(count_prefix(&backups, "spartiate-pre-migration-"), 5);
}

#[test]
fn c137_daily_backup_survives_rotation_when_the_clock_goes_back() {
    let dir = scratch();
    make_db(dir.path(), 4);
    let backups = dir.path().join(BACKUP_DIR);
    fs::create_dir_all(&backups).unwrap();
    for i in 10..24 {
        fs::write(backups.join(format!("spartiate-daily-209901{i}.db")), b"x").unwrap();
    }
    let out =
        create_daily_backup(&dir.path().join(DB_FILE), &backups, "20261001", false, 14).unwrap();
    assert!(out.created);
    assert!(backups.join(&out.name).is_file());
    assert_eq!(count_prefix(&backups, "spartiate-daily-"), 14);
}

#[test]
fn c137_safety_copy_survives_rotation_when_the_clock_goes_back() {
    let (_dir, db, backups) = restorable();
    for i in 1..=3 {
        fs::write(
            backups.join(format!("spartiate-pre-restore-2099010{i}T000000Z.db")),
            b"x",
        )
        .unwrap();
    }
    let out = restore_backup_file(
        &db,
        &backups,
        "spartiate-daily-20261003.db",
        4,
        "20261001T000000Z",
        NO_FAIL,
    )
    .unwrap();
    let safety = out.safety_copy.expect("copie de sécurité");
    assert!(backups.join(safety).is_file());
    assert_eq!(count_prefix(&backups, "spartiate-pre-restore-"), 3);
}

#[test]
fn c138_a_second_operation_on_the_same_database_is_refused_while_a_restore_runs() {
    let (_dir, db, backups) = restorable();
    let (reached_tx, reached_rx) = mpsc::channel::<()>();
    let (release_tx, release_rx) = mpsc::channel::<()>();
    let (db2, backups2) = (db.clone(), backups.clone());
    let first = thread::spawn(move || {
        restore_backup_file(
            &db2,
            &backups2,
            "spartiate-daily-20261003.db",
            4,
            "20261005T101500Z",
            &move |step| {
                if matches!(step, RestoreStep::Staged) {
                    reached_tx.send(()).unwrap();
                    release_rx.recv().unwrap();
                }
                Ok(())
            },
        )
    });
    reached_rx.recv().unwrap();
    let second = restore_backup_file(
        &db,
        &backups,
        "spartiate-daily-20261003.db",
        4,
        "20261005T101501Z",
        NO_FAIL,
    );
    assert_eq!(second.unwrap_err().code, "busy");
    let daily = create_daily_backup(&db, &backups, "20261004", true, 14);
    assert_eq!(daily.unwrap_err().code, "busy");
    let migration = create_migration_backup(&db, &backups, 4, 5, "20261005T101502Z", 5);
    assert_eq!(migration.unwrap_err().code, "busy");
    // Une autre base n'est pas gênée.
    let other = scratch();
    make_db(other.path(), 4);
    assert!(create_daily_backup(
        &other.path().join(DB_FILE),
        &other.path().join(BACKUP_DIR),
        "20261004",
        false,
        14
    )
    .is_ok());
    release_tx.send(()).unwrap();
    first.join().unwrap().unwrap();
    assert!(!backups.join("spartiate-daily-20261004.db").exists());
    // Le verrou est rendu : une nouvelle sauvegarde passe.
    assert!(
        create_daily_backup(&db, &backups, "20261004", false, 14)
            .unwrap()
            .created
    );
}

#[test]
fn c138_the_lock_is_released_after_a_failed_operation() {
    let (_dir, db, backups) = restorable();
    let failed = restore_backup_file(
        &db,
        &backups,
        "spartiate-daily-20261003.db",
        4,
        "20261005T101500Z",
        &|step| match step {
            RestoreStep::Staged => Err(std::io::Error::other("panne simulée")),
            _ => Ok(()),
        },
    );
    assert_eq!(failed.unwrap_err().code, "io");
    assert!(create_daily_backup(&db, &backups, "20261004", false, 14).is_ok());
}

#[test]
fn c138_the_swap_never_replaces_an_existing_database() {
    let (_dir, db, backups) = restorable();
    let intruder = db.clone();
    let result = restore_backup_file(
        &db,
        &backups,
        "spartiate-daily-20261003.db",
        4,
        "20261005T101500Z",
        &move |step| {
            if matches!(step, RestoreStep::OldMoved) {
                fs::write(&intruder, b"fichier etranger").unwrap();
            }
            Ok(())
        },
    );
    assert_eq!(
        result.unwrap_err().code,
        "rollback-failed",
        "l'échange refuse de remplacer et le retour arrière aussi"
    );
    assert_eq!(fs::read(&db).unwrap(), b"fichier etranger");
    let old = PathBuf::from(format!("{}.restore-old", db.display()));
    assert!(old.is_file(), "l'ancienne base reste récupérable");

    // La récupération archive l'ancienne base ; le fichier étranger en place n'est pas touché.
    let recovery = recover_interrupted_restore(&db, &backups).unwrap();
    assert_eq!(format!("{recovery:?}"), "Archived");
    assert_eq!(fs::read(&db).unwrap(), b"fichier etranger");
    assert!(!old.exists());
    let archived: Vec<_> = fs::read_dir(&backups)
        .unwrap()
        .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
        .filter(|n| n.starts_with("spartiate-pre-restore-") && !n.contains("20261005T101500Z"))
        .collect();
    assert_eq!(archived.len(), 1, "{archived:?}");
    let kept = Connection::open(backups.join(&archived[0])).unwrap();
    let title: String = kept
        .query_row("SELECT title FROM task", [], |r| r.get(0))
        .unwrap();
    assert_eq!(title, "synthétique");
}

#[test]
fn c137_recovery_archive_survives_rotation_when_the_clock_goes_back() {
    let (_dir, db, backups) = restorable();
    for i in 1..=3 {
        fs::write(
            backups.join(format!("spartiate-pre-restore-2099010{i}T000000Z.db")),
            b"x",
        )
        .unwrap();
    }
    // Conflit : la base et son .restore-old coexistent (échange interrompu).
    let old = PathBuf::from(format!("{}.restore-old", db.display()));
    fs::copy(&db, &old).unwrap();
    recover_interrupted_restore(&db, &backups).unwrap();
    assert!(!old.exists());
    let archives: Vec<String> = fs::read_dir(&backups)
        .unwrap()
        .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
        .filter(|n| n.starts_with("spartiate-pre-restore-") && !n.contains("2099"))
        .collect();
    assert_eq!(archives.len(), 1, "l'archive créée existe : {archives:?}");
    assert!(backups.join(&archives[0]).is_file());
    assert_eq!(count_prefix(&backups, "spartiate-pre-restore-"), 3);
}
