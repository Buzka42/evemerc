use std::sync::LazyLock;

use chrono::{NaiveDateTime, SecondsFormat};
use regex::Regex;
use serde::Serialize;

const TIMESTAMP_PATTERN: &str = r"\[\s*(?<timestamp>\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2})\s*\]";

static JUMP_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(&format!(
        r"^{TIMESTAMP_PATTERN}\s*\([^)]+\)\s*Jumping from (?<from>.+?) to (?<to>.+?)\s*$"
    ))
    .expect("jump pattern must compile")
});

/// Matches `Undocking from <station> to <system> solar system.` - the only reliable
/// system-confirming gamelog line found in a real, sanitized gamelog sample. There is no
/// equivalent "docked at" or "warp started" line in the Gamelogs channel.
static LOCATION_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(&format!(
        r"^{TIMESTAMP_PATTERN}\s*\(None\)\s*Undocking from .+? to (?<system>.+?) solar system\.\s*$"
    ))
    .expect("location pattern must compile")
});

static COMBAT_MISS_INCOMING_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(&format!(
        r"^{TIMESTAMP_PATTERN}\s*\(combat\)\s*(?<attacker>.+?) misses you completely\s*$"
    ))
    .expect("incoming miss pattern must compile")
});

static COMBAT_MISS_OUTGOING_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(&format!(
        r"^{TIMESTAMP_PATTERN}\s*\(combat\)\s*Your (?:group of )?(?<weapon>.+?) misses (?<target>.+?) completely - .+$"
    ))
    .expect("outgoing miss pattern must compile")
});

const HIT_QUALITY: &str = r"(?<quality>Glances Off|Grazes|Hits|Penetrates|Smashes|Wrecks)";

static COMBAT_HIT_INCOMING_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(&format!(
        r"^{TIMESTAMP_PATTERN}\s*\(combat\)\s*<color=0xffcc0000><b>(?<damage>\d+)</b>\s*<color=0x77ffffff><font size=10>from</font>\s*<b><color=0xffffffff>(?<counterpart>[^<]+)</b><font size=10><color=0x77ffffff>\s*-\s*(?:(?<weapon>.+?)\s*-\s*)?{HIT_QUALITY}\s*$"
    ))
    .expect("incoming hit pattern must compile")
});

static COMBAT_HIT_OUTGOING_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(&format!(
        r"^{TIMESTAMP_PATTERN}\s*\(combat\)\s*<color=0xff00ffff><b>(?<damage>\d+)</b>\s*<color=0x77ffffff><font size=10>to</font>\s*<b><color=0xffffffff>(?<counterpart>[^<]+)</b><font size=10><color=0x77ffffff>\s*-\s*(?:(?<weapon>.+?)\s*-\s*)?{HIT_QUALITY}\s*$"
    ))
    .expect("outgoing hit pattern must compile")
});

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum EveLogObservationKind {
    JumpStarted,
    LocationConfirmed,
    CombatHit,
    CombatMiss,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CombatDirection {
    Incoming,
    Outgoing,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EveLogObservation {
    pub kind: EveLogObservationKind,
    pub observed_at: String,
    pub character_id: Option<u64>,
    pub source_event_id: String,
    // jump_started only.
    pub from_system: Option<String>,
    pub to_system: Option<String>,
    // location_confirmed only.
    pub system: Option<String>,
    // combat_hit / combat_miss only. `counterpart` is the attacker on an incoming event, the
    // target on an outgoing one - which one depends on `direction`, not on the field name.
    pub direction: Option<CombatDirection>,
    pub counterpart: Option<String>,
    pub weapon: Option<String>,
    pub damage: Option<i64>,
    pub hit_quality: Option<String>,
}

fn empty(
    kind: EveLogObservationKind,
    observed_at: String,
    character_id: Option<u64>,
    source_event_id: String,
) -> EveLogObservation {
    EveLogObservation {
        kind,
        observed_at,
        character_id,
        source_event_id,
        from_system: None,
        to_system: None,
        system: None,
        direction: None,
        counterpart: None,
        weapon: None,
        damage: None,
        hit_quality: None,
    }
}

fn parse_timestamp(raw: &str) -> Option<String> {
    Some(
        NaiveDateTime::parse_from_str(raw, "%Y.%m.%d %H:%M:%S")
            .ok()?
            .and_utc()
            .to_rfc3339_opts(SecondsFormat::Millis, true),
    )
}

pub fn parse_line(
    line: &str,
    character_id: Option<u64>,
    source_event_id: String,
) -> Option<EveLogObservation> {
    let normalized = line.trim_start_matches('\u{feff}');

    if let Some(captures) = JUMP_PATTERN.captures(normalized) {
        let observed_at = parse_timestamp(&captures["timestamp"])?;
        let mut observation = empty(
            EveLogObservationKind::JumpStarted,
            observed_at,
            character_id,
            source_event_id,
        );
        observation.from_system = Some(captures["from"].trim().to_owned());
        observation.to_system = Some(captures["to"].trim().to_owned());
        return Some(observation);
    }

    if let Some(captures) = LOCATION_PATTERN.captures(normalized) {
        let observed_at = parse_timestamp(&captures["timestamp"])?;
        let mut observation = empty(
            EveLogObservationKind::LocationConfirmed,
            observed_at,
            character_id,
            source_event_id,
        );
        observation.system = Some(captures["system"].trim().to_owned());
        return Some(observation);
    }

    if let Some(captures) = COMBAT_MISS_INCOMING_PATTERN.captures(normalized) {
        let observed_at = parse_timestamp(&captures["timestamp"])?;
        let mut observation = empty(
            EveLogObservationKind::CombatMiss,
            observed_at,
            character_id,
            source_event_id,
        );
        observation.direction = Some(CombatDirection::Incoming);
        observation.counterpart = Some(captures["attacker"].trim().to_owned());
        return Some(observation);
    }

    if let Some(captures) = COMBAT_MISS_OUTGOING_PATTERN.captures(normalized) {
        let observed_at = parse_timestamp(&captures["timestamp"])?;
        let mut observation = empty(
            EveLogObservationKind::CombatMiss,
            observed_at,
            character_id,
            source_event_id,
        );
        observation.direction = Some(CombatDirection::Outgoing);
        observation.counterpart = Some(captures["target"].trim().to_owned());
        observation.weapon = Some(captures["weapon"].trim().to_owned());
        return Some(observation);
    }

    if let Some(captures) = COMBAT_HIT_INCOMING_PATTERN.captures(normalized) {
        return combat_hit(
            &captures,
            CombatDirection::Incoming,
            character_id,
            source_event_id,
        );
    }

    if let Some(captures) = COMBAT_HIT_OUTGOING_PATTERN.captures(normalized) {
        return combat_hit(
            &captures,
            CombatDirection::Outgoing,
            character_id,
            source_event_id,
        );
    }

    None
}

fn combat_hit(
    captures: &regex::Captures,
    direction: CombatDirection,
    character_id: Option<u64>,
    source_event_id: String,
) -> Option<EveLogObservation> {
    let observed_at = parse_timestamp(&captures["timestamp"])?;
    let mut observation = empty(
        EveLogObservationKind::CombatHit,
        observed_at,
        character_id,
        source_event_id,
    );
    observation.direction = Some(direction);
    observation.counterpart = Some(captures["counterpart"].trim().to_owned());
    observation.weapon = captures
        .name("weapon")
        .map(|weapon| weapon.as_str().trim().to_owned());
    observation.damage = captures["damage"].parse::<i64>().ok();
    observation.hit_quality = Some(captures["quality"].trim().to_owned());
    Some(observation)
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
        assert_eq!(observation.from_system.as_deref(), Some("Jita"));
        assert_eq!(observation.to_system.as_deref(), Some("Perimeter"));
        assert_eq!(observation.character_id, Some(90_000_001));
    }

    #[test]
    fn parses_an_undocking_line_as_a_location_confirmation() {
        let observation = parse_line(
            "[ 2026.04.22 16:25:02 ] (None) Undocking from Hek VIII - Moon 12 - Boundless Creation Factory to Hek solar system.",
            None,
            "event-id".to_owned(),
        )
        .expect("undocking should parse");

        assert_eq!(observation.kind, EveLogObservationKind::LocationConfirmed);
        assert_eq!(observation.system.as_deref(), Some("Hek"));
    }

    #[test]
    fn parses_an_incoming_miss() {
        let observation = parse_line(
            "[ 2026.04.22 12:43:28 ] (combat) Arch Gistum Marauder misses you completely",
            None,
            "event-id".to_owned(),
        )
        .expect("incoming miss should parse");

        assert_eq!(observation.kind, EveLogObservationKind::CombatMiss);
        assert_eq!(observation.direction, Some(CombatDirection::Incoming));
        assert_eq!(observation.counterpart.as_deref(), Some("Arch Gistum Marauder"));
    }

    #[test]
    fn parses_an_outgoing_miss_with_a_weapon_group() {
        let observation = parse_line(
            "[ 2026.04.22 16:00:32 ] (combat) Your group of 425mm AutoCannon II misses Some Rival completely - 425mm AutoCannon II",
            None,
            "event-id".to_owned(),
        )
        .expect("outgoing miss should parse");

        assert_eq!(observation.kind, EveLogObservationKind::CombatMiss);
        assert_eq!(observation.direction, Some(CombatDirection::Outgoing));
        assert_eq!(observation.counterpart.as_deref(), Some("Some Rival"));
        assert_eq!(observation.weapon.as_deref(), Some("425mm AutoCannon II"));
    }

    #[test]
    fn parses_an_outgoing_miss_from_a_drone_without_the_group_prefix() {
        let observation = parse_line(
            "[ 2026.04.22 19:14:45 ] (combat) Your Warrior II misses Some Target completely - Warrior II",
            None,
            "event-id".to_owned(),
        )
        .expect("drone miss should parse");

        assert_eq!(observation.counterpart.as_deref(), Some("Some Target"));
        assert_eq!(observation.weapon.as_deref(), Some("Warrior II"));
    }

    #[test]
    fn parses_an_incoming_hit_with_no_weapon_name() {
        let observation = parse_line(
            "[ 2026.04.22 12:44:45 ] (combat) <color=0xffcc0000><b>55</b> <color=0x77ffffff><font size=10>from</font> <b><color=0xffffffff>Gistatis Legionnaire</b><font size=10><color=0x77ffffff> - Smashes",
            None,
            "event-id".to_owned(),
        )
        .expect("incoming hit should parse");

        assert_eq!(observation.kind, EveLogObservationKind::CombatHit);
        assert_eq!(observation.direction, Some(CombatDirection::Incoming));
        assert_eq!(observation.counterpart.as_deref(), Some("Gistatis Legionnaire"));
        assert_eq!(observation.weapon, None);
        assert_eq!(observation.damage, Some(55));
        assert_eq!(observation.hit_quality.as_deref(), Some("Smashes"));
    }

    #[test]
    fn parses_an_incoming_hit_with_a_weapon_name() {
        let observation = parse_line(
            "[ 2026.04.22 12:43:33 ] (combat) <color=0xffcc0000><b>67</b> <color=0x77ffffff><font size=10>from</font> <b><color=0xffffffff>Arch Gistum Marauder</b><font size=10><color=0x77ffffff> - Nova Heavy Missile - Hits",
            None,
            "event-id".to_owned(),
        )
        .expect("incoming hit with weapon should parse");

        assert_eq!(observation.counterpart.as_deref(), Some("Arch Gistum Marauder"));
        assert_eq!(observation.weapon.as_deref(), Some("Nova Heavy Missile"));
        assert_eq!(observation.damage, Some(67));
        assert_eq!(observation.hit_quality.as_deref(), Some("Hits"));
    }

    #[test]
    fn parses_an_outgoing_hit_against_a_named_target_with_corp_and_ship_tags() {
        let observation = parse_line(
            "[ 2026.04.22 16:00:15 ] (combat) <color=0xff00ffff><b>764</b> <color=0x77ffffff><font size=10>to</font> <b><color=0xffffffff>Some Target[CORP](Covetor)</b><font size=10><color=0x77ffffff> - 425mm AutoCannon II - Hits",
            None,
            "event-id".to_owned(),
        )
        .expect("outgoing hit should parse");

        assert_eq!(observation.kind, EveLogObservationKind::CombatHit);
        assert_eq!(observation.direction, Some(CombatDirection::Outgoing));
        assert_eq!(observation.counterpart.as_deref(), Some("Some Target[CORP](Covetor)"));
        assert_eq!(observation.weapon.as_deref(), Some("425mm AutoCannon II"));
        assert_eq!(observation.damage, Some(764));
        assert_eq!(observation.hit_quality.as_deref(), Some("Hits"));
    }

    #[test]
    fn ignores_unknown_or_non_location_templates() {
        assert!(parse_line(
            "[ 2026.07.12 19:41:32 ] (notify) You cannot do that while warping.",
            Some(90_000_001),
            "event-id".to_owned(),
        )
        .is_none());
    }
}
