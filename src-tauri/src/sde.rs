use std::{
    fs,
    io::{Cursor, Read},
    path::Path,
};

use flate2::read::GzDecoder;
use reqwest::Url;
use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};

#[derive(Debug, Deserialize)]
struct RemoteVersion {
    version: String,
    size_bytes: u64,
    url: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SdeStatus {
    pub version: String,
    pub size_bytes: u64,
    pub updated: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegionSystem {
    id: i64,
    name: String,
    security: f64,
    position_x: f64,
    position_z: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegionJump {
    from_system_id: i64,
    to_system_id: i64,
}

#[derive(Debug, Serialize)]
pub struct RegionTopology {
    systems: Vec<RegionSystem>,
    jumps: Vec<RegionJump>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignatureCatalogEntry {
    id: i64,
    name: String,
    category_id: i64,
    category_name: String,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SolarSystemDetails {
    id: i64,
    name: String,
    security: f64,
    wormhole_class: Option<i64>,
    effect_name: Option<String>,
    statics: Vec<String>,
}

#[tauri::command]
pub async fn sync_sde_snapshot(app: AppHandle, server_url: String) -> Result<SdeStatus, String> {
    let server = validate_server_url(&server_url)?;
    let version_url = server
        .join("/api/v1/sde/version")
        .map_err(|error| format!("Invalid SDE version URL: {error}"))?;
    let remote = reqwest::get(version_url)
        .await
        .map_err(|error| format!("Could not request the SDE version: {error}"))?
        .error_for_status()
        .map_err(|error| format!("The SDE version request failed: {error}"))?
        .json::<RemoteVersion>()
        .await
        .map_err(|error| format!("The SDE version response was invalid: {error}"))?;

    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not locate the application data folder: {error}"))?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Could not create the application data folder: {error}"))?;
    let database_path = directory.join("sde.sqlite");
    let metadata_path = directory.join("sde.json");

    if local_version(&metadata_path).as_deref() == Some(&remote.version) && database_path.is_file()
    {
        return Ok(SdeStatus {
            version: remote.version,
            size_bytes: remote.size_bytes,
            updated: false,
        });
    }

    let snapshot_url = validate_snapshot_url(&remote.url, &server)?;
    let compressed = reqwest::get(snapshot_url)
        .await
        .map_err(|error| format!("Could not download the SDE snapshot: {error}"))?
        .error_for_status()
        .map_err(|error| format!("The SDE snapshot download failed: {error}"))?
        .bytes()
        .await
        .map_err(|error| format!("Could not read the SDE snapshot: {error}"))?;

    let actual_hash = hex::encode(Sha256::digest(&compressed));
    if actual_hash != remote.version {
        return Err("The downloaded SDE snapshot did not match its advertised hash.".to_owned());
    }

    let building_path = directory.join("sde.building.sqlite");
    let mut decoder = GzDecoder::new(Cursor::new(compressed));
    let mut sqlite = Vec::new();
    decoder
        .read_to_end(&mut sqlite)
        .map_err(|error| format!("Could not decompress the SDE snapshot: {error}"))?;
    fs::write(&building_path, sqlite)
        .map_err(|error| format!("Could not write the SDE snapshot: {error}"))?;
    validate_database(&building_path)?;

    if database_path.exists() {
        fs::remove_file(&database_path)
            .map_err(|error| format!("Could not replace the existing SDE snapshot: {error}"))?;
    }
    fs::rename(&building_path, &database_path)
        .map_err(|error| format!("Could not activate the SDE snapshot: {error}"))?;
    fs::write(
        metadata_path,
        serde_json::to_vec(&SdeStatus {
            version: remote.version.clone(),
            size_bytes: remote.size_bytes,
            updated: true,
        })
        .map_err(|error| format!("Could not serialize SDE metadata: {error}"))?,
    )
    .map_err(|error| format!("Could not save SDE metadata: {error}"))?;

    Ok(SdeStatus {
        version: remote.version,
        size_bytes: remote.size_bytes,
        updated: true,
    })
}

#[tauri::command]
pub fn resolve_solar_system(app: AppHandle, name: String) -> Result<Option<i64>, String> {
    resolve_system_id(
        &app.path()
            .app_data_dir()
            .map_err(|error| error.to_string())?
            .join("sde.sqlite"),
        &name,
    )
}

#[tauri::command]
pub fn get_region_topology(
    app: AppHandle,
    region_id: i64,
) -> Result<Option<RegionTopology>, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("sde.sqlite");
    if !path.is_file() {
        return Ok(None);
    }

    read_region_topology(&path, region_id).map(Some)
}

#[tauri::command]
pub fn get_signature_catalog(app: AppHandle) -> Result<Vec<SignatureCatalogEntry>, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("sde.sqlite");
    read_signature_catalog(&path)
}

#[tauri::command]
pub fn get_solar_system_details(
    app: AppHandle,
    system_ids: Vec<i64>,
) -> Result<Vec<SolarSystemDetails>, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("sde.sqlite");
    read_solar_system_details(&path, &system_ids)
}

fn read_solar_system_details(
    path: &Path,
    system_ids: &[i64],
) -> Result<Vec<SolarSystemDetails>, String> {
    if !path.is_file() {
        return Ok(Vec::new());
    }
    let database = Connection::open(path)
        .map_err(|error| format!("Could not open the SDE snapshot: {error}"))?;
    let mut details_statement = database
        .prepare(
            "SELECT systems.id, systems.name, systems.security, wormhole_systems.class, effects.name
             FROM solarsystems systems
             LEFT JOIN wormhole_systems ON wormhole_systems.id = systems.id
             LEFT JOIN wormhole_effects effects ON effects.id = wormhole_systems.effect_id
             WHERE systems.id = ?1",
        )
        .map_err(|error| format!("Could not prepare solar-system details: {error}"))?;
    let mut statics_statement = database
        .prepare(
            "SELECT wormholes.name FROM wormhole_statics
             JOIN wormholes ON wormholes.id = wormhole_statics.wormhole_id
             WHERE wormhole_statics.wormhole_system_id = ?1 ORDER BY wormholes.name",
        )
        .map_err(|error| format!("Could not prepare wormhole statics: {error}"))?;
    let mut result = Vec::new();

    for system_id in system_ids {
        let row = details_statement
            .query_row([system_id], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, f64>(2)?,
                    row.get::<_, Option<i64>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                ))
            })
            .optional()
            .map_err(|error| format!("Could not query solar-system details: {error}"))?;
        let Some((id, name, security, wormhole_class, effect_name)) = row else {
            continue;
        };
        let statics = statics_statement
            .query_map([system_id], |row| row.get::<_, String>(0))
            .map_err(|error| format!("Could not query wormhole statics: {error}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("Could not read wormhole statics: {error}"))?;
        result.push(SolarSystemDetails {
            id,
            name,
            security,
            wormhole_class,
            effect_name,
            statics,
        });
    }

    Ok(result)
}

fn read_signature_catalog(path: &Path) -> Result<Vec<SignatureCatalogEntry>, String> {
    if !path.is_file() {
        return Ok(Vec::new());
    }
    let database = Connection::open(path)
        .map_err(|error| format!("Could not open the SDE snapshot: {error}"))?;
    let mut statement = database
        .prepare(
            "SELECT types.id, types.name, categories.id, categories.name
             FROM signature_types types
             JOIN signature_categories categories ON categories.id = types.signature_category_id
             ORDER BY categories.name, types.name",
        )
        .map_err(|error| format!("Could not prepare the signature catalog query: {error}"))?;
    let entries = statement
        .query_map([], |row| {
            Ok(SignatureCatalogEntry {
                id: row.get(0)?,
                name: row.get(1)?,
                category_id: row.get(2)?,
                category_name: row.get(3)?,
            })
        })
        .map_err(|error| format!("Could not query the signature catalog: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Could not read the signature catalog: {error}"))?;

    Ok(entries)
}

fn read_region_topology(path: &Path, region_id: i64) -> Result<RegionTopology, String> {
    let database = Connection::open(path)
        .map_err(|error| format!("Could not open the SDE snapshot: {error}"))?;
    let mut systems_statement = database
        .prepare("SELECT id, name, security, pos_x, pos_z FROM solarsystems WHERE region_id = ?1 ORDER BY id")
        .map_err(|error| format!("Could not prepare the regional topology query: {error}"))?;
    let systems = systems_statement
        .query_map([region_id], |row| {
            Ok(RegionSystem {
                id: row.get(0)?,
                name: row.get(1)?,
                security: row.get(2)?,
                position_x: row.get(3)?,
                position_z: row.get(4)?,
            })
        })
        .map_err(|error| format!("Could not query regional systems: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Could not read regional systems: {error}"))?;
    let mut jumps_statement = database
        .prepare(
            "SELECT j.from_system_id, j.to_system_id
             FROM jumps j
             JOIN solarsystems source ON source.id = j.from_system_id
             JOIN solarsystems destination ON destination.id = j.to_system_id
             WHERE source.region_id = ?1 AND destination.region_id = ?1
             ORDER BY j.from_system_id, j.to_system_id",
        )
        .map_err(|error| format!("Could not prepare the regional jump query: {error}"))?;
    let jumps = jumps_statement
        .query_map([region_id], |row| {
            Ok(RegionJump {
                from_system_id: row.get(0)?,
                to_system_id: row.get(1)?,
            })
        })
        .map_err(|error| format!("Could not query regional jumps: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Could not read regional jumps: {error}"))?;

    Ok(RegionTopology { systems, jumps })
}

fn resolve_system_id(path: &Path, name: &str) -> Result<Option<i64>, String> {
    if !path.is_file() {
        return Ok(None);
    }

    Connection::open(path)
        .and_then(|database| {
            database
                .query_row(
                    "SELECT id FROM solarsystems WHERE name = ?1 COLLATE NOCASE LIMIT 1",
                    [name],
                    |row| row.get(0),
                )
                .optional()
        })
        .map_err(|error| format!("Could not query the SDE snapshot: {error}"))
}

fn validate_database(path: &Path) -> Result<(), String> {
    Connection::open(path)
        .and_then(|database| {
            database.query_row("PRAGMA quick_check", [], |row| row.get::<_, String>(0))
        })
        .and_then(|result| {
            if result == "ok" {
                Ok(())
            } else {
                Err(rusqlite::Error::InvalidQuery)
            }
        })
        .map_err(|error| format!("The downloaded SDE database failed validation: {error}"))
}

fn local_version(path: &Path) -> Option<String> {
    let contents = fs::read(path).ok()?;
    serde_json::from_slice::<SdeStatus>(&contents)
        .ok()
        .map(|status| status.version)
}

fn validate_server_url(value: &str) -> Result<Url, String> {
    let url = Url::parse(value).map_err(|error| format!("Invalid server URL: {error}"))?;
    let is_local = matches!(url.host_str(), Some("localhost" | "127.0.0.1"));
    if url.scheme() != "https" && !(is_local && url.scheme() == "http") {
        return Err("The server must use HTTPS unless it is localhost.".to_owned());
    }

    Ok(url)
}

fn validate_snapshot_url(value: &str, server: &Url) -> Result<Url, String> {
    let url = Url::parse(value).map_err(|error| format!("Invalid SDE snapshot URL: {error}"))?;
    if url.origin() != server.origin() {
        return Err("The SDE snapshot URL must use the configured server origin.".to_owned());
    }

    Ok(url)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_insecure_remote_servers() {
        assert!(validate_server_url("http://example.com").is_err());
        assert!(validate_server_url("http://localhost:8000").is_ok());
    }

    #[test]
    fn resolves_a_system_name_case_insensitively() {
        let directory = tempfile::tempdir().expect("temp directory");
        let path = directory.path().join("sde.sqlite");
        let database = Connection::open(&path).expect("database");
        database
            .execute_batch("CREATE TABLE solarsystems (id INTEGER PRIMARY KEY, name TEXT NOT NULL); INSERT INTO solarsystems VALUES (30000142, 'Jita');")
            .expect("fixture");

        assert_eq!(
            resolve_system_id(&path, "jita").expect("query"),
            Some(30_000_142)
        );
    }

    #[test]
    fn loads_only_the_requested_region_topology() {
        let directory = tempfile::tempdir().expect("temp directory");
        let path = directory.path().join("sde.sqlite");
        let database = Connection::open(&path).expect("database");
        database
            .execute_batch(
                "CREATE TABLE solarsystems (id INTEGER PRIMARY KEY, name TEXT, security REAL, region_id INTEGER, pos_x REAL, pos_z REAL);
                 CREATE TABLE jumps (from_system_id INTEGER, to_system_id INTEGER);
                 INSERT INTO solarsystems VALUES (1, 'Alpha', 0.5, 10, 10.0, 20.0), (2, 'Beta', 0.1, 10, 30.0, 40.0), (3, 'Other', 0.0, 11, 50.0, 60.0);
                 INSERT INTO jumps VALUES (1, 2), (2, 3);",
            )
            .expect("fixture");

        let topology = read_region_topology(&path, 10).expect("topology");
        assert_eq!(topology.systems.len(), 2);
        assert_eq!(topology.jumps.len(), 1);
    }

    #[test]
    fn reads_signature_types_with_their_categories() {
        let directory = tempfile::tempdir().expect("temp directory");
        let path = directory.path().join("sde.sqlite");
        let database = Connection::open(&path).expect("database");
        database.execute_batch(
            "CREATE TABLE signature_categories (id INTEGER PRIMARY KEY, name TEXT);
             CREATE TABLE signature_types (id INTEGER PRIMARY KEY, name TEXT, signature_category_id INTEGER);
             INSERT INTO signature_categories VALUES (1, 'Wormhole');
             INSERT INTO signature_types VALUES (2, 'Unstable Wormhole', 1);",
        ).expect("fixture");

        let catalog = read_signature_catalog(&path).expect("catalog");
        assert_eq!(catalog.len(), 1);
        assert_eq!(catalog[0].category_name, "Wormhole");
    }

    #[test]
    fn reads_wormhole_system_details_and_statics() {
        let directory = tempfile::tempdir().expect("temp directory");
        let path = directory.path().join("sde.sqlite");
        let database = Connection::open(&path).expect("database");
        database.execute_batch(
            "CREATE TABLE solarsystems (id INTEGER PRIMARY KEY, name TEXT, security REAL);
             CREATE TABLE wormhole_systems (id INTEGER PRIMARY KEY, effect_id INTEGER, class INTEGER);
             CREATE TABLE wormhole_effects (id INTEGER PRIMARY KEY, name TEXT);
             CREATE TABLE wormholes (id INTEGER PRIMARY KEY, name TEXT);
             CREATE TABLE wormhole_statics (id INTEGER PRIMARY KEY, wormhole_system_id INTEGER, wormhole_id INTEGER);
             INSERT INTO solarsystems VALUES (31000005, 'Thera', -1.0);
             INSERT INTO wormhole_effects VALUES (1, 'Wolf-Rayet Star');
             INSERT INTO wormhole_systems VALUES (31000005, 1, 12);
             INSERT INTO wormholes VALUES (2, 'K162'), (3, 'Q063');
             INSERT INTO wormhole_statics VALUES (1, 31000005, 3), (2, 31000005, 2);",
        ).expect("fixture");

        let details = read_solar_system_details(&path, &[31_000_005]).expect("details");
        assert_eq!(details.len(), 1);
        assert_eq!(details[0].name, "Thera");
        assert_eq!(details[0].wormhole_class, Some(12));
        assert_eq!(details[0].effect_name.as_deref(), Some("Wolf-Rayet Star"));
        assert_eq!(details[0].statics, vec!["K162", "Q063"]);
    }
}
