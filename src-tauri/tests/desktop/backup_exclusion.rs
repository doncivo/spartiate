//! FIX-CONFID-IOS (C-152, C-147, audit Claude 0.27.0 ; D-99 (1)) : la base, les sauvegardes locales et le journal de l'iPhone sont exclus
//! de la sauvegarde iCloud de l'appareil, AVANT l'ouverture de la base par le plugin SQL. Le code `cfg(target_os = "ios")` ne compile pas
//! sous Windows : l'ordre du démarrage est vérifié par lecture du source (la compilation build-ios fera foi).

const IOS_SETUP: &str = include_str!("../../src/ios_setup.rs");

/// Corps de `setup` (de sa signature à la fin du fichier), sans les commentaires de ligne.
fn setup_body() -> String {
    let start = IOS_SETUP
        .find("pub fn setup(")
        .expect("ios_setup::setup présent");
    IOS_SETUP[start..]
        .lines()
        .filter(|line| !line.trim_start().starts_with("//"))
        .collect::<Vec<_>>()
        .join("\n")
}

#[test]
fn fix_confid_c152_exclusion_is_requested_after_the_journal_and_before_the_sql_plugin() {
    let body = setup_body();
    let journal = body.find("crate::applog::init(").expect("journal ouvert");
    let exclusion = body
        .find("crate::backup_exclusion::exclude_on_launch(")
        .expect("exclusion de la sauvegarde demandée au démarrage");
    let sql = body
        .find("register_sql_after_recovery(")
        .expect("plugin SQL enregistré");
    assert!(
        journal < exclusion,
        "l'exclusion est journalisée : après applog::init"
    );
    assert!(
        exclusion < sql,
        "l'exclusion précède l'ouverture de la base (plugin SQL)"
    );
    // Jamais bloquante : aucun `?` ni retour anticipé sur l'appel.
    let line = body[exclusion..].lines().next().unwrap();
    assert!(!line.contains('?'), "{line}");
    assert!(!line.contains("return"), "{line}");
}

#[test]
fn fix_confid_c147_the_journal_stays_in_documents_journal_and_is_among_the_excluded_folders() {
    let body = setup_body();
    assert!(IOS_SETUP.contains("const JOURNAL_DIR: &str = \"Journal\";"));
    let exclusion = body
        .find("crate::backup_exclusion::exclude_on_launch(")
        .expect("exclusion");
    let call = &body[exclusion..exclusion + body[exclusion..].find(';').unwrap()];
    for argument in ["config_dir", "journal_dir"] {
        assert!(
            call.contains(argument),
            "{argument} passé à l'exclusion : {call}"
        );
    }
}

const SWIFT: &str = include_str!("../../plugins/files/ios/Sources/CtFilesPlugin.swift");

/// Corps Swift de `excludeFromBackup` (jusqu'à la méthode suivante ou au point d'entrée).
fn swift_exclude_body() -> &'static str {
    let start = SWIFT
        .find("@objc public func excludeFromBackup(_ invoke: Invoke)")
        .expect("commande Swift excludeFromBackup");
    let rest = &SWIFT[start..];
    let end = rest[1..]
        .find("@objc public func ")
        .or_else(|| rest.find("@_cdecl("))
        .unwrap_or(rest.len());
    &rest[..end]
}

#[test]
fn fix_confid_c152_swift_sets_then_rereads_the_exclusion_flag_on_checked_folders_only() {
    let body = swift_exclude_body();
    for needle in [
        "invoke.parseArgs(ExcludeArgs.self)",
        // Dossier ordinaire, jamais un lien, sous le conteneur de l'app.
        ".isDirectoryKey",
        ".isSymbolicLinkKey",
        "NSHomeDirectory()",
        "resolvingSymlinksInPath()",
        // Pose puis relecture : une valeur non relue vaut échec.
        "isExcludedFromBackup = true",
        "setResourceValues(",
        ".isExcludedFromBackupKey",
        "invoke.resolve([\"excluded\":",
    ] {
        assert!(
            body.contains(needle),
            "{needle} absent de excludeFromBackup"
        );
    }
    // Rejet par code seulement (fonction `reject` du plugin), jamais le texte d'une erreur système ni `try!`.
    assert!(!body.contains("invoke.reject("));
    assert!(!body.contains("try!"));
    assert!(!body.contains("\\(error"));
    // Aucun travail sur le fil principal : appelé pendant le démarrage, depuis le fil `ipc` de Tauri.
    assert!(!body.contains("DispatchQueue.main"));
}

// --- Logique de `backup_exclusion` (compilée partout), avec un faux transport ---

use std::path::PathBuf;
use std::sync::Mutex;

use spartiate_lib::backup_exclusion::{
    apply, run, status, targets, ExclusionTransport, CODES, COMMAND,
};

struct Fake {
    answer: Result<u64, String>,
    seen: Mutex<Vec<String>>,
}

impl Fake {
    fn new(answer: Result<u64, String>) -> Self {
        Self {
            answer,
            seen: Mutex::new(Vec::new()),
        }
    }
}

impl ExclusionTransport for Fake {
    fn exclude(&self, paths: &[String]) -> Result<u64, String> {
        self.seen.lock().unwrap().extend(paths.iter().cloned());
        self.answer.clone()
    }
}

fn three(root: &std::path::Path) -> Vec<PathBuf> {
    targets(
        Some(&root.join("config")),
        Some(&root.join("Documents").join("Journal")),
    )
}

#[test]
fn fix_confid_c152_the_three_folders_are_created_then_passed_as_absolute_paths() {
    let dir = tempfile::tempdir().unwrap();
    let list = three(dir.path());
    assert_eq!(
        list,
        [
            dir.path().join("config"),
            dir.path().join("config").join("backups"),
            dir.path().join("Documents").join("Journal"),
        ]
    );
    let fake = Fake::new(Ok(3));
    assert_eq!(apply(&list, &fake), Ok(3));
    for path in &list {
        assert!(path.is_dir(), "{path:?} créé");
    }
    let seen = fake.seen.lock().unwrap().clone();
    assert_eq!(seen.len(), 3);
    assert!(seen.iter().all(|p| std::path::Path::new(p).is_absolute()));
    // Repli du journal sous le dossier de configuration : pas de doublon.
    let config = dir.path().join("config");
    assert_eq!(targets(Some(&config), Some(&config)).len(), 2);
    assert!(targets(None, None).is_empty());
    assert_eq!(COMMAND, "excludeFromBackup");
}

#[test]
fn fix_confid_c152_failures_give_a_known_code_and_never_a_path() {
    let dir = tempfile::tempdir().unwrap();
    let list = three(dir.path());
    assert_eq!(apply(&list, &Fake::new(Ok(2))), Err("partial"));
    assert_eq!(
        apply(&list, &Fake::new(Err("timeout".into()))),
        Err("timeout")
    );
    assert_eq!(
        apply(&list, &Fake::new(Err("failed".into()))),
        Err("failed")
    );
    assert_eq!(
        apply(&list, &Fake::new(Err("/var/mobile/Containers/x".into()))),
        Err("failed"),
        "un texte libre n'atteint jamais le journal"
    );
    assert_eq!(apply(&[], &Fake::new(Ok(0))), Err("no-data-dir"));
    for code in [
        "partial",
        "timeout",
        "failed",
        "no-data-dir",
        "unsafe-folder",
    ] {
        assert!(CODES.contains(&code));
    }
    let contract: serde_json::Value = serde_json::from_str(include_str!(
        "../../../tests/fixtures/files/files-contract.json"
    ))
    .unwrap();
    let listed: Vec<&str> = contract["backupExclusionCodes"]
        .as_array()
        .unwrap()
        .iter()
        .map(|v| v.as_str().unwrap())
        .collect();
    assert_eq!(listed, CODES);
}

#[cfg(windows)]
#[test]
fn fix_confid_c152_a_folder_that_is_a_link_is_refused() {
    let dir = tempfile::tempdir().unwrap();
    let real = dir.path().join("ailleurs");
    std::fs::create_dir_all(&real).unwrap();
    let config = dir.path().join("config");
    // Jonction (sans droit d'administrateur) : un lien de dossier.
    let made = std::process::Command::new("cmd")
        .args(["/C", "mklink", "/J"])
        .arg(&config)
        .arg(&real)
        .output()
        .unwrap();
    assert!(made.status.success());
    let fake = Fake::new(Ok(3));
    assert_eq!(
        apply(&targets(Some(&config), None), &fake),
        Err("unsafe-folder")
    );
    assert!(
        fake.seen.lock().unwrap().is_empty(),
        "rien n'est demandé au plugin"
    );
}

#[test]
fn fix_confid_c152_the_outcome_is_logged_without_value_and_kept_for_the_about_screen() {
    let _log_dir = crate::support::applog_dir_lock();
    spartiate_lib::applog::reset_for_tests();
    spartiate_lib::backup_exclusion::reset_for_tests();
    let dir = tempfile::tempdir().unwrap();
    let logs = dir.path().join("logs");
    spartiate_lib::applog::init(logs.clone());
    let list = three(dir.path());
    run(&list, &Fake::new(Err("timeout".into())));
    assert_eq!(status(), Some("timeout"));
    run(&list, &Fake::new(Ok(3)));
    assert_eq!(status(), None, "une exclusion réussie efface l'échec");
    let entries = spartiate_lib::applog::read_entries(&logs, 50).unwrap();
    let ours: Vec<(String, String, Option<u32>, String)> = entries
        .into_iter()
        .filter(|e| e.scope == "backup-exclusion")
        .map(|e| (e.scope, e.code, e.n, e.detail))
        .collect();
    assert_eq!(
        ours,
        [
            (
                "backup-exclusion".into(),
                "timeout".into(),
                None,
                String::new()
            ),
            (
                "backup-exclusion".into(),
                "applied".into(),
                Some(3),
                String::new()
            ),
        ]
    );
    spartiate_lib::applog::reset_for_tests();
}
