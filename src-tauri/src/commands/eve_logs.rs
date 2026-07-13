use tauri::{AppHandle, State};

use crate::eve_logs::{EveLogService, EveLogStatus};

#[tauri::command]
pub fn start_eve_log_watcher(
    app: AppHandle,
    service: State<'_, EveLogService>,
    root: Option<String>,
) -> Result<EveLogStatus, String> {
    service.start(app, root)
}

#[tauri::command]
pub fn stop_eve_log_watcher(service: State<'_, EveLogService>) -> Result<(), String> {
    service.stop()
}

#[tauri::command]
pub fn get_eve_log_status(service: State<'_, EveLogService>) -> Result<EveLogStatus, String> {
    service.status()
}
