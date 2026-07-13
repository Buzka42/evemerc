#[derive(Clone, Copy, Debug)]
pub enum LogEncoding {
    Utf8,
    Utf16LittleEndian,
    Utf16BigEndian,
}

pub fn detect_encoding(prefix: &[u8]) -> LogEncoding {
    if prefix.starts_with(&[0xff, 0xfe]) {
        LogEncoding::Utf16LittleEndian
    } else if prefix.starts_with(&[0xfe, 0xff]) {
        LogEncoding::Utf16BigEndian
    } else {
        LogEncoding::Utf8
    }
}

pub fn decode_chunk(encoding: LogEncoding, pending_bytes: &mut Vec<u8>, bytes: &[u8]) -> String {
    pending_bytes.extend_from_slice(bytes);

    match encoding {
        LogEncoding::Utf8 => decode_utf8(pending_bytes),
        LogEncoding::Utf16LittleEndian => decode_utf16(pending_bytes, true),
        LogEncoding::Utf16BigEndian => decode_utf16(pending_bytes, false),
    }
}

fn decode_utf8(bytes: &mut Vec<u8>) -> String {
    match std::str::from_utf8(bytes) {
        Ok(value) => {
            let decoded = value.trim_start_matches('\u{feff}').to_owned();
            bytes.clear();
            decoded
        }
        Err(error) if error.error_len().is_none() => {
            let valid_up_to = error.valid_up_to();
            let decoded = String::from_utf8_lossy(&bytes[..valid_up_to]).into_owned();
            bytes.drain(..valid_up_to);
            decoded
        }
        Err(_) => {
            let decoded = String::from_utf8_lossy(bytes).into_owned();
            bytes.clear();
            decoded
        }
    }
}

fn decode_utf16(bytes: &mut Vec<u8>, little_endian: bool) -> String {
    let complete_length = bytes.len() - (bytes.len() % 2);
    let units = bytes[..complete_length]
        .chunks_exact(2)
        .map(|pair| {
            if little_endian {
                u16::from_le_bytes([pair[0], pair[1]])
            } else {
                u16::from_be_bytes([pair[0], pair[1]])
            }
        })
        .filter(|unit| *unit != 0xfeff)
        .collect::<Vec<_>>();

    bytes.drain(..complete_length);
    String::from_utf16_lossy(&units)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preserves_an_incomplete_utf8_character_between_chunks() {
        let source = "jump →".as_bytes();
        let mut pending = Vec::new();
        let first = decode_chunk(LogEncoding::Utf8, &mut pending, &source[..source.len() - 1]);
        let second = decode_chunk(LogEncoding::Utf8, &mut pending, &source[source.len() - 1..]);

        assert_eq!(format!("{first}{second}"), "jump →");
    }

    #[test]
    fn decodes_utf16_little_endian_with_a_split_code_unit() {
        let bytes = "Jump"
            .encode_utf16()
            .flat_map(u16::to_le_bytes)
            .collect::<Vec<_>>();
        let mut pending = Vec::new();
        let first = decode_chunk(LogEncoding::Utf16LittleEndian, &mut pending, &bytes[..3]);
        let second = decode_chunk(LogEncoding::Utf16LittleEndian, &mut pending, &bytes[3..]);

        assert_eq!(format!("{first}{second}"), "Jump");
    }
}
