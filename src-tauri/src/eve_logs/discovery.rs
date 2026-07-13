use std::fs;
use std::path::{Path, PathBuf};

pub fn default_logs_root() -> Option<PathBuf> {
    dirs::document_dir().map(|documents| documents.join("EVE").join("logs"))
}

pub fn validate_logs_root(root: &Path) -> Result<(), String> {
    if !root.is_dir() {
        return Err("The configured EVE logs root does not exist.".to_owned());
    }

    if !root.join("Gamelogs").is_dir() || !root.join("Chatlogs").is_dir() {
        return Err("The configured folder must contain Gamelogs and Chatlogs.".to_owned());
    }

    Ok(())
}

pub fn text_files(directory: &Path) -> Vec<PathBuf> {
    fs::read_dir(directory)
        .into_iter()
        .flatten()
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.is_file()
                && path
                    .extension()
                    .is_some_and(|extension| extension.eq_ignore_ascii_case("txt"))
        })
        .collect()
}

pub fn character_id_from_path(path: &Path) -> Option<u64> {
    let segments = path.file_stem()?.to_str()?.split('_').collect::<Vec<_>>();

    if segments.len() < 3 {
        return None;
    }

    segments.last()?.parse().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_character_id_from_eve_session_filename() {
        let path = Path::new("20260712_174129_2114563455.txt");
        assert_eq!(character_id_from_path(path), Some(2_114_563_455));
    }

    #[test]
    fn leaves_unidentified_sessions_unbound() {
        assert_eq!(
            character_id_from_path(Path::new("20260712_174108.txt")),
            None
        );
    }
}
