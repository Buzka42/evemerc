use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

/// Byte offsets already processed per gamelog file, keyed by the file's normalized path string.
/// Persisted across app restarts so a restart resumes where it left off instead of either
/// replaying already-seen lines (if it re-read from 0) or blindly jumping to EOF and silently
/// skipping whatever accumulated while the app was closed (today's behavior before this file
/// existed). Chatlog offsets are intentionally not persisted — nothing consumes chatlog content
/// yet, so there is nothing at risk of being missed.
#[derive(Debug, Default, Serialize, Deserialize)]
pub struct PersistedOffsets {
    gamelogs: HashMap<String, u64>,
}

impl PersistedOffsets {
    pub fn get(&self, path: &Path) -> Option<u64> {
        self.gamelogs.get(&key_for(path)).copied()
    }

    pub fn set(&mut self, path: &Path, offset: u64) {
        self.gamelogs.insert(key_for(path), offset);
    }
}

fn key_for(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

pub fn offsets_file_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("eve_log_offsets.json")
}

/// Reads persisted offsets, if any. Any failure to read or parse the file (missing, corrupt,
/// from an incompatible future format) is treated as "no persisted offsets" rather than an
/// error — losing the resume point degrades to the pre-existing EOF-start behavior, which is
/// safe, so this must never block the watcher from starting.
pub fn load(path: &Path) -> PersistedOffsets {
    fs::read(path)
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

pub fn save(path: &Path, offsets: &PersistedOffsets) -> Result<(), String> {
    let encoded = serde_json::to_vec(offsets)
        .map_err(|error| format!("Could not serialize EVE log offsets: {error}"))?;
    fs::write(path, encoded).map_err(|error| format!("Could not save EVE log offsets: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_offsets_through_disk() {
        let directory = tempfile::tempdir().expect("temp directory");
        let path = offsets_file_path(directory.path());

        let mut offsets = PersistedOffsets::default();
        offsets.set(Path::new("C:/logs/Gamelogs/a.txt"), 4_096);
        save(&path, &offsets).expect("save");

        let reloaded = load(&path);
        assert_eq!(reloaded.get(Path::new("C:/logs/Gamelogs/a.txt")), Some(4_096));
        assert_eq!(reloaded.get(Path::new("C:/logs/Gamelogs/b.txt")), None);
    }

    #[test]
    fn missing_or_corrupt_files_load_as_empty_rather_than_failing() {
        let directory = tempfile::tempdir().expect("temp directory");

        let missing = load(&offsets_file_path(directory.path()));
        assert_eq!(missing.get(Path::new("anything")), None);

        let corrupt_path = directory.path().join("corrupt.json");
        fs::write(&corrupt_path, b"not json").expect("write corrupt file");
        let corrupt = load(&corrupt_path);
        assert_eq!(corrupt.get(Path::new("anything")), None);
    }
}
