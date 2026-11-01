//! SPA-001a, ADR 0017 « Séparation Spartiate / CircleTasks » : ce qui vient de CircleTasks est refusé, et le dossier qui porte son nom
//! ou ses fichiers n'est jamais lié. Fixture figée : `tests/fixtures/sync/circletasks-foreign.json` (clé de test, format CircleTasks).

use std::path::Path;

use serde_json::Value;
use spartiate_lib::sync::crypto::{
    key_from_recovery, parse_qr_text, FileHeader, MasterKey, Place, AAD_VERSION, HKDF_SALT, PAIRING_QR_PREFIX, RECOVERY_KEY_PREFIX,
};
use spartiate_lib::sync::folder::FolderKind;
use spartiate_lib::sync::{SyncCode, SyncError};

use crate::sync_support::{Device, FakeBackend, MemFs, DEV_A};

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
        let d = Device::new(FakeBackend::with(path.trim_end_matches('\'), FolderKind::Icloud, fs));
        assert_eq!(code(d.core.choose_folder(Path::new(path.trim_end_matches('\')))), SyncCode::ForeignFolder, "{path}");
    }
}

#[test]
fn sp_folder_holding_a_circletasks_header_is_refused_whatever_its_name() {
    for (file, header) in [("state.ctx", r#"{"f":"ct-state","sm":1}"#), ("state.ctx", r#"{"f":"ct-j","sm":1}"#)] {
        let fs = MemFs::new();
        fs.put(&["devices", DEV_A, file], format!("{header}\nligne\n").as_bytes());
        let d = Device::new(FakeBackend::with(r"C:\Users\Ali\iCloudDrive\Partage", FolderKind::Icloud, fs));
        assert_eq!(code(d.core.choose_folder(Path::new(r"C:\Users\Ali\iCloudDrive\Partage"))), SyncCode::ForeignFolder);
    }
}

#[test]
fn sp_empty_or_spartiate_folder_is_accepted() {
    let fs = MemFs::new();
    let d = Device::new(FakeBackend::with(r"C:\Users\Ali\iCloudDrive\Spartiate", FolderKind::Icloud, fs));
    assert!(d.core.choose_folder(Path::new(r"C:\Users\Ali\iCloudDrive\Spartiate")).is_ok());
}
