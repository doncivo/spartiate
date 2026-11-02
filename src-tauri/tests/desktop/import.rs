//! Import neutralisé jusqu'à SPA-005 (D-64) : `import_open_file` répond `unsupported`, sans boîte système ni lecture de fichier.

use spartiate_lib::import::{import_open_file, unsupported};

#[test]
fn import_is_unsupported_until_spa_005() {
    assert_eq!(unsupported().code, "unsupported");
    let answer = tauri::async_runtime::block_on(import_open_file());
    assert_eq!(answer.expect_err("refus").code, "unsupported");
}

#[test]
fn import_module_no_longer_reads_files_or_opens_dialogs() {
    let source = include_str!("../../src/import.rs");
    for gone in [
        "DialogExt",
        "read_import_file",
        "IMPORT_EXTENSIONS",
        "File::open",
    ] {
        assert!(!source.contains(gone), "{gone}");
    }
}
