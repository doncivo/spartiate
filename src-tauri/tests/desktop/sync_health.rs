//! I5-03 point 1 (D-90, H-26) : le dossier `iCloud Drive/Spartiate/sante/` est lu par le marque-page de la synchro, sans nouveau Swift.
//! Trois conditions prouvées ici, avant tout code de lecture :
//!
//! 1. la synchro ignore tout ce qui est hors de `devices/<id>/`, sans le signaler comme anomalie ni le purger ;
//! 2. aucune commande de synchro ne peut écrire, renommer ni supprimer dans `sante/` (et pas davantage y lire : le `DevicesOnly` de
//!    `Bound` refuse tout chemin hors de `devices/`) ;
//! 3. les fichiers de `sante/` ne sont jamais publiés ni chiffrés dans les journaux (aucune lecture de `sante/` par la synchro ; la
//!    lecture de `sante/` a son propre accès, sans écriture, limité à quatre noms).
//!
//! Fichiers de test synthétiques : aucune donnée réelle (D-38).

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::json;
use spartiate_lib::sync::bookmark::BookmarkFs;
use spartiate_lib::sync::files::{AppendMode, Availability, FsError, SyncFs};
use spartiate_lib::sync::health::{
    read_health_files, DevicesOnly, HEALTH_DIR, HEALTH_FILES, MAX_HEALTH_FILE_BYTES,
};
use spartiate_lib::sync::SyncCode;

use crate::support::fake_bookmark::{FakePlugin, SharedPlugin, BOOKMARK, ROOT};
use crate::sync_support::{device, epoch, hlc, Device, MemFs, SharedFs, DEV_A, NOW};

const FILES: [(&str, &[u8]); 4] = [
    ("hrv.csv", b"2026-11-08T06:41:03+01:00;42\n"),
    ("fc-repos.csv", b"2026-11-08T07:02:00+01:00;54\n"),
    ("sommeil.csv", b"2026-11-07T23:10:00+01:00;2026-11-08T00:05:00+01:00;Profond\n"),
    ("pas.csv", b"2026-11-08T18:12:00+01:00;1250\n"),
];

fn seed_health(fs: &MemFs) {
    for (name, bytes) in FILES {
        fs.put(&[HEALTH_DIR, name], bytes);
    }
    // Un fichier étranger et un `.tmp` de plus : la synchro ne doit les voir ni les signaler.
    fs.put(&[HEALTH_DIR, "autre.txt"], b"x");
    fs.put(&[HEALTH_DIR, "hrv.csv.tmp"], b"x");
}

fn health_files(fs: &MemFs) -> Vec<(String, Vec<u8>)> {
    fs.all_files()
        .into_iter()
        .filter(|(path, _)| path.starts_with("sante/"))
        .collect()
}

fn state(ep: &str, seq: u64) -> serde_json::Value {
    json!({
        "deviceId": DEV_A, "platform": "windows", "appVersion": "0.11.1", "sm": 1, "sv": 14, "epoch": ep, "stateSeq": seq,
        "head": { "epoch": ep, "segment": 0, "record": 0, "hlc": null, "stateSeq": seq },
        "acks": {}, "snapshot": null, "purgeHorizon": null, "lastSyncHlc": hlc(seq * 1_000, DEV_A), "forgotten": [], "reset": null
    })
}

/// Un cycle de publication : instantané, état, scan.
fn full_cycle(d: &Device) -> spartiate_lib::sync::store::FolderScan {
    let ep = epoch(1, DEV_A);
    let handle = d.core.snapshot_begin(&ep, 1, 14).unwrap();
    d.core
        .snapshot_append(handle, &["{\"k\":\"snap-rows\"}".to_owned()])
        .unwrap();
    d.core.snapshot_commit(handle).unwrap();
    d.core.write_state(14, state(&ep, 1)).unwrap();
    d.core.scan(&[]).unwrap()
}

// --- Condition 1 : ignoré, ni anomalie, ni purge ---------------------------------------------------------------------------------

#[test]
fn scan_ignores_the_health_folder_without_anomaly_and_without_purge() {
    let (with, fs_with) = device();
    with.setup(DEV_A);
    seed_health(&fs_with);
    let before = health_files(&fs_with);
    assert!(before.len() >= 6, "fixture sante/ en place");
    let scan_with = full_cycle(&with);

    let (without, _fs_without) = device();
    without.setup(DEV_A);
    let scan_without = full_cycle(&without);

    // Aucune anomalie, aucun fichier compté « ignoré » : le résultat est identique à celui d'un dossier sans `sante/`.
    assert_eq!(scan_with.ignored, 0);
    assert_eq!(scan_with.ignored, scan_without.ignored);
    assert_eq!(scan_with.devices.len(), scan_without.devices.len());
    assert_eq!(scan_with.total_bytes, scan_without.total_bytes);
    assert_eq!(scan_with.incomplete, scan_without.incomplete);
    assert_eq!(scan_with.too_many_devices, scan_without.too_many_devices);
    assert!(!scan_with.folder_large);
    // Rien n'est purgé, renommé ni modifié : mêmes noms, mêmes octets.
    assert_eq!(health_files(&fs_with), before);
}

#[test]
fn choosing_a_folder_that_holds_a_health_folder_is_not_refused() {
    let (d, fs) = device();
    seed_health(&fs);
    // Le contrôle « fichiers étrangers » (ADR 0017) ne liste que `devices/` : `sante/` ne refuse pas le dossier.
    d.core
        .choose_folder(std::path::Path::new(crate::sync_support::FOLDER))
        .expect("dossier accepté avec sante/");
}

// --- Condition 2 : aucune commande de synchro n'écrit dans sante/ ---------------------------------------------------------------

#[test]
fn devices_only_refuses_every_operation_outside_devices() {
    let fs = MemFs::new();
    seed_health(&fs);
    let before = health_files(&fs);
    let guard = DevicesOnly::new(Box::new(SharedFs(fs.clone())));

    let unsafe_ = Err(FsError::Unsafe);
    let file = [HEALTH_DIR, "hrv.csv"];
    assert_eq!(guard.append(&file, b"x", AppendMode::Existing), unsafe_);
    assert_eq!(guard.append(&file, b"x", AppendMode::CreateNew), unsafe_);
    assert_eq!(guard.write_atomic(&file, b"x"), unsafe_);
    assert_eq!(guard.rename(&[HEALTH_DIR], "hrv.csv", "autre.csv"), unsafe_);
    assert_eq!(guard.create_dir(&[HEALTH_DIR, "sous"]), unsafe_);
    assert_eq!(guard.remove_file(&file), Err(FsError::Unsafe));
    assert_eq!(guard.remove_empty_dir(&[HEALTH_DIR]), unsafe_);
    assert_eq!(guard.pin(&file), unsafe_);
    // Lectures et listes : la synchro n'a aucune raison de lire `sante/` (condition 3).
    assert_eq!(guard.read(&file, 1024, true), Err(FsError::Unsafe));
    assert_eq!(guard.read_head(&file, 16), Err(FsError::Unsafe));
    assert_eq!(guard.read_from(&file, 0, 16, true).map(|_| ()), Err(FsError::Unsafe));
    assert!(matches!(guard.list(&[HEALTH_DIR], 10), Err(FsError::Unsafe)));
    assert!(matches!(guard.list(&[], 10), Err(FsError::Unsafe)));
    // Un chemin vide et la racine elle-même : jamais d'écriture ni de suppression à la racine.
    assert_eq!(guard.write_atomic(&["state.spx"], b"x"), unsafe_);
    assert_eq!(guard.remove_file(&["autre"]), Err(FsError::Unsafe));

    assert_eq!(fs.writes.load(Ordering::SeqCst), 0, "aucune écriture");
    assert_eq!(fs.reads.load(Ordering::SeqCst), 0, "aucune lecture");
    assert_eq!(health_files(&fs), before);
}

#[test]
fn devices_only_lets_the_sync_own_paths_through() {
    let fs = MemFs::new();
    let guard = DevicesOnly::new(Box::new(SharedFs(fs.clone())));
    let state = ["devices", DEV_A, "state.spx"];
    guard.create_dir(&["devices", DEV_A]).unwrap();
    guard.write_atomic(&state, b"abc").unwrap();
    assert_eq!(guard.read(&state, 1024, true).unwrap(), b"abc");
    assert_eq!(guard.list(&["devices", DEV_A], 10).unwrap().entries.len(), 1);
    assert!(guard.remove_file(&state).unwrap());
    guard.start_cycle().unwrap();
    guard.check_root().unwrap();
}

#[test]
fn a_full_sync_cycle_never_reads_writes_or_lists_the_health_folder() {
    let (d, fs) = device();
    d.setup(DEV_A);
    seed_health(&fs);
    let before = health_files(&fs);
    full_cycle(&d);
    d.core.scan(&[]).unwrap();
    // Condition 3 : la synchro ne lit jamais `sante/`, donc ne le publie ni ne le chiffre.
    let log = fs.read_log.lock().unwrap().clone();
    assert!(!log.is_empty(), "le cycle a bien lu des fichiers");
    assert!(
        log.iter().all(|path| path.starts_with("devices/")),
        "lectures hors devices/ : {log:?}"
    );
    assert_eq!(health_files(&fs), before);
    // Aucun octet de `sante/` dans un fichier publié.
    for (path, bytes) in fs.all_files() {
        if path.starts_with("devices/") {
            for (_, content) in FILES {
                assert!(
                    !bytes.windows(content.len()).any(|w| w == content),
                    "contenu de sante/ retrouvé dans {path}"
                );
            }
        }
    }
}

// --- Condition 3 et lecteur : quatre noms, lecture seule, téléchargement forcé -----------------------------------------------------

#[test]
fn reader_returns_the_four_files_and_never_writes() {
    let fs = MemFs::new();
    seed_health(&fs);
    let names: Vec<String> = HEALTH_FILES.iter().map(|n| (*n).to_owned()).collect();
    let reads = read_health_files(&SharedFs(fs.clone()), &names).unwrap();
    assert_eq!(reads.len(), 4);
    for (read, (name, bytes)) in reads.iter().zip(FILES) {
        assert_eq!(read.name, name);
        assert_eq!(read.state, "ok");
        assert_eq!(read.bytes.as_deref(), Some(STANDARD.encode(bytes).as_str()));
    }
    assert_eq!(fs.writes.load(Ordering::SeqCst), 0);
    let log = fs.read_log.lock().unwrap().clone();
    assert_eq!(
        log,
        ["sante/hrv.csv", "sante/fc-repos.csv", "sante/sommeil.csv", "sante/pas.csv"]
    );
}

#[test]
fn reader_refuses_every_name_outside_the_four_files_before_any_access() {
    let fs = MemFs::new();
    seed_health(&fs);
    fs.put(&["devices", DEV_A, "state.spx"], b"secret");
    for bad in [
        "state.spx",
        "../devices/x/state.spx",
        "autre.txt",
        "hrv.csv.tmp",
        "HRV.CSV",
        "",
        "sante/hrv.csv",
        "devices",
        "hrv.csv\0",
    ] {
        let err = read_health_files(&SharedFs(fs.clone()), &["hrv.csv".to_owned(), bad.to_owned()])
            .expect_err(bad);
        assert_eq!(err.code, SyncCode::BadName, "{bad}");
    }
    assert_eq!(fs.reads.load(Ordering::SeqCst), 0, "aucun accès avant la validation");
}

#[test]
fn reader_reports_absent_unreadable_and_cloud_files_by_state() {
    let fs = MemFs::new();
    // Dossier `sante/` absent : tous « absent », jamais une erreur.
    let all: Vec<String> = HEALTH_FILES.iter().map(|n| (*n).to_owned()).collect();
    let reads = read_health_files(&SharedFs(fs.clone()), &all).unwrap();
    assert!(reads.iter().all(|r| r.state == "absent" && r.bytes.is_none()));

    // Fichier dans le nuage : téléchargement forcé (hydratation demandée), puis lu.
    fs.put(&[HEALTH_DIR, "hrv.csv"], FILES[0].1);
    fs.set_availability(&[HEALTH_DIR, "hrv.csv"], Availability::Cloud);
    let reads = read_health_files(&SharedFs(fs.clone()), &["hrv.csv".to_owned()]).unwrap();
    assert_eq!(reads[0].state, "ok");
    assert!(fs.hydrations.load(Ordering::SeqCst) >= 1, "téléchargement forcé avant lecture");

    // Fichier trop gros : « illisible », sans lecture du contenu.
    fs.put(&[HEALTH_DIR, "pas.csv"], b"1");
    fs.set_extra(&[HEALTH_DIR, "pas.csv"], MAX_HEALTH_FILE_BYTES + 1);
    let reads = read_health_files(&SharedFs(fs.clone()), &["pas.csv".to_owned()]).unwrap();
    assert_eq!(reads[0].state, "unreadable");
    assert!(reads[0].bytes.is_none());
}

#[test]
fn core_reads_the_health_folder_through_its_own_access_and_keeps_the_sync_untouched() {
    let (d, fs) = device();
    d.setup(DEV_A);
    seed_health(&fs);
    let before = health_files(&fs);
    let names: Vec<String> = HEALTH_FILES.iter().map(|n| (*n).to_owned()).collect();
    let reads = d.core.read_health_files(&names).unwrap();
    assert_eq!(reads.iter().filter(|r| r.state == "ok").count(), 4);
    assert_eq!(health_files(&fs), before);
    assert_eq!(fs.writes.load(Ordering::SeqCst), 0);
    // La synchro continue normalement après une lecture de `sante/`.
    full_cycle(&d);
}

#[test]
fn core_without_a_linked_folder_refuses_the_health_read() {
    let (d, _fs) = device();
    let err = d.core.read_health_files(&["hrv.csv".to_owned()]).expect_err("dossier absent");
    assert_eq!(err.code, SyncCode::NotConfigured);
}

#[test]
fn bookmark_reads_only_through_status_download_and_read_from() {
    // Sur le marque-page de l'iPhone (faux du plugin) : seules les commandes de lecture partent, jamais une écriture.
    let clock = Arc::new(AtomicU64::new(NOW));
    let plugin = FakePlugin::new(clock.clone());
    plugin.mkdir(&[HEALTH_DIR]);
    plugin.put(&[HEALTH_DIR, "hrv.csv"], FILES[0].1);
    plugin.put_cloud(&[HEALTH_DIR, "sommeil.csv"], FILES[2].1, 10, false);
    let now = clock.clone();
    let fs = BookmarkFs::new(
        Arc::new(SharedPlugin(plugin.clone())),
        ROOT.to_owned(),
        BOOKMARK.to_owned(),
        Arc::new(Mutex::new(None)),
        Arc::new(move || now.load(Ordering::SeqCst)),
    );
    fs.start_cycle_within(std::time::Duration::from_secs(30)).unwrap();
    let names: Vec<String> = HEALTH_FILES.iter().map(|n| (*n).to_owned()).collect();
    let reads = read_health_files(&fs, &names).unwrap();
    let states: Vec<&str> = reads.iter().map(|r| r.state).collect();
    assert_eq!(states, ["ok", "absent", "ok", "absent"]);
    assert!(
        !plugin.calls("download").is_empty(),
        "téléchargement forcé du fichier dans le nuage avant lecture"
    );
    for command in [
        "append",
        "writeAtomic",
        "rename",
        "createDir",
        "remove",
        "removeEmptyDir",
    ] {
        assert!(plugin.calls(command).is_empty(), "{command} appelé");
    }
}

// --- Contrôles statiques ------------------------------------------------------------------------------------------------------

const STORE_RS: &str = include_str!("../../src/sync/store.rs");
const FORGET_RS: &str = include_str!("../../src/sync/forget.rs");
const RESET_RS: &str = include_str!("../../src/sync/reset.rs");
const FILES_RS: &str = include_str!("../../src/sync/files.rs");
const SERVICE_RS: &str = include_str!("../../src/sync/service.rs");
const COMMANDS_RS: &str = include_str!("../../src/sync/commands.rs");
const COMMANDS_IOS_RS: &str = include_str!("../../src/sync/commands_ios.rs");

#[test]
fn only_the_health_module_names_the_health_folder() {
    for (name, source) in [
        ("store.rs", STORE_RS),
        ("forget.rs", FORGET_RS),
        ("reset.rs", RESET_RS),
        ("files.rs", FILES_RS),
        ("commands.rs", COMMANDS_RS),
    ] {
        assert!(!source.contains("\"sante\""), "{name} nomme sante/");
        assert!(!source.contains("HEALTH_DIR"), "{name} nomme HEALTH_DIR");
        assert!(!source.contains("health::"), "{name} utilise le module health");
    }
}

#[test]
fn the_sync_core_wraps_its_folder_in_devices_only_and_has_one_health_entry_point() {
    assert!(!SERVICE_RS.contains("\"sante\""));
    // Chaque dossier lié par le service est enveloppé : la synchro n'a jamais d'accès brut à la racine.
    let wraps = SERVICE_RS.matches("DevicesOnly::new(").count();
    let bounds = SERVICE_RS.matches("Bound {").count() - 1; // la définition de la structure
    assert_eq!(wraps, bounds, "chaque Bound enveloppe son fs");
    // Une seule entrée de lecture de sante/, hors des commandes sync_* : `read_health_files`.
    assert_eq!(SERVICE_RS.matches("health::read_health_files(").count(), 1);
    // La commande iPhone n'est pas une commande de synchro (liste figée à 22) et n'écrit pas.
    assert!(COMMANDS_IOS_RS.contains("health_files_read"));
    assert!(!COMMANDS_IOS_RS.contains("write_health"));
}

// --- Relecture sync-icloud (D-26) : A1, R1, R3 --------------------------------------------------------------------------------------

#[test]
fn reader_accepts_at_most_four_distinct_names() {
    let fs = MemFs::new();
    seed_health(&fs);
    let dup = vec!["hrv.csv".to_owned(), "hrv.csv".to_owned()];
    assert_eq!(read_health_files(&SharedFs(fs.clone()), &dup).expect_err("doublon").code, SyncCode::BadName);
    let many = vec!["hrv.csv".to_owned(); 5];
    assert_eq!(read_health_files(&SharedFs(fs.clone()), &many).expect_err("trop").code, SyncCode::BadName);
    assert_eq!(fs.reads.load(Ordering::SeqCst), 0);
}

#[test]
fn health_download_budget_stays_under_the_plugin_call_deadline() {
    // A1 : un téléchargement de sante/ occupe la file du plugin ; il doit finir avant l'échéance d'un appel de synchro (20 s).
    assert!(spartiate_lib::sync::health::HEALTH_HYDRATE_BUDGET < std::time::Duration::from_secs(20));
}
