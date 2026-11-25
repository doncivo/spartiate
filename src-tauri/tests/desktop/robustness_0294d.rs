//! SHELL-0294d : C-143 (marqueur illisible), C-144 (diagnostic sans chemin absolu, horodatage validé).

use spartiate_lib::backup::{diagnose_db_dir, is_valid_stamp, Recovery, DB_FILE};
use spartiate_lib::startup_gate::{settle_provisional_marker, PREVIOUS_MARKER_FILE};
use std::fs;

fn scratch() -> tempfile::TempDir {
    tempfile::tempdir_in(env!("CARGO_TARGET_TMPDIR")).unwrap()
}

#[test]
fn c144_the_stamp_must_be_a_real_date_and_time() {
    assert!(is_valid_stamp("20261125T163000Z"));
    assert!(!is_valid_stamp("20269999T999999Z"));
    assert!(!is_valid_stamp("20261301T000000Z"));
    assert!(!is_valid_stamp("20260230T000000Z"));
    assert!(!is_valid_stamp("20261125T240000Z"));
    assert!(!is_valid_stamp("20261125T006000Z"));
    assert!(!is_valid_stamp("20261125T000060Z"));
}

#[test]
fn c144_the_diagnostic_never_returns_an_absolute_path() {
    let dir = scratch();
    let report = diagnose_db_dir(Ok(dir.path().to_path_buf()));
    let folder = report.config_dir.expect("nom du dossier");
    let db = report.db_path.expect("nom de la base");
    assert!(!folder.contains(['/', '\\']),"{folder}");
    assert_eq!(db, DB_FILE);
}

#[test]
fn c144_a_folder_error_is_a_stable_code_not_a_system_message() {
    let report = diagnose_db_dir(Err("C:\\Users\\quelquun\\AppData introuvable".into()));
    assert_eq!(report.config_dir_error.as_deref(), Some("no-data-dir"));
}

#[test]
fn c143_an_unreadable_marker_is_not_settled_and_keeps_the_previous_marker() {
    let dir = scratch();
    fs::write(dir.path().join("restore-marker.json"), b"{ illisible").unwrap();
    fs::write(dir.path().join(PREVIOUS_MARKER_FILE), b"{\"v\":1}").unwrap();
    let settled = settle_provisional_marker(dir.path(), &Ok(Recovery::Nothing));
    assert!(!settled, "un marqueur illisible n'est pas réglé");
    assert!(
        dir.path().join(PREVIOUS_MARKER_FILE).exists(),
        "la preuve du marqueur d'avant est conservée"
    );
}

#[test]
fn c143_without_any_marker_the_settlement_is_trivially_done() {
    let dir = scratch();
    assert!(settle_provisional_marker(
        dir.path(),
        &Ok(Recovery::Nothing)
    ));
}
