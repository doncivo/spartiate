//! Plugin Swift HealthKit de Spartiate (SPA-006). Rust seul appelle HealthKit ; la WebView ne dispose d'aucune commande de plugin.

use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_healthkit);

pub struct HealthKit<R: Runtime> {
    #[cfg(target_os = "ios")]
    handle: tauri::plugin::PluginHandle<R>,
    #[cfg(not(target_os = "ios"))]
    _runtime: std::marker::PhantomData<fn() -> R>,
}

impl<R: Runtime> Clone for HealthKit<R> {
    fn clone(&self) -> Self {
        Self {
            #[cfg(target_os = "ios")]
            handle: self.handle.clone(),
            #[cfg(not(target_os = "ios"))]
            _runtime: std::marker::PhantomData,
        }
    }
}

impl<R: Runtime> HealthKit<R> {
    #[cfg(target_os = "ios")]
    pub fn call(
        &self,
        command: &str,
        args: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        use tauri::plugin::mobile::PluginInvokeError;
        self.handle
            .run_mobile_plugin::<serde_json::Value>(command, args)
            .map_err(|error| match error {
                PluginInvokeError::InvokeRejected(response) => response
                    .code
                    .filter(|code| !code.is_empty())
                    .unwrap_or_else(|| "healthkit-failed".to_owned()),
                _ => "healthkit-unavailable".to_owned(),
            })
    }

    #[cfg(not(target_os = "ios"))]
    pub fn call(
        &self,
        _command: &str,
        _args: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        Err("healthkit-unsupported".to_owned())
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("healthkit")
        .setup(|app, api| {
            #[cfg(target_os = "ios")]
            let plugin = HealthKit {
                handle: api.register_ios_plugin(init_plugin_healthkit)?,
            };
            #[cfg(not(target_os = "ios"))]
            let plugin = {
                let _ = api;
                HealthKit::<R> {
                    _runtime: std::marker::PhantomData,
                }
            };
            app.manage(plugin);
            Ok(())
        })
        .build()
}
