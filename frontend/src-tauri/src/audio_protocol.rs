use percent_encoding::percent_decode_str;
use std::{
    fs::File,
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
};
use tauri::{
    http::{
        header::{
            ACCEPT_RANGES, ACCESS_CONTROL_ALLOW_ORIGIN, CONTENT_LENGTH, CONTENT_RANGE, CONTENT_TYPE,
        },
        Method, Request, Response, StatusCode,
    },
    AppHandle, Manager, Runtime,
};

// Keep range responses bounded because custom-protocol bodies cross the webview IPC boundary.
// Eight MiB covers many hours of our front-loaded MP4 sample metadata. If recordings outgrow
// this ceiling, replace the custom protocol with a loopback HTTP stream instead of raising it.
const MAX_RANGE_LEN: u64 = 8 * 1024 * 1024;

pub fn response<R: Runtime>(app: &AppHandle<R>, request: Request<Vec<u8>>) -> Response<Vec<u8>> {
    let result = request_path(&request).and_then(|path| {
        if !app.asset_protocol_scope().is_allowed(&path) {
            return Err(StatusCode::FORBIDDEN);
        }
        file_response(&path, &request)
    });

    result.unwrap_or_else(error_response)
}

fn request_path(request: &Request<Vec<u8>>) -> Result<PathBuf, StatusCode> {
    let encoded = request
        .uri()
        .path()
        .strip_prefix('/')
        .ok_or(StatusCode::BAD_REQUEST)?;
    let decoded = percent_decode_str(encoded)
        .decode_utf8()
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    Ok(PathBuf::from(decoded.as_ref()))
}

fn file_response(path: &Path, request: &Request<Vec<u8>>) -> Result<Response<Vec<u8>>, StatusCode> {
    let mut file = File::open(path).map_err(|error| match error.kind() {
        std::io::ErrorKind::NotFound => StatusCode::NOT_FOUND,
        std::io::ErrorKind::PermissionDenied => StatusCode::FORBIDDEN,
        _ => StatusCode::INTERNAL_SERVER_ERROR,
    })?;
    let len = file
        .metadata()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .len();
    let mime = audio_mime(path);

    if request.method() == Method::HEAD {
        return Response::builder()
            .header(CONTENT_TYPE, mime)
            .header(CONTENT_LENGTH, len)
            .header(ACCEPT_RANGES, "bytes")
            .header(ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .body(Vec::new())
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR);
    }

    if let Some(value) = request.headers().get("range") {
        let value = value.to_str().map_err(|_| StatusCode::BAD_REQUEST)?;
        let (start, requested_end) = parse_range(value, len)?;
        let end = requested_end.min(start.saturating_add(MAX_RANGE_LEN - 1));
        let count = end - start + 1;
        let mut bytes = Vec::with_capacity(count as usize);
        file.seek(SeekFrom::Start(start))
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        file.take(count)
            .read_to_end(&mut bytes)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        return Response::builder()
            .status(StatusCode::PARTIAL_CONTENT)
            .header(CONTENT_TYPE, mime)
            .header(CONTENT_LENGTH, bytes.len())
            .header(CONTENT_RANGE, format!("bytes {start}-{end}/{len}"))
            .header(ACCEPT_RANGES, "bytes")
            .header(ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .body(bytes)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR);
    }

    let mut bytes = Vec::with_capacity(len as usize);
    file.read_to_end(&mut bytes)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Response::builder()
        .header(CONTENT_TYPE, mime)
        .header(CONTENT_LENGTH, len)
        .header(ACCEPT_RANGES, "bytes")
        .header(ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(bytes)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

fn parse_range(value: &str, len: u64) -> Result<(u64, u64), StatusCode> {
    let range = value
        .strip_prefix("bytes=")
        .filter(|value| !value.contains(','))
        .ok_or(StatusCode::RANGE_NOT_SATISFIABLE)?;
    let (start, end) = range
        .split_once('-')
        .ok_or(StatusCode::RANGE_NOT_SATISFIABLE)?;

    let (start, end) = if start.is_empty() {
        let suffix = end
            .parse::<u64>()
            .map_err(|_| StatusCode::RANGE_NOT_SATISFIABLE)?
            .min(len);
        (len.saturating_sub(suffix), len.saturating_sub(1))
    } else {
        let start = start
            .parse::<u64>()
            .map_err(|_| StatusCode::RANGE_NOT_SATISFIABLE)?;
        let end = if end.is_empty() {
            len.saturating_sub(1)
        } else {
            end.parse::<u64>()
                .map_err(|_| StatusCode::RANGE_NOT_SATISFIABLE)?
                .min(len.saturating_sub(1))
        };
        (start, end)
    };

    if len == 0 || start >= len || end < start {
        Err(StatusCode::RANGE_NOT_SATISFIABLE)
    } else {
        Ok((start, end))
    }
}

fn audio_mime(path: &Path) -> &'static str {
    match path.extension().and_then(|value| value.to_str()) {
        Some(ext) if ext.eq_ignore_ascii_case("mp4") || ext.eq_ignore_ascii_case("m4a") => {
            "audio/mp4"
        }
        Some(ext) if ext.eq_ignore_ascii_case("aac") => "audio/aac",
        Some(ext) if ext.eq_ignore_ascii_case("mp3") => "audio/mpeg",
        Some(ext) if ext.eq_ignore_ascii_case("wav") => "audio/wav",
        Some(ext) if ext.eq_ignore_ascii_case("flac") => "audio/flac",
        Some(ext) if ext.eq_ignore_ascii_case("ogg") => "audio/ogg",
        Some(ext) if ext.eq_ignore_ascii_case("webm") => "audio/webm",
        _ => "application/octet-stream",
    }
}

fn error_response(status: StatusCode) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(Vec::new())
        .expect("static error response must be valid")
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::http::header::RANGE;

    #[test]
    fn initial_metadata_range_can_exceed_tauri_asset_protocol_limit() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("long-recording.mp4");
        let metadata_len = 1_200_000usize;
        std::fs::write(&path, vec![0_u8; metadata_len]).unwrap();
        let request = Request::builder()
            .header(RANGE, format!("bytes=0-{}", metadata_len - 1))
            .body(Vec::new())
            .unwrap();

        let response = file_response(&path, &request).unwrap();

        assert_eq!(response.status(), StatusCode::PARTIAL_CONTENT);
        assert_eq!(response.body().len(), metadata_len);
        assert_eq!(
            response.headers()[CONTENT_RANGE],
            format!("bytes 0-{}/{metadata_len}", metadata_len - 1)
        );
    }

    #[test]
    fn rejects_multiple_ranges() {
        assert_eq!(
            parse_range("bytes=0-1,4-5", 10),
            Err(StatusCode::RANGE_NOT_SATISFIABLE)
        );
    }

    #[test]
    fn parses_suffix_range() {
        assert_eq!(parse_range("bytes=-4", 10), Ok((6, 9)));
    }

    #[test]
    fn decodes_the_absolute_path_encoded_by_convert_file_src() {
        let request = Request::builder()
            .uri("meetily-audio://localhost/%2FUsers%2Fsomeone%2FMeeting%20audio.mp4")
            .body(Vec::new())
            .unwrap();

        assert_eq!(
            request_path(&request).unwrap(),
            PathBuf::from("/Users/someone/Meeting audio.mp4")
        );
    }

    #[test]
    #[ignore = "requires TEST_AUDIO_PATH to point to a long MP4 recording"]
    fn serves_complete_metadata_range_from_real_recording() {
        let path = PathBuf::from(
            std::env::var("TEST_AUDIO_PATH").expect("TEST_AUDIO_PATH must be provided"),
        );
        let mut file = File::open(&path).unwrap();
        let len = file.metadata().unwrap().len();
        let mut offset = 0_u64;
        let moov_end = loop {
            file.seek(SeekFrom::Start(offset)).unwrap();
            let mut header = [0_u8; 8];
            file.read_exact(&mut header).unwrap();
            let atom_len = u32::from_be_bytes(header[..4].try_into().unwrap()) as u64;
            assert!(atom_len >= 8, "invalid MP4 atom at offset {offset}");
            offset += atom_len;
            if &header[4..] == b"moov" {
                break offset;
            }
            assert!(offset < len, "recording has no moov atom");
        };
        assert!(
            moov_end > 1000 * 1024,
            "recording does not reproduce Tauri's range ceiling"
        );
        let request = Request::builder()
            .header(RANGE, format!("bytes=0-{}", moov_end - 1))
            .body(Vec::new())
            .unwrap();

        let response = file_response(&path, &request).unwrap();

        assert_eq!(response.body().len() as u64, moov_end);
    }
}
