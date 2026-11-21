//! Essai du modèle local d'Apple (IOS-029b, Foundation Models, iOS 26 ; H-41 proposée). Une commande, sans argument : le texte envoyé au
//! modèle est fixe dans le Swift, aucune donnée de l'app n'y entre. La réponse ne contient que ce texte, la réponse du modèle, un motif
//! d'indisponibilité ou une erreur native (domaine, code, description).

use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Manager, Runtime};

use crate::mobile_call::{call_with_deadline, shaped_code, CallError};

/// Première génération : chargement du modèle compris ; au-delà, l'essai est déclaré en échec (`appleintelligence-timeout`).
const PROBE_DEADLINE: Duration = Duration::from_secs(60);

#[tauri::command]
pub async fn apple_intelligence_probe<R: Runtime>(app: AppHandle<R>) -> Result<Value, String> {
    let plugin = app
        .try_state::<tauri_plugin_apple_intelligence::AppleIntelligence<R>>()
        .ok_or_else(|| "appleintelligence-no-plugin".to_owned())?
        .inner()
        .clone();

    tauri::async_runtime::spawn_blocking(move || {
        call_with_deadline(move || plugin.call("probe", json!({})), PROBE_DEADLINE).map_err(
            |error| match error {
                CallError::Timeout => "appleintelligence-timeout".to_owned(),
                CallError::Rejected(code) => shaped_code(&code).to_owned(),
            },
        )
    })
    .await
    .map_err(|_| "appleintelligence-task-failed".to_owned())?
}
