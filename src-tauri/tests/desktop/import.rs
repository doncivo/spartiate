//! SPA-005 : lecture du seul fichier choisi (plafond de taille, type zip, disque local, fichier ordinaire).

use spartiate_lib::import::{
    display_name, has_import_extension, read_import_file, IMPORT_EXTENSIONS, MAX_IMPORT_BYTES,
};
use std::fs;
use std::path::Path;

fn scratch() -> tempfile::TempDir {
    tempfile::tempdir_in(env!("CARGO_TARGET_TMPDIR")).unwrap()
}

#[test]
fn spa005_limit_is_two_megabytes_like_the_typescript_side() {
    assert_eq!(MAX_IMPORT_BYTES, 2 * 1024 * 1024);
    assert_eq!(IMPORT_EXTENSIONS, ["zip"]);
}

#[test]
fn spa005_extension_is_case_insensitive_and_limited_to_zip_archives() {
    for ok in [
        "C:\\a\\spartiate-export-2026-11-04.zip",
        "C:\\a\\EXPORT.ZIP",
    ] {
        assert!(has_import_extension(Path::new(ok)), "{ok}");
    }
    for bad in [
        "C:\\a\\x.exe",
        "C:\\a\\x.zip.exe",
        "C:\\a\\x",
        "C:\\a\\x.db",
        "C:\\a\\x.csv",
        "C:\\a\\x.json",
    ] {
        assert!(!has_import_extension(Path::new(bad)), "{bad}");
    }
    assert_eq!(
        display_name(Path::new(
            "C:\\Users\\Ali\\Documents\\spartiate-export-2026-11-04.zip"
        )),
        "spartiate-export-2026-11-04.zip"
    );
}

#[test]
fn spa005_reads_the_chosen_file_exactly_including_binary_bytes() {
    let dir = scratch();
    let path = dir.path().join("export.zip");
    let content: Vec<u8> = vec![0x50, 0x4b, 0x03, 0x04, 0xff, 0x00, 0xe9, 0x0d, 0x0a];
    fs::write(&path, &content).unwrap();
    assert_eq!(read_import_file(&path, MAX_IMPORT_BYTES).unwrap(), content);
}

#[test]
fn spa005_a_file_over_the_limit_is_refused_without_being_read() {
    let dir = scratch();
    let path = dir.path().join("gros.zip");
    fs::write(&path, vec![b'a'; 1025]).unwrap();
    assert_eq!(read_import_file(&path, 1024).unwrap_err().code, "too-large");
    fs::write(&path, vec![b'a'; 1024]).unwrap();
    assert_eq!(
        read_import_file(&path, 1024).unwrap().len(),
        1024,
        "la limite est incluse"
    );
}

#[test]
fn spa005_other_types_directories_and_missing_files_are_refused() {
    let dir = scratch();
    let exe = dir.path().join("x.exe");
    fs::write(&exe, b"MZ").unwrap();
    assert_eq!(read_import_file(&exe, 1024).unwrap_err().code, "bad-type");
    let folder = dir.path().join("dossier.zip");
    fs::create_dir(&folder).unwrap();
    let error = read_import_file(&folder, 1024).unwrap_err();
    assert!(
        ["not-a-file", "unreadable"].contains(&error.code),
        "un dossier n'est jamais lu : {}",
        error.code
    );
    assert_eq!(
        read_import_file(&dir.path().join("absent.zip"), 1024)
            .unwrap_err()
            .code,
        "unreadable"
    );
}

#[test]
fn spa005_network_and_relative_paths_are_refused_before_any_access() {
    for path in [
        "\\\\serveur\\partage\\x.zip",
        "\\\\?\\UNC\\serveur\\partage\\x.zip",
        "\\\\.\\C:\\x.zip",
        "x.zip",
        "/srv/x.zip",
    ] {
        assert_eq!(
            read_import_file(Path::new(path), 1024).unwrap_err().code,
            "not-local",
            "{path}"
        );
    }
}
