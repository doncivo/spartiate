//! Import de fichier (PC) : neutralisé jusqu'à SPA-005 (export / import des données de Spartiate).
//!
//! L'entrée CSV de CircleTasks (boîte « Ouvrir », lecture bornée, 2 Mo) a été retirée avec les tâches (SPA-001b, D-64). La commande
//! `import_open_file` reste déclarée (permission, façade TypeScript) et répond `unsupported` : aucune boîte système n'est ouverte et
//! aucun fichier n'est lu. SPA-005 la remplacera par l'import des données de Spartiate.

use serde::Serialize;

/// Erreur renvoyée au front : `{ code, message }` (ADR 0001). Code actuel : `unsupported`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ImportError {
    pub code: &'static str,
    pub message: String,
}

/// Fichier lu : nom (sans dossier) et octets en base64. Jamais produit avant SPA-005.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ImportedFile {
    pub name: String,
    pub data: String,
}

/// Réponse unique tant que SPA-005 n'est pas livré.
pub fn unsupported() -> ImportError {
    ImportError { code: "unsupported", message: "import non pris en charge avant SPA-005".to_owned() }
}

/// Commande PC : refuse sans rien ouvrir ni lire.
#[tauri::command]
pub async fn import_open_file() -> Result<Option<ImportedFile>, ImportError> {
    Err(unsupported())
}
