//! Commandes iPhone de la Live Activity du compteur (SPA-007). Les réponses et erreurs du plugin ne contiennent que des codes, des dates et des
//! erreurs natives d'ActivityKit (domaine, code, description) : aucune donnée de santé ni de tâche.

use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Manager, Runtime};

use crate::mobile_call::{call_with_deadline, shaped_code, CallError};

const STATUS_DEADLINE: Duration = Duration::from_secs(5);
const START_DEADLINE: Duration = Duration::from_secs(10);
const END_DEADLINE: Duration = Duration::from_secs(10);
/// Longueur maximale du libellé affiché dans l'extension.
const LABEL_MAX: usize = 80;

async fn call<R: Runtime>(
    app: AppHandle<R>,
    command: &'static str,
    args: Value,
    deadline: Duration,
) -> Result<Value, String> {
    let plugin = app
        .try_state::<tauri_plugin_live_activity::LiveActivity<R>>()
        .ok_or_else(|| "liveactivity-plugin-unavailable".to_owned())?
        .inner()
        .clone();

    tauri::async_runtime::spawn_blocking(move || {
        call_with_deadline(move || plugin.call(command, args), deadline).map_err(
            |error| match error {
                CallError::Timeout => "liveactivity-timeout".to_owned(),
                CallError::Rejected(code) => shaped_code(&code).to_owned(),
            },
        )
    })
    .await
    .map_err(|_| "liveactivity-task-failed".to_owned())?
}

#[tauri::command]
pub async fn live_activity_status<R: Runtime>(app: AppHandle<R>) -> Result<Value, String> {
    call(app, "status", json!({}), STATUS_DEADLINE).await
}

#[tauri::command]
pub async fn live_activity_start<R: Runtime>(
    app: AppHandle<R>,
    end_date_ms: f64,
    label: String,
) -> Result<Value, String> {
    if !end_date_ms.is_finite() || end_date_ms <= 0.0 || label.trim().is_empty() {
        return Err("liveactivity-bad-args".to_owned());
    }
    let label: String = label.chars().take(LABEL_MAX).collect();
    call(
        app,
        "start",
        json!({ "endDateMs": end_date_ms, "label": label }),
        START_DEADLINE,
    )
    .await
}

#[tauri::command]
pub async fn live_activity_end<R: Runtime>(app: AppHandle<R>) -> Result<Value, String> {
    call(app, "end", json!({}), END_DEADLINE).await
}
