//! SPA-001a, ADR 0017 « Séparation Spartiate / CircleTasks » : ce qui vient de CircleTasks est refusé, et le dossier qui porte son nom
//! ou ses fichiers n'est jamais lié. Fixture figée : `tests/fixtures/sync/circletasks-foreign.json` (clé de test, format CircleTasks).

use std::path::Path;

use serde_json::Value;
use spartiate_lib::sync::crypto::{
    key_from_recovery, parse_qr_text, FileHeader, MasterKey, Place, AAD_VERSION, HKDF_SALT, PAIRING_QR_PREFIX, RECOVERY_KEY_PREFIX,
};
use spartiate_lib::sync::files::Availability;
use spartiate_lib::sync::folder::FolderKind;
use spartiate_lib::sync::{SyncCode, SyncError};

use crate::sync_support::{Device, FakeBackend, MemFs, DEV_A};

const PARTAGE: &str = r"C:\Users\Ali\iCloudDrive\Partage";
const FOREIGN: &str = include_str!("../../../tests/fixtures/sync/circletasks-foreign.json");

fn foreign() -> Value {
    serde_json::from_str(FOREIGN).expect("fixture CircleTasks valide")
}

fn code<T>(result: Result<T, SyncError>) -> SyncCode {
    match result {
        Ok(_) => panic!("erreur attendue"),
        Err(error) => error.code,
    }
}

#[test]
fn sp_constants_are_spartiate_own() {
    assert_eq!(PAIRING_QR_PREFIX, "SPPAIR1.");
    assert_eq!(RECOVERY_KEY_PREFIX, "SP1-");
    assert_eq!(AAD_VERSION, "sp/1");
    assert_eq!(HKDF_SALT, b"spartiate");
}

#[test]
fn sp_circletasks_qr_recovery_key_and_headers_are_refused() {
    let v = foreign();
    assert!(parse_qr_text(v["qr"]["text"].as_str().unwrap()).is_none(), "QR CTPAIR1");
    assert!(key_from_recovery(v["recoveryKey"].as_str().unwrap()).is_none(), "clé de secours CT1-");
    for case in v["headers"].as_array().unwrap() {
        assert!(FileHeader::parse(case["line"].as_str().unwrap().as_bytes()).is_none(), "{}", case["line"]);
    }
}

#[test]
fn sp_circletasks_sealed_line_does_not_decrypt() {
    let v = foreign();
    let key = MasterKey::from_bytes(&hex_to_bytes(v["key"].as_str().unwrap())).expect("clé de test");
    for case in v["rustSealed"].as_array().unwrap() {
        let p = &case["place"];
        let place = Place::Journal {
            dev: p["dev"].as_str().unwrap(),
            epoch: p["epoch"].as_str().unwrap(),
            segment: p["segment"].as_u64().unwrap() as u32,
            index: p["index"].as_u64().unwrap(),
        };
        assert!(key.open(&place, case["line"].as_str().unwrap()).is_err(), "ligne CircleTasks déchiffrée");
    }
}

fn hex_to_bytes(text: &str) -> Vec<u8> {
    (0..text.len()).step_by(2).map(|i| u8::from_str_radix(&text[i..i + 2], 16).unwrap()).collect()
}

#[test]
fn sp_folder_named_circletasks_is_refused() {
    for path in [r"C:\Users\Ali\iCloudDrive\CircleTasks", r"C:\Users\Ali\iCloudDrive\circletasks", r"C:\Users\Ali\iCloudDrive\CIRCLETASKS\"] {
        let fs = MemFs::new();
        let d = Device::new(FakeBackend::with(path.trim_end_matches('\\'), FolderKind::Icloud, fs));
        assert_eq!(code(d.core.choose_folder(Path::new(path.trim_end_matches('\\')))), SyncCode::ForeignFolder, "{path}");
    }
}

#[test]
fn sp_folder_holding_circletasks_state_file_is_refused_whatever_its_name() {
    for name in ["state.ctx", "state.next.ctx", "state 2.ctx"] {
        let fs = MemFs::new();
        fs.put(&["devices", DEV_A, name], b"contenu quelconque");
        let d = Device::new(FakeBackend::with(PARTAGE, FolderKind::Icloud, fs));
        assert_eq!(code(d.core.choose_folder(Path::new(PARTAGE))), SyncCode::ForeignFolder, "{name}");
    }
}

#[test]
fn sp_folder_holding_only_ctj_or_cts_files_is_refused() {
    for name in ["j-00000001.ctj", "s-00000001.cts"] {
        let fs = MemFs::new();
        let ep = format!("e0001-{DEV_A}");
        fs.put(&["devices", DEV_A, &ep, name], b"contenu quelconque");
        let d = Device::new(FakeBackend::with(PARTAGE, FolderKind::Icloud, fs));
        assert_eq!(code(d.core.choose_folder(Path::new(PARTAGE))), SyncCode::ForeignFolder, "{name}");
    }
}

#[test]
fn sp_not_downloaded_circletasks_state_file_is_refused_without_reading_it() {
    let fs = MemFs::new();
    fs.put(&["devices", DEV_A, "state.ctx"], b"x");
    fs.set_availability(&["devices", DEV_A, "state.ctx"], Availability::Cloud);
    let d = Device::new(FakeBackend::with(PARTAGE, FolderKind::Icloud, fs));
    assert_eq!(code(d.core.choose_folder(Path::new(PARTAGE))), SyncCode::ForeignFolder);
}

#[test]
fn sp_clean_spartiate_folder_with_its_own_file_family_is_accepted() {
    let fs = MemFs::new();
    let ep = format!("e0001-{DEV_A}");
    fs.put(&["devices", DEV_A, "state.spx"], b"x");
    fs.put(&["devices", DEV_A, &ep, "j-00000001.spj"], b"x");
    fs.put(&["devices", DEV_A, &ep, "s-00000001.sps"], b"x");
    let d = Device::new(FakeBackend::with(PARTAGE, FolderKind::Icloud, fs));
    assert!(d.core.choose_folder(Path::new(PARTAGE)).is_ok());
}

#[test]
fn sp_iphone_path_choose_bookmarked_folder_applies_the_same_guard() {
    for (path, fs) in [(r"C:\Users\Ali\iCloudDrive\CircleTasks", MemFs::new()), (PARTAGE, {
        let fs = MemFs::new();
        fs.put(&["devices", DEV_A, "state.ctx"], b"x");
        fs
    })] {
        let d = Device::new(FakeBackend::with(path, FolderKind::Icloud, fs));
        assert_eq!(code(d.core.choose_bookmarked_folder(path, "signet")), SyncCode::ForeignFolder, "{path}");
    }
}

#[test]
fn sp_refusal_writes_no_folder_json_nor_own_json() {
    let fs = MemFs::new();
    fs.put(&["devices", DEV_A, "state.ctx"], b"x");
    let d = Device::new(FakeBackend::with(PARTAGE, FolderKind::Icloud, fs));
    assert_eq!(code(d.core.choose_folder(Path::new(PARTAGE))), SyncCode::ForeignFolder);
    let config = d.base.path().join("sync");
    assert!(!config.join("folder.json").exists(), "folder.json écrit malgré le refus");
    assert!(!config.join("own.json").exists(), "own.json écrit malgré le refus");
}

#[test]
fn sp_refusal_keeps_the_previously_bound_spartiate_folder() {
    let (d, _fs) = crate::sync_support::device();
    d.core.choose_folder(Path::new(crate::sync_support::FOLDER)).unwrap();
    let foreign = r"C:\Users\Ali\iCloudDrive\CircleTasks";
    d.backend.add(foreign, FolderKind::Icloud, MemFs::new());
    assert_eq!(code(d.core.choose_folder(Path::new(foreign))), SyncCode::ForeignFolder);
    let record = std::fs::read_to_string(d.base.path().join("sync").join("folder.json")).unwrap();
    assert!(record.contains("Spartiate") && !record.contains("CircleTasks"), "{record}");
}

#[test]
fn sp_empty_or_spartiate_folder_is_accepted() {
    let fs = MemFs::new();
    let d = Device::new(FakeBackend::with(r"C:\Users\Ali\iCloudDrive\Spartiate", FolderKind::Icloud, fs));
    assert!(d.core.choose_folder(Path::new(r"C:\Users\Ali\iCloudDrive\Spartiate")).is_ok());
}

#[test]
fn sp_folder_inside_the_circletasks_tree_is_refused() {
    for path in [r"C:\Users\Ali\iCloudDrive\CircleTasks\devices", r"C:\Users\Ali\iCloudDrive\CircleTasks\devices\3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60"] {
        let d = Device::new(FakeBackend::with(path, FolderKind::Icloud, MemFs::new()));
        assert_eq!(code(d.core.choose_folder(Path::new(path))), SyncCode::ForeignFolder, "{path}");
    }
}
