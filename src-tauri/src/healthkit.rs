//! Commandes iPhone pour les lectures HealthKit autorisées. Les réponses et erreurs du plugin ne contiennent que des données utiles ou des codes.

use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Manager, Runtime};

use crate::mobile_call::{call_with_deadline, shaped_code, CallError};

const STATUS_DEADLINE: Duration = Duration::from_secs(5);
const READ_DEADLINE: Duration = Duration::from_secs(10);
const AUTHORIZE_DEADLINE: Duration = Duration::from_secs(300);

async fn call<R: Runtime>(
    app: AppHandle<R>,
    command: &'static str,
    deadline: Duration,
) -> Result<Value, String> {
    let plugin = app
        .try_state::<tauri_plugin_healthkit::HealthKit<R>>()
        .ok_or_else(|| "healthkit-plugin-unavailable".to_owned())?
        .inner()
        .clone();

    tauri::async_runtime::spawn_blocking(move || {
        call_with_deadline(move || plugin.call(command, json!({})), deadline).map_err(|error| {
            match error {
                CallError::Timeout => "healthkit-timeout".to_owned(),
                CallError::Rejected(code) => shaped_code(&code).to_owned(),
            }
        })
    })
    .await
    .map_err(|_| "healthkit-task-failed".to_owned())?
}

#[tauri::command]
pub async fn healthkit_status<R: Runtime>(app: AppHandle<R>) -> Result<Value, String> {
    call(app, "status", STATUS_DEADLINE).await
}

#[tauri::command]
pub async fn healthkit_authorize<R: Runtime>(app: AppHandle<R>) -> Result<Value, String> {
    call(app, "authorize", AUTHORIZE_DEADLINE).await
}

#[tauri::command]
pub async fn healthkit_body_mass_today<R: Runtime>(app: AppHandle<R>) -> Result<Value, String> {
    call(app, "bodyMassToday", READ_DEADLINE).await
}

#[tauri::command]
pub async fn healthkit_step_count_today<R: Runtime>(app: AppHandle<R>) -> Result<Value, String> {
    call(app, "stepCountToday", READ_DEADLINE).await
}
