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
        assert!(body.contains(needle), "{needle} absent de excludeFromBackup");
    }
    // Rejet par code seulement (fonction `reject` du plugin), jamais le texte d'une erreur système ni `try!`.
    assert!(!body.contains("invoke.reject("));
    assert!(!body.contains("try!"));
    assert!(!body.contains("\\(error"));
    // Aucun travail sur le fil principal : appelé pendant le démarrage, depuis le fil `ipc` de Tauri.
    assert!(!body.contains("DispatchQueue.main"));
}
