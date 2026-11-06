//! Plugin Swift Live Activity de Spartiate (SPA-007). Rust seul appelle ActivityKit ; la WebView ne dispose d'aucune commande de plugin.

use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_live_activity);

pub struct LiveActivity<R: Runtime> {
    #[cfg(target_os = "ios")]
    handle: tauri::plugin::PluginHandle<R>,
    #[cfg(not(target_os = "ios"))]
    _runtime: std::marker::PhantomData<fn() -> R>,
}

impl<R: Runtime> Clone for LiveActivity<R> {
    fn clone(&self) -> Self {
        Self {
            #[cfg(target_os = "ios")]
            handle: self.handle.clone(),
            #[cfg(not(target_os = "ios"))]
            _runtime: std::marker::PhantomData,
        }
    }
}

impl<R: Runtime> LiveActivity<R> {
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
                    .unwrap_or_else(|| "liveactivity-failed".to_owned()),
                _ => "liveactivity-unavailable".to_owned(),
            })
    }

    #[cfg(not(target_os = "ios"))]
    pub fn call(
        &self,
        _command: &str,
        _args: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        Err("liveactivity-unsupported".to_owned())
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("live-activity")
        .setup(|app, api| {
            #[cfg(target_os = "ios")]
            let plugin = LiveActivity {
                handle: api.register_ios_plugin(init_plugin_live_activity)?,
            };
            #[cfg(not(target_os = "ios"))]
            let plugin = {
                let _ = api;
                LiveActivity::<R> {
                    _runtime: std::marker::PhantomData,
                }
            };
            app.manage(plugin);
            Ok(())
        })
        .build()
}
