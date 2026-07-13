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
    let normalized = normalized_path(path);
    let observations = {
        let Ok(mut state) = state.lock() else {
            return;
        };

        if !state.tails.contains_key(&normalized) {
            match TailState::created(path) {
                Ok(tail) => {
                    state.tails.insert(normalized.clone(), tail);
                    state.status.gamelog_files += 1;
                }
                Err(_) => {
                    state.status.read_errors += 1;
                    return;
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
    };

    for observation in observations {
        if app.emit(OBSERVATION_EVENT, &observation).is_ok() {
            if let Ok(mut state) = state.lock() {
                state.status.observations_emitted += 1;
                state.status.last_observation_at = Some(Utc::now().to_rfc3339());
            }
        }
    }
}

fn increment_read_error(state: &Arc<Mutex<ServiceState>>) {
    if let Ok(mut state) = state.lock() {
        state.status.read_errors += 1;
    }
}
