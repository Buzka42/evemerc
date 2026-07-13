use std::sync::LazyLock;

use chrono::{NaiveDateTime, SecondsFormat};
use regex::Regex;
use serde::Serialize;

static JUMP_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"^\[\s*(?<timestamp>\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2})\s*\]\s*\([^)]+\)\s*Jumping from (?<from>.+?) to (?<to>.+?)\s*$",
    )
    .expect("jump pattern must compile")
});

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum EveLogObservationKind {
    JumpStarted,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EveLogObservation {
    pub kind: EveLogObservationKind,
    pub observed_at: String,
    pub character_id: Option<u64>,
    pub from_system: String,
    pub to_system: String,
    pub source_event_id: String,
}

pub fn parse_line(
    line: &str,
    character_id: Option<u64>,
    source_event_id: String,
) -> Option<EveLogObservation> {
    let normalized = line.trim_start_matches('\u{feff}');
    let captures = JUMP_PATTERN.captures(normalized)?;
    let timestamp = NaiveDateTime::parse_from_str(&captures["timestamp"], "%Y.%m.%d %H:%M:%S")
        .ok()?
        .and_utc()
        .to_rfc3339_opts(SecondsFormat::Millis, true);

    Some(EveLogObservation {
        kind: EveLogObservationKind::JumpStarted,
        observed_at: timestamp,
        character_id,
        from_system: captures["from"].trim().to_owned(),
        to_system: captures["to"].trim().to_owned(),
        source_event_id,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_an_english_jump_notification_without_exposing_the_raw_line() {
        let observation = parse_line(
            "\u{feff}[ 2026.07.12 19:41:32 ] (None) Jumping from Jita to Perimeter",
            Some(90_000_001),
            "event-id".to_owned(),
        )
        .expect("jump should parse");

        assert_eq!(observation.kind, EveLogObservationKind::JumpStarted);
        assert_eq!(observation.observed_at, "2026-07-12T19:41:32.000Z");
        assert_eq!(observation.from_system, "Jita");
        assert_eq!(observation.to_system, "Perimeter");
        assert_eq!(observation.character_id, Some(90_000_001));
    }

    #[test]
    fn ignores_unknown_or_non_location_templates() {
        assert!(parse_line(
            "[ 2026.07.12 19:41:32 ] (combat) Your weapon hits a target",
            Some(90_000_001),
            "event-id".to_owned(),
        )
        .is_none());
    }
}
