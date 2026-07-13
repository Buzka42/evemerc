mod cache;
mod commands;
mod eve_logs;
mod sde;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(
            |app, _arguments, _cwd| {
                use tauri::Manager;

                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            },
        ))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|_app| {
            #[cfg(any(target_os = "linux", all(debug_assertions, windows)))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;

                _app.deep_link().register_all()?;
            }

            Ok(())
        })
        .manage(eve_logs::EveLogService::default())
        .invoke_handler(tauri::generate_handler![
            cache::cache_put,
            cache::cache_get,
            cache::cache_purge_server,
            commands::auth::store_access_token,
            commands::auth::load_access_token,
            commands::auth::clear_access_token,
            commands::auth::device_name,
            commands::auth::start_loopback_auth_listener,
            commands::eve_logs::start_eve_log_watcher,
            commands::eve_logs::stop_eve_log_watcher,
            commands::eve_logs::get_eve_log_status,
            commands::windows::open_panel_window,
            commands::windows::set_panel_always_on_top,
            commands::windows::control_main_window,
            sde::sync_sde_snapshot,
            sde::resolve_solar_system,
            sde::get_region_topology,
            sde::get_signature_catalog,
            sde::get_solar_system_details,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
