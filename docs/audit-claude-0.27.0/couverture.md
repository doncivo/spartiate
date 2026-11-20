# AUDIT-CLAUDE-0.27.0 — couverture

Généré par `preuves/couverture.mjs` depuis `git ls-tree v0.27.0` et `preuves/lectures.tsv` : ne pas éditer à la main.

- Fichiers de production et d'outillage du périmètre : **892**, lus : **88** (9.9 %).
- Hors relecture motivée (vendored, généré, binaire) : 179. Tests et supports (partie 11, hors décompte) : 597.
- Dossiers de Codex exclus (src/db, src/sync, src/domain/sync, src-tauri/src/sync) : 320.

| Fichier | Partie | Statut | Note |
|---|---|---|---|
| `.github/workflows/.gitkeep` | — | hors relecture | fichier vide |
| `.github/workflows/build-ios.yml` | 11 | à lire |  |
| `.github/workflows/build-windows.yml` | 11 | à lire |  |
| `.github/workflows/tests.yml` | 11 | à lire |  |
| `scripts/backup/export-migrations-fixture.mjs` | 11 | à lire |  |
| `scripts/ci/test-counts.mjs` | 11 | à lire |  |
| `scripts/cleanup/apply.mjs` | 11 | à lire |  |
| `scripts/cleanup/cssClasses.mjs` | 11 | à lire |  |
| `scripts/cleanup/cssTokens.mjs` | 11 | à lire |  |
| `scripts/cleanup/i18nDrop.mjs` | 11 | à lire |  |
| `scripts/cleanup/i18nKeys.mjs` | 11 | à lire |  |
| `scripts/cleanup/legacySyncInventory.mjs` | 11 | à lire |  |
| `scripts/cleanup/orphanCatalogs.mjs` | 11 | à lire |  |
| `scripts/cleanup/plan.mjs` | 11 | à lire |  |
| `scripts/cleanup/reachability.mjs` | 11 | à lire |  |
| `scripts/cleanup/restore-missing.mjs` | 11 | à lire |  |
| `scripts/cleanup/restore-tests.mjs` | 11 | à lire |  |
| `scripts/cleanup/symbols.mjs` | 11 | à lire |  |
| `scripts/content/build-ciqual.mjs` | 11 | à lire |  |
| `scripts/content/build-media.mjs` | 11 | à lire |  |
| `scripts/content/build-strength-standards.mjs` | 11 | à lire |  |
| `scripts/content/ciqual.mjs` | 11 | à lire |  |
| `scripts/content/media-map.json` | 11 | à lire |  |
| `scripts/content/png-reduce.mjs` | 11 | à lire |  |
| `scripts/content/set-strength-keys.mjs` | 11 | à lire |  |
| `scripts/content/validate-content.mjs` | 11 | à lire |  |
| `scripts/e2e-perf.mjs` | 11 | à lire |  |
| `scripts/ios/apply-entitlements.mjs` | 8b | à lire |  |
| `scripts/ios/apply-icons.mjs` | 8b | à lire |  |
| `scripts/ios/check-plist-contract.mjs` | 8b | à lire |  |
| `scripts/ios/check-source.mjs` | 8b | à lire |  |
| `scripts/ios/inject-live-activity.mjs` | 8b | à lire |  |
| `scripts/ios/make-source-json.mjs` | 8b | à lire |  |
| `scripts/ios/plist-contract.json` | 8b | à lire |  |
| `scripts/ios/plist.mjs` | 8b | à lire |  |
| `scripts/ios/prepare-a9.mjs` | 8b | à lire |  |
| `scripts/ios/source.template.json` | 8b | à lire |  |
| `scripts/make-ocr-fixtures.mjs` | 11 | à lire |  |
| `scripts/release/check-version.mjs` | 11 | à lire |  |
| `scripts/release/fixtures/prd-v6.3-changes.json` | 11 | à lire |  |
| `scripts/release/lib/agentsCheck.mjs` | 11 | à lire |  |
| `scripts/release/lib/docsPaths.mjs` | 11 | à lire |  |
| `scripts/release/lib/mentions.mjs` | 11 | à lire |  |
| `scripts/release/lib/prdSplit.mjs` | 11 | à lire |  |
| `scripts/release/licences-npm.mjs` | 11 | à lire |  |
| `scripts/release/make-latest-json.mjs` | 11 | à lire |  |
| `scripts/release/release-notes.mjs` | 11 | à lire |  |
| `scripts/release/rename.mjs` | 11 | à lire |  |
| `scripts/release/split-prd.mjs` | 11 | à lire |  |
| `scripts/release/verify-signature.mjs` | 11 | à lire |  |
| `scripts/smoke/build.mjs` | 11 | à lire |  |
| `src-tauri/Cargo.lock` | 8a | à lire |  |
| `src-tauri/Cargo.toml` | 8a | à lire |  |
| `src-tauri/Info.ios.plist` | 8b | à lire |  |
| `src-tauri/app-icon.png` | — | hors relecture | binaire, hors relecture |
| `src-tauri/build.rs` | 8a | à lire |  |
| `src-tauri/capabilities/backups-ios.json` | 8a | à lire |  |
| `src-tauri/capabilities/backups.json` | 8a | à lire |  |
| `src-tauri/capabilities/biometric-ios.json` | 8a | à lire |  |
| `src-tauri/capabilities/capture-ios.json` | 8a | à lire |  |
| `src-tauri/capabilities/default.json` | 8a | à lire |  |
| `src-tauri/capabilities/desktop.json` | 8a | à lire |  |
| `src-tauri/capabilities/export-ios.json` | 8a | à lire |  |
| `src-tauri/capabilities/export.json` | 8a | à lire |  |
| `src-tauri/capabilities/geolocation-ios.json` | 8a | à lire |  |
| `src-tauri/capabilities/haptics-ios.json` | 8a | à lire |  |
| `src-tauri/capabilities/health-files-ios.json` | 8a | à lire |  |
| `src-tauri/capabilities/healthkit-ios.json` | 8a | à lire |  |
| `src-tauri/capabilities/import.json` | 8a | à lire |  |
| `src-tauri/capabilities/live-activity-ios.json` | 8a | à lire |  |
| `src-tauri/capabilities/logs-ios.json` | 8a | à lire |  |
| `src-tauri/capabilities/logs.json` | 8a | à lire |  |
| `src-tauri/capabilities/notifications-ios.json` | 8a | à lire |  |
| `src-tauri/capabilities/ocr.json` | 8a | à lire |  |
| `src-tauri/capabilities/off.json` | 8a | à lire |  |
| `src-tauri/capabilities/privacy-shield-ios.json` | 8a | à lire |  |
| `src-tauri/capabilities/signing-ios.json` | 8a | à lire |  |
| `src-tauri/capabilities/sync-ios.json` | 8a | à lire |  |
| `src-tauri/capabilities/sync-pairing.json` | 8a | à lire |  |
| `src-tauri/capabilities/sync.json` | 8a | à lire |  |
| `src-tauri/icons/128x128.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/128x128@2x.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/32x32.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/64x64.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/Square107x107Logo.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/Square142x142Logo.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/Square150x150Logo.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/Square284x284Logo.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/Square30x30Logo.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/Square310x310Logo.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/Square44x44Logo.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/Square71x71Logo.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/Square89x89Logo.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/StoreLogo.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/icon.icns` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/icon.ico` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/icon.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/ios/AppIcon-20x20@1x.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/ios/AppIcon-20x20@2x-1.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/ios/AppIcon-20x20@2x.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/ios/AppIcon-20x20@3x.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/ios/AppIcon-29x29@1x.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/ios/AppIcon-29x29@2x-1.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/ios/AppIcon-29x29@2x.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/ios/AppIcon-29x29@3x.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/ios/AppIcon-40x40@1x.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/ios/AppIcon-40x40@2x-1.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/ios/AppIcon-40x40@2x.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/ios/AppIcon-40x40@3x.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/ios/AppIcon-512@2x.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/ios/AppIcon-60x60@2x.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/ios/AppIcon-60x60@3x.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/ios/AppIcon-76x76@1x.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/ios/AppIcon-76x76@2x.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/icons/ios/AppIcon-83.5x83.5@2x.png` | — | hors relecture | binaire (icône), hors relecture |
| `src-tauri/ios/LiveActivity/Info.plist` | 8b | à lire |  |
| `src-tauri/ios/LiveActivity/SpartiateLiveActivity.swift` | 8b | à lire |  |
| `src-tauri/ios/LiveActivity/SpartiateTimerAttributes.swift` | 8b | à lire |  |
| `src-tauri/ios/Spartiate.entitlements` | 8b | à lire |  |
| `src-tauri/permissions/autogenerated/app_settings_open.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/app_signing_info.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/backup_database_before_migration.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/backup_restore_marker_write.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/backup_set_aside_conflicts.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/backup_startup_status.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/check_backup.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/confirm_quit.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/daily_backup.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/db_diagnostics.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/export_save_file.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/health_files_read.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/healthkit_authorize.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/healthkit_body_mass_today.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/healthkit_status.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/healthkit_step_count_today.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/import_open_file.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/list_backups.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/live_activity_end.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/live_activity_start.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/live_activity_status.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/log_append.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/log_clear.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/log_read.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/ocr_recognize.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/ocr_status.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/off_product.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/off_search.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/restore_backup.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/reveal_backups_folder.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/reveal_exported_file.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/set_tray_labels.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/speech_listen.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/speech_request_permissions.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/speech_status.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/speech_stop.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/sync_abandon_orphan_epoch.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/sync_append_journal.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/sync_bind_device.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/sync_delete_own.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/sync_device_forget.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/sync_folder_choose.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/sync_folder_forget.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/sync_folder_info.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/sync_forgotten_delete.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/sync_key_create.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/sync_key_import.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/sync_key_status.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/sync_pairing_close.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/sync_pairing_open.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/sync_pairing_payload.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/sync_read_journal.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/sync_read_snapshot.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/sync_reset_key.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/sync_restore_marker_clear.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/sync_restore_marker_get.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/sync_scan.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/sync_snapshot_append.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/sync_snapshot_begin.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/sync_snapshot_commit.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/permissions/autogenerated/sync_write_state.toml` | — | hors relecture | généré par tauri-build, hors relecture : contenu dérivé des commandes relues en 8a |
| `src-tauri/plugins/README.md` | 8b | à lire |  |
| `src-tauri/plugins/files/.gitignore` | 8b | à lire |  |
| `src-tauri/plugins/files/Cargo.toml` | 8b | à lire |  |
| `src-tauri/plugins/files/build.rs` | 8b | à lire |  |
| `src-tauri/plugins/files/ios/Package.swift` | 8b | à lire |  |
| `src-tauri/plugins/files/ios/Sources/CtFilesPlugin.swift` | 8b | à lire |  |
| `src-tauri/plugins/files/src/lib.rs` | 8b | à lire |  |
| `src-tauri/plugins/folder-bookmark/.gitignore` | 8b | à lire |  |
| `src-tauri/plugins/folder-bookmark/Cargo.toml` | 8b | à lire |  |
| `src-tauri/plugins/folder-bookmark/build.rs` | 8b | à lire |  |
| `src-tauri/plugins/folder-bookmark/ios/Package.swift` | 8b | à lire |  |
| `src-tauri/plugins/folder-bookmark/ios/Sources/FolderBookmarkPlugin.swift` | 8b | à lire |  |
| `src-tauri/plugins/folder-bookmark/src/lib.rs` | 8b | à lire |  |
| `src-tauri/plugins/haptics/.gitignore` | 8b | à lire |  |
| `src-tauri/plugins/haptics/Cargo.toml` | 8b | à lire |  |
| `src-tauri/plugins/haptics/build.rs` | 8b | à lire |  |
| `src-tauri/plugins/haptics/ios/Package.swift` | 8b | à lire |  |
| `src-tauri/plugins/haptics/ios/Sources/HapticsPlugin.swift` | 8b | à lire |  |
| `src-tauri/plugins/haptics/src/lib.rs` | 8b | à lire |  |
| `src-tauri/plugins/healthkit/Cargo.toml` | 8b | à lire |  |
| `src-tauri/plugins/healthkit/build.rs` | 8b | à lire |  |
| `src-tauri/plugins/healthkit/ios/Package.swift` | 8b | à lire |  |
| `src-tauri/plugins/healthkit/ios/Sources/HealthKitPlugin.swift` | 8b | à lire |  |
| `src-tauri/plugins/healthkit/src/lib.rs` | 8b | à lire |  |
| `src-tauri/plugins/live-activity/Cargo.toml` | 8b | à lire |  |
| `src-tauri/plugins/live-activity/build.rs` | 8b | à lire |  |
| `src-tauri/plugins/live-activity/ios/Package.swift` | 8b | à lire |  |
| `src-tauri/plugins/live-activity/ios/Sources/LiveActivityPlugin.swift` | 8b | à lire |  |
| `src-tauri/plugins/live-activity/ios/Sources/SpartiateTimerAttributes.swift` | 8b | à lire |  |
| `src-tauri/plugins/live-activity/src/lib.rs` | 8b | à lire |  |
| `src-tauri/plugins/notification-actions/.gitignore` | 8b | à lire |  |
| `src-tauri/plugins/notification-actions/Cargo.toml` | 8b | à lire |  |
| `src-tauri/plugins/notification-actions/build.rs` | 8b | à lire |  |
| `src-tauri/plugins/notification-actions/ios/Package.swift` | 8b | à lire |  |
| `src-tauri/plugins/notification-actions/ios/Sources/NotificationActionsPlugin.swift` | 8b | à lire |  |
| `src-tauri/plugins/notification-actions/src/lib.rs` | 8b | à lire |  |
| `src-tauri/plugins/privacy-shield/.gitignore` | 8b | à lire |  |
| `src-tauri/plugins/privacy-shield/Cargo.toml` | 8b | à lire |  |
| `src-tauri/plugins/privacy-shield/build.rs` | 8b | à lire |  |
| `src-tauri/plugins/privacy-shield/ios/Package.swift` | 8b | à lire |  |
| `src-tauri/plugins/privacy-shield/ios/Sources/PrivacyShieldPlugin.swift` | 8b | à lire |  |
| `src-tauri/plugins/privacy-shield/src/lib.rs` | 8b | à lire |  |
| `src-tauri/plugins/speech/Cargo.toml` | 8b | à lire |  |
| `src-tauri/plugins/speech/build.rs` | 8b | à lire |  |
| `src-tauri/plugins/speech/ios/Package.swift` | 8b | à lire |  |
| `src-tauri/plugins/speech/ios/Sources/SpeechPlugin.swift` | 8b | à lire |  |
| `src-tauri/plugins/speech/src/lib.rs` | 8b | à lire |  |
| `src-tauri/plugins/vision/Cargo.toml` | 8b | à lire |  |
| `src-tauri/plugins/vision/build.rs` | 8b | à lire |  |
| `src-tauri/plugins/vision/ios/Package.swift` | 8b | à lire |  |
| `src-tauri/plugins/vision/ios/Sources/VisionPlugin.swift` | 8b | à lire |  |
| `src-tauri/plugins/vision/src/lib.rs` | 8b | à lire |  |
| `src-tauri/src/applog.rs` | 8a | à lire |  |
| `src-tauri/src/backup.rs` | 8a | à lire |  |
| `src-tauri/src/backup_triggers.rs` | 8a | à lire |  |
| `src-tauri/src/desktop.rs` | 8a | à lire |  |
| `src-tauri/src/export.rs` | 8a | à lire |  |
| `src-tauri/src/export_common.rs` | 8a | à lire |  |
| `src-tauri/src/export_ios.rs` | 8a | à lire |  |
| `src-tauri/src/healthkit.rs` | 8a | à lire |  |
| `src-tauri/src/import.rs` | 8a | à lire |  |
| `src-tauri/src/ios_setup.rs` | 8a | à lire |  |
| `src-tauri/src/lib.rs` | 8a | à lire |  |
| `src-tauri/src/live_activity.rs` | 8a | à lire |  |
| `src-tauri/src/main.rs` | 8a | à lire |  |
| `src-tauri/src/mobile_call.rs` | 8a | à lire |  |
| `src-tauri/src/ocr/mod.rs` | 8a | à lire |  |
| `src-tauri/src/ocr/vision.rs` | 8a | à lire |  |
| `src-tauri/src/ocr/win.rs` | 8a | à lire |  |
| `src-tauri/src/off.rs` | 8a | lu 2026-11-20 (relecteur journal) | lu pour la partie 5 (appel Open Food Facts) |
| `src-tauri/src/signing.rs` | 8a | à lire |  |
| `src-tauri/src/speech/ios.rs` | 8a | à lire |  |
| `src-tauri/src/speech/mod.rs` | 8a | à lire |  |
| `src-tauri/src/startup_gate.rs` | 8a | à lire |  |
| `src-tauri/src/vault.rs` | 8a | à lire |  |
| `src-tauri/src/vault_ios.rs` | 8a | à lire |  |
| `src-tauri/src/window_fit.rs` | 8a | à lire |  |
| `src-tauri/tauri.conf.json` | 8a | à lire |  |
| `src-tauri/tauri.smoke.conf.json` | 8a | à lire |  |
| `src-tauri/tauri.windows.conf.json` | 8a | à lire |  |
| `src-tauri/vendor/sqlx-sqlite/.cargo_vcs_info.json` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/Cargo.toml` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/Cargo.toml.orig` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/LICENSE-APACHE` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/LICENSE-MIT` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/PROVENANCE-SPARTIATE.md` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/any.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/arguments.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/column.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/connection/collation.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/connection/describe.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/connection/establish.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/connection/execute.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/connection/executor.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/connection/explain.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/connection/handle.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/connection/intmap.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/connection/mod.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/connection/preupdate_hook.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/connection/serialize.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/connection/worker.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/database.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/error.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/lib.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/logger.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/migrate.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/options/auto_vacuum.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/options/connect.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/options/journal_mode.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/options/locking_mode.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/options/mod.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/options/parse.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/options/synchronous.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/query_result.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/regexp.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/row.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/statement/handle.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/statement/mod.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/statement/unlock_notify.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/statement/virtual.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/testing/mod.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/transaction.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/type_checking.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/type_info.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/types/bool.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/types/bytes.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/types/chrono.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/types/float.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/types/int.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/types/json.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/types/mod.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/types/str.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/types/text.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/types/time.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/types/uint.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/types/uuid.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/sqlx-sqlite/src/value.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/tauri-plugin-sql/Cargo.toml` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/tauri-plugin-sql/LICENSE.spdx` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/tauri-plugin-sql/LICENSE_APACHE-2.0` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/tauri-plugin-sql/LICENSE_MIT` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/tauri-plugin-sql/README.md` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/tauri-plugin-sql/api-iife.js` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/tauri-plugin-sql/build.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/tauri-plugin-sql/permissions/autogenerated/commands/close.toml` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/tauri-plugin-sql/permissions/autogenerated/commands/execute.toml` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/tauri-plugin-sql/permissions/autogenerated/commands/load.toml` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/tauri-plugin-sql/permissions/autogenerated/commands/select.toml` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/tauri-plugin-sql/permissions/autogenerated/reference.md` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/tauri-plugin-sql/permissions/default.toml` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/tauri-plugin-sql/permissions/schemas/schema.json` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/tauri-plugin-sql/src/commands.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/tauri-plugin-sql/src/decode/mod.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/tauri-plugin-sql/src/decode/mysql.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/tauri-plugin-sql/src/decode/postgres.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/tauri-plugin-sql/src/decode/sqlite.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/tauri-plugin-sql/src/error.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/tauri-plugin-sql/src/guard.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/tauri-plugin-sql/src/guard_tests.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/tauri-plugin-sql/src/lib.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/vendor/tauri-plugin-sql/src/wrapper.rs` | — | hors relecture | vendored (plugin SQL et sqlx-sqlite), hors relecture : code tiers figé, garde propre au dépôt relue en 8a |
| `src-tauri/windows-test.manifest` | 8a | à lire |  |
| `src-tauri/windows/hooks.nsh` | 8a | à lire |  |
| `src/App.tsx` | 7c | à lire |  |
| `src/domain/appLock.ts` | 7c | à lire |  |
| `src/domain/appStatus.ts` | 7c | à lire |  |
| `src/domain/appUpdate.ts` | 7c | à lire |  |
| `src/domain/appleReminders.ts` | 7c | à lire |  |
| `src/domain/backupSchedule.ts` | 7c | à lire |  |
| `src/domain/bodyProfile.ts` | 4 | lu 2026-11-20 (relecteur Strength Score) |  |
| `src/domain/bodyProgress/index.ts` | 4 | lu 2026-11-20 (relecteur Strength Score) |  |
| `src/domain/bodyProgress/measurements.ts` | 4 | lu 2026-11-20 (relecteur Strength Score) |  |
| `src/domain/bodyProgress/photos.ts` | 4 | lu 2026-11-20 (relecteur Strength Score) |  |
| `src/domain/cardio/index.ts` | 4 | lu 2026-11-20 (relecteur Strength Score) |  |
| `src/domain/cardio/progress.ts` | 4 | lu 2026-11-20 (relecteur Strength Score) |  |
| `src/domain/cardio/session.ts` | 4 | lu 2026-11-20 (relecteur Strength Score) |  |
| `src/domain/cardio/track.ts` | 4 | lu 2026-11-20 (relecteur Strength Score) |  |
| `src/domain/clock.ts` | 7c | à lire |  |
| `src/domain/compareCodeUnits.ts` | 7c | à lire |  |
| `src/domain/csvImport.ts` | 7c | à lire |  |
| `src/domain/dataReset.ts` | 7c | à lire |  |
| `src/domain/dateInput.ts` | 7c | à lire |  |
| `src/domain/donePeriod.ts` | 7c | à lire |  |
| `src/domain/eventKinds.ts` | 7c | à lire |  |
| `src/domain/eventOccurrences.ts` | 7c | à lire |  |
| `src/domain/eventReminders.ts` | 7c | à lire |  |
| `src/domain/eventRules.ts` | 7c | à lire |  |
| `src/domain/eventTestKit.ts` | 7c | à lire |  |
| `src/domain/exportImport/archive.ts` | 7c | à lire |  |
| `src/domain/exportImport/fullExport.ts` | 7c | à lire |  |
| `src/domain/exportImport/plan.ts` | 7c | à lire |  |
| `src/domain/exportImport/sha256.ts` | 7c | à lire |  |
| `src/domain/exportImport/zip.ts` | 7c | à lire |  |
| `src/domain/focusSession.ts` | 7c | à lire |  |
| `src/domain/goalRules.ts` | 7c | à lire |  |
| `src/domain/health/bodyShortcutFiles.ts` | 6 | à lire |  |
| `src/domain/health/shortcutWeights.ts` | 6 | à lire |  |
| `src/domain/historyExport.ts` | 7c | à lire |  |
| `src/domain/hlc.ts` | 7c | à lire |  |
| `src/domain/id.ts` | 7c | à lire |  |
| `src/domain/itemFilter.ts` | 7c | à lire |  |
| `src/domain/localDate.ts` | 7c | à lire |  |
| `src/domain/model/checklist.ts` | 7c | à lire |  |
| `src/domain/model/event.ts` | 7c | à lire |  |
| `src/domain/model/externalEvent.ts` | 7c | à lire |  |
| `src/domain/model/focusSession.ts` | 7c | à lire |  |
| `src/domain/model/goal.ts` | 7c | à lire |  |
| `src/domain/model/holiday.ts` | 7c | à lire |  |
| `src/domain/model/icon.ts` | 7c | à lire |  |
| `src/domain/model/index.ts` | 7c | à lire |  |
| `src/domain/model/recurrence.ts` | 7c | à lire |  |
| `src/domain/model/reminder.ts` | 7c | à lire |  |
| `src/domain/model/routine.ts` | 7c | à lire |  |
| `src/domain/model/settings.ts` | 7c | à lire |  |
| `src/domain/model/space.ts` | 7c | à lire |  |
| `src/domain/model/task.ts` | 7c | à lire |  |
| `src/domain/notificationActions.ts` | 7c | à lire |  |
| `src/domain/notificationId.ts` | 7c | à lire |  |
| `src/domain/notificationInstant.ts` | 5 | lu 2026-11-20 (relecteur compléments) |  |
| `src/domain/notificationLedger.ts` | 7c | à lire |  |
| `src/domain/notificationPlan.ts` | 7c | à lire |  |
| `src/domain/notificationStatus.ts` | 7c | à lire |  |
| `src/domain/nutrition/barcode.ts` | 5 | lu 2026-11-20 (relecteur journal) |  |
| `src/domain/nutrition/checkIn.ts` | 5 | lu 2026-11-20 (relecteur cibles) |  |
| `src/domain/nutrition/ciqual.ts` | 5 | lu 2026-11-20 (relecteur journal) |  |
| `src/domain/nutrition/config.ts` | 5 | lu 2026-11-20 (relecteur cibles) |  |
| `src/domain/nutrition/coverage.ts` | 5 | lu 2026-11-20 (relecteur cibles) |  |
| `src/domain/nutrition/dayTotals.ts` | 5 | lu 2026-11-20 (relecteur journal) |  |
| `src/domain/nutrition/favorites.ts` | 5 | lu 2026-11-20 (relecteur journal) |  |
| `src/domain/nutrition/firstCheckIn.ts` | 5 | lu 2026-11-20 (relecteur cibles) |  |
| `src/domain/nutrition/food.ts` | 5 | lu 2026-11-20 (relecteur journal) |  |
| `src/domain/nutrition/foodSearch.ts` | 5 | lu 2026-11-20 (relecteur journal) |  |
| `src/domain/nutrition/index.ts` | 5 | lu 2026-11-20 (relecteur cibles) |  |
| `src/domain/nutrition/journal.ts` | 5 | lu 2026-11-20 (relecteur journal) |  |
| `src/domain/nutrition/mealEntry.ts` | 5 | lu 2026-11-20 (relecteur journal) |  |
| `src/domain/nutrition/offProduct.ts` | 5 | lu 2026-11-20 (relecteur journal) |  |
| `src/domain/nutrition/prefs.ts` | 5 | lu 2026-11-20 (relecteur cibles) |  |
| `src/domain/nutrition/recipe.ts` | 5 | lu 2026-11-20 (relecteur journal) |  |
| `src/domain/nutrition/recipeTypes.ts` | 5 | lu 2026-11-20 (relecteur journal) |  |
| `src/domain/nutrition/renphoDay.ts` | 5 | lu 2026-11-20 (relecteur cibles) |  |
| `src/domain/nutrition/restDay.ts` | 5 | lu 2026-11-20 (relecteur cibles) |  |
| `src/domain/nutrition/supplements.ts` | 5 | lu 2026-11-20 (relecteur compléments) |  |
| `src/domain/nutrition/targetRecord.ts` | 5 | lu 2026-11-20 (relecteur cibles) |  |
| `src/domain/nutrition/tdee.ts` | 5 | lu 2026-11-20 (relecteur cibles) |  |
| `src/domain/nutrition/trendLearning.ts` | 5 | lu 2026-11-20 (relecteur cibles) |  |
| `src/domain/nutrition/types.ts` | 5 | lu 2026-11-20 (relecteur cibles) |  |
| `src/domain/nutrition/weeklyRate.ts` | 5 | lu 2026-11-20 (relecteur cibles) |  |
| `src/domain/nutrition/weightTrend.ts` | 5 | lu 2026-11-20 (relecteur cibles) |  |
| `src/domain/occurrenceDedup.ts` | 7c | à lire |  |
| `src/domain/omitKey.ts` | 7c | à lire |  |
| `src/domain/onboarding/draft.ts` | 7c | à lire |  |
| `src/domain/onboarding/expenditure.ts` | 7c | à lire |  |
| `src/domain/onboarding/index.ts` | 7c | à lire |  |
| `src/domain/onboarding/review.ts` | 7c | à lire |  |
| `src/domain/onboarding/split.ts` | 7c | à lire |  |
| `src/domain/projectRules.ts` | 7c | à lire |  |
| `src/domain/quietHours.ts` | 7c | à lire |  |
| `src/domain/recap.ts` | 7c | à lire |  |
| `src/domain/recovery/baseline.ts` | 6 | à lire |  |
| `src/domain/recovery/bedtimeProposal.ts` | 6 | à lire |  |
| `src/domain/recovery/config.ts` | 6 | à lire |  |
| `src/domain/recovery/daySummary.ts` | 6 | à lire |  |
| `src/domain/recovery/exertion.ts` | 6 | à lire |  |
| `src/domain/recovery/factors.ts` | 6 | à lire |  |
| `src/domain/recovery/index.ts` | 6 | à lire |  |
| `src/domain/recovery/muscleRecovery.ts` | 6 | à lire |  |
| `src/domain/recovery/nights.ts` | 6 | à lire |  |
| `src/domain/recovery/notificationPrefs.ts` | 6 | à lire |  |
| `src/domain/recovery/recoveryScore.ts` | 6 | à lire |  |
| `src/domain/recovery/shortcutFiles.ts` | 6 | à lire |  |
| `src/domain/recovery/sleepNeed.ts` | 6 | à lire |  |
| `src/domain/recovery/types.ts` | 6 | à lire |  |
| `src/domain/recovery/unusualValues.ts` | 6 | à lire |  |
| `src/domain/recoveryNotificationPlan.ts` | 6 | à lire |  |
| `src/domain/recurrenceEdit.ts` | 7c | à lire |  |
| `src/domain/recurrenceNext.ts` | 7c | à lire |  |
| `src/domain/recurrenceRules.ts` | 7c | à lire |  |
| `src/domain/routineReport.ts` | 7c | à lire |  |
| `src/domain/routineSchedule.ts` | 7c | à lire |  |
| `src/domain/routineStreaks.ts` | 7c | à lire |  |
| `src/domain/routineTestKit.ts` | 7c | à lire |  |
| `src/domain/signingNotice.ts` | 7c | à lire |  |
| `src/domain/spaceRules.ts` | 7c | à lire |  |
| `src/domain/supplementNotificationActions.ts` | 5 | lu 2026-11-20 (relecteur compléments) |  |
| `src/domain/supplementNotificationPlan.ts` | 5 | lu 2026-11-20 (relecteur compléments) |  |
| `src/domain/syncBanners.ts` | 7c | à lire |  |
| `src/domain/syntheticTimer.ts` | 7c | à lire |  |
| `src/domain/taskPostpone.ts` | 7c | à lire |  |
| `src/domain/taskRules.ts` | 7c | à lire |  |
| `src/domain/taskSchedule.ts` | 7c | à lire |  |
| `src/domain/taskTrash.ts` | 7c | à lire |  |
| `src/domain/textEncoding.ts` | 7c | à lire |  |
| `src/domain/timeFormat.ts` | 7c | à lire |  |
| `src/domain/timeZone.ts` | 7c | à lire |  |
| `src/domain/todayList.ts` | 7c | à lire |  |
| `src/domain/training/bodyweight.ts` | 4 | lu 2026-11-20 (relecteur matériel) |  |
| `src/domain/training/circuit.ts` | 4 | lu 2026-11-20 (relecteur génération) |  |
| `src/domain/training/closure.ts` | 4 | lu 2026-11-20 (relecteur génération) |  |
| `src/domain/training/confidence.ts` | 4 | lu 2026-11-20 (relecteur prescription) |  |
| `src/domain/training/config.ts` | 4 | lu 2026-11-20 (relecteur prescription) |  |
| `src/domain/training/constraints.ts` | 4 | lu 2026-11-20 (relecteur prescription) |  |
| `src/domain/training/cycleWeek.ts` | 4 | lu 2026-11-20 (relecteur mésocycle) |  |
| `src/domain/training/decision.ts` | 4 | lu 2026-11-20 (relecteur prescription) |  |
| `src/domain/training/dumbbellPair.ts` | 4 | lu 2026-11-20 (relecteur matériel) |  |
| `src/domain/training/equipment.ts` | 4 | lu 2026-11-20 (relecteur matériel) |  |
| `src/domain/training/estimate1rm.ts` | 4 | lu 2026-11-20 (relecteur prescription) |  |
| `src/domain/training/exerciseCatalog.ts` | 4 | lu 2026-11-20 (relecteur matériel) |  |
| `src/domain/training/exerciseResolution.ts` | 4 | lu 2026-11-20 (relecteur matériel) |  |
| `src/domain/training/exerciseSheet.ts` | 4 | lu 2026-11-20 (relecteur matériel) |  |
| `src/domain/training/explain.ts` | 4 | lu 2026-11-20 (relecteur génération) |  |
| `src/domain/training/generateSession.ts` | 4 | lu 2026-11-20 (relecteur génération) |  |
| `src/domain/training/generationTypes.ts` | 4 | lu 2026-11-20 (relecteur génération) |  |
| `src/domain/training/index.ts` | 4 | lu 2026-11-20 (relecteur génération) |  |
| `src/domain/training/loadGrid.ts` | 4 | lu 2026-11-20 (relecteur matériel) |  |
| `src/domain/training/media.ts` | 4 | lu 2026-11-20 (relecteur matériel) |  |
| `src/domain/training/mesocycle.ts` | 4 | lu 2026-11-20 (relecteur mésocycle) |  |
| `src/domain/training/positionRank.ts` | 4 | lu 2026-11-20 (relecteur prescription) |  |
| `src/domain/training/prescribe.ts` | 4 | lu 2026-11-20 (relecteur prescription) |  |
| `src/domain/training/prescriptionInput.ts` | 4 | lu 2026-11-20 (relecteur prescription) |  |
| `src/domain/training/programDay.ts` | 4 | lu 2026-11-20 (relecteur mésocycle) |  |
| `src/domain/training/programModes.ts` | 4 | lu 2026-11-20 (relecteur mésocycle) |  |
| `src/domain/training/programPause.ts` | 4 | lu 2026-11-20 (relecteur mésocycle) |  |
| `src/domain/training/recoverySplit.ts` | 4 | lu 2026-11-20 (relecteur mésocycle) |  |
| `src/domain/training/redDay.ts` | 4 | lu 2026-11-20 (relecteur mésocycle) |  |
| `src/domain/training/replay.ts` | 4 | lu 2026-11-20 (relecteur génération) |  |
| `src/domain/training/restDefault.ts` | 4 | lu 2026-11-20 (relecteur matériel) |  |
| `src/domain/training/routineCircuit.ts` | 4 | lu 2026-11-20 (relecteur génération) |  |
| `src/domain/training/routineRules.ts` | 4 | lu 2026-11-20 (relecteur génération) |  |
| `src/domain/training/session.ts` | 4 | lu 2026-11-20 (relecteur génération) |  |
| `src/domain/training/strengthScore.ts` | 4 | lu 2026-11-20 (relecteur Strength Score) |  |
| `src/domain/training/types.ts` | 4 | lu 2026-11-20 (relecteur génération) |  |
| `src/domain/training/warmup.ts` | 4 | lu 2026-11-20 (relecteur matériel) |  |
| `src/domain/types.ts` | 7c | à lire |  |
| `src/domain/week.ts` | 7c | à lire |  |
| `src/features/app/AppContainerContext.tsx` | 7c | à lire |  |
| `src/features/app/AppStatusBanner.tsx` | 7c | à lire |  |
| `src/features/app/DbFailureDetails.css` | 7c | à lire |  |
| `src/features/app/DbFailureDetails.tsx` | 7c | à lire |  |
| `src/features/app/FileSaveFailure.css` | 7c | à lire |  |
| `src/features/app/FileSaveFailure.tsx` | 7c | à lire |  |
| `src/features/app/RecoveryFailure.tsx` | 7c | à lire |  |
| `src/features/app/SectionNotice.css` | 7c | à lire |  |
| `src/features/app/SectionNotice.tsx` | 7c | à lire |  |
| `src/features/app/ShellChrome.css` | 7c | à lire |  |
| `src/features/app/ShellChrome.tsx` | 7c | à lire |  |
| `src/features/app/StartupBlocked.tsx` | 7c | à lire |  |
| `src/features/app/StartupWatchdog.tsx` | 7c | à lire |  |
| `src/features/app/TodayPcSide.tsx` | 7a | à lire |  |
| `src/features/app/TodayScreen.css` | 7a | à lire |  |
| `src/features/app/TodayScreen.tsx` | 7a | à lire |  |
| `src/features/app/UndoToast.css` | 7c | à lire |  |
| `src/features/app/UndoToast.tsx` | 7c | à lire |  |
| `src/features/app/UpdateRestoreAction.tsx` | 7c | à lire |  |
| `src/features/app/appStatus.ts` | 7c | à lire |  |
| `src/features/app/appStore.ts` | 7c | à lire |  |
| `src/features/app/bootstrap.ts` | 7c | à lire |  |
| `src/features/app/container.ts` | 7c | à lire |  |
| `src/features/app/desktop.ts` | 7c | à lire |  |
| `src/features/app/globalErrors.ts` | 7c | à lire |  |
| `src/features/app/idle.ts` | 7c | à lire |  |
| `src/features/app/lazyScreens.css` | 7c | à lire |  |
| `src/features/app/lazyScreens.tsx` | 7c | à lire |  |
| `src/features/app/logJournalBoot.ts` | 7c | à lire |  |
| `src/features/app/navigation.ts` | 7c | à lire |  |
| `src/features/app/notice.ts` | 7c | à lire |  |
| `src/features/app/saveFile.ts` | 7c | à lire |  |
| `src/features/app/screenNames.ts` | 7c | à lire |  |
| `src/features/app/settingsLedger.ts` | 7c | à lire |  |
| `src/features/app/shareStartupLog.ts` | 7c | à lire |  |
| `src/features/app/shortcuts.ts` | 7c | à lire |  |
| `src/features/app/shortcutsHelp.ts` | 7c | à lire |  |
| `src/features/app/startup.ts` | 7c | à lire |  |
| `src/features/app/startupSteps.ts` | 7c | à lire |  |
| `src/features/app/tabShortcuts.ts` | 7c | à lire |  |
| `src/features/app/timeZoneWatcher.ts` | 7c | à lire |  |
| `src/features/app/todayTestPreload.ts` | 7c | à lire |  |
| `src/features/app/undo.ts` | 7c | à lire |  |
| `src/features/app/updateRestore.ts` | 7c | à lire |  |
| `src/features/bodyProgress/BodyProgress.css` | 7b | à lire |  |
| `src/features/bodyProgress/BodyProgress.tsx` | 7b | à lire |  |
| `src/features/bodyProgress/BodyZones.tsx` | 7b | à lire |  |
| `src/features/bodyProgress/bodyZone.ts` | 7b | à lire |  |
| `src/features/cardio/Cardio.css` | 7a | à lire |  |
| `src/features/cardio/CardioGps.tsx` | 7a | à lire |  |
| `src/features/cardio/CardioProgress.tsx` | 7a | à lire |  |
| `src/features/cardio/CardioView.tsx` | 7a | à lire |  |
| `src/features/cardio/gpsFigures.ts` | 7a | à lire |  |
| `src/features/notifications/index.ts` | 7c | à lire |  |
| `src/features/notifications/recoveryNotifications.ts` | 7c | à lire |  |
| `src/features/notifications/supplementActions.ts` | 5 | lu 2026-11-20 (relecteur compléments) |  |
| `src/features/notifications/supplementNotifications.ts` | 5 | lu 2026-11-20 (relecteur compléments) |  |
| `src/features/notifications/supplementWake.ts` | 7c | à lire |  |
| `src/features/nutrition/NutritionRemainingCard.tsx` | 7b | à lire |  |
| `src/features/nutrition/NutritionScreen.css` | 7b | à lire |  |
| `src/features/nutrition/NutritionScreen.tsx` | 7b | à lire |  |
| `src/features/nutrition/catalogue/ciqualCatalogue.ts` | 7b | à lire |  |
| `src/features/nutrition/checkIn/CheckIn.css` | 7b | à lire |  |
| `src/features/nutrition/checkIn/CheckInView.tsx` | 7b | à lire |  |
| `src/features/nutrition/checkIn/weekSummary.ts` | 7b | à lire |  |
| `src/features/nutrition/dashboard/Charts.tsx` | 7b | à lire |  |
| `src/features/nutrition/dashboard/DashboardView.tsx` | 7b | à lire |  |
| `src/features/nutrition/dashboard/model.ts` | 7b | à lire |  |
| `src/features/nutrition/dayType.ts` | 7b | à lire |  |
| `src/features/nutrition/journal/EntryEditor.tsx` | 7b | à lire |  |
| `src/features/nutrition/journal/JournalView.tsx` | 7b | à lire |  |
| `src/features/nutrition/quickAdd/QuickAddForm.tsx` | 7b | à lire |  |
| `src/features/nutrition/recipes/IngredientPicker.tsx` | 7b | à lire |  |
| `src/features/nutrition/recipes/RecipeEditor.tsx` | 7b | à lire |  |
| `src/features/nutrition/recipes/RecipeHits.tsx` | 7b | à lire |  |
| `src/features/nutrition/recipes/RecipeQuantityStep.tsx` | 7b | à lire |  |
| `src/features/nutrition/recipes/Recipes.css` | 7b | à lire |  |
| `src/features/nutrition/recipes/RecipesView.tsx` | 7b | à lire |  |
| `src/features/nutrition/recipes/recipeModel.ts` | 7b | à lire |  |
| `src/features/nutrition/recipes/recipeSearch.ts` | 7b | à lire |  |
| `src/features/nutrition/scan/BarcodeScanView.tsx` | 7b | à lire |  |
| `src/features/nutrition/scan/scanBarcode.ts` | 7b | à lire |  |
| `src/features/nutrition/search/CustomFoodForm.tsx` | 7b | à lire |  |
| `src/features/nutrition/search/FoodSearchPanel.tsx` | 7b | à lire |  |
| `src/features/nutrition/search/catalogueSearch.ts` | 7b | à lire |  |
| `src/features/nutrition/search/favoritesStore.ts` | 7b | à lire |  |
| `src/features/nutrition/search/offLookup.ts` | 7b | à lire |  |
| `src/features/nutrition/search/offMessages.ts` | 7b | à lire |  |
| `src/features/nutrition/search/resolveFood.ts` | 7b | à lire |  |
| `src/features/nutrition/shared.tsx` | 7b | à lire |  |
| `src/features/nutrition/strategy/RestTargetForm.tsx` | 7b | à lire |  |
| `src/features/nutrition/strategy/StrategyView.tsx` | 7b | à lire |  |
| `src/features/nutrition/strategy/TargetForm.tsx` | 7b | à lire |  |
| `src/features/nutrition/supplements/Supplements.css` | 7b | à lire |  |
| `src/features/nutrition/supplements/SupplementsTodayCard.tsx` | 7b | à lire |  |
| `src/features/nutrition/supplements/SupplementsView.tsx` | 7b | à lire |  |
| `src/features/nutrition/supplements/constancy.ts` | 7b | à lire |  |
| `src/features/nutrition/supplements/replan.ts` | 7b | à lire |  |
| `src/features/nutrition/useCases.ts` | 7b | à lire |  |
| `src/features/nutrition/useNutritionData.ts` | 7b | à lire |  |
| `src/features/onboarding/BodyMap.tsx` | 7c | à lire |  |
| `src/features/onboarding/OnboardingFlow.css` | 7c | à lire |  |
| `src/features/onboarding/OnboardingFlow.tsx` | 7c | à lire |  |
| `src/features/onboarding/OnboardingHost.tsx` | 7c | à lire |  |
| `src/features/onboarding/OptionCards.tsx` | 7c | à lire |  |
| `src/features/onboarding/StepsBasics.tsx` | 7c | à lire |  |
| `src/features/onboarding/StepsPlan.tsx` | 7c | à lire |  |
| `src/features/onboarding/firstSession.ts` | 7c | à lire |  |
| `src/features/onboarding/launch.ts` | 7c | à lire |  |
| `src/features/onboarding/onboardingData.ts` | 7c | à lire |  |
| `src/features/recovery/FactorJournalCard.tsx` | 7a | à lire |  |
| `src/features/recovery/RecoveryProgress.tsx` | 7a | à lire |  |
| `src/features/recovery/RecoveryToday.css` | 7a | à lire |  |
| `src/features/recovery/RecoveryToday.tsx` | 7a | à lire |  |
| `src/features/recovery/UnusualValuesCard.tsx` | 7a | à lire |  |
| `src/features/recovery/display.ts` | 7a | à lire |  |
| `src/features/recovery/factorJournal.ts` | 7a | à lire |  |
| `src/features/security/AppLockGate.tsx` | 7c | à lire |  |
| `src/features/security/LockScreen.tsx` | 7c | à lire |  |
| `src/features/security/appLockBoot.ts` | 7c | à lire |  |
| `src/features/security/appLockStore.ts` | 7c | à lire |  |
| `src/features/security/excursion.ts` | 7c | à lire |  |
| `src/features/security/lockLayer.ts` | 7c | à lire |  |
| `src/features/security/privacyCover.ts` | 7c | à lire |  |
| `src/features/security/security.css` | 7c | à lire |  |
| `src/features/security/startAppLock.ts` | 7c | à lire |  |
| `src/features/security/systemSettingsAction.ts` | 7c | à lire |  |
| `src/features/settings/AboutSection.tsx` | 7c | à lire |  |
| `src/features/settings/AppearanceScreen.css` | 7c | à lire |  |
| `src/features/settings/AppearanceScreen.tsx` | 7c | à lire |  |
| `src/features/settings/AppleHealthScreen.tsx` | 7c | à lire |  |
| `src/features/settings/BackupRow.tsx` | 7c | à lire |  |
| `src/features/settings/BackupSheet.css` | 7c | à lire |  |
| `src/features/settings/BackupSheet.tsx` | 7c | à lire |  |
| `src/features/settings/BodyScreen.css` | 7c | à lire |  |
| `src/features/settings/BodyScreen.tsx` | 7c | à lire |  |
| `src/features/settings/ExportImportScreen.tsx` | 7c | à lire |  |
| `src/features/settings/HealthBodyImportSection.tsx` | 7c | à lire |  |
| `src/features/settings/LinkRow.tsx` | 7c | à lire |  |
| `src/features/settings/ProfileCard.tsx` | 7c | à lire |  |
| `src/features/settings/RecoveryImportSection.tsx` | 7c | à lire |  |
| `src/features/settings/RecoveryNotificationsSection.css` | 7c | à lire |  |
| `src/features/settings/RecoveryNotificationsSection.tsx` | 7c | à lire |  |
| `src/features/settings/ResetDataScreen.tsx` | 7c | à lire |  |
| `src/features/settings/SecuritySection.tsx` | 7c | à lire |  |
| `src/features/settings/SettingsPanels.tsx` | 7c | à lire |  |
| `src/features/settings/SettingsScreen.css` | 7c | à lire |  |
| `src/features/settings/SettingsScreen.tsx` | 7c | à lire |  |
| `src/features/settings/SettingsScreenPc.tsx` | 7c | à lire |  |
| `src/features/settings/TimerTestRow.tsx` | 7c | à lire |  |
| `src/features/settings/appearance.ts` | 7c | à lire |  |
| `src/features/settings/backupLabels.ts` | 7c | à lire |  |
| `src/features/settings/backupScheduler.ts` | 7c | à lire |  |
| `src/features/settings/backupSchedulerStatus.ts` | 7c | à lire |  |
| `src/features/settings/backupStore.ts` | 7c | à lire |  |
| `src/features/settings/healthBodyImport/index.ts` | 7c | à lire |  |
| `src/features/settings/healthBodyImport/service.ts` | 7c | à lire |  |
| `src/features/settings/index.ts` | 7c | à lire |  |
| `src/features/settings/logs/LogsScreen.css` | 7c | à lire |  |
| `src/features/settings/logs/LogsScreen.tsx` | 7c | à lire |  |
| `src/features/settings/logs/logExport.ts` | 7c | à lire |  |
| `src/features/settings/logs/syncReport.ts` | 7c | à lire |  |
| `src/features/settings/logs/useLogJournal.ts` | 7c | à lire |  |
| `src/features/settings/recoveryImport/index.ts` | 7c | à lire |  |
| `src/features/settings/recoveryImport/service.ts` | 7c | à lire |  |
| `src/features/settings/recoveryImport/statusMessage.ts` | 7c | à lire |  |
| `src/features/settings/restoreFlow.ts` | 7c | à lire |  |
| `src/features/settings/restoreMemo.ts` | 7c | à lire |  |
| `src/features/settings/restoreMemoPeek.ts` | 7c | à lire |  |
| `src/features/settings/restoreQuiesce.ts` | 7c | à lire |  |
| `src/features/settings/settingsStore.ts` | 7c | à lire |  |
| `src/features/settings/settingsUseCases.ts` | 7c | à lire |  |
| `src/features/settings/syntheticTimer.ts` | 7c | à lire |  |
| `src/features/settings/theme.ts` | 7c | à lire |  |
| `src/features/settings/useBackupLabelContext.ts` | 7c | à lire |  |
| `src/features/settings/useSyncValue.ts` | 7c | à lire |  |
| `src/features/shortcuts/ShortcutsHelp.css` | 7c | à lire |  |
| `src/features/shortcuts/ShortcutsHelp.tsx` | 7c | à lire |  |
| `src/features/shortcuts/ShortcutsSettingsSection.css` | 7c | à lire |  |
| `src/features/shortcuts/ShortcutsSettingsSection.tsx` | 7c | à lire |  |
| `src/features/shortcuts/index.ts` | 7c | à lire |  |
| `src/features/shortcuts/registerShellShortcuts.ts` | 7c | à lire |  |
| `src/features/signing/SigningAbout.tsx` | 7c | à lire |  |
| `src/features/signing/requestPermission.ts` | 7c | à lire |  |
| `src/features/signing/signingNotice.ts` | 7c | à lire |  |
| `src/features/signing/signingRun.ts` | 7c | à lire |  |
| `src/features/signing/signingStatus.ts` | 7c | à lire |  |
| `src/features/signing/signingText.ts` | 7c | à lire |  |
| `src/features/signing/testKit.ts` | 7c | à lire |  |
| `src/features/strength/StrengthScore.css` | 7a | à lire |  |
| `src/features/strength/StrengthScore.tsx` | 7a | à lire |  |
| `src/features/sync/CarryReport.css` | 7c | à lire |  |
| `src/features/sync/CarryReportSheet.tsx` | 7c | à lire |  |
| `src/features/sync/ConflictList.css` | 7c | à lire |  |
| `src/features/sync/ConflictList.tsx` | 7c | à lire |  |
| `src/features/sync/ForgetDeviceDialog.tsx` | 7c | à lire |  |
| `src/features/sync/IosPairingRow.tsx` | 7c | à lire |  |
| `src/features/sync/IosPairingScreen.css` | 7c | à lire |  |
| `src/features/sync/IosPairingScreen.tsx` | 7c | à lire |  |
| `src/features/sync/JoinProgress.tsx` | 7c | à lire |  |
| `src/features/sync/ResetSyncDialog.tsx` | 7c | à lire |  |
| `src/features/sync/RestoreChoiceDialog.tsx` | 7c | à lire |  |
| `src/features/sync/RestoreChoiceHost.tsx` | 7c | à lire |  |
| `src/features/sync/RestoreMarkerResume.tsx` | 7c | à lire |  |
| `src/features/sync/SyncDetailsCarryReport.tsx` | 7c | à lire |  |
| `src/features/sync/SyncDetailsCarryReportHost.tsx` | 7c | à lire |  |
| `src/features/sync/SyncDetailsConflicts.tsx` | 7c | à lire |  |
| `src/features/sync/SyncDetailsDedup.tsx` | 7c | à lire |  |
| `src/features/sync/SyncDetailsFolder.tsx` | 7c | à lire |  |
| `src/features/sync/SyncDetailsForget.css` | 7c | à lire |  |
| `src/features/sync/SyncDetailsForget.tsx` | 7c | à lire |  |
| `src/features/sync/SyncDetailsOwnDeletion.css` | 7c | à lire |  |
| `src/features/sync/SyncDetailsOwnDeletion.tsx` | 7c | à lire |  |
| `src/features/sync/SyncDetailsOwnDeletionHost.tsx` | 7c | à lire |  |
| `src/features/sync/SyncDetailsPairing.tsx` | 7c | à lire |  |
| `src/features/sync/SyncDetailsRescue.tsx` | 7c | à lire |  |
| `src/features/sync/SyncDetailsReset.tsx` | 7c | à lire |  |
| `src/features/sync/SyncDetailsScreen.css` | 7c | à lire |  |
| `src/features/sync/SyncDetailsScreen.tsx` | 7c | à lire |  |
| `src/features/sync/SyncDetailsVersion.tsx` | 7c | à lire |  |
| `src/features/sync/SyncDeviceName.tsx` | 7c | à lire |  |
| `src/features/sync/SyncNowButton.tsx` | 7c | à lire |  |
| `src/features/sync/SyncSettingsSection.css` | 7c | à lire |  |
| `src/features/sync/SyncSettingsSection.tsx` | 7c | à lire |  |
| `src/features/sync/SyncStatusLine.tsx` | 7c | à lire |  |
| `src/features/sync/carryReportBannerLine.ts` | 7c | à lire |  |
| `src/features/sync/carryReportOpen.ts` | 7c | à lire |  |
| `src/features/sync/carryReportText.ts` | 7c | à lire |  |
| `src/features/sync/conflictText.ts` | 7c | à lire |  |
| `src/features/sync/failureKinds.ts` | 7c | à lire |  |
| `src/features/sync/forgetText.ts` | 7c | à lire |  |
| `src/features/sync/keyPresence.ts` | 7c | à lire |  |
| `src/features/sync/pairing-window/PairingView.tsx` | 7c | à lire |  |
| `src/features/sync/pairing-window/RecoveryKeyEntry.tsx` | 7c | à lire |  |
| `src/features/sync/pairing-window/main.tsx` | 7c | à lire |  |
| `src/features/sync/pairing-window/pairing.css` | 7c | à lire |  |
| `src/features/sync/pairing-window/pairingPlatform.ts` | 7c | à lire |  |
| `src/features/sync/pairing-window/pairingText.ts` | 7c | à lire |  |
| `src/features/sync/pairingHub.ts` | 7c | à lire |  |
| `src/features/sync/pairingStatus.ts` | 7c | à lire |  |
| `src/features/sync/reloadRetry.ts` | 7c | à lire |  |
| `src/features/sync/remoteChanges.ts` | 7c | à lire |  |
| `src/features/sync/resetReason.ts` | 7c | à lire |  |
| `src/features/sync/resetText.ts` | 7c | à lire |  |
| `src/features/sync/startSync.ts` | 7c | à lire |  |
| `src/features/sync/syncConflictUseCases.ts` | 7c | à lire |  |
| `src/features/sync/syncRestoreControl.ts` | 7c | à lire |  |
| `src/features/sync/syncRestoreState.ts` | 7c | à lire |  |
| `src/features/sync/syncStore.ts` | 7c | à lire |  |
| `src/features/sync/syncText.ts` | 7c | à lire |  |
| `src/features/sync/testKit.ts` | 7c | à lire |  |
| `src/features/training/EquipmentView.tsx` | 7a | à lire |  |
| `src/features/training/LibraryView.tsx` | 7a | à lire |  |
| `src/features/training/RoutineCircuitUi.tsx` | 7a | à lire |  |
| `src/features/training/RoutinesView.tsx` | 7a | à lire |  |
| `src/features/training/TrainingScreen.css` | 7a | à lire |  |
| `src/features/training/TrainingScreen.tsx` | 7a | à lire |  |
| `src/features/training/content.ts` | 7a | à lire |  |
| `src/features/training/content02.originals.json` | 7a | à lire |  |
| `src/features/training/cycle/CycleView.css` | 7a | à lire |  |
| `src/features/training/cycle/CycleView.tsx` | 7a | à lire |  |
| `src/features/training/cycle/currentCycle.ts` | 7a | à lire |  |
| `src/features/training/cycle/sessionLink.ts` | 7a | à lire |  |
| `src/features/training/history/History.css` | 7a | à lire |  |
| `src/features/training/history/HistoryDetail.tsx` | 7a | à lire |  |
| `src/features/training/history/HistorySetRow.tsx` | 7a | à lire |  |
| `src/features/training/history/HistoryTimelineView.tsx` | 7a | à lire |  |
| `src/features/training/history/HistoryView.tsx` | 7a | à lire |  |
| `src/features/training/labels.ts` | 7a | à lire |  |
| `src/features/training/library/ExerciseSheetStats.tsx` | 7a | à lire |  |
| `src/features/training/library/Sheet.css` | 7a | à lire |  |
| `src/features/training/loadDisplay.ts` | 7a | à lire |  |
| `src/features/training/media/ExerciseMedia.css` | 7a | à lire |  |
| `src/features/training/media/ExerciseMedia.tsx` | 7a | à lire |  |
| `src/features/training/media/exerciseMediaFiles.ts` | 7a | à lire |  |
| `src/features/training/session/ActiveSession.tsx` | 7a | à lire |  |
| `src/features/training/session/Circuit.css` | 7a | à lire |  |
| `src/features/training/session/CircuitUi.tsx` | 7a | à lire |  |
| `src/features/training/session/ExerciseProgression.tsx` | 7a | à lire |  |
| `src/features/training/session/GeneratedSession.css` | 7a | à lire |  |
| `src/features/training/session/GeneratedSession.tsx` | 7a | à lire |  |
| `src/features/training/session/Progression.css` | 7a | à lire |  |
| `src/features/training/session/RecoverySession.css` | 7a | à lire |  |
| `src/features/training/session/RecoverySession.tsx` | 7a | à lire |  |
| `src/features/training/session/Session.css` | 7a | à lire |  |
| `src/features/training/session/SessionScreen.tsx` | 7a | à lire |  |
| `src/features/training/session/SetRow.tsx` | 7a | à lire |  |
| `src/features/training/session/StartSession.tsx` | 7a | à lire |  |
| `src/features/training/session/Summary.css` | 7a | à lire |  |
| `src/features/training/session/SummaryFigures.tsx` | 7a | à lire |  |
| `src/features/training/session/TodaySessionCard.tsx` | 7a | à lire |  |
| `src/features/training/session/WorkoutSummary.tsx` | 7a | à lire |  |
| `src/features/training/session/generationInput.ts` | 7a | à lire |  |
| `src/features/training/session/prescriptionContext.ts` | 7a | à lire |  |
| `src/features/training/session/redDayState.ts` | 7a | à lire |  |
| `src/features/training/session/restTimer.ts` | 7a | à lire |  |
| `src/features/training/session/todaySessionPreview.ts` | 7a | à lire |  |
| `src/features/training/trainingState.ts` | 7a | à lire |  |
| `src/features/updater/UpdateBanner.css` | 7c | à lire |  |
| `src/features/updater/UpdateBanner.tsx` | 7c | à lire |  |
| `src/features/updater/index.ts` | 7c | à lire |  |
| `src/features/updater/updateChecks.ts` | 7c | à lire |  |
| `src/features/updater/updaterStore.ts` | 7c | à lire |  |
| `src/i18n/appUpdateRestoreText.ts` | 7c | à lire |  |
| `src/i18n/backupRestoreText.ts` | 7c | à lire |  |
| `src/i18n/bodyProgressText.ts` | 7b | à lire |  |
| `src/i18n/bodyText.ts` | 7b | à lire |  |
| `src/i18n/cardioText.ts` | 7a | à lire |  |
| `src/i18n/circuitText.ts` | 7a | à lire |  |
| `src/i18n/dataResetText.ts` | 7c | à lire |  |
| `src/i18n/exportImportText.ts` | 7c | à lire |  |
| `src/i18n/fileFailureText.ts` | 7c | à lire |  |
| `src/i18n/format.ts` | 7c | à lire |  |
| `src/i18n/formatBackup.ts` | 7c | à lire |  |
| `src/i18n/formatPrefs.ts` | 7c | à lire |  |
| `src/i18n/formatRoutine.ts` | 7c | à lire |  |
| `src/i18n/fr.appUpdate.ts` | 7c | à lire |  |
| `src/i18n/fr.appUpdateRestore.ts` | 7c | à lire |  |
| `src/i18n/fr.appearance.ts` | 7c | à lire |  |
| `src/i18n/fr.backup.ts` | 7c | à lire |  |
| `src/i18n/fr.backupRestore.ts` | 7c | à lire |  |
| `src/i18n/fr.body.ts` | 7b | à lire |  |
| `src/i18n/fr.bodyProgress.ts` | 7b | à lire |  |
| `src/i18n/fr.capture.ts` | 7b | à lire |  |
| `src/i18n/fr.cardio.ts` | 7a | à lire |  |
| `src/i18n/fr.circuit.ts` | 7a | à lire |  |
| `src/i18n/fr.dataReset.ts` | 7c | à lire |  |
| `src/i18n/fr.events.ts` | 7c | à lire |  |
| `src/i18n/fr.exportImport.ts` | 7c | à lire |  |
| `src/i18n/fr.health.ts` | 7c | à lire |  |
| `src/i18n/fr.importCsv.ts` | 7c | à lire |  |
| `src/i18n/fr.logs.ts` | 7c | à lire |  |
| `src/i18n/fr.notifications.ts` | 7c | à lire |  |
| `src/i18n/fr.nutrition.ts` | 7b | à lire |  |
| `src/i18n/fr.onboarding.ts` | 7c | à lire |  |
| `src/i18n/fr.progression.ts` | 7a | à lire |  |
| `src/i18n/fr.recipes.ts` | 7b | à lire |  |
| `src/i18n/fr.recovery.ts` | 7a | à lire |  |
| `src/i18n/fr.recoveryFactors.ts` | 7a | à lire |  |
| `src/i18n/fr.recoveryNotifications.ts` | 7a | à lire |  |
| `src/i18n/fr.routineCircuit.ts` | 7a | à lire |  |
| `src/i18n/fr.routines.ts` | 7a | à lire |  |
| `src/i18n/fr.scan.ts` | 7b | à lire |  |
| `src/i18n/fr.sections.ts` | 7c | à lire |  |
| `src/i18n/fr.security.ts` | 7c | à lire |  |
| `src/i18n/fr.shortcuts.ts` | 7c | à lire |  |
| `src/i18n/fr.signing.ts` | 7c | à lire |  |
| `src/i18n/fr.startupBlocked.ts` | 7c | à lire |  |
| `src/i18n/fr.strength.ts` | 7a | à lire |  |
| `src/i18n/fr.supplementNotifications.ts` | 7b | à lire |  |
| `src/i18n/fr.supplements.ts` | 7b | à lire |  |
| `src/i18n/fr.syncCarryReport.ts` | 7c | à lire |  |
| `src/i18n/fr.syncConflicts.ts` | 7c | à lire |  |
| `src/i18n/fr.syncEngine.ts` | 7c | à lire |  |
| `src/i18n/fr.syncField.ts` | 7c | à lire |  |
| `src/i18n/fr.syncFolder.ts` | 7c | à lire |  |
| `src/i18n/fr.syncForget.ts` | 7c | à lire |  |
| `src/i18n/fr.syncOlderDevice.ts` | 7c | à lire |  |
| `src/i18n/fr.syncOwnDeletion.ts` | 7c | à lire |  |
| `src/i18n/fr.syncPairing.ts` | 7c | à lire |  |
| `src/i18n/fr.syncPublishCause.ts` | 7c | à lire |  |
| `src/i18n/fr.syncReset.ts` | 7c | à lire |  |
| `src/i18n/fr.syncRestore.ts` | 7c | à lire |  |
| `src/i18n/fr.syncVersion.ts` | 7c | à lire |  |
| `src/i18n/fr.timer.ts` | 7a | à lire |  |
| `src/i18n/fr.today.ts` | 7a | à lire |  |
| `src/i18n/fr.todayPc.ts` | 7a | à lire |  |
| `src/i18n/fr.training.ts` | 7a | à lire |  |
| `src/i18n/fr.trainingCycle.ts` | 7a | à lire |  |
| `src/i18n/fr.trainingGeneration.ts` | 7a | à lire |  |
| `src/i18n/fr.trainingMedia.ts` | 7a | à lire |  |
| `src/i18n/fr.trainingRecovery.ts` | 7a | à lire |  |
| `src/i18n/fr.ts` | 7c | à lire |  |
| `src/i18n/fr.workoutReplay.ts` | 7a | à lire |  |
| `src/i18n/healthText.ts` | 7c | à lire |  |
| `src/i18n/index.ts` | 7c | à lire |  |
| `src/i18n/logsText.ts` | 7c | à lire |  |
| `src/i18n/native/fr.json` | 7c | à lire |  |
| `src/i18n/nutritionText.ts` | 7b | à lire |  |
| `src/i18n/onboardingText.ts` | 7c | à lire |  |
| `src/i18n/plural.ts` | 7c | à lire |  |
| `src/i18n/plusText.ts` | 7c | à lire |  |
| `src/i18n/progressionText.ts` | 7a | à lire |  |
| `src/i18n/recipesText.ts` | 7b | à lire |  |
| `src/i18n/recoveryFactorsText.ts` | 7a | à lire |  |
| `src/i18n/recoveryText.ts` | 7a | à lire |  |
| `src/i18n/routineCircuitText.ts` | 7a | à lire |  |
| `src/i18n/sectionsText.ts` | 7c | à lire |  |
| `src/i18n/settingsRefonteText.ts` | 7c | à lire |  |
| `src/i18n/strengthText.ts` | 7a | à lire |  |
| `src/i18n/supplementsText.ts` | 7b | à lire |  |
| `src/i18n/syncCarryReportText.ts` | 7c | à lire |  |
| `src/i18n/syncOlderDeviceText.ts` | 7c | à lire |  |
| `src/i18n/syncOwnDeletionText.ts` | 7c | à lire |  |
| `src/i18n/syncPublishCauseText.ts` | 7c | à lire |  |
| `src/i18n/syncRefonteText.ts` | 7c | à lire |  |
| `src/i18n/syncRescue.ts` | 7c | à lire |  |
| `src/i18n/syncRestoreText.ts` | 7c | à lire |  |
| `src/i18n/timerText.ts` | 7a | à lire |  |
| `src/i18n/todayPcText.ts` | 7a | à lire |  |
| `src/i18n/todayText.ts` | 7a | à lire |  |
| `src/i18n/trainingCycleText.ts` | 7a | à lire |  |
| `src/i18n/trainingGenerationText.ts` | 7a | à lire |  |
| `src/i18n/trainingMediaText.ts` | 7a | à lire |  |
| `src/i18n/trainingRecoveryText.ts` | 7a | à lire |  |
| `src/i18n/trainingText.ts` | 7a | à lire |  |
| `src/i18n/types.ts` | 7c | à lire |  |
| `src/i18n/workoutReplayText.ts` | 7a | à lire |  |
| `src/main.tsx` | 7c | à lire |  |
| `src/platform/appVersion.ts` | 8b | à lire |  |
| `src/platform/backup/index.ts` | 8b | à lire |  |
| `src/platform/backup/memory.ts` | 8b | à lire |  |
| `src/platform/backup/recovery.ts` | 8b | à lire |  |
| `src/platform/backup/recoveryAvailable.ts` | 8b | à lire |  |
| `src/platform/backup/startupRecovery.ts` | 8b | à lire |  |
| `src/platform/backup/tauriBackup.ts` | 8b | à lire |  |
| `src/platform/backup/types.ts` | 8b | à lire |  |
| `src/platform/barcode/index.ts` | 5 | lu 2026-11-20 (relecteur journal) |  |
| `src/platform/barcode/testing.ts` | 5 | lu 2026-11-20 (relecteur journal) |  |
| `src/platform/biometric/fake.ts` | 8b | à lire |  |
| `src/platform/biometric/guard.ts` | 8b | à lire |  |
| `src/platform/biometric/index.ts` | 8b | à lire |  |
| `src/platform/biometric/tauriBiometric.ts` | 8b | à lire |  |
| `src/platform/biometric/types.ts` | 8b | à lire |  |
| `src/platform/database.ts` | 8b | à lire |  |
| `src/platform/dbDiagnostics.ts` | 8b | à lire |  |
| `src/platform/desktop/index.ts` | 8b | à lire |  |
| `src/platform/desktop/log.ts` | 8b | à lire |  |
| `src/platform/desktop/releases.ts` | 8b | à lire |  |
| `src/platform/desktop/tauriDesktop.ts` | 8b | à lire |  |
| `src/platform/desktop/testing.ts` | 8b | à lire |  |
| `src/platform/desktop/types.ts` | 8b | à lire |  |
| `src/platform/files/browser.ts` | 8b | à lire |  |
| `src/platform/files/errorCode.ts` | 8b | à lire |  |
| `src/platform/files/index.ts` | 8b | à lire |  |
| `src/platform/files/iosFiles.ts` | 8b | à lire |  |
| `src/platform/files/memory.ts` | 8b | à lire |  |
| `src/platform/files/open.ts` | 8b | à lire |  |
| `src/platform/files/tauriFiles.ts` | 8b | à lire |  |
| `src/platform/files/types.ts` | 8b | à lire |  |
| `src/platform/geolocation/index.ts` | 8b | à lire |  |
| `src/platform/geolocation/tauriGeolocation.ts` | 8b | à lire |  |
| `src/platform/geolocation/types.ts` | 8b | à lire |  |
| `src/platform/geolocation/unavailable.ts` | 8b | à lire |  |
| `src/platform/haptics/fake.ts` | 8b | à lire |  |
| `src/platform/haptics/index.ts` | 8b | à lire |  |
| `src/platform/haptics/tauriHaptics.ts` | 8b | à lire |  |
| `src/platform/haptics/types.ts` | 8b | à lire |  |
| `src/platform/healthkit/index.ts` | 6 | à lire |  |
| `src/platform/healthkit/tauriHealthKit.ts` | 6 | à lire |  |
| `src/platform/healthkit/types.ts` | 6 | à lire |  |
| `src/platform/healthkit/unavailable.ts` | 6 | à lire |  |
| `src/platform/healthkit/validation.ts` | 6 | à lire |  |
| `src/platform/index.ts` | 8b | à lire |  |
| `src/platform/liveActivity/index.ts` | 8b | à lire |  |
| `src/platform/liveActivity/tauriLiveActivity.ts` | 8b | à lire |  |
| `src/platform/liveActivity/types.ts` | 8b | à lire |  |
| `src/platform/liveActivity/unavailable.ts` | 8b | à lire |  |
| `src/platform/logs/buffer.ts` | 8b | à lire |  |
| `src/platform/logs/index.ts` | 8b | à lire |  |
| `src/platform/logs/memory.ts` | 8b | à lire |  |
| `src/platform/logs/sanitize.ts` | 8b | à lire |  |
| `src/platform/logs/tauriLogs.ts` | 8b | à lire |  |
| `src/platform/logs/types.ts` | 8b | à lire |  |
| `src/platform/network.ts` | 8b | à lire |  |
| `src/platform/notifications/actions.ts` | 8b | à lire |  |
| `src/platform/notifications/fake.ts` | 8b | à lire |  |
| `src/platform/notifications/fakeActions.ts` | 8b | à lire |  |
| `src/platform/notifications/fakeBridge.ts` | 8b | à lire |  |
| `src/platform/notifications/index.ts` | 8b | à lire |  |
| `src/platform/notifications/notificationClock.ts` | 8b | à lire |  |
| `src/platform/notifications/notificationLedger.ts` | 8b | à lire |  |
| `src/platform/notifications/tauriNotificationActions.ts` | 8b | à lire |  |
| `src/platform/notifications/tauriNotifications.ts` | 8b | à lire |  |
| `src/platform/notifications/timerNotification.ts` | 8b | à lire |  |
| `src/platform/notifications/types.ts` | 8b | à lire |  |
| `src/platform/notifications/unavailable.ts` | 8b | à lire |  |
| `src/platform/notifications/validate.ts` | 8b | à lire |  |
| `src/platform/ocr/index.ts` | 5 | lu 2026-11-20 (relecteur journal) |  |
| `src/platform/ocr/nativeOcr.ts` | 5 | lu 2026-11-20 (relecteur journal) |  |
| `src/platform/ocr/testing.ts` | 5 | lu 2026-11-20 (relecteur journal) |  |
| `src/platform/ocr/types.ts` | 5 | lu 2026-11-20 (relecteur journal) |  |
| `src/platform/off/index.ts` | 5 | lu 2026-11-20 (relecteur journal) |  |
| `src/platform/off/parse.ts` | 5 | lu 2026-11-20 (relecteur journal) |  |
| `src/platform/off/tauriOff.ts` | 5 | lu 2026-11-20 (relecteur journal) |  |
| `src/platform/off/testing.ts` | 5 | lu 2026-11-20 (relecteur journal) |  |
| `src/platform/photoImage/picker.ts` | 5 | lu 2026-11-20 (relecteur journal) |  |
| `src/platform/privacyShield/index.ts` | 8b | à lire |  |
| `src/platform/privacyShield/tauriPrivacyShield.ts` | 8b | à lire |  |
| `src/platform/quiet.ts` | 8b | à lire |  |
| `src/platform/relaunch.ts` | 8b | à lire |  |
| `src/platform/runtime.ts` | 8b | à lire |  |
| `src/platform/shortcutFiles/index.ts` | 8b | à lire |  |
| `src/platform/signing/fake.ts` | 8b | à lire |  |
| `src/platform/signing/index.ts` | 8b | à lire |  |
| `src/platform/signing/tauriSigning.ts` | 8b | à lire |  |
| `src/platform/signing/tauriSigningAlert.ts` | 8b | à lire |  |
| `src/platform/signing/types.ts` | 8b | à lire |  |
| `src/platform/speech/index.ts` | 8b | à lire |  |
| `src/platform/speech/tauriSpeech.ts` | 8b | à lire |  |
| `src/platform/speech/testing.ts` | 8b | à lire |  |
| `src/platform/speech/types.ts` | 8b | à lire |  |
| `src/platform/speech/unavailable.ts` | 8b | à lire |  |
| `src/platform/sync/barcodeScanner.ts` | 8b | à lire |  |
| `src/platform/sync/faultPlan.ts` | 8b | à lire |  |
| `src/platform/sync/index.ts` | 8b | à lire |  |
| `src/platform/sync/memory.ts` | 8b | à lire |  |
| `src/platform/sync/tauriSync.ts` | 8b | à lire |  |
| `src/platform/sync/types.ts` | 8b | à lire |  |
| `src/platform/systemSettings/index.ts` | 8b | à lire |  |
| `src/platform/systemSettings/tauriSystemSettings.ts` | 8b | à lire |  |
| `src/platform/systemSettings/testing.ts` | 8b | à lire |  |
| `src/platform/tauri/migrationBackup.ts` | 8b | à lire |  |
| `src/platform/tauri/sqlDriver.ts` | 8b | à lire |  |
| `src/platform/timeZone.ts` | 8b | à lire |  |
| `src/platform/windowTheme.ts` | 8b | à lire |  |
| `src/ui/AppShell.css` | 7c | à lire |  |
| `src/ui/AppShell.tsx` | 7c | à lire |  |
| `src/ui/Button.css` | 7c | à lire |  |
| `src/ui/Button.tsx` | 7c | à lire |  |
| `src/ui/ChoiceDialog.css` | 7c | à lire |  |
| `src/ui/ChoiceDialog.tsx` | 7c | à lire |  |
| `src/ui/ConfirmDialog.css` | 7c | à lire |  |
| `src/ui/ConfirmDialog.tsx` | 7c | à lire |  |
| `src/ui/HeroFigure.tsx` | 7c | à lire |  |
| `src/ui/Icon.tsx` | 7c | à lire |  |
| `src/ui/Kbd.css` | 7c | à lire |  |
| `src/ui/Kbd.tsx` | 7c | à lire |  |
| `src/ui/ListSkeleton.css` | 7c | à lire |  |
| `src/ui/ListSkeleton.tsx` | 7c | à lire |  |
| `src/ui/MissingValue.tsx` | 7c | à lire |  |
| `src/ui/Rule.tsx` | 7c | à lire |  |
| `src/ui/SectionTitle.tsx` | 7c | à lire |  |
| `src/ui/SegmentedControl.css` | 7c | à lire |  |
| `src/ui/SegmentedControl.tsx` | 7c | à lire |  |
| `src/ui/Sheet.css` | 7c | à lire |  |
| `src/ui/Sheet.tsx` | 7c | à lire |  |
| `src/ui/Skeleton.css` | 7c | à lire |  |
| `src/ui/StatusBanner.css` | 7c | à lire |  |
| `src/ui/StatusBanner.tsx` | 7c | à lire |  |
| `src/ui/Switch.css` | 7c | à lire |  |
| `src/ui/Switch.tsx` | 7c | à lire |  |
| `src/ui/TabIcon.tsx` | 7c | à lire |  |
| `src/ui/TabRail.css` | 7c | à lire |  |
| `src/ui/TabRail.tsx` | 7c | à lire |  |
| `src/ui/Toast.css` | 7c | à lire |  |
| `src/ui/Toast.tsx` | 7c | à lire |  |
| `src/ui/WeekdayToggles.css` | 7c | à lire |  |
| `src/ui/WeekdayToggles.tsx` | 7c | à lire |  |
| `src/ui/iconStyle.ts` | 7c | à lire |  |
| `src/ui/index.ts` | 7c | à lire |  |
| `src/ui/theme/figures.css` | 7c | à lire |  |
| `src/ui/theme/fonts.css` | 7c | à lire |  |
| `src/ui/theme/tokens.css` | 7c | à lire |  |
| `src/ui/useFocusTrap.ts` | 7c | à lire |  |
| `src/ui/useLayout.ts` | 7c | à lire |  |
| `src/vite-env.d.ts` | 7c | à lire |  |
