use std::{fs, path::Path};

use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn cache_put(
    app: AppHandle,
    server_origin: String,
    namespace: String,
    key: String,
    payload: Value,
) -> Result<(), String> {
    let database = open_cache(&app)?;
    put_record(&database, &server_origin, &namespace, &key, &payload)
}

#[tauri::command]
pub fn cache_get(
    app: AppHandle,
    server_origin: String,
    namespace: String,
    key: String,
) -> Result<Option<Value>, String> {
    let database = open_cache(&app)?;
    get_record(&database, &server_origin, &namespace, &key)
}

#[tauri::command]
pub fn cache_purge_server(app: AppHandle, server_origin: String) -> Result<(), String> {
    let database = open_cache(&app)?;
    database
        .execute(
            "DELETE FROM records WHERE server_origin = ?1",
            [server_origin],
        )
        .map(|_| ())
        .map_err(|error| format!("Could not purge the offline cache: {error}"))
}

fn open_cache(app: &AppHandle) -> Result<Connection, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not locate the application data folder: {error}"))?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Could not create the application data folder: {error}"))?;
    open_cache_path(&directory.join("cache.sqlite"))
}

fn open_cache_path(path: &Path) -> Result<Connection, String> {
    let database = Connection::open(path)
        .map_err(|error| format!("Could not open the offline cache: {error}"))?;
    database
        .execute_batch(
            "CREATE TABLE IF NOT EXISTS records (
                server_origin TEXT NOT NULL,
                namespace TEXT NOT NULL,
                record_key TEXT NOT NULL,
                payload TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (server_origin, namespace, record_key)
            );",
        )
        .map_err(|error| format!("Could not initialize the offline cache: {error}"))?;
    Ok(database)
}

fn put_record(
    database: &Connection,
    server_origin: &str,
    namespace: &str,
    key: &str,
    payload: &Value,
) -> Result<(), String> {
    let encoded = serde_json::to_string(payload)
        .map_err(|error| format!("Could not serialize the cached record: {error}"))?;
    database
        .execute(
            "INSERT INTO records (server_origin, namespace, record_key, payload)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT (server_origin, namespace, record_key) DO UPDATE SET
                 payload = excluded.payload,
                 updated_at = CURRENT_TIMESTAMP",
            params![server_origin, namespace, key, encoded],
        )
        .map(|_| ())
        .map_err(|error| format!("Could not update the offline cache: {error}"))
}

fn get_record(
    database: &Connection,
    server_origin: &str,
    namespace: &str,
    key: &str,
) -> Result<Option<Value>, String> {
    let encoded = database
        .query_row(
            "SELECT payload FROM records WHERE server_origin = ?1 AND namespace = ?2 AND record_key = ?3",
            params![server_origin, namespace, key],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| format!("Could not read the offline cache: {error}"))?;

    encoded
        .map(|payload| {
            serde_json::from_str(&payload)
                .map_err(|error| format!("The cached record was invalid: {error}"))
        })
        .transpose()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_records_are_isolated_by_server_and_namespace() {
        let directory = tempfile::tempdir().expect("temp directory");
        let database = open_cache_path(&directory.path().join("cache.sqlite")).expect("cache");
        let payload = serde_json::json!({"revision": 7});
        put_record(&database, "https://one.test", "fleet", "map-1", &payload).expect("put");

        assert_eq!(
            get_record(&database, "https://one.test", "fleet", "map-1").expect("get"),
            Some(payload)
        );
        assert_eq!(
            get_record(&database, "https://two.test", "fleet", "map-1").expect("get"),
            None
        );
        assert_eq!(
            get_record(&database, "https://one.test", "maps", "map-1").expect("get"),
            None
        );
    }
}
