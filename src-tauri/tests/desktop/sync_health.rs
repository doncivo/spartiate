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
    (
        "sommeil.csv",
        b"2026-11-07T23:10:00+01:00;2026-11-08T00:05:00+01:00;Profond\n",
    ),
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
        "deviceId": DEV_A, "platform": "windows", "appVersion": "0.11.2", "sm": 1, "sv": 14, "epoch": ep, "stateSeq": seq,
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
    assert_eq!(
        guard.read_from(&file, 0, 16, true).map(|_| ()),
        Err(FsError::Unsafe)
    );
    assert!(matches!(
        guard.list(&[HEALTH_DIR], 10),
        Err(FsError::Unsafe)
    ));
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
    assert_eq!(
        guard.list(&["devices", DEV_A], 10).unwrap().entries.len(),
        1
    );
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
        [
            "sante/hrv.csv",
            "sante/fc-repos.csv",
            "sante/sommeil.csv",
            "sante/pas.csv"
        ]
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
        let err = read_health_files(
            &SharedFs(fs.clone()),
            &["hrv.csv".to_owned(), bad.to_owned()],
        )
        .expect_err(bad);
        assert_eq!(err.code, SyncCode::BadName, "{bad}");
    }
    assert_eq!(
        fs.reads.load(Ordering::SeqCst),
        0,
        "aucun accès avant la validation"
    );
}

#[test]
fn reader_reports_absent_unreadable_and_cloud_files_by_state() {
    let fs = MemFs::new();
    // Dossier `sante/` absent : tous « absent », jamais une erreur.
    let all: Vec<String> = HEALTH_FILES.iter().map(|n| (*n).to_owned()).collect();
    let reads = read_health_files(&SharedFs(fs.clone()), &all).unwrap();
    assert!(reads
        .iter()
        .all(|r| r.state == "absent" && r.bytes.is_none()));

    // Fichier dans le nuage : téléchargement forcé (hydratation demandée), puis lu.
    fs.put(&[HEALTH_DIR, "hrv.csv"], FILES[0].1);
    fs.set_availability(&[HEALTH_DIR, "hrv.csv"], Availability::Cloud);
    let reads = read_health_files(&SharedFs(fs.clone()), &["hrv.csv".to_owned()]).unwrap();
    assert_eq!(reads[0].state, "ok");
    assert!(
        fs.hydrations.load(Ordering::SeqCst) >= 1,
        "téléchargement forcé avant lecture"
    );

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
    assert_eq!(reads.files.iter().filter(|r| r.state == "ok").count(), 4);
    assert_eq!(health_files(&fs), before);
    assert_eq!(fs.writes.load(Ordering::SeqCst), 0);
    // La synchro continue normalement après une lecture de `sante/`.
    full_cycle(&d);
}

#[test]
fn core_without_a_linked_folder_refuses_the_health_read() {
    let (d, _fs) = device();
    let err = d
        .core
        .read_health_files(&["hrv.csv".to_owned()])
        .expect_err("dossier absent");
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
    fs.start_cycle_within(std::time::Duration::from_secs(30))
        .unwrap();
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
        assert!(
            !source.contains("health::"),
            "{name} utilise le module health"
        );
    }
}

#[test]
fn the_sync_core_wraps_its_folder_in_devices_only_and_has_one_health_entry_point() {
    assert!(!SERVICE_RS.contains("\"sante\""));
    // Chaque dossier lié par le service est enveloppé : la synchro n'a jamais d'accès brut à la racine.
    let wraps = SERVICE_RS.matches("DevicesOnly::new(").count();
    let bounds = SERVICE_RS.matches("Bound {").count() - 1; // la définition de la structure
    assert_eq!(wraps, bounds, "chaque Bound enveloppe son fs");
    // Une seule entrée de lecture de sante/, hors des commandes sync_* : `read_health_report`.
    assert_eq!(SERVICE_RS.matches("health::read_health_report(").count(), 1);
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
    assert_eq!(
        read_health_files(&SharedFs(fs.clone()), &dup)
            .expect_err("doublon")
            .code,
        SyncCode::BadName
    );
    let many = vec!["hrv.csv".to_owned(); 5];
    assert_eq!(
        read_health_files(&SharedFs(fs.clone()), &many)
            .expect_err("trop")
            .code,
        SyncCode::BadName
    );
    assert_eq!(fs.reads.load(Ordering::SeqCst), 0);
}

#[test]
fn health_download_budget_stays_under_the_plugin_call_deadline() {
    // A1 : un téléchargement de sante/ occupe la file du plugin ; il doit finir avant l'échéance d'un appel de synchro (20 s).
    assert!(
        spartiate_lib::sync::health::HEALTH_HYDRATE_BUDGET < std::time::Duration::from_secs(20)
    );
}

// --- I5-04 point 2 : fichier présent mais lu « absent » (constat d'Ali, 0.11.1) ------------------------------------------------------
// Dossier de laboratoire : racine liée avec `devices/` et `sante/hrv.csv` de la taille du fichier d'Ali (338 lignes, environ 15 ko).
// Aucune donnée réelle (D-38) : lignes synthétiques.

use spartiate_lib::sync::health::{read_health_report, HealthReport};

fn lab_hrv() -> Vec<u8> {
    let mut text = String::new();
    for i in 0..338 {
        text.push_str(&format!(
            "2026-10-{:02}T06:{:02}:00+01:00;33,7171717171717;ms\n",
            1 + i % 28,
            i % 60
        ));
    }
    text.into_bytes()
}

fn bookmark_over(plugin: &Arc<FakePlugin>, clock: &Arc<AtomicU64>) -> BookmarkFs {
    let now = clock.clone();
    BookmarkFs::new(
        Arc::new(SharedPlugin(plugin.clone())),
        ROOT.to_owned(),
        BOOKMARK.to_owned(),
        Arc::new(Mutex::new(None)),
        Arc::new(move || now.load(Ordering::SeqCst)),
    )
}

fn all_names() -> Vec<String> {
    HEALTH_FILES.iter().map(|n| (*n).to_owned()).collect()
}

fn report_of(fs: &dyn SyncFs) -> HealthReport {
    read_health_report(fs, &all_names()).unwrap()
}

#[test]
fn lab_folder_with_hrv_file_reads_it_present_with_its_size() {
    let clock = Arc::new(AtomicU64::new(NOW));
    let plugin = FakePlugin::new(clock.clone());
    plugin.mkdir(&["devices", DEV_A]);
    let bytes = lab_hrv();
    plugin.put(&[HEALTH_DIR, "hrv.csv"], &bytes);
    let fs = bookmark_over(&plugin, &clock);
    fs.start_cycle_within(std::time::Duration::from_secs(15))
        .unwrap();
    let report = report_of(&fs);
    assert!(report.folder.root_listed);
    assert!(report.folder.sante_present);
    assert!(report.folder.devices_present);
    assert_eq!(report.files[0].state, "ok");
    assert_eq!(report.files[0].size, Some(bytes.len() as u64));
    assert!(bytes.len() > 14_000 && bytes.len() < 30_000);
    assert_eq!(report.files[1].state, "absent");
    assert_eq!(report.files[1].size, None);
}

#[test]
fn report_tells_a_missing_health_folder_from_a_missing_file() {
    let fs = MemFs::new();
    fs.put(&["devices", DEV_A, "state.spx"], b"x");
    let report = report_of(&SharedFs(fs.clone()));
    assert!(report.folder.root_listed);
    assert!(!report.folder.sante_present);
    assert!(report.folder.devices_present);
    assert!(report.files.iter().all(|f| f.state == "absent"));

    // Dossier présent, fichier absent : la différence se lit dans le rapport.
    fs.put(&[HEALTH_DIR, "autre.txt"], b"x");
    let report = report_of(&SharedFs(fs.clone()));
    assert!(report.folder.sante_present);
    assert_eq!(report.folder.sante_entries, 1);
    assert!(report.files.iter().all(|f| f.state == "absent"));
}

#[test]
fn reader_finds_the_folder_and_files_under_another_case_or_accent() {
    // Le raccourci peut écrire « Sante », « santé » (NFC ou NFD) ou « HRV.csv » : même dossier, mêmes quatre fichiers.
    for dir in ["Sante", "SANTE", "sant\u{e9}", "sante\u{301}"] {
        let fs = MemFs::new();
        fs.put(&[dir, "HRV.csv"], FILES[0].1);
        fs.put(&[dir, "Pas.CSV"], FILES[3].1);
        let report = report_of(&SharedFs(fs.clone()));
        assert!(report.folder.sante_present, "{dir}");
        let states: Vec<&str> = report.files.iter().map(|f| f.state).collect();
        assert_eq!(states, ["ok", "absent", "absent", "ok"], "{dir}");
        assert_eq!(fs.writes.load(Ordering::SeqCst), 0);
    }
}

#[test]
fn reader_never_follows_a_listed_name_outside_the_four_files() {
    let fs = MemFs::new();
    fs.put(&[HEALTH_DIR, "hrv.csv.tmp"], b"x");
    fs.put(&[HEALTH_DIR, "hrv.csv.bak"], b"x");
    fs.put(&[HEALTH_DIR, "state.spx"], b"x");
    let report = report_of(&SharedFs(fs.clone()));
    assert!(report.files.iter().all(|f| f.state == "absent"));
    assert!(fs
        .read_log
        .lock()
        .unwrap()
        .iter()
        .all(|p| p == "sante/hrv.csv"
            || p == "sante/fc-repos.csv"
            || p == "sante/sommeil.csv"
            || p == "sante/pas.csv"));
}

#[test]
fn report_separates_to_download_from_unreadable() {
    let clock = Arc::new(AtomicU64::new(NOW));
    let plugin = FakePlugin::new(clock.clone());
    plugin.put_cloud(&[HEALTH_DIR, "hrv.csv"], &lab_hrv(), 10, false);
    plugin.put_cloud(&[HEALTH_DIR, "pas.csv"], FILES[3].1, 10, true);
    let fs = bookmark_over(&plugin, &clock);
    // Budget nul : le téléchargement ne peut pas partir, le fichier reste « à télécharger » (jamais « absent »).
    fs.start_cycle_within(std::time::Duration::from_millis(0))
        .unwrap();
    let report = report_of(&fs);
    assert_eq!(report.files[0].state, "cloud");
    assert_eq!(report.files[0].bytes, None);
    assert_ne!(report.files[3].state, "absent");
}

// --- Relecture sync-icloud I5-04 : A1 (dossier présent mais non listable ≠ absent), S1 (nom exact d'abord) ----------------------------

/// Dossier dont le listage de `sante/` échoue (nuage, coordination) : tout le reste passe.
struct SanteListFails(SharedFs);

impl SyncFs for SanteListFails {
    fn check_root(&self) -> Result<(), FsError> {
        self.0.check_root()
    }
    fn start_cycle(&self) -> Result<(), FsError> {
        self.0.start_cycle()
    }
    fn start_cycle_within(&self, budget: std::time::Duration) -> Result<(), FsError> {
        self.0.start_cycle_within(budget)
    }
    fn read_head(&self, file: &[&str], max: usize) -> Result<Vec<u8>, FsError> {
        self.0.read_head(file, max)
    }
    fn list(
        &self,
        dir: &[&str],
        max: usize,
    ) -> Result<spartiate_lib::sync::files::Listing, FsError> {
        if dir
            .first()
            .is_some_and(|d| d.eq_ignore_ascii_case(HEALTH_DIR))
        {
            return Err(FsError::CloudPending);
        }
        self.0.list(dir, max)
    }
    fn read(&self, file: &[&str], limit: u64, hydrate: bool) -> Result<Vec<u8>, FsError> {
        self.0.read(file, limit, hydrate)
    }
    fn read_from(
        &self,
        file: &[&str],
        offset: u64,
        max: usize,
        hydrate: bool,
    ) -> Result<spartiate_lib::sync::files::Chunk, FsError> {
        self.0.read_from(file, offset, max, hydrate)
    }
    fn append(&self, file: &[&str], bytes: &[u8], mode: AppendMode) -> Result<(), FsError> {
        self.0.append(file, bytes, mode)
    }
    fn write_atomic(&self, file: &[&str], bytes: &[u8]) -> Result<(), FsError> {
        self.0.write_atomic(file, bytes)
    }
    fn rename(&self, dir: &[&str], from: &str, to: &str) -> Result<(), FsError> {
        self.0.rename(dir, from, to)
    }
    fn create_dir(&self, dir: &[&str]) -> Result<(), FsError> {
        self.0.create_dir(dir)
    }
    fn remove_file(&self, file: &[&str]) -> Result<bool, FsError> {
        self.0.remove_file(file)
    }
    fn remove_empty_dir(&self, dir: &[&str]) -> Result<(), FsError> {
        self.0.remove_empty_dir(dir)
    }
    fn pin(&self, file: &[&str]) -> Result<(), FsError> {
        self.0.pin(file)
    }
}

#[test]
fn a_health_folder_that_cannot_be_listed_is_present_but_not_listed() {
    let fs = MemFs::new();
    fs.put(&["devices", DEV_A, "state.spx"], b"x");
    fs.put(&[HEALTH_DIR, "hrv.csv"], FILES[0].1);
    let report = report_of(&SanteListFails(SharedFs(fs.clone())));
    assert!(
        report.folder.sante_present,
        "présent : seul son listage échoue"
    );
    assert!(!report.folder.sante_listed);
    assert_eq!(report.folder.sante_entries, 0);
    // La lecture directe du fichier reste tentée : « sante » par défaut.
    assert_eq!(report.files[0].state, "ok");
}

#[test]
fn an_exact_file_name_wins_over_a_case_variant() {
    let fs = MemFs::new();
    fs.put(&[HEALTH_DIR, "HRV.csv"], b"2026-11-01T06:00:00+01:00;1\n");
    fs.put(&[HEALTH_DIR, "hrv.csv"], FILES[0].1);
    let report = report_of(&SharedFs(fs.clone()));
    assert_eq!(
        report.files[0].bytes.as_deref(),
        Some(STANDARD.encode(FILES[0].1).as_str())
    );
}

// --- I5-05 : « sante » présent dans Fichiers mais non reconnu par la lecture (constat d'Ali, 0.11.2) -------------------------------
// Journal d'Ali : `root_listed=1 sante_present=0 sante_listed=0 devices_present=1 root_entries=4`, et la synchro voit une entrée en plus de
// `devices` à la racine. Cause la plus plausible (non prouvée sans l'appareil) : l'entrée est listée comme un FICHIER dans le nuage
// (substitut `.sante.icloud`, listé sous le nom `sante`, `is_dir` faux, `cloud`) ; la lecture ne cherchait que des dossiers. Pistes :
// nom (invisible, espace, normalisation), entrée-fichier / placeholder, filtre de la synchro (`DevicesOnly`), autre racine.

use spartiate_lib::sync::files::{Chunk, FsEntry, Listing};

/// Racine dont `sante` est, tant que personne ne l'a téléchargé, un substitut iCloud : listé comme un fichier `cloud`, absent dessous.
/// `read_from` avec `hydrate` sur ce nom le télécharge (même contrat que le plugin : `download` puis relecture, qui échoue sur un dossier).
struct CloudSante {
    inner: SharedFs,
    dir_name: &'static str,
    hydrated: std::sync::atomic::AtomicBool,
    hydrate_calls: AtomicU64,
}

impl CloudSante {
    fn new(inner: SharedFs, dir_name: &'static str) -> Self {
        Self {
            inner,
            dir_name,
            hydrated: std::sync::atomic::AtomicBool::new(false),
            hydrate_calls: AtomicU64::new(0),
        }
    }
    fn pending(&self, path: &[&str]) -> bool {
        !self.hydrated.load(Ordering::SeqCst) && path.first() == Some(&self.dir_name)
    }
}

impl SyncFs for CloudSante {
    fn check_root(&self) -> Result<(), FsError> {
        self.inner.check_root()
    }
    fn start_cycle(&self) -> Result<(), FsError> {
        self.inner.start_cycle()
    }
    fn start_cycle_within(&self, budget: std::time::Duration) -> Result<(), FsError> {
        self.inner.start_cycle_within(budget)
    }
    fn read_head(&self, file: &[&str], max: usize) -> Result<Vec<u8>, FsError> {
        self.inner.read_head(file, max)
    }
    fn list(&self, dir: &[&str], max: usize) -> Result<Listing, FsError> {
        if self.pending(dir) {
            return Err(FsError::NotFound);
        }
        let mut listing = self.inner.list(dir, max)?;
        if dir.is_empty() && !self.hydrated.load(Ordering::SeqCst) {
            for entry in &mut listing.entries {
                if entry.name == self.dir_name {
                    *entry = FsEntry {
                        name: entry.name.clone(),
                        is_dir: false,
                        size: 0,
                        availability: Availability::Cloud,
                    };
                }
            }
        }
        Ok(listing)
    }
    fn read(&self, file: &[&str], limit: u64, hydrate: bool) -> Result<Vec<u8>, FsError> {
        if self.pending(file) {
            return Err(FsError::NotFound);
        }
        self.inner.read(file, limit, hydrate)
    }
    fn read_from(
        &self,
        file: &[&str],
        offset: u64,
        max: usize,
        hydrate: bool,
    ) -> Result<Chunk, FsError> {
        if file == [self.dir_name] && hydrate && !self.hydrated.load(Ordering::SeqCst) {
            self.hydrate_calls.fetch_add(1, Ordering::SeqCst);
            self.hydrated.store(true, Ordering::SeqCst);
            return Err(FsError::Unsafe);
        }
        self.inner.read_from(file, offset, max, hydrate)
    }
    fn append(&self, file: &[&str], bytes: &[u8], mode: AppendMode) -> Result<(), FsError> {
        self.inner.append(file, bytes, mode)
    }
    fn write_atomic(&self, file: &[&str], bytes: &[u8]) -> Result<(), FsError> {
        self.inner.write_atomic(file, bytes)
    }
    fn rename(&self, dir: &[&str], from: &str, to: &str) -> Result<(), FsError> {
        self.inner.rename(dir, from, to)
    }
    fn create_dir(&self, dir: &[&str]) -> Result<(), FsError> {
        self.inner.create_dir(dir)
    }
    fn remove_file(&self, file: &[&str]) -> Result<bool, FsError> {
        self.inner.remove_file(file)
    }
    fn remove_empty_dir(&self, dir: &[&str]) -> Result<(), FsError> {
        self.inner.remove_empty_dir(dir)
    }
    fn pin(&self, file: &[&str]) -> Result<(), FsError> {
        self.inner.pin(file)
    }
}

fn lab_root() -> Arc<MemFs> {
    let fs = MemFs::new();
    fs.put(&["devices", DEV_A, "state.spx"], b"x");
    fs.put(&[HEALTH_DIR, "hrv.csv"], FILES[0].1);
    fs.put(&[HEALTH_DIR, "pas.csv"], FILES[3].1);
    fs
}

#[test]
fn pista_cloud_placeholder_folder_is_downloaded_then_read() {
    // Piste « entrée vue comme fichier, dossier iCloud non matérialisé » : le dossier est téléchargé, la racine relue, les fichiers lus.
    let fs = lab_root();
    let cloud = CloudSante::new(SharedFs(fs.clone()), HEALTH_DIR);
    let report = report_of(&cloud);
    assert!(report.folder.root_listed);
    assert!(
        report.folder.sante_present,
        "le dossier est reconnu après téléchargement"
    );
    assert!(report.folder.sante_listed);
    assert!(report.folder.sante_hydrated);
    assert_eq!(cloud.hydrate_calls.load(Ordering::SeqCst), 1);
    let states: Vec<&str> = report.files.iter().map(|f| f.state).collect();
    assert_eq!(states, ["ok", "absent", "absent", "ok"]);
    // Lecture seule, toujours : rien n'est écrit, renommé ni supprimé.
    assert_eq!(fs.writes.load(Ordering::SeqCst), 0);
}

#[test]
fn pista_cloud_placeholder_folder_under_another_case_is_also_downloaded() {
    let fs = MemFs::new();
    fs.put(&["devices", DEV_A, "state.spx"], b"x");
    fs.put(&["Sante", "HRV.csv"], FILES[0].1);
    let cloud = CloudSante::new(SharedFs(fs.clone()), "Sante");
    let report = report_of(&cloud);
    assert!(report.folder.sante_hydrated);
    assert_eq!(report.files[0].state, "ok");
}

#[test]
fn pista_a_local_plain_file_named_sante_is_never_downloaded_nor_taken_for_the_folder() {
    // Un vrai fichier local nommé `sante` n'est pas un dossier : aucun téléchargement, état « absent », jamais une écriture.
    let fs = MemFs::new();
    fs.put(&["devices", DEV_A, "state.spx"], b"x");
    fs.put(&["sante"], b"un fichier");
    let report = report_of(&SharedFs(fs.clone()));
    assert!(!report.folder.sante_present);
    assert!(!report.folder.sante_hydrated);
    assert!(report.files.iter().all(|f| f.state == "absent"));
    assert_eq!(fs.writes.load(Ordering::SeqCst), 0);
}

#[test]
fn pista_invisible_or_odd_characters_in_the_folder_name_are_ignored() {
    // Piste « comparaison de nom » : espace, espace insécable, caractère de largeur nulle, marque d'ordre, normalisation.
    for dir in [
        " sante",
        "sante ",
        "sante\u{a0}",
        "sante\u{200b}",
        "\u{feff}sante",
        "sante\u{200e}",
        "SANT\u{c9}",
        "sante\u{301}",
        "sant\u{e9}",
    ] {
        let fs = MemFs::new();
        fs.put(&["devices", DEV_A, "state.spx"], b"x");
        fs.put(&[dir, "hrv.csv"], FILES[0].1);
        let report = report_of(&SharedFs(fs.clone()));
        assert!(report.folder.sante_present, "{dir:?}");
        assert_eq!(report.files[0].state, "ok", "{dir:?}");
        assert_eq!(fs.writes.load(Ordering::SeqCst), 0);
    }
}

#[test]
fn pista_probe_describes_every_root_entry_with_fixed_codes_and_no_name() {
    let fs = MemFs::new();
    fs.put(&["devices", DEV_A, "state.spx"], b"x");
    fs.put(&["Sante\u{200b}", "hrv.csv"], FILES[0].1);
    fs.put(&["autre-fichier.txt"], b"x");
    let report = report_of(&SharedFs(fs.clone()));
    let probe = &report.folder.root_probe;
    assert_eq!(probe.len(), 3);
    assert_eq!(probe.iter().filter(|e| e.eq_devices).count(), 1);
    assert_eq!(probe.iter().filter(|e| e.eq_sante_exact).count(), 0);
    assert_eq!(probe.iter().filter(|e| e.eq_sante_folded).count(), 1);
    let sante = probe.iter().find(|e| e.eq_sante_folded).unwrap();
    assert!(sante.is_dir);
    assert_eq!(sante.availability, "local");
    let devices = probe.iter().find(|e| e.eq_devices).unwrap();
    assert!(devices.is_dir && !devices.eq_sante_folded);
    let other = probe.iter().find(|e| !e.is_dir).unwrap();
    assert!(!other.eq_devices && !other.eq_sante_folded);
    // Des codes seulement : ni nom ni chemin dans ce qui part vers la WebView.
    let json = serde_json::to_string(&report.folder).unwrap();
    assert!(!json.contains('\u{200b}'), "{json}");
    for name in ["autre-fichier", "hrv.csv", "state.spx"] {
        assert!(!json.contains(name), "{name} dans {json}");
    }
}

#[test]
fn pista_probe_after_download_describes_sante_as_a_local_folder() {
    let fs = lab_root();
    let report = report_of(&CloudSante::new(SharedFs(fs), HEALTH_DIR));
    let sante = report
        .folder
        .root_probe
        .iter()
        .find(|e| e.eq_sante_exact)
        .unwrap();
    assert!(sante.is_dir);
}

#[test]
fn pista_the_sync_filter_never_applies_to_the_health_read() {
    // Piste « filtre de la synchro appliqué par erreur » : `DevicesOnly` refuse tout hors de `devices/` ; si la lecture passait par lui, la
    // racine ne serait pas listable. La lecture passe par son propre accès (voir `core_reads_the_health_folder_through_its_own_access…`).
    let fs = lab_root();
    let guard = DevicesOnly::new(Box::new(SharedFs(fs.clone())));
    let report = report_of(&guard);
    assert!(!report.folder.root_listed, "le filtre refuse la racine");
    assert!(report.files.iter().all(|f| f.state != "ok"));
}

// --- I5-05 (analyse de Codex) : parent `sante` non matérialisé, bout en bout par `BookmarkFs` et le faux du plugin -------------------

#[test]
fn bookmark_cloud_parent_is_materialized_within_the_budget_then_read() {
    let clock = Arc::new(AtomicU64::new(NOW));
    let plugin = FakePlugin::new(clock.clone());
    plugin.mkdir(&["devices", DEV_A]);
    let bytes = lab_hrv();
    plugin.put_cloud_dir(
        &[HEALTH_DIR],
        &[("hrv.csv", bytes.as_slice()), ("pas.csv", FILES[3].1)],
        2_000,
    );
    let fs = bookmark_over(&plugin, &clock);
    fs.start_cycle_within(std::time::Duration::from_secs(15))
        .unwrap();
    let report = report_of(&fs);
    assert!(report.folder.sante_hydrated);
    assert!(report.folder.sante_present && report.folder.sante_listed);
    let states: Vec<&str> = report.files.iter().map(|f| f.state).collect();
    assert_eq!(states, ["ok", "absent", "absent", "ok"]);
    assert_eq!(report.files[0].size, Some(bytes.len() as u64));
    // Un seul téléchargement du dossier, aucune écriture.
    assert_eq!(
        plugin.calls("download").len(),
        1,
        "le dossier seul : ses fichiers sont déjà locaux"
    );
    for command in ["append", "writeAtomic", "rename", "remove", "createDir"] {
        assert!(plugin.calls(command).is_empty(), "{command}");
    }
}

#[test]
fn bookmark_cloud_parent_over_the_budget_is_to_download_never_absent() {
    let clock = Arc::new(AtomicU64::new(NOW));
    let plugin = FakePlugin::new(clock.clone());
    plugin.mkdir(&["devices", DEV_A]);
    plugin.put_cloud_dir(&[HEALTH_DIR], &[("hrv.csv", FILES[0].1)], 60_000);
    let fs = bookmark_over(&plugin, &clock);
    fs.start_cycle_within(std::time::Duration::from_secs(15))
        .unwrap();
    let report = report_of(&fs);
    assert!(report.folder.sante_hydrated);
    assert!(report.folder.sante_present);
    assert!(!report.folder.sante_listed);
    assert!(report.files.iter().all(|f| f.state == "cloud"));
    // La lecture suivante, une fois le dossier arrivé, aboutit.
    let plugin2 = FakePlugin::new(clock.clone());
    plugin2.mkdir(&["devices", DEV_A]);
    plugin2.put_cloud_dir(&[HEALTH_DIR], &[("hrv.csv", FILES[0].1)], 1_000);
    let fs2 = bookmark_over(&plugin2, &clock);
    fs2.start_cycle_within(std::time::Duration::from_secs(15))
        .unwrap();
    assert_eq!(report_of(&fs2).files[0].state, "ok");
}

#[test]
fn an_exact_folder_wins_over_a_cloud_placeholder_without_any_download() {
    // Relecture sync-icloud S5 : le dossier exact et un substitut de même nom normalisé coexistent : le dossier gagne, aucun téléchargement.
    let fs = lab_root();
    fs.put(&["Sante\u{200b}"], b"x");
    let cloud = CloudSante::new(SharedFs(fs.clone()), "Sante\u{200b}");
    let report = report_of(&cloud);
    assert!(!report.folder.sante_hydrated);
    assert_eq!(cloud.hydrate_calls.load(Ordering::SeqCst), 0);
    assert_eq!(report.files[0].state, "ok");
}

// --- I5-06 : constat d'Ali (0.11.3) : `is_dir=1 avail=0 eq_sante_exact=0 eq_sante_folded=1`, puis `sante_listed=0` et quatre fichiers illisibles.
// Cause : le dossier trouvé par nom normalisé (espace final) était refusé par la garde de chemin de `BookmarkFs` (règles Windows : point ou espace
// final interdits), donc `Unsafe`. La lecture seule d'un nom LISTÉ par le plugin doit le passer tel quel. H-26 est CONFIRMED depuis le renommage à la main.

#[test]
fn i506_a_folder_found_by_normalized_name_is_listed_and_read_under_its_real_name() {
    for dir in [
        "sante",
        "Sante",
        "sante ",
        " sante",
        "sante\u{200b}",
        "sante\u{a0}",
    ] {
        let clock = Arc::new(AtomicU64::new(NOW));
        let plugin = FakePlugin::new(clock.clone());
        plugin.mkdir(&["devices", DEV_A]);
        plugin.put(&[dir, "hrv.csv"], FILES[0].1);
        plugin.put(&[dir, "pas.csv"], FILES[3].1);
        let fs = bookmark_over(&plugin, &clock);
        fs.start_cycle_within(std::time::Duration::from_secs(15))
            .unwrap();
        let report = report_of(&fs);
        assert!(report.folder.sante_listed, "{dir:?}");
        assert_eq!(report.folder.sante_list_error, "", "{dir:?}");
        let states: Vec<&str> = report.files.iter().map(|f| f.state).collect();
        assert_eq!(states, ["ok", "absent", "absent", "ok"], "{dir:?}");
        for command in ["append", "writeAtomic", "rename", "remove", "createDir"] {
            assert!(plugin.calls(command).is_empty(), "{command}");
        }
    }
}

#[test]
fn i506_the_read_guard_still_refuses_separators_dots_and_controls() {
    for bad in ["a/b", "..", ".", "a\\b", "a\u{0}b", "a\nb", ""] {
        let clock = Arc::new(AtomicU64::new(NOW));
        let plugin = FakePlugin::new(clock.clone());
        let fs = bookmark_over(&plugin, &clock);
        fs.start_cycle_within(std::time::Duration::from_secs(15))
            .unwrap();
        assert_eq!(
            fs.list(&[bad], 10).map(|_| ()),
            Err(FsError::Unsafe),
            "{bad:?}"
        );
        assert_eq!(
            fs.read(&["sante", bad], 10, false).map(|_| ()),
            Err(FsError::Unsafe),
            "{bad:?}"
        );
    }
    // Les écritures gardent la règle stricte (jamais un nom à espace final).
    let clock = Arc::new(AtomicU64::new(NOW));
    let plugin = FakePlugin::new(clock.clone());
    let fs = bookmark_over(&plugin, &clock);
    fs.start_cycle_within(std::time::Duration::from_secs(15))
        .unwrap();
    assert_eq!(
        fs.write_atomic(&["sante ", "x"], b"x"),
        Err(FsError::Unsafe)
    );
}

#[test]
fn i506_the_listing_error_is_named_by_a_fixed_code() {
    let fs = MemFs::new();
    fs.put(&["devices", DEV_A, "state.spx"], b"x");
    fs.put(&[HEALTH_DIR, "hrv.csv"], FILES[0].1);
    // Nuage : « cloud » ; nom refusé par la garde de chemin : « unsafe-name » ; dossier absent : « not-found » ; lecture normale : « ».
    let cloud = report_of(&SanteListFails(SharedFs(fs.clone())));
    assert_eq!(cloud.folder.sante_list_error, "cloud");
    let guarded = report_of(&DevicesOnly::new(Box::new(SharedFs(fs.clone()))));
    assert_eq!(guarded.folder.sante_list_error, "unsafe-name");
    let ok = report_of(&SharedFs(fs.clone()));
    assert_eq!(ok.folder.sante_list_error, "");
    let none = MemFs::new();
    assert_eq!(
        report_of(&SharedFs(none)).folder.sante_list_error,
        "not-found"
    );
}
