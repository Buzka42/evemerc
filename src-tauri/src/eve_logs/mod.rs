mod decoder;
mod discovery;
mod parser;
mod tailer;

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use chrono::Utc;
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use discovery::{default_logs_root, text_files, validate_logs_root};
use parser::EveLogObservation;
use tailer::{is_chatlog, is_gamelog, normalized_path, TailState};

const OBSERVATION_EVENT: &str = "eve-log://observation";

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EveLogStatus {
    pub root: Option<String>,
    pub watching: bool,
    pub gamelog_files: usize,
    pub chatlog_files: usize,
    pub observations_emitted: u64,
    pub chat_lines_read: u64,
    pub read_errors: u64,
    pub last_observation_at: Option<String>,
}

#[derive(Default)]
struct ServiceState {
    status: EveLogStatus,
    tails: HashMap<PathBuf, TailState>,
    chat_tails: HashMap<PathBuf, TailState>,
}

#[derive(Default)]
pub struct EveLogService {
    state: Arc<Mutex<ServiceState>>,
    watcher: Mutex<Option<RecommendedWatcher>>,
}

impl EveLogService {
    pub fn start(
        &self,
        app: AppHandle,
        requested_root: Option<String>,
    ) -> Result<EveLogStatus, String> {
        self.stop()?;

        let root = requested_root
            .map(PathBuf::from)
            .or_else(default_logs_root)
            .ok_or_else(|| "Unable to discover the Documents directory.".to_owned())?;
        validate_logs_root(&root)?;

        let gamelog_files = text_files(&root.join("Gamelogs"));
        let chatlog_files = text_files(&root.join("Chatlogs"));
        let mut tails = HashMap::with_capacity(gamelog_files.len());
        let mut chat_tails = HashMap::with_capacity(chatlog_files.len());

        for path in &gamelog_files {
            if let Ok(tail) = TailState::existing(path) {
                tails.insert(normalized_path(path), tail);
            }
        }
        for path in &chatlog_files {
            if let Ok(tail) = TailState::existing(path) {
                chat_tails.insert(normalized_path(path), tail);
            }
        }

        {
            let mut state = self
                .state
                .lock()
                .map_err(|_| "EVE log watcher state is unavailable.".to_owned())?;
            state.status = EveLogStatus {
                root: Some(root.to_string_lossy().into_owned()),
                watching: true,
                gamelog_files: gamelog_files.len(),
                chatlog_files: chatlog_files.len(),
                ..EveLogStatus::default()
            };
            state.tails = tails;
            state.chat_tails = chat_tails;
        }

        let callback_state = Arc::clone(&self.state);
        let callback_root = root.clone();
        let mut watcher =
            notify::recommended_watcher(move |result: notify::Result<notify::Event>| {
                let Ok(event) = result else {
                    increment_read_error(&callback_state);
                    return;
                };

                for path in event.paths {
                    if is_gamelog(&path, &callback_root) {
                        process_path(&callback_state, &app, &path);
                    } else if is_chatlog(&path, &callback_root) {
                        process_chat_path(&callback_state, &path);
                    }
                }
            })
            .map_err(|_| "Unable to initialize the EVE log watcher.".to_owned())?;

        watcher
            .watch(Path::new(&root), RecursiveMode::Recursive)
            .map_err(|_| "Unable to watch the configured EVE logs folder.".to_owned())?;

        *self
            .watcher
            .lock()
            .map_err(|_| "EVE log watcher state is unavailable.".to_owned())? = Some(watcher);

        self.status()
    }

    pub fn stop(&self) -> Result<(), String> {
        self.watcher
            .lock()
            .map_err(|_| "EVE log watcher state is unavailable.".to_owned())?
            .take();

        let mut state = self
            .state
            .lock()
            .map_err(|_| "EVE log watcher state is unavailable.".to_owned())?;
        state.status.watching = false;
        state.tails.clear();
        state.chat_tails.clear();

        Ok(())
    }

    pub fn status(&self) -> Result<EveLogStatus, String> {
        self.state
            .lock()
            .map(|state| state.status.clone())
            .map_err(|_| "EVE log watcher state is unavailable.".to_owned())
    }
}

fn process_chat_path(state: &Arc<Mutex<ServiceState>>, path: &Path) {
    let normalized = normalized_path(path);
    let Ok(mut state) = state.lock() else {
        return;
    };

    if !state.chat_tails.contains_key(&normalized) {
        match TailState::created(path) {
            Ok(tail) => {
                state.chat_tails.insert(normalized.clone(), tail);
                state.status.chatlog_files += 1;
            }
            Err(_) => {
                state.status.read_errors += 1;
                return;
            }
        }
    }

    let result = state
        .chat_tails
        .get_mut(&normalized)
        .expect("chat tail was inserted")
        .read_complete_lines(path);
    match result {
        Ok(lines) => state.status.chat_lines_read += lines.len() as u64,
        Err(_) => state.status.read_errors += 1,
    }
}

fn process_path(state: &Arc<Mutex<ServiceState>>, app: &AppHandle, path: &Path) {
    let observations = track_and_read_gamelog(state, path);

    for observation in observations {
        if app.emit(OBSERVATION_EVENT, &observation).is_ok() {
            if let Ok(mut state) = state.lock() {
                state.status.observations_emitted += 1;
                state.status.last_observation_at = Some(Utc::now().to_rfc3339());
            }
        }
    }
}

/// Tracks (creating a fresh tail on first sight) and reads newly appended, deduplicated
/// observations from a single gamelog path. Split out from `process_path` so the file-tracking
/// and rotation behavior — which file gets a fresh `TailState`, which keeps its existing offset —
/// is testable without a Tauri `AppHandle`.
fn track_and_read_gamelog(state: &Arc<Mutex<ServiceState>>, path: &Path) -> Vec<EveLogObservation> {
    let normalized = normalized_path(path);
    let Ok(mut state) = state.lock() else {
        return Vec::new();
    };

    if !state.tails.contains_key(&normalized) {
        match TailState::created(path) {
            Ok(tail) => {
                state.tails.insert(normalized.clone(), tail);
                state.status.gamelog_files += 1;
            }
            Err(_) => {
                state.status.read_errors += 1;
                return Vec::new();
            }
        }
    }

    match state
        .tails
        .get_mut(&normalized)
        .expect("tail was inserted")
        .read_observations(path)
    {
        Ok(observations) => observations,
        Err(_) => {
            state.status.read_errors += 1;
            Vec::new()
        }
    }
}

fn increment_read_error(state: &Arc<Mutex<ServiceState>>) {
    if let Ok(mut state) = state.lock() {
        state.status.read_errors += 1;
    }
}

#[cfg(test)]
mod tests {
    use std::io::Write;

    use tempfile::NamedTempFile;

    use super::*;

    #[test]
    fn a_newly_discovered_gamelog_starts_from_the_beginning_not_eof() {
        let mut file = NamedTempFile::new().expect("temp file");
        writeln!(file, "[ 2026.07.13 10:00:00 ] (None) Jumping from Alpha to Beta").expect("write");

        let state: Arc<Mutex<ServiceState>> = Arc::new(Mutex::new(ServiceState::default()));
        let observations = track_and_read_gamelog(&state, file.path());

        assert_eq!(observations.len(), 1);
        assert_eq!(observations[0].from_system, "Alpha");
        assert_eq!(observations[0].to_system, "Beta");
    }

    #[test]
    fn switching_to_a_new_session_file_tracks_it_independently_of_the_previous_one() {
        let mut file_a = NamedTempFile::new().expect("temp file a");
        writeln!(file_a, "[ 2026.07.13 10:00:00 ] (None) Jumping from Alpha to Beta").expect("write a");

        let state: Arc<Mutex<ServiceState>> = Arc::new(Mutex::new(ServiceState::default()));
        let first = track_and_read_gamelog(&state, file_a.path());
        assert_eq!(first.len(), 1);

        // A new session file appears - simulates EVE creating a fresh log after a relogin. It is
        // tracked independently and starts from its own beginning, not the prior file's offset.
        let mut file_b = NamedTempFile::new().expect("temp file b");
        writeln!(file_b, "[ 2026.07.13 10:05:00 ] (None) Jumping from Gamma to Delta").expect("write b");

        let second = track_and_read_gamelog(&state, file_b.path());
        assert_eq!(second.len(), 1);
        assert_eq!(second[0].from_system, "Gamma");
        assert_eq!(second[0].to_system, "Delta");

        // The previous file's tail is untouched by the switch: replaying it with no new bytes
        // appended yields nothing.
        let replay_a = track_and_read_gamelog(&state, file_a.path());
        assert!(replay_a.is_empty());

        let state_guard = state.lock().expect("state lock");
        assert_eq!(state_guard.tails.len(), 2);
        assert_eq!(state_guard.status.gamelog_files, 2);
    }

    #[test]
    fn rereading_the_same_file_after_growth_never_replays_a_previously_emitted_observation() {
        let mut file = NamedTempFile::new().expect("temp file");
        writeln!(file, "[ 2026.07.13 10:00:00 ] (None) Jumping from Alpha to Beta").expect("write first");

        let state: Arc<Mutex<ServiceState>> = Arc::new(Mutex::new(ServiceState::default()));
        let first = track_and_read_gamelog(&state, file.path());
        assert_eq!(first.len(), 1);

        let replay = track_and_read_gamelog(&state, file.path());
        assert!(replay.is_empty(), "re-reading with no new bytes must not replay the prior observation");

        writeln!(file, "[ 2026.07.13 10:01:00 ] (None) Jumping from Beta to Charlie").expect("write second");
        let grown = track_and_read_gamelog(&state, file.path());
        assert_eq!(grown.len(), 1);
        assert_eq!(grown[0].from_system, "Beta");
        assert_eq!(grown[0].to_system, "Charlie");
    }
}
