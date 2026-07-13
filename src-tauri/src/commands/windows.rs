use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

const ALLOWED_PANELS: [&str; 4] = ["fleet-command", "wormhole-chain", "account", "telemetry"];

#[tauri::command]
pub async fn open_panel_window(
    app: AppHandle,
    panel_id: String,
    always_on_top: bool,
    opacity: f64,
) -> Result<(), String> {
    if !ALLOWED_PANELS.contains(&panel_id.as_str()) {
        return Err("Unknown panel identifier.".to_owned());
    }

    let opacity = opacity.clamp(0.35, 1.0);
    let label = format!("panel-{}", panel_id);
    if let Some(window) = app.get_webview_window(&label) {
        window
            .set_always_on_top(always_on_top)
            .map_err(|error| error.to_string())?;
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
        return Ok(());
    }

    let url = format!("index.html?window=panel&panel={panel_id}&opacity={opacity}");
    WebviewWindowBuilder::new(&app, label, WebviewUrl::App(url.into()))
        .title(format!("EVEMerc — {}", panel_title(&panel_id)))
        .inner_size(780.0, 560.0)
        .min_inner_size(420.0, 300.0)
        .always_on_top(always_on_top)
        .transparent(true)
        .build()
        .map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn set_panel_always_on_top(
    app: AppHandle,
    panel_id: String,
    always_on_top: bool,
) -> Result<(), String> {
    if !ALLOWED_PANELS.contains(&panel_id.as_str()) {
        return Err("Unknown panel identifier.".to_owned());
    }

    let label = format!("panel-{panel_id}");
    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| "Panel window is not open.".to_owned())?;

    window
        .set_always_on_top(always_on_top)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn control_main_window(app: AppHandle, action: String) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window is unavailable.".to_owned())?;

    let result = match action.as_str() {
        "minimize" => window.minimize(),
        "toggle-maximize" => {
            if window.is_maximized().map_err(|error| error.to_string())? {
                window.unmaximize()
            } else {
                window.maximize()
            }
        }
        "close" => window.close(),
        _ => return Err("Unknown window action.".to_owned()),
    };

    result.map_err(|error| error.to_string())
}

fn panel_title(panel_id: &str) -> &str {
    match panel_id {
        "fleet-command" => "Fleet Command",
        "wormhole-chain" => "Wormhole Chain",
        "account" => "EVE Account",
        "telemetry" => "EVE Telemetry",
        _ => "Panel",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_allowed_panel_has_a_title() {
        for panel in ALLOWED_PANELS {
            assert_ne!(panel_title(panel), "Panel");
        }
    }

    #[test]
    fn rejects_unknown_panel_titles() {
        assert_eq!(panel_title("untrusted"), "Panel");
    }
}
