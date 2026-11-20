//! Exclusion de la sauvegarde iCloud de l'iPhone (FIX-CONFID-IOS : C-152, C-147 de l'audit Claude 0.27.0 ; D-99 (1) : les photos ne
//! quittent jamais l'appareil).
//!
//! Au démarrage de l'iPhone (`ios_setup::setup`), après l'ouverture du journal et AVANT l'enregistrement du plugin SQL : le dossier de la
//! base (`app_config_dir`, photos comprises dans `progress_photo_file`), celui des sauvegardes locales (`backups/`) et celui du journal
//! (`Documents/Journal`, qui reste visible dans Fichiers) sont créés au besoin, puis exclus de la sauvegarde par le plugin Swift `ct-files`
//! (`excludeFromBackup`, `URLResourceValues.isExcludedFromBackup`, relu après écriture). Posé à chaque démarrage (idempotent).
//!
//! Jamais bloquant : délai de 5 s, un échec (code seulement, jamais un chemin) est inscrit au journal (`backup-exclusion` / code) et gardé
//! pour Plus › À propos et diagnostic (`status`, rendu par `log_read`). Effet réel à constater par Ali (H-38, UNVERIFIED) : aucun
//! CONFIRMED depuis le code (D-36). Compilé partout : la logique est testée sous Windows avec un faux transport.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

/// Délai de l'appel au plugin : au-delà, `timeout` (le démarrage continue).
pub const DEADLINE: Duration = Duration::from_secs(5);
/// Commande du plugin `ct-files`.
pub const COMMAND: &str = "excludeFromBackup";
/// Codes d'échec possibles (contrat `tests/fixtures/files/files-contract.json`, `backupExclusionCodes`).
pub const CODES: &[&str] = &[
    "unsafe-folder",
    "no-data-dir",
    "partial",
    "timeout",
    "failed",
];

/// Transport vers le plugin Swift (faux dans les tests).
pub trait ExclusionTransport {
    /// Demande l'exclusion des dossiers `paths` (chemins absolus) ; rend le nombre de dossiers exclus, ou le code de rejet.
    fn exclude(&self, paths: &[String]) -> Result<u64, String>;
}

/// Dernier échec du processus (`None` : réussie, ou non tentée hors iPhone).
static STATUS: Mutex<Option<&'static str>> = Mutex::new(None);

/// Dernier échec de l'exclusion (code), `None` si elle a réussi ou n'a pas lieu sur cet appareil.
pub fn status() -> Option<&'static str> {
    *STATUS
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}

fn set_status(value: Option<&'static str>) {
    *STATUS
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner) = value;
}

/// Dossiers à exclure : base, sauvegardes locales, journal (sans doublon, ordre stable).
pub fn targets(config_dir: Option<&Path>, journal_dir: Option<&Path>) -> Vec<PathBuf> {
    let mut out: Vec<PathBuf> = Vec::new();
    let mut push = |path: PathBuf| {
        if !out.contains(&path) {
            out.push(path);
        }
    };
    if let Some(config) = config_dir {
        push(config.to_path_buf());
        push(config.join(crate::backup::BACKUP_DIR));
    }
    if let Some(journal) = journal_dir {
        push(journal.to_path_buf());
    }
    out
}

/// Code connu pour un rejet du plugin (`failed` sinon) : jamais un texte libre au journal.
fn known_code(code: &str) -> &'static str {
    CODES
        .iter()
        .find(|known| **known == crate::mobile_call::shaped_code(code))
        .copied()
        .unwrap_or("failed")
}

/// Crée au besoin chaque dossier (jamais à travers un lien), puis demande l'exclusion de tous en un appel. Rend le nombre de dossiers
/// exclus, ou un code de `CODES`.
pub fn apply(
    targets: &[PathBuf],
    transport: &dyn ExclusionTransport,
) -> Result<usize, &'static str> {
    if targets.is_empty() {
        return Err("no-data-dir");
    }
    let mut paths = Vec::with_capacity(targets.len());
    for dir in targets {
        if fs::symlink_metadata(dir).is_err() && fs::create_dir_all(dir).is_err() {
            return Err("failed");
        }
        if !crate::backup::is_plain_dir(dir) {
            return Err("unsafe-folder");
        }
        paths.push(dir.to_str().ok_or("failed")?.to_owned());
    }
    match transport.exclude(&paths) {
        Ok(count) if usize::try_from(count).is_ok_and(|n| n == paths.len()) => Ok(paths.len()),
        Ok(_) => Err("partial"),
        Err(code) => Err(known_code(&code)),
    }
}

/// Applique l'exclusion, l'inscrit au journal (`backup-exclusion` / `applied` avec le nombre de dossiers, ou le code d'échec) et garde
/// l'issue pour `status`. Ne rend rien : le démarrage continue dans tous les cas.
pub fn run(targets: &[PathBuf], transport: &dyn ExclusionTransport) {
    match apply(targets, transport) {
        Ok(count) => {
            set_status(None);
            crate::applog::write_count(
                "backup-exclusion",
                "applied",
                u32::try_from(count).unwrap_or(u32::MAX),
            );
        }
        Err(code) => {
            set_status(Some(code));
            crate::applog::write("backup-exclusion", code);
        }
    }
}

/// Tests seulement (`test-hooks`) : état remis à zéro.
#[cfg(feature = "test-hooks")]
pub fn reset_for_tests() {
    set_status(None);
}

/// Transport réel : le plugin Swift `ct-files` (commande `excludeFromBackup`), appelé par Rust seul, avec délai.
#[cfg(target_os = "ios")]
pub struct PluginTransport(pub tauri_plugin_ct_files::CtFiles<tauri::Wry>);

#[cfg(target_os = "ios")]
impl ExclusionTransport for PluginTransport {
    fn exclude(&self, paths: &[String]) -> Result<u64, String> {
        let plugin = self.0.clone();
        let args = serde_json::json!({ "paths": paths });
        let answer = crate::mobile_call::call_with_deadline(
            move || plugin.call("excludeFromBackup", args),
            DEADLINE,
        )
        .map_err(|error| match error {
            crate::mobile_call::CallError::Timeout => "timeout".to_owned(),
            crate::mobile_call::CallError::Rejected(code) => code,
        })?;
        answer
            .get("excluded")
            .and_then(serde_json::Value::as_u64)
            .ok_or_else(|| "failed".to_owned())
    }
}

/// Démarrage de l'iPhone : exclusion des dossiers de la base, des sauvegardes et du journal (avant le plugin SQL, jamais bloquante).
#[cfg(target_os = "ios")]
pub fn exclude_on_launch(app: &tauri::App, config_dir: Option<&Path>, journal_dir: Option<&Path>) {
    use tauri::Manager;
    let targets = targets(config_dir, journal_dir);
    match app.try_state::<tauri_plugin_ct_files::CtFiles<tauri::Wry>>() {
        Some(plugin) => run(&targets, &PluginTransport(plugin.inner().clone())),
        None => {
            set_status(Some("failed"));
            crate::applog::write("backup-exclusion", "failed");
        }
    }
}
