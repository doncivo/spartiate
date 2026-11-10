//! Lecture du dossier `sante/` de la synchro (I5-03 point 1, D-90, H-26 ; sans nouveau Swift).
//!
//! Le raccourci « Spartiate — récupération » écrit `hrv.csv`, `fc-repos.csv`, `sommeil.csv` et `pas.csv` dans
//! `iCloud Drive/Spartiate/sante/`. Spartiate les lit par le marque-page que le plugin folder-bookmark détient déjà pour la synchro
//! (mêmes commandes `status`, `download` et `readFrom` que les journaux : téléchargement forcé avant lecture, borne de taille avant
//! lecture, jamais un chemin dans la WebView).
//!
//! Séparation de la synchro, prouvée par `tests/desktop/sync_health.rs` :
//! - `DevicesOnly` enveloppe le dossier de la synchro (`Bound.fs`) : toute opération, lecture comprise, sur un chemin hors de
//!   `devices/` est refusée (`Unsafe`) sans toucher au dossier. La synchro ne peut donc ni écrire, ni renommer, ni supprimer, ni lire,
//!   ni lister `sante/`, et rien de `sante/` n'entre dans un journal ni n'est chiffré ;
//! - `read_health_files` a son propre accès au dossier (`SyncCore::read_health_files`) : lecture seule, quatre noms exacts, aucune
//!   écriture, aucune liste. Un fichier absent ou le dossier absent donne l'état « absent », jamais une erreur.

use std::time::Duration;

use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;

use super::files::{AppendMode, Chunk, FsError, Listing, SyncFs};
use super::names::DEVICES_DIR;
use super::{fail, SyncCode, SyncResult};

/// Sous-dossier du raccourci, sous la racine liée.
pub const HEALTH_DIR: &str = "sante";
/// Les quatre fichiers lus, noms exacts (casse comprise).
pub const HEALTH_FILES: [&str; 4] = ["hrv.csv", "fc-repos.csv", "sommeil.csv", "pas.csv"];
/// Taille maximale d'un fichier lu (2 Mio : même borne que le sélecteur de fichiers, `SHORTCUT_FILE_MAX_BYTES`).
pub const MAX_HEALTH_FILE_BYTES: u64 = 2 * 1024 * 1024;
/// Budget de téléchargement d'une lecture (les quatre fichiers ensemble) : court, la lecture est une tâche de fond.
pub const HEALTH_HYDRATE_BUDGET: Duration = Duration::from_secs(45);

/// Un fichier lu : état `ok` (octets en base64, décodés en texte par l'import), `absent` ou `unreadable` (trop gros, nuage injoignable,
/// lien, erreur d'accès). Jamais un chemin, jamais le texte d'une erreur.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthFileRead {
    pub name: String,
    pub state: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bytes: Option<String>,
}

/// Lit les fichiers demandés, dans l'ordre. Un nom hors des quatre est refusé (`bad-name`) AVANT tout accès.
pub fn read_health_files(fs: &dyn SyncFs, names: &[String]) -> SyncResult<Vec<HealthFileRead>> {
    if names.iter().any(|n| !HEALTH_FILES.contains(&n.as_str())) {
        return fail(SyncCode::BadName);
    }
    Ok(names
        .iter()
        .map(
            |name| match fs.read(&[HEALTH_DIR, name], MAX_HEALTH_FILE_BYTES, true) {
                Ok(bytes) => HealthFileRead {
                    name: name.clone(),
                    state: "ok",
                    bytes: Some(STANDARD.encode(bytes)),
                },
                Err(FsError::NotFound) => HealthFileRead {
                    name: name.clone(),
                    state: "absent",
                    bytes: None,
                },
                Err(_) => HealthFileRead {
                    name: name.clone(),
                    state: "unreadable",
                    bytes: None,
                },
            },
        )
        .collect())
}

/// Enveloppe du dossier de la synchro : seuls les chemins sous `devices/` passent, toute autre opération est refusée (`Unsafe`) sans
/// atteindre le dossier. Le contrôle du dossier (`check_root`, `start_cycle`) passe tel quel.
pub struct DevicesOnly {
    inner: Box<dyn SyncFs>,
}

impl DevicesOnly {
    pub fn new(inner: Box<dyn SyncFs>) -> Self {
        Self { inner }
    }
}

/// Le chemin est strictement sous `devices/` (au moins un composant de plus : `devices` seul est listé, jamais écrit).
fn under_devices(path: &[&str]) -> bool {
    path.first() == Some(&DEVICES_DIR)
}

fn allow(path: &[&str]) -> Result<(), FsError> {
    if under_devices(path) {
        Ok(())
    } else {
        Err(FsError::Unsafe)
    }
}

impl SyncFs for DevicesOnly {
    fn check_root(&self) -> Result<(), FsError> {
        self.inner.check_root()
    }
    fn start_cycle(&self) -> Result<(), FsError> {
        self.inner.start_cycle()
    }
    fn start_cycle_within(&self, budget: Duration) -> Result<(), FsError> {
        self.inner.start_cycle_within(budget)
    }
    fn read_head(&self, file: &[&str], max: usize) -> Result<Vec<u8>, FsError> {
        allow(file)?;
        self.inner.read_head(file, max)
    }
    fn list(&self, dir: &[&str], max: usize) -> Result<Listing, FsError> {
        allow(dir)?;
        self.inner.list(dir, max)
    }
    fn read(&self, file: &[&str], limit: u64, hydrate: bool) -> Result<Vec<u8>, FsError> {
        allow(file)?;
        self.inner.read(file, limit, hydrate)
    }
    fn read_from(
        &self,
        file: &[&str],
        offset: u64,
        max: usize,
        hydrate: bool,
    ) -> Result<Chunk, FsError> {
        allow(file)?;
        self.inner.read_from(file, offset, max, hydrate)
    }
    fn append(&self, file: &[&str], bytes: &[u8], mode: AppendMode) -> Result<(), FsError> {
        allow(file)?;
        self.inner.append(file, bytes, mode)
    }
    fn write_atomic(&self, file: &[&str], bytes: &[u8]) -> Result<(), FsError> {
        allow(file)?;
        self.inner.write_atomic(file, bytes)
    }
    fn rename(&self, dir: &[&str], from: &str, to: &str) -> Result<(), FsError> {
        allow(dir)?;
        self.inner.rename(dir, from, to)
    }
    fn create_dir(&self, dir: &[&str]) -> Result<(), FsError> {
        allow(dir)?;
        self.inner.create_dir(dir)
    }
    fn remove_file(&self, file: &[&str]) -> Result<bool, FsError> {
        allow(file)?;
        self.inner.remove_file(file)
    }
    fn remove_empty_dir(&self, dir: &[&str]) -> Result<(), FsError> {
        allow(dir)?;
        self.inner.remove_empty_dir(dir)
    }
    fn pin(&self, file: &[&str]) -> Result<(), FsError> {
        allow(file)?;
        self.inner.pin(file)
    }
}
