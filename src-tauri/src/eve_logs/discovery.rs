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

fn is_digits_of_len(segment: &str, len: usize) -> bool {
    segment.len() == len && segment.chars().all(|character| character.is_ascii_digit())
}

/// Extracts the chat channel name from a Chatlogs filename (e.g.
/// `gem.imperium_20260701_125509_1129337206.txt` -> `gem.imperium`). Channel names can contain
/// underscores themselves (e.g. `3X_Scum_Poly`), so this strips the trailing
/// `_<date>_<time>[_<characterId>]` suffix (matched by digit-length, not split position) rather
/// than splitting on the first underscore.
pub fn channel_name_from_path(path: &Path) -> Option<String> {
    let stem = path.file_stem()?.to_str()?;
    let mut segments = stem.split('_').collect::<Vec<_>>();

    if segments
        .last()
        .is_some_and(|segment| segment.chars().all(|c| c.is_ascii_digit()) && !is_digits_of_len(segment, 6) && !is_digits_of_len(segment, 8))
    {
        segments.pop();
    }

    if !segments.last().is_some_and(|segment| is_digits_of_len(segment, 6)) {
        return None;
    }
    segments.pop();

    if !segments.last().is_some_and(|segment| is_digits_of_len(segment, 8)) {
        return None;
    }
    segments.pop();

    if segments.is_empty() {
        return None;
    }

    Some(segments.join("_"))
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

    #[test]
    fn extracts_a_simple_channel_name() {
        let path = Path::new("gem.imperium_20260701_125509_1129337206.txt");
        assert_eq!(channel_name_from_path(path), Some("gem.imperium".to_owned()));
    }

    #[test]
    fn keeps_underscores_that_are_part_of_the_channel_name_itself() {
        let path = Path::new("3X_Scum_Poly_20260422_124245_2114563455.txt");
        assert_eq!(channel_name_from_path(path), Some("3X_Scum_Poly".to_owned()));
    }

    #[test]
    fn handles_a_channel_log_with_no_character_id_suffix() {
        let path = Path::new("Fleet_20260422_190852.txt");
        assert_eq!(channel_name_from_path(path), Some("Fleet".to_owned()));
    }

    #[test]
    fn returns_none_for_a_filename_that_does_not_look_like_a_chatlog() {
        assert_eq!(channel_name_from_path(Path::new("not-a-chatlog.txt")), None);
    }
}
