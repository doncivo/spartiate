//! Lecture du dossier `sante/` de la synchro (I5-03 point 1, D-90, H-26 ; sans nouveau Swift).
//!
//! Le raccourci « Spartiate — récupération » écrit `hrv.csv`, `fc-repos.csv`, `sommeil.csv` et `pas.csv` dans
//! `iCloud Drive/Spartiate/sante/` ; depuis I6-04 (D-113), le raccourci « Spartiate — corps et nutrition » y écrit aussi dix fichiers Renpho / Santé
//! (`poids.csv`, `masse-grasse.csv`, `masse-maigre.csv`, `tour-taille.csv`, `taille.csv`, `energie.csv`, `proteines.csv`, `glucides.csv`,
//! `lipides.csv`, `fibres.csv`) : quatorze noms exacts en tout, liste blanche fermée. Spartiate les lit par le marque-page que le plugin folder-bookmark détient déjà pour la synchro
//! (mêmes commandes `status`, `download` et `readFrom` que les journaux : téléchargement forcé avant lecture, borne de taille avant
//! lecture, jamais un chemin dans la WebView).
//!
//! Séparation de la synchro, prouvée par `tests/desktop/sync_health.rs` :
//! - `DevicesOnly` enveloppe le dossier de la synchro (`Bound.fs`) : toute opération, lecture comprise, sur un chemin hors de
//!   `devices/` est refusée (`Unsafe`) sans toucher au dossier. La synchro ne peut donc ni écrire, ni renommer, ni supprimer, ni lire,
//!   ni lister `sante/`, et rien de `sante/` n'entre dans un journal ni n'est chiffré ;
//! - `read_health_report` a son propre accès au dossier (`SyncCore::read_health_files`) : lecture seule, quatorze noms (casse et accents du
//!   dossier, casse des noms de fichiers ignorés), aucune écriture ; il liste la racine et `sante/` pour décrire le dossier (comptes seulement, I5-04). Un fichier absent ou le dossier absent donne l'état « absent », jamais une erreur.

use std::time::Duration;

use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;

use super::files::{AppendMode, Availability, Chunk, FsEntry, FsError, Listing, SyncFs};
use super::names::DEVICES_DIR;
use super::{fail, SyncCode, SyncResult};

/// Sous-dossier du raccourci, sous la racine liée.
pub const HEALTH_DIR: &str = "sante";
/// Les quatre fichiers de la récupération, noms exacts (casse comprise).
pub const HEALTH_RECOVERY_FILES: [&str; 4] = ["hrv.csv", "fc-repos.csv", "sommeil.csv", "pas.csv"];
/// I6-04 : les dix fichiers Renpho / Santé (poids, composition, mensurations, nutrition du jour), noms exacts.
pub const HEALTH_BODY_FILES: [&str; 10] = [
    "poids.csv",
    "masse-grasse.csv",
    "masse-maigre.csv",
    "tour-taille.csv",
    "taille.csv",
    "energie.csv",
    "proteines.csv",
    "glucides.csv",
    "lipides.csv",
    "fibres.csv",
];
/// La liste blanche entière : les quatorze fichiers lus, noms exacts (casse comprise). Aucun autre nom n'est jamais lu.
pub const HEALTH_FILES: [&str; 14] = [
    "hrv.csv",
    "fc-repos.csv",
    "sommeil.csv",
    "pas.csv",
    "poids.csv",
    "masse-grasse.csv",
    "masse-maigre.csv",
    "tour-taille.csv",
    "taille.csv",
    "energie.csv",
    "proteines.csv",
    "glucides.csv",
    "lipides.csv",
    "fibres.csv",
];
/// Taille maximale d'un fichier lu (2 Mio : même borne que le sélecteur de fichiers, `SHORTCUT_FILE_MAX_BYTES`).
pub const MAX_HEALTH_FILE_BYTES: u64 = 2 * 1024 * 1024;
/// Budget de téléchargement d'une lecture (les fichiers d'une même lecture). Un `download` occupe la file série du plugin : il doit finir avant
/// l'échéance d'un appel de synchro (20 s, `BOOKMARK_CALL_DEADLINE_MS`), sinon un cycle en cours rendrait `cloud-pending` (relecture D-26).
pub const HEALTH_HYDRATE_BUDGET: Duration = Duration::from_secs(15);

/// Un fichier lu : état `ok` (octets en base64, décodés en texte par l'import), `absent`, `cloud` (présent mais pas encore téléchargé :
/// budget épuisé ou transfert en cours) ou `unreadable` (trop gros, lien, erreur d'accès). `size` : taille en octets quand elle est connue.
/// Jamais un chemin, jamais le texte d'une erreur.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthFileRead {
    pub name: String,
    pub state: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bytes: Option<String>,
}

/// Diagnostic du dossier (I5-04 point 2) : seulement des booléens et des comptes, jamais un nom ni un chemin.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthFolder {
    /// La racine liée a pu être listée.
    pub root_listed: bool,
    /// Un dossier `sante` (casse et accents ignorés) existe sous la racine : faux seulement s'il est absent (listage `NotFound`).
    pub sante_present: bool,
    /// Ses entrées ont pu être listées (faux : dossier présent mais illisible pour l'instant, ou absent).
    pub sante_listed: bool,
    /// Le dossier `devices` de la synchro existe sous la même racine (la racine liée est bien celle de la synchro).
    pub devices_present: bool,
    pub root_entries: u32,
    pub sante_entries: u32,
    /// I5-05 : `sante` était listé comme un substitut iCloud (fichier « dans le nuage ») et son téléchargement a été demandé.
    pub sante_hydrated: bool,
    /// I5-06 : raison, en code fixe, pour laquelle `sante` n'a pas pu être listé : vide (listé), `not-found`, `unsafe-name` (nom refusé par la garde de chemin), `cloud`, `io`.
    pub sante_list_error: &'static str,
    /// I5-05 : une entrée de la racine, par ordre de listage (16 au plus), décrite par des codes fixes, jamais par son nom.
    pub root_probe: Vec<RootEntryProbe>,
}

/// Une entrée de la racine liée vue par la sonde (I5-05) : des codes fixes seulement, aucun nom ni chemin.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RootEntryProbe {
    pub is_dir: bool,
    /// `local`, `cloud` (substitut iCloud, pas encore téléchargé) ou `error` (lien, état illisible).
    pub availability: &'static str,
    /// Nom égal à `devices`.
    pub eq_devices: bool,
    /// Nom égal à `sante`, octet pour octet.
    pub eq_sante_exact: bool,
    /// Nom égal à `sante` une fois normalisé (casse, accents, espaces et caractères invisibles ignorés).
    pub eq_sante_folded: bool,
}

/// Entrées décrites au plus (la racine d'une synchro en compte quelques-unes).
const MAX_PROBED_ENTRIES: usize = 16;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct HealthReport {
    pub folder: HealthFolder,
    pub files: Vec<HealthFileRead>,
}

/// Nom normalisé : seuls les lettres et chiffres comptent, sans casse ni accent (« Santé », « SANTE », `sante` + accent combinant, espace,
/// espace insécable, caractère invisible) : le raccourci n'écrit pas toujours exactement `sante`.
fn fold(name: &str) -> String {
    name.chars()
        .filter_map(|c| match c {
            '\u{300}'..='\u{36f}' => None,
            'é' | 'è' | 'ê' | 'ë' | 'É' | 'È' | 'Ê' | 'Ë' => Some('e'),
            c if c.is_ascii_alphanumeric() => Some(c.to_ascii_lowercase()),
            _ => None,
        })
        .collect()
}

/// Décrit la racine (comptes, `devices`, une sonde par entrée).
fn describe_root(folder: &mut HealthFolder, listing: &Listing) {
    folder.root_listed = true;
    folder.root_entries = listing.entries.len() as u32;
    folder.devices_present = listing
        .entries
        .iter()
        .any(|e| e.is_dir && e.name == DEVICES_DIR);
    folder.root_probe = listing
        .entries
        .iter()
        .take(MAX_PROBED_ENTRIES)
        .map(|e| RootEntryProbe {
            is_dir: e.is_dir,
            availability: e.availability.as_str(),
            eq_devices: e.name == DEVICES_DIR,
            eq_sante_exact: e.name == HEALTH_DIR,
            eq_sante_folded: fold(&e.name) == HEALTH_DIR,
        })
        .collect();
}

/// Le dossier `sante` de la racine, sous son vrai nom : le nom exact d'abord, puis une variante.
fn health_dir_entry(listing: &Listing) -> Option<&FsEntry> {
    let exact = listing
        .entries
        .iter()
        .find(|e| e.is_dir && e.name == HEALTH_DIR);
    exact.or_else(|| {
        listing
            .entries
            .iter()
            .find(|e| e.is_dir && fold(&e.name) == HEALTH_DIR)
    })
}

/// Une entrée `sante` listée comme un fichier « dans le nuage » : le substitut d'un dossier iCloud pas encore téléchargé. Un vrai fichier local
/// nommé `sante`, ou un lien, n'en est pas un.
fn health_placeholder(listing: &Listing) -> Option<&FsEntry> {
    listing
        .entries
        .iter()
        .find(|e| !e.is_dir && e.availability == Availability::Cloud && fold(&e.name) == HEALTH_DIR)
}

/// Lit les fichiers demandés, dans l'ordre (voir `read_health_report`).
pub fn read_health_files(fs: &dyn SyncFs, names: &[String]) -> SyncResult<Vec<HealthFileRead>> {
    read_health_report(fs, names).map(|report| report.files)
}

/// Lit les fichiers demandés, dans l'ordre, et décrit le dossier. Un nom hors des quatorze, un doublon ou plus de quatorze noms : `bad-name` AVANT
/// tout accès. Lecture seule : une liste de la racine et de `sante/` (comptes et noms résolus, jamais renvoyés), puis une lecture par nom.
pub fn read_health_report(fs: &dyn SyncFs, names: &[String]) -> SyncResult<HealthReport> {
    let distinct = names
        .iter()
        .collect::<std::collections::BTreeSet<_>>()
        .len()
        == names.len();
    if names.len() > HEALTH_FILES.len()
        || !distinct
        || names.iter().any(|n| !HEALTH_FILES.contains(&n.as_str()))
    {
        return fail(SyncCode::BadName);
    }
    let mut folder = HealthFolder::default();
    // Racine : le dossier `sante` sous son vrai nom, et la présence de `devices`.
    let mut dir = HEALTH_DIR.to_owned();
    // Dossier iCloud non matérialisé (substitut listé comme un fichier `cloud`) dont le téléchargement n'a pas abouti dans le budget.
    let mut dir_in_cloud = false;
    if let Ok(listing) = fs.list(&[], 256) {
        describe_root(&mut folder, &listing);
        if let Some(entry) = health_dir_entry(&listing) {
            dir = entry.name.clone();
        } else if let Some(placeholder) = health_placeholder(&listing) {
            // I5-05 : le téléchargement d'un dossier passe par la même commande que celui d'un fichier (`readFrom` avec hydratation) ; la
            // lecture qui suit échoue sur un dossier, sans importance : seul l'effet compte (le dossier devient local).
            folder.sante_hydrated = true;
            let name = placeholder.name.clone();
            let outcome = fs.read_from(&[name.as_str()], 0, 1, true);
            let _ = outcome;
            dir_in_cloud = true;
            dir = name;
            if let Ok(again) = fs.list(&[], 256) {
                describe_root(&mut folder, &again);
                if let Some(entry) = health_dir_entry(&again) {
                    dir_in_cloud = false;
                    dir = entry.name.clone();
                }
            }
        }
    }
    // `sante` : ses entrées, pour retrouver les vrais noms et les tailles.
    let listed = match fs.list(&[dir.as_str()], 256) {
        Ok(listing) => {
            folder.sante_present = true;
            folder.sante_listed = true;
            folder.sante_entries = listing.entries.len() as u32;
            listing.entries
        }
        // Illisible pour l'instant (nuage, coordination) : le dossier existe peut-être ; la lecture directe décide.
        Err(FsError::NotFound) => {
            // Dossier iCloud encore dans le nuage (budget épuisé) : présent, pas encore listable.
            folder.sante_present = dir_in_cloud;
            folder.sante_list_error = if dir_in_cloud { "cloud" } else { "not-found" };
            Vec::new()
        }
        Err(error) => {
            folder.sante_present = true;
            folder.sante_list_error = match error {
                FsError::Unsafe => "unsafe-name",
                FsError::CloudPending => "cloud",
                _ => "io",
            };
            Vec::new()
        }
    };
    let files = names
        .iter()
        .map(|name| {
            // Le nom exact d'abord, puis une variante de casse (volume sensible à la casse : `hrv.csv` et `HRV.csv` peuvent coexister).
            let entry = listed
                .iter()
                .find(|e| !e.is_dir && e.name == *name)
                .or_else(|| {
                    listed
                        .iter()
                        .find(|e| !e.is_dir && e.name.eq_ignore_ascii_case(name))
                });
            let actual = entry.map_or(name.as_str(), |e| e.name.as_str());
            let known = entry.map(|e| e.size).filter(|s| *s > 0);
            if dir_in_cloud {
                // Dossier pas encore téléchargé : « à télécharger », jamais « absent ».
                return HealthFileRead {
                    name: name.clone(),
                    state: "cloud",
                    size: None,
                    bytes: None,
                };
            }
            let (state, size, bytes) =
                match fs.read(&[dir.as_str(), actual], MAX_HEALTH_FILE_BYTES, true) {
                    Ok(bytes) => ("ok", Some(bytes.len() as u64), Some(STANDARD.encode(bytes))),
                    Err(FsError::NotFound) => ("absent", None, None),
                    Err(FsError::CloudPending) => ("cloud", known, None),
                    Err(_) => ("unreadable", known, None),
                };
            HealthFileRead {
                name: name.clone(),
                state,
                size,
                bytes,
            }
        })
        .collect();
    Ok(HealthReport { folder, files })
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

/// Le premier composant est `devices` (le dossier `devices` lui-même est accepté : il n'est jamais `sante`).
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
