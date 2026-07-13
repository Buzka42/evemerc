use sha2::Digest;
use std::io::{Read, Write};
use std::net::TcpListener;
use tauri::{AppHandle, Emitter};

const SERVICE_NAME: &str = "systems.wormhole.evemerc-desktop";

fn token_entry(server_origin: &str) -> Result<keyring::Entry, String> {
    let account = token_account(server_origin);
    keyring::Entry::new(SERVICE_NAME, &account)
        .map_err(|error| format!("Could not access the operating system credential store: {error}"))
}

fn token_account(server_origin: &str) -> String {
    format!(
        "desktop-access-token-{}",
        hex::encode(sha2::Sha256::digest(server_origin))
    )
}

#[tauri::command]
pub fn store_access_token(token: String, server_origin: String) -> Result<(), String> {
    if token.trim().is_empty() {
        return Err("The access token cannot be empty.".to_owned());
    }

    token_entry(&server_origin)?
        .set_password(&token)
        .map_err(|error| format!("Could not save the access token: {error}"))
}

#[tauri::command]
pub fn load_access_token(server_origin: String) -> Result<Option<String>, String> {
    match token_entry(&server_origin)?.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("Could not load the access token: {error}")),
    }
}

#[tauri::command]
pub fn clear_access_token(server_origin: String) -> Result<(), String> {
    match token_entry(&server_origin)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("Could not remove the access token: {error}")),
    }
}

#[tauri::command]
pub fn device_name() -> String {
    hostname::get()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|_| "EVEMerc Desktop".to_owned())
}

#[tauri::command]
pub fn start_loopback_auth_listener(app: AppHandle) -> Result<String, String> {
    let listener = TcpListener::bind(("127.0.0.1", 0))
        .map_err(|error| format!("Could not start the local authentication receiver: {error}"))?;
    let address = listener
        .local_addr()
        .map_err(|error| format!("Could not inspect the local authentication receiver: {error}"))?;
    let redirect_uri = format!("http://127.0.0.1:{}/callback", address.port());
    let callback_origin = redirect_uri.clone();

    std::thread::spawn(move || {
        let Ok((mut stream, _peer)) = listener.accept() else {
            return;
        };
        let mut request = [0_u8; 8192];
        let Ok(read) = stream.read(&mut request) else {
            return;
        };
        let target = request_target(&request[..read]);
        let is_callback = target
            .as_deref()
            .is_some_and(|value| value.starts_with("/callback?"));

        if let Some(target) = target.filter(|_| is_callback) {
            let callback = callback_origin.trim_end_matches("/callback").to_owned() + &target;
            let _ = app.emit("auth://callback", callback);
        }

        let (status, body) = if is_callback {
            (
                "200 OK",
                "Authentication received. You can return to EVEMerc Desktop.",
            )
        } else {
            ("400 Bad Request", "Invalid authentication callback.")
        };
        let response = format!(
            "HTTP/1.1 {status}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        );
        let _ = stream.write_all(response.as_bytes());
    });

    Ok(redirect_uri)
}

fn request_target(request: &[u8]) -> Option<String> {
    let request = std::str::from_utf8(request).ok()?;
    let request_line = request.lines().next()?;
    let mut parts = request_line.split_whitespace();
    if parts.next()? != "GET" {
        return None;
    }

    parts.next().map(str::to_owned)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn device_name_is_never_empty() {
        assert!(!device_name().trim().is_empty());
    }

    #[test]
    fn access_tokens_are_isolated_by_server_origin() {
        assert_ne!(
            token_account("https://one.test"),
            token_account("https://two.test")
        );
        assert_eq!(
            token_account("https://one.test"),
            token_account("https://one.test")
        );
    }

    #[test]
    fn loopback_receiver_accepts_only_get_request_targets() {
        assert_eq!(
            request_target(b"GET /callback?code=abc&state=xyz HTTP/1.1\r\nHost: 127.0.0.1\r\n"),
            Some("/callback?code=abc&state=xyz".to_owned())
        );
        assert_eq!(request_target(b"POST /callback HTTP/1.1\r\n"), None);
    }
}
