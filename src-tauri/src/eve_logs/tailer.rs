use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};

use super::decoder::{decode_chunk, detect_encoding, LogEncoding};
use super::discovery::character_id_from_path;
use super::parser::{parse_line, EveLogObservation};

pub struct TailState {
    offset: u64,
    pending_text: String,
    pending_bytes: Vec<u8>,
    encoding: LogEncoding,
}

impl TailState {
    pub fn existing(path: &Path) -> Result<Self, String> {
        let mut state = Self::new(path)?;
        state.offset = path.metadata().map_err(redacted_io_error)?.len();
        Ok(state)
    }

    pub fn created(path: &Path) -> Result<Self, String> {
        Self::new(path)
    }

    fn new(path: &Path) -> Result<Self, String> {
        let mut file = File::open(path).map_err(redacted_io_error)?;
        let mut prefix = [0_u8; 3];
        let read = file.read(&mut prefix).map_err(redacted_io_error)?;

        Ok(Self {
            offset: 0,
            pending_text: String::new(),
            pending_bytes: Vec::new(),
            encoding: detect_encoding(&prefix[..read]),
        })
    }

    pub fn read_observations(&mut self, path: &Path) -> Result<Vec<EveLogObservation>, String> {
        let character_id = character_id_from_path(path);
        Ok(self
            .read_complete_lines(path)?
            .into_iter()
            .filter_map(|(line, event_id)| {
                parse_line(line.trim_end_matches('\r'), character_id, event_id)
            })
            .collect())
    }

    pub fn read_complete_lines(&mut self, path: &Path) -> Result<Vec<(String, String)>, String> {
        let length = path.metadata().map_err(redacted_io_error)?.len();

        if length < self.offset {
            self.offset = length;
            self.pending_text.clear();
            self.pending_bytes.clear();
            return Ok(Vec::new());
        }

        if length == self.offset {
            return Ok(Vec::new());
        }

        let start_offset = self.offset;
        let mut file = File::open(path).map_err(redacted_io_error)?;
        file.seek(SeekFrom::Start(self.offset))
            .map_err(redacted_io_error)?;
        let mut appended = Vec::new();
        file.read_to_end(&mut appended).map_err(redacted_io_error)?;
        self.offset = length;

        let decoded = decode_chunk(self.encoding, &mut self.pending_bytes, &appended);
        self.pending_text.push_str(&decoded);

        let has_trailing_newline = self.pending_text.ends_with('\n');
        let mut lines = self
            .pending_text
            .split_terminator('\n')
            .map(str::to_owned)
            .collect::<Vec<_>>();

        self.pending_text = if has_trailing_newline {
            String::new()
        } else {
            lines.pop().unwrap_or_default()
        };

        Ok(lines
            .into_iter()
            .enumerate()
            .map(|(index, line)| (line, source_event_id(path, start_offset, index)))
            .collect())
    }
}

fn source_event_id(path: &Path, offset: u64, line_index: usize) -> String {
    let mut digest = Sha256::new();
    digest.update(path.to_string_lossy().as_bytes());
    digest.update(offset.to_le_bytes());
    digest.update(line_index.to_le_bytes());
    hex::encode(digest.finalize())
}

fn redacted_io_error(_: std::io::Error) -> String {
    "Unable to read an EVE log file.".to_owned()
}

pub fn is_gamelog(path: &Path, root: &Path) -> bool {
    path.starts_with(root.join("Gamelogs"))
        && path
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("txt"))
}

pub fn is_chatlog(path: &Path, root: &Path) -> bool {
    path.starts_with(root.join("Chatlogs"))
        && path
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("txt"))
}

pub fn normalized_path(path: &Path) -> PathBuf {
    path.components().collect()
}

#[cfg(test)]
mod tests {
    use std::io::Write;

    use tempfile::NamedTempFile;

    use super::*;

    #[test]
    fn existing_files_start_at_eof_and_only_emit_new_complete_lines() {
        let mut file = NamedTempFile::new().expect("temporary file");
        writeln!(
            file,
            "[ 2026.07.12 19:00:00 ] (None) Jumping from Old to History"
        )
        .expect("write history");

        let mut state = TailState::existing(file.path()).expect("tail state");
        assert!(state
            .read_observations(file.path())
            .expect("initial read")
            .is_empty());

        write!(file, "[ 2026.07.12 19:01:00 ] (None) Jumping from Jita").expect("write partial");
        assert!(state
            .read_observations(file.path())
            .expect("partial read")
            .is_empty());

        writeln!(file, " to Perimeter").expect("finish line");
        let observations = state.read_observations(file.path()).expect("complete read");
        assert_eq!(observations.len(), 1);
        assert_eq!(observations[0].from_system, "Jita");
        assert_eq!(observations[0].to_system, "Perimeter");
    }

    #[test]
    fn chat_tails_read_only_new_complete_lines() {
        let mut file = NamedTempFile::new().expect("temporary file");
        writeln!(file, "historical sensitive message").expect("write history");
        let mut state = TailState::existing(file.path()).expect("tail state");

        writeln!(file, "new sensitive message").expect("write new line");
        let lines = state.read_complete_lines(file.path()).expect("read lines");

        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0].0, "new sensitive message");
        assert_eq!(lines[0].1.len(), 64);
    }
}
