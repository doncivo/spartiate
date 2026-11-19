# Couverture de relecture — AUDIT-0.26.0

SHA : `8686a8fc2860f7a94eb193426cbcc640a33bac80`.
108/2047 fichiers lus (5.28 %). « Lu » indique une lecture complète dans la passe précisée, pas la validation de tous les scénarios métier. Les lectures partielles et scans ne sont pas comptés.

Production et outillage : 106/1046 lus intégralement. Tests et supports : 1001 fichiers ; partie 11 par outils, lecture complète des règles critiques et échantillon motivé du reste (décision d’Ali des 16 et 19/11). Inventaire corrigé en partie 1 : 389 ajouts, dont 33 de production/outillage et 356 de tests/supports ; les 645 tests du compteur initial n’incluaient pas tout le banc. Les 81 fichiers vendored exclus restent listés. Configurations déclaratives et documents consultés sont cités dans les rapports de partie, hors de ce décompte de sources.

| Fichier | Statut | Motif / preuve |
| --- | --- | --- |
| `.github/workflows/.gitkeep` | à lire |  |
| `.github/workflows/build-ios.yml` | à lire |  |
| `.github/workflows/build-windows.yml` | à lire |  |
| `.github/workflows/tests.yml` | à lire |  |
| `eslint.config.js` | lu | Partie 1 : Gardes statiques, sideEffects, entrées et graphe du démarrage lus ; A-007 reproduit par sondes ESLint. |
| `index.html` | lu | Partie 1 : Entrées et initialisation du thème lues ; fenêtre pairing distincte sans StrictMode ; thème système à vérifier partie 7c. |
| `pairing.html` | lu | Partie 1 : Entrées et initialisation du thème lues ; fenêtre pairing distincte sans StrictMode ; thème système à vérifier partie 7c. |
| `playwright.config.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `playwright.smoke.config.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `playwright.visual.config.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `public/theme-init.js` | lu | Partie 1 : Entrées et initialisation du thème lues ; fenêtre pairing distincte sans StrictMode ; thème système à vérifier partie 7c. |
| `scripts/backup/export-migrations-fixture.mjs` | à lire |  |
| `scripts/ci/test-counts.mjs` | à lire |  |
| `scripts/cleanup/apply.mjs` | à lire |  |
| `scripts/cleanup/cssClasses.mjs` | à lire |  |
| `scripts/cleanup/cssTokens.mjs` | à lire |  |
| `scripts/cleanup/i18nDrop.mjs` | à lire |  |
| `scripts/cleanup/i18nKeys.mjs` | lu | Partie 0 : Catalogue fr.ts seul ; heuristique de chaînes et préfixes, limites documentées partie-00. |
| `scripts/cleanup/legacySyncInventory.mjs` | à lire |  |
| `scripts/cleanup/orphanCatalogs.mjs` | à lire |  |
| `scripts/cleanup/plan.mjs` | à lire |  |
| `scripts/cleanup/reachability.mjs` | lu | Partie 0 : Racines main/pairing, imports relatifs et glob ; résultats candidats, aucun retrait automatique. |
| `scripts/cleanup/restore-missing.mjs` | à lire |  |
| `scripts/cleanup/restore-tests.mjs` | à lire |  |
| `scripts/cleanup/symbols.mjs` | à lire |  |
| `scripts/content/build-ciqual.mjs` | à lire |  |
| `scripts/content/build-media.mjs` | à lire |  |
| `scripts/content/build-strength-standards.mjs` | à lire |  |
| `scripts/content/ciqual.mjs` | à lire |  |
| `scripts/content/ciqual.test.ts` | à lire |  |
| `scripts/content/media-map.json` | à lire |  |
| `scripts/content/png-reduce.mjs` | à lire |  |
| `scripts/content/png-reduce.test.ts` | à lire |  |
| `scripts/content/set-strength-keys.mjs` | à lire |  |
| `scripts/content/validate-content.mjs` | à lire |  |
| `scripts/content/validate.test.ts` | à lire |  |
| `scripts/e2e-perf.mjs` | à lire |  |
| `scripts/ios/a9.test.ts` | à lire |  |
| `scripts/ios/apply-entitlements.mjs` | à lire |  |
| `scripts/ios/apply-icons.mjs` | à lire |  |
| `scripts/ios/capIos01.test.ts` | à lire |  |
| `scripts/ios/check-plist-contract.mjs` | à lire |  |
| `scripts/ios/check-source.mjs` | à lire |  |
| `scripts/ios/geolocation.test.ts` | à lire |  |
| `scripts/ios/healthkitBridge.test.ts` | à lire |  |
| `scripts/ios/i03.test.ts` | à lire |  |
| `scripts/ios/i06.test.ts` | à lire |  |
| `scripts/ios/i06Qa.test.ts` | à lire |  |
| `scripts/ios/icons.test.ts` | à lire |  |
| `scripts/ios/inject-live-activity.mjs` | à lire |  |
| `scripts/ios/injectLiveActivity.test.ts` | à lire |  |
| `scripts/ios/ios.qa.test.ts` | à lire |  |
| `scripts/ios/ios.test.ts` | à lire |  |
| `scripts/ios/journalVisible.test.ts` | à lire |  |
| `scripts/ios/liveActivity.test.ts` | à lire |  |
| `scripts/ios/make-source-json.mjs` | à lire |  |
| `scripts/ios/plist-contract.json` | à lire |  |
| `scripts/ios/plist.mjs` | à lire |  |
| `scripts/ios/prepare-a9.mjs` | à lire |  |
| `scripts/ios/source.template.json` | à lire |  |
| `scripts/ios/sourceIdentity.test.ts` | à lire |  |
| `scripts/ios/yIos02.test.ts` | à lire |  |
| `scripts/make-ocr-fixtures.mjs` | à lire |  |
| `scripts/release/agents.test.ts` | à lire |  |
| `scripts/release/backupMigrationsFixture.test.ts` | à lire |  |
| `scripts/release/check-version.mjs` | à lire |  |
| `scripts/release/docs-paths.test.ts` | à lire |  |
| `scripts/release/fixtures/prd-v6.3-changes.json` | à lire |  |
| `scripts/release/healthShortcutsGuide.test.ts` | à lire |  |
| `scripts/release/identity.test.ts` | à lire |  |
| `scripts/release/lib/agentsCheck.mjs` | à lire |  |
| `scripts/release/lib/docsPaths.mjs` | à lire |  |
| `scripts/release/lib/mentions.mjs` | à lire |  |
| `scripts/release/lib/prdSplit.mjs` | à lire |  |
| `scripts/release/make-latest-json.mjs` | à lire |  |
| `scripts/release/prd-split.test.ts` | à lire |  |
| `scripts/release/purge.test.ts` | à lire |  |
| `scripts/release/release-notes.mjs` | à lire |  |
| `scripts/release/release.test.ts` | à lire |  |
| `scripts/release/rename.mjs` | à lire |  |
| `scripts/release/rename.test.ts` | à lire |  |
| `scripts/release/signingBoundary.test.ts` | à lire |  |
| `scripts/release/split-prd.mjs` | à lire |  |
| `scripts/release/verify-signature.mjs` | à lire |  |
| `scripts/smoke/build.mjs` | à lire |  |
| `src-tauri/build.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/ios/LiveActivity/SpartiateLiveActivity.swift` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/ios/LiveActivity/SpartiateTimerAttributes.swift` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/plugins/files/build.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/plugins/files/ios/Package.swift` | à lire |  |
| `src-tauri/plugins/files/ios/Sources/CtFilesPlugin.swift` | à lire |  |
| `src-tauri/plugins/files/src/lib.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/plugins/folder-bookmark/build.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/plugins/folder-bookmark/ios/Package.swift` | à lire |  |
| `src-tauri/plugins/folder-bookmark/ios/Sources/FolderBookmarkPlugin.swift` | à lire |  |
| `src-tauri/plugins/folder-bookmark/src/lib.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/plugins/haptics/build.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/plugins/haptics/ios/Package.swift` | à lire |  |
| `src-tauri/plugins/haptics/ios/Sources/HapticsPlugin.swift` | à lire |  |
| `src-tauri/plugins/haptics/src/lib.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/plugins/healthkit/build.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/plugins/healthkit/ios/Package.swift` | à lire |  |
| `src-tauri/plugins/healthkit/ios/Sources/HealthKitPlugin.swift` | à lire |  |
| `src-tauri/plugins/healthkit/src/lib.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/plugins/live-activity/build.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/plugins/live-activity/ios/Package.swift` | à lire |  |
| `src-tauri/plugins/live-activity/ios/Sources/LiveActivityPlugin.swift` | à lire |  |
| `src-tauri/plugins/live-activity/ios/Sources/SpartiateTimerAttributes.swift` | à lire |  |
| `src-tauri/plugins/live-activity/src/lib.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/plugins/notification-actions/build.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/plugins/notification-actions/ios/Package.swift` | à lire |  |
| `src-tauri/plugins/notification-actions/ios/Sources/NotificationActionsPlugin.swift` | à lire |  |
| `src-tauri/plugins/notification-actions/src/lib.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/plugins/privacy-shield/build.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/plugins/privacy-shield/ios/Package.swift` | à lire |  |
| `src-tauri/plugins/privacy-shield/ios/Sources/PrivacyShieldPlugin.swift` | à lire |  |
| `src-tauri/plugins/privacy-shield/src/lib.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/plugins/speech/build.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/plugins/speech/ios/Package.swift` | à lire |  |
| `src-tauri/plugins/speech/ios/Sources/SpeechPlugin.swift` | à lire |  |
| `src-tauri/plugins/speech/src/lib.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/plugins/vision/build.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/plugins/vision/ios/Package.swift` | à lire |  |
| `src-tauri/plugins/vision/ios/Sources/VisionPlugin.swift` | à lire |  |
| `src-tauri/plugins/vision/src/lib.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/src/applog.rs` | à lire |  |
| `src-tauri/src/backup.rs` | à lire |  |
| `src-tauri/src/backup_triggers.rs` | à lire |  |
| `src-tauri/src/desktop.rs` | à lire |  |
| `src-tauri/src/export.rs` | à lire |  |
| `src-tauri/src/export_common.rs` | à lire |  |
| `src-tauri/src/export_ios.rs` | à lire |  |
| `src-tauri/src/healthkit.rs` | à lire |  |
| `src-tauri/src/import.rs` | à lire |  |
| `src-tauri/src/ios_setup.rs` | à lire |  |
| `src-tauri/src/lib.rs` | à lire |  |
| `src-tauri/src/live_activity.rs` | à lire |  |
| `src-tauri/src/main.rs` | à lire |  |
| `src-tauri/src/mobile_call.rs` | à lire |  |
| `src-tauri/src/ocr/mod.rs` | à lire |  |
| `src-tauri/src/ocr/vision.rs` | à lire |  |
| `src-tauri/src/ocr/win.rs` | à lire |  |
| `src-tauri/src/off.rs` | à lire |  |
| `src-tauri/src/signing.rs` | à lire |  |
| `src-tauri/src/speech/ios.rs` | à lire |  |
| `src-tauri/src/speech/mod.rs` | à lire |  |
| `src-tauri/src/startup_gate.rs` | à lire |  |
| `src-tauri/src/sync/bookmark.rs` | à lire |  |
| `src-tauri/src/sync/cloud_windows.rs` | à lire |  |
| `src-tauri/src/sync/commands.rs` | à lire |  |
| `src-tauri/src/sync/commands_ios.rs` | à lire |  |
| `src-tauri/src/sync/consent.rs` | à lire |  |
| `src-tauri/src/sync/consent_ios.rs` | à lire |  |
| `src-tauri/src/sync/crypto.rs` | à lire |  |
| `src-tauri/src/sync/files.rs` | à lire |  |
| `src-tauri/src/sync/folder.rs` | à lire |  |
| `src-tauri/src/sync/forget.rs` | à lire |  |
| `src-tauri/src/sync/health.rs` | à lire |  |
| `src-tauri/src/sync/limits.rs` | à lire |  |
| `src-tauri/src/sync/marker.rs` | à lire |  |
| `src-tauri/src/sync/mod.rs` | à lire |  |
| `src-tauri/src/sync/names.rs` | à lire |  |
| `src-tauri/src/sync/pairing.rs` | à lire |  |
| `src-tauri/src/sync/reset.rs` | à lire |  |
| `src-tauri/src/sync/service.rs` | à lire |  |
| `src-tauri/src/sync/state.rs` | à lire |  |
| `src-tauri/src/sync/store.rs` | à lire |  |
| `src-tauri/src/vault.rs` | à lire |  |
| `src-tauri/src/vault_ios.rs` | à lire |  |
| `src-tauri/src/window_fit.rs` | à lire |  |
| `src-tauri/tests/desktop/applog.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/backup.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/backup_summary.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/backup_versions.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/capture_ios.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/config.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/db_diagnostics.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/export.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/export_ios.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/import.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/logic.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/main.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/notification_actions.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/ocr.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/ocr_vision.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/off.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/quit.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/restore.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/restore_hardening.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/restore_identity.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/restore_identity_sync.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/restore_ios.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/restore_qa_ios.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/restore_recovery.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/restore_wal_guard.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/signing.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/speech.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/sql_closed.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/sqlite_engine.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/support/fake_bookmark.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/support/fault_plan.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/support/http_mock.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/support/mod.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/sync_bookmark.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/sync_closed_segments.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/sync_crypto.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/sync_fault_plan.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/sync_fixes.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/sync_folder.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/sync_forget.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/sync_forget_qa.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/sync_fs_conformance.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/sync_health.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/sync_ios_y02.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/sync_key.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/sync_pairing.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/sync_pairing_qa.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/sync_pairing_y06.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/sync_publish_bound.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/sync_qa_crypto.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/sync_qa_folder.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/sync_reset.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/sync_separation.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/sync_store.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/sync_support.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/sync_tz.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/sync_y_tech_02.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/training_schema.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/updater.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/window.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/tests/desktop/window_fit.rs` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `src-tauri/vendor/sqlx-sqlite/.cargo_vcs_info.json` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/Cargo.toml` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/Cargo.toml.orig` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/LICENSE-APACHE` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/LICENSE-MIT` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/PROVENANCE-SPARTIATE.md` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/any.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/arguments.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/column.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/connection/collation.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/connection/describe.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/connection/establish.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/connection/execute.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/connection/executor.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/connection/explain.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/connection/handle.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/connection/intmap.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/connection/mod.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/connection/preupdate_hook.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/connection/serialize.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/connection/worker.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/database.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/error.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/lib.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/logger.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/migrate.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/options/auto_vacuum.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/options/connect.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/options/journal_mode.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/options/locking_mode.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/options/mod.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/options/parse.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/options/synchronous.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/query_result.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/regexp.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/row.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/statement/handle.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/statement/mod.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/statement/unlock_notify.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/statement/virtual.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/testing/mod.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/transaction.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/type_checking.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/type_info.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/types/bool.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/types/bytes.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/types/chrono.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/types/float.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/types/int.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/types/json.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/types/mod.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/types/str.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/types/text.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/types/time.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/types/uint.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/types/uuid.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/sqlx-sqlite/src/value.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/tauri-plugin-sql/Cargo.toml` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/tauri-plugin-sql/LICENSE.spdx` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/tauri-plugin-sql/LICENSE_APACHE-2.0` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/tauri-plugin-sql/LICENSE_MIT` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/tauri-plugin-sql/README.md` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/tauri-plugin-sql/api-iife.js` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/tauri-plugin-sql/build.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/tauri-plugin-sql/permissions/autogenerated/commands/close.toml` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/tauri-plugin-sql/permissions/autogenerated/commands/execute.toml` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/tauri-plugin-sql/permissions/autogenerated/commands/load.toml` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/tauri-plugin-sql/permissions/autogenerated/commands/select.toml` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/tauri-plugin-sql/permissions/autogenerated/reference.md` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/tauri-plugin-sql/permissions/default.toml` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/tauri-plugin-sql/permissions/schemas/schema.json` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/tauri-plugin-sql/src/commands.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/tauri-plugin-sql/src/decode/mod.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/tauri-plugin-sql/src/decode/mysql.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/tauri-plugin-sql/src/decode/postgres.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/tauri-plugin-sql/src/decode/sqlite.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/tauri-plugin-sql/src/error.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/tauri-plugin-sql/src/guard.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/tauri-plugin-sql/src/guard_tests.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/tauri-plugin-sql/src/lib.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src-tauri/vendor/tauri-plugin-sql/src/wrapper.rs` | hors relecture | code tiers vendored, inventorié ; dépendances et correctifs locaux à contrôler séparément |
| `src/App.test.tsx` | à lire |  |
| `src/App.tsx` | lu | Partie 1 : Composition, ordre des attentes, publication des erreurs et nettoyage lus ; réintégration/garde à approfondir en parties 2/3. |
| `src/db/driver.ts` | lu | Partie 1 : Contrats, fabrique liée à la transaction et association catalogue/repositories lus ; atomicité effective à vérifier partie 2. |
| `src/db/drivers/sqliteWasm.test.ts` | à lire |  |
| `src/db/drivers/sqliteWasm.ts` | lu | Partie 2 : Cache borné des statements, fermeture, signaux et observateurs lus ; effets transactionnels à confronter aux appelants. |
| `src/db/errorText.ts` | à lire |  |
| `src/db/index.ts` | à lire |  |
| `src/db/localWrite.test.ts` | à lire |  |
| `src/db/localWrite.ts` | lu | Partie 2 : Cache borné des statements, fermeture, signaux et observateurs lus ; effets transactionnels à confronter aux appelants. |
| `src/db/migrationBackup.test.ts` | à lire |  |
| `src/db/migrationBackup.ts` | lu | Partie 2 : Ordre, sommes, version future, transactions, sauvegarde et réutilisation lus ; sans preuve native nouvelle. |
| `src/db/migrationBackupUpdate.test.ts` | à lire |  |
| `src/db/migrations/0001_spartiate_init.test.ts` | à lire |  |
| `src/db/migrations/0001_spartiate_init.ts` | lu | Partie 2 : DDL et déclencheurs intégralement lus : captures figées, contraintes, extensions additives et clôture. Concordance catalogue à vérifier dans la suite de partie 2. |
| `src/db/migrations/0002_training.test.ts` | à lire |  |
| `src/db/migrations/0002_training.ts` | lu | Partie 2 : DDL et déclencheurs intégralement lus : captures figées, contraintes, extensions additives et clôture. Concordance catalogue à vérifier dans la suite de partie 2. |
| `src/db/migrations/0003_workout.test.ts` | à lire |  |
| `src/db/migrations/0003_workout.ts` | lu | Partie 2 : DDL et déclencheurs intégralement lus : captures figées, contraintes, extensions additives et clôture. Concordance catalogue à vérifier dans la suite de partie 2. |
| `src/db/migrations/0004_workout_sync.test.ts` | à lire |  |
| `src/db/migrations/0004_workout_sync.ts` | lu | Partie 2 : DDL et déclencheurs intégralement lus : captures figées, contraintes, extensions additives et clôture. Concordance catalogue à vérifier dans la suite de partie 2. |
| `src/db/migrations/0005_progression.test.ts` | à lire |  |
| `src/db/migrations/0005_progression.ts` | lu | Partie 2 : DDL et déclencheurs intégralement lus : captures figées, contraintes, extensions additives et clôture. Concordance catalogue à vérifier dans la suite de partie 2. |
| `src/db/migrations/0006_progression_sync.test.ts` | à lire |  |
| `src/db/migrations/0006_progression_sync.ts` | lu | Partie 2 : DDL et déclencheurs intégralement lus : captures figées, contraintes, extensions additives et clôture. Concordance catalogue à vérifier dans la suite de partie 2. |
| `src/db/migrations/0007_mesocycle.test.ts` | à lire |  |
| `src/db/migrations/0007_mesocycle.ts` | lu | Partie 2 : DDL et déclencheurs intégralement lus : captures figées, contraintes, extensions additives et clôture. Concordance catalogue à vérifier dans la suite de partie 2. |
| `src/db/migrations/0008_nutrition.test.ts` | à lire |  |
| `src/db/migrations/0008_nutrition.ts` | lu | Partie 2 : DDL et déclencheurs intégralement lus : captures figées, contraintes, extensions additives et clôture. Concordance catalogue à vérifier dans la suite de partie 2. |
| `src/db/migrations/0009_recipes.test.ts` | à lire |  |
| `src/db/migrations/0009_recipes.ts` | lu | Partie 2 : DDL et déclencheurs intégralement lus : captures figées, contraintes, extensions additives et clôture. Concordance catalogue à vérifier dans la suite de partie 2. |
| `src/db/migrations/0010_recovery.test.ts` | à lire |  |
| `src/db/migrations/0010_recovery.ts` | lu | Partie 2 : DDL et déclencheurs intégralement lus : captures figées, contraintes, extensions additives et clôture. Concordance catalogue à vérifier dans la suite de partie 2. |
| `src/db/migrations/0011_recovery_factor.test.ts` | à lire |  |
| `src/db/migrations/0011_recovery_factor.ts` | lu | Partie 2 : DDL et déclencheurs intégralement lus : captures figées, contraintes, extensions additives et clôture. Concordance catalogue à vérifier dans la suite de partie 2. |
| `src/db/migrations/0012_body_progress.test.ts` | à lire |  |
| `src/db/migrations/0012_body_progress.ts` | lu | Partie 2 : DDL et déclencheurs intégralement lus : captures figées, contraintes, extensions additives et clôture. Concordance catalogue à vérifier dans la suite de partie 2. |
| `src/db/migrations/0013_workout_circuit.test.ts` | à lire |  |
| `src/db/migrations/0013_workout_circuit.ts` | lu | Partie 2 : DDL et déclencheurs intégralement lus : captures figées, contraintes, extensions additives et clôture. Concordance catalogue à vérifier dans la suite de partie 2. |
| `src/db/migrations/0014_routine_circuit.test.ts` | à lire |  |
| `src/db/migrations/0014_routine_circuit.ts` | lu | Partie 2 : DDL et déclencheurs intégralement lus : captures figées, contraintes, extensions additives et clôture. Concordance catalogue à vérifier dans la suite de partie 2. |
| `src/db/migrations/0015_food_favorite.test.ts` | à lire |  |
| `src/db/migrations/0015_food_favorite.ts` | lu | Partie 2 : DDL et déclencheurs intégralement lus : captures figées, contraintes, extensions additives et clôture. Concordance catalogue à vérifier dans la suite de partie 2. |
| `src/db/migrations/0016_data_reset.test.ts` | à lire |  |
| `src/db/migrations/0016_data_reset.ts` | lu | Partie 2 : DDL et déclencheurs intégralement lus : captures figées, contraintes, extensions additives et clôture. Concordance catalogue à vérifier dans la suite de partie 2. |
| `src/db/migrations/0017_supplement.test.ts` | à lire |  |
| `src/db/migrations/0017_supplement.ts` | lu | Partie 2 : DDL et déclencheurs intégralement lus : captures figées, contraintes, extensions additives et clôture. Concordance catalogue à vérifier dans la suite de partie 2. |
| `src/db/migrations/0018_cardio.test.ts` | à lire |  |
| `src/db/migrations/0018_cardio.ts` | lu | Partie 2 : DDL et déclencheurs intégralement lus : captures figées, contraintes, extensions additives et clôture. Concordance catalogue à vérifier dans la suite de partie 2. |
| `src/db/migrations/0019_program_rest_day.test.ts` | à lire |  |
| `src/db/migrations/0019_program_rest_day.ts` | lu | Partie 2 : DDL et déclencheurs intégralement lus : captures figées, contraintes, extensions additives et clôture. Concordance catalogue à vérifier dans la suite de partie 2. |
| `src/db/migrations/index.ts` | lu | Partie 2 : DDL et déclencheurs intégralement lus : captures figées, contraintes, extensions additives et clôture. Concordance catalogue à vérifier dans la suite de partie 2. |
| `src/db/migrations/schemaRepublish.test.ts` | à lire |  |
| `src/db/migrations/spartiateSchemaFixture.test.ts` | à lire |  |
| `src/db/migrator.test.ts` | à lire |  |
| `src/db/migrator.ts` | lu | Partie 2 : Ordre, sommes, version future, transactions, sauvegarde et réutilisation lus ; sans preuve native nouvelle. |
| `src/db/parse/equipmentJson.ts` | à lire |  |
| `src/db/parse/exerciseJson.ts` | à lire |  |
| `src/db/parse/jsonText.ts` | à lire |  |
| `src/db/parse/recoveryFactorJson.test.ts` | à lire |  |
| `src/db/parse/recoveryFactorJson.ts` | à lire |  |
| `src/db/parse/recoveryJson.test.ts` | à lire |  |
| `src/db/parse/recoveryJson.ts` | à lire |  |
| `src/db/parse/trainingJson.test.ts` | à lire |  |
| `src/db/repositories/bodyProgressRepository.ts` | à lire |  |
| `src/db/repositories/bodyRepositories.ts` | à lire |  |
| `src/db/repositories/cardioRepository.ts` | à lire |  |
| `src/db/repositories/checklistRepository.ts` | à lire |  |
| `src/db/repositories/common.ts` | à lire |  |
| `src/db/repositories/dataAccess.test.ts` | à lire |  |
| `src/db/repositories/dataAccess.ts` | lu | Partie 1 : Contrats, fabrique liée à la transaction et association catalogue/repositories lus ; atomicité effective à vérifier partie 2. |
| `src/db/repositories/dataResetRepository.ts` | à lire |  |
| `src/db/repositories/dayCompletenessRepository.ts` | à lire |  |
| `src/db/repositories/epochCarryReportRepository.ts` | à lire |  |
| `src/db/repositories/equipmentProfileRepository.ts` | à lire |  |
| `src/db/repositories/exerciseRepository.ts` | à lire |  |
| `src/db/repositories/exportImportRepository.ts` | à lire |  |
| `src/db/repositories/foodFavoriteRepository.ts` | à lire |  |
| `src/db/repositories/foodRepository.ts` | à lire |  |
| `src/db/repositories/goalRepository.ts` | à lire |  |
| `src/db/repositories/index.ts` | lu | Partie 1 : Contrats, fabrique liée à la transaction et association catalogue/repositories lus ; atomicité effective à vérifier partie 2. |
| `src/db/repositories/mealEntryRepository.ts` | à lire |  |
| `src/db/repositories/mesocycleRepository.ts` | à lire |  |
| `src/db/repositories/nutritionTargetRepository.ts` | à lire |  |
| `src/db/repositories/observeWrites.test.ts` | à lire |  |
| `src/db/repositories/observeWrites.ts` | lu | Partie 2 : Cache borné des statements, fermeture, signaux et observateurs lus ; effets transactionnels à confronter aux appelants. |
| `src/db/repositories/occurrenceDedupRepository.ts` | à lire |  |
| `src/db/repositories/progressionRepository.ts` | à lire |  |
| `src/db/repositories/recipeRepository.ts` | à lire |  |
| `src/db/repositories/recoveryFactorRepository.ts` | à lire |  |
| `src/db/repositories/recoveryRepository.ts` | à lire |  |
| `src/db/repositories/recoverySampleRepository.ts` | à lire |  |
| `src/db/repositories/reminderRepository.ts` | à lire |  |
| `src/db/repositories/routineRepository.ts` | à lire |  |
| `src/db/repositories/settingsRepository.ts` | à lire |  |
| `src/db/repositories/spaceRepository.ts` | à lire |  |
| `src/db/repositories/sql/bodyHealthMetrics.test.ts` | à lire |  |
| `src/db/repositories/sql/bodyProgressRepository.test.ts` | à lire |  |
| `src/db/repositories/sql/bodyProgressRepository.ts` | à lire |  |
| `src/db/repositories/sql/bodyRepositories.test.ts` | à lire |  |
| `src/db/repositories/sql/bodyRepositories.ts` | à lire |  |
| `src/db/repositories/sql/cardioRepository.test.ts` | à lire |  |
| `src/db/repositories/sql/cardioRepository.ts` | à lire |  |
| `src/db/repositories/sql/checklistRepository.test.ts` | à lire |  |
| `src/db/repositories/sql/checklistRepository.ts` | à lire |  |
| `src/db/repositories/sql/dataResetRepository.ts` | lu | Partie 3 : Instantanés fusion/remplacement, export, traces et effacement SQL intégralement lus. A-009 : colonne inconnue de table connue ignorée en fusion, preuve ciblée journal/instantané. |
| `src/db/repositories/sql/dayCompletenessRepository.test.ts` | à lire |  |
| `src/db/repositories/sql/dayCompletenessRepository.ts` | à lire |  |
| `src/db/repositories/sql/epochCarryReports.test.ts` | à lire |  |
| `src/db/repositories/sql/epochCarryReports.ts` | à lire |  |
| `src/db/repositories/sql/equipmentProfileRepository.test.ts` | à lire |  |
| `src/db/repositories/sql/equipmentProfileRepository.ts` | à lire |  |
| `src/db/repositories/sql/exerciseRepository.test.ts` | à lire |  |
| `src/db/repositories/sql/exerciseRepository.ts` | à lire |  |
| `src/db/repositories/sql/exportImportBodyProgress.test.ts` | à lire |  |
| `src/db/repositories/sql/exportImportCardio.test.ts` | à lire |  |
| `src/db/repositories/sql/exportImportCircuit.test.ts` | à lire |  |
| `src/db/repositories/sql/exportImportFoodFavorite.test.ts` | à lire |  |
| `src/db/repositories/sql/exportImportHealthBody.test.ts` | à lire |  |
| `src/db/repositories/sql/exportImportMesocycle.test.ts` | à lire |  |
| `src/db/repositories/sql/exportImportNutrition.test.ts` | à lire |  |
| `src/db/repositories/sql/exportImportOpenWorkout.test.ts` | à lire |  |
| `src/db/repositories/sql/exportImportProgression.test.ts` | à lire |  |
| `src/db/repositories/sql/exportImportRecipes.test.ts` | à lire |  |
| `src/db/repositories/sql/exportImportRecovery.test.ts` | à lire |  |
| `src/db/repositories/sql/exportImportRecoveryFactor.test.ts` | à lire |  |
| `src/db/repositories/sql/exportImportRepository.test.ts` | à lire |  |
| `src/db/repositories/sql/exportImportRepository.ts` | à lire |  |
| `src/db/repositories/sql/exportImportRoutineCircuit.test.ts` | à lire |  |
| `src/db/repositories/sql/exportImportSupplement.test.ts` | à lire |  |
| `src/db/repositories/sql/exportImportSv18.test.ts` | à lire |  |
| `src/db/repositories/sql/exportImportSyncParity.test.ts` | à lire |  |
| `src/db/repositories/sql/exportImportTargetOrder.test.ts` | à lire |  |
| `src/db/repositories/sql/exportImportTraining.test.ts` | à lire |  |
| `src/db/repositories/sql/foodFavoriteRepository.test.ts` | à lire |  |
| `src/db/repositories/sql/foodFavoriteRepository.ts` | à lire |  |
| `src/db/repositories/sql/foodRepository.test.ts` | à lire |  |
| `src/db/repositories/sql/foodRepository.ts` | à lire |  |
| `src/db/repositories/sql/fullExport.test.ts` | à lire |  |
| `src/db/repositories/sql/goalRepository.test.ts` | à lire |  |
| `src/db/repositories/sql/goalRepository.ts` | à lire |  |
| `src/db/repositories/sql/index.ts` | à lire |  |
| `src/db/repositories/sql/mealEntryRenpho.test.ts` | à lire |  |
| `src/db/repositories/sql/mealEntryRepository.test.ts` | à lire |  |
| `src/db/repositories/sql/mealEntryRepository.ts` | à lire |  |
| `src/db/repositories/sql/mesocycleRepository.test.ts` | à lire |  |
| `src/db/repositories/sql/mesocycleRepository.ts` | à lire |  |
| `src/db/repositories/sql/nutritionTargetRepository.test.ts` | à lire |  |
| `src/db/repositories/sql/nutritionTargetRepository.ts` | à lire |  |
| `src/db/repositories/sql/occurrenceDedup.ts` | à lire |  |
| `src/db/repositories/sql/progressionRepository.i408.test.ts` | à lire |  |
| `src/db/repositories/sql/progressionRepository.test.ts` | à lire |  |
| `src/db/repositories/sql/progressionRepository.ts` | à lire |  |
| `src/db/repositories/sql/recipeRepository.test.ts` | à lire |  |
| `src/db/repositories/sql/recipeRepository.ts` | à lire |  |
| `src/db/repositories/sql/recoveryFactorRepository.test.ts` | à lire |  |
| `src/db/repositories/sql/recoveryFactorRepository.ts` | à lire |  |
| `src/db/repositories/sql/recoveryRepository.test.ts` | à lire |  |
| `src/db/repositories/sql/recoveryRepository.ts` | à lire |  |
| `src/db/repositories/sql/recoveryRepositoryLatest.test.ts` | à lire |  |
| `src/db/repositories/sql/recoveryRepositoryReader.test.ts` | à lire |  |
| `src/db/repositories/sql/recoverySampleRepository.test.ts` | à lire |  |
| `src/db/repositories/sql/recoverySampleRepository.ts` | à lire |  |
| `src/db/repositories/sql/reminderRepository.test.ts` | à lire |  |
| `src/db/repositories/sql/reminderRepository.ts` | à lire |  |
| `src/db/repositories/sql/rev01.ingredientName.test.ts` | à lire |  |
| `src/db/repositories/sql/routineCircuit.test.ts` | à lire |  |
| `src/db/repositories/sql/routineRepository.test.ts` | à lire |  |
| `src/db/repositories/sql/routineRepository.ts` | à lire |  |
| `src/db/repositories/sql/settingsRepository.test.ts` | à lire |  |
| `src/db/repositories/sql/settingsRepository.ts` | à lire |  |
| `src/db/repositories/sql/spaceRepository.test.ts` | à lire |  |
| `src/db/repositories/sql/spaceRepository.ts` | à lire |  |
| `src/db/repositories/sql/sqlHelpers.ts` | à lire |  |
| `src/db/repositories/sql/supplementRepository.test.ts` | à lire |  |
| `src/db/repositories/sql/supplementRepository.ts` | à lire |  |
| `src/db/repositories/sql/syncConflicts.ts` | à lire |  |
| `src/db/repositories/sql/syncRepository.ts` | à lire |  |
| `src/db/repositories/sql/syncUnknown.ts` | lu | Partie 2 : Réintégration par pages/savepoints, garde et état persistant lus ; nuance la piste de partie 1, affichage à vérifier partie 3. |
| `src/db/repositories/sql/taskRepository.done.test.ts` | à lire |  |
| `src/db/repositories/sql/taskRepository.perf.test.ts` | à lire |  |
| `src/db/repositories/sql/taskRepository.purge.test.ts` | à lire |  |
| `src/db/repositories/sql/taskRepository.test.ts` | à lire |  |
| `src/db/repositories/sql/taskRepository.ts` | à lire |  |
| `src/db/repositories/sql/testSetup.ts` | à lire |  |
| `src/db/repositories/sql/trainingRoutineRepository.test.ts` | à lire |  |
| `src/db/repositories/sql/trainingRoutineRepository.ts` | à lire |  |
| `src/db/repositories/sql/userDataRepository.ts` | à lire |  |
| `src/db/repositories/sql/workoutCircuit.test.ts` | à lire |  |
| `src/db/repositories/sql/workoutClosure.test.ts` | à lire |  |
| `src/db/repositories/sql/workoutDifficulty.test.ts` | à lire |  |
| `src/db/repositories/sql/workoutRepository.test.ts` | à lire |  |
| `src/db/repositories/sql/workoutRepository.ts` | à lire |  |
| `src/db/repositories/sql/workoutWarmup.test.ts` | à lire |  |
| `src/db/repositories/storage.ts` | lu | Partie 1 : Contrats, fabrique liée à la transaction et association catalogue/repositories lus ; atomicité effective à vérifier partie 2. |
| `src/db/repositories/supplementRepository.ts` | à lire |  |
| `src/db/repositories/syncConflictRepository.ts` | à lire |  |
| `src/db/repositories/syncRepository.ts` | à lire |  |
| `src/db/repositories/syncUnknownRepository.ts` | à lire |  |
| `src/db/repositories/taskRepository.ts` | à lire |  |
| `src/db/repositories/trainingRoutineRepository.ts` | à lire |  |
| `src/db/repositories/userDataRepository.ts` | à lire |  |
| `src/db/repositories/workoutRepository.ts` | à lire |  |
| `src/db/seed/defaultSpaces.ts` | à lire |  |
| `src/db/seed/externalEventFixtures.ts` | à lire |  |
| `src/db/seed/sampleData.ts` | à lire |  |
| `src/db/serializedDriver.test.ts` | lu | Partie 2 : File, transactions et tests existants intégralement lus ; A-008 reproduit sous rejet de rollback injecté, écriture suivante perdue. |
| `src/db/serializedDriver.ts` | lu | Partie 2 : File, transactions et tests existants intégralement lus ; A-008 reproduit sous rejet de rollback injecté, écriture suivante perdue. |
| `src/db/spaceOwnership.test.ts` | à lire |  |
| `src/db/testHooks.ts` | à lire |  |
| `src/domain/appLock.test.ts` | à lire |  |
| `src/domain/appLock.ts` | à lire |  |
| `src/domain/appStatus.test.ts` | à lire |  |
| `src/domain/appStatus.ts` | à lire |  |
| `src/domain/appUpdate.test.ts` | à lire |  |
| `src/domain/appUpdate.ts` | à lire |  |
| `src/domain/appleReminders.test.ts` | à lire |  |
| `src/domain/appleReminders.ts` | à lire |  |
| `src/domain/backupSchedule.test.ts` | à lire |  |
| `src/domain/backupSchedule.ts` | à lire |  |
| `src/domain/bodyProfile.test.ts` | à lire |  |
| `src/domain/bodyProfile.ts` | à lire |  |
| `src/domain/bodyProgress/index.ts` | à lire |  |
| `src/domain/bodyProgress/measurements.test.ts` | à lire |  |
| `src/domain/bodyProgress/measurements.ts` | à lire |  |
| `src/domain/bodyProgress/photos.test.ts` | à lire |  |
| `src/domain/bodyProgress/photos.ts` | à lire |  |
| `src/domain/cardio/index.ts` | à lire |  |
| `src/domain/cardio/lastKm.test.ts` | à lire |  |
| `src/domain/cardio/progress.test.ts` | à lire |  |
| `src/domain/cardio/progress.ts` | à lire |  |
| `src/domain/cardio/session.test.ts` | à lire |  |
| `src/domain/cardio/session.ts` | à lire |  |
| `src/domain/cardio/track.test.ts` | à lire |  |
| `src/domain/cardio/track.ts` | à lire |  |
| `src/domain/clock.test.ts` | à lire |  |
| `src/domain/clock.ts` | lu | Partie 1 : Source système injectable, règles nowIso/todayLocal/nowLocalTime reçoivent Clock ; pas de hasard métier trouvé. |
| `src/domain/compareCodeUnits.test.ts` | à lire |  |
| `src/domain/compareCodeUnits.ts` | à lire |  |
| `src/domain/csvImport.test.ts` | à lire |  |
| `src/domain/csvImport.ts` | à lire |  |
| `src/domain/csvImportHardening.test.ts` | à lire |  |
| `src/domain/dataReset.test.ts` | à lire |  |
| `src/domain/dataReset.ts` | à lire |  |
| `src/domain/dateInput.ts` | à lire |  |
| `src/domain/donePeriod.test.ts` | à lire |  |
| `src/domain/donePeriod.ts` | à lire |  |
| `src/domain/eventKinds.test.ts` | à lire |  |
| `src/domain/eventKinds.ts` | à lire |  |
| `src/domain/eventOccurrences.test.ts` | à lire |  |
| `src/domain/eventOccurrences.ts` | à lire |  |
| `src/domain/eventReminders.test.ts` | à lire |  |
| `src/domain/eventReminders.ts` | à lire |  |
| `src/domain/eventRules.test.ts` | à lire |  |
| `src/domain/eventRules.ts` | à lire |  |
| `src/domain/eventTestKit.ts` | lu | Partie 1 : Compteurs mutables propres aux fabriques de fixtures ; pas assimilés à un moteur métier avec état. |
| `src/domain/exportImport/archive.test.ts` | à lire |  |
| `src/domain/exportImport/archive.ts` | à lire |  |
| `src/domain/exportImport/fullExport.test.ts` | à lire |  |
| `src/domain/exportImport/fullExport.ts` | à lire |  |
| `src/domain/exportImport/fullExportDoc.test.ts` | à lire |  |
| `src/domain/exportImport/plan.test.ts` | à lire |  |
| `src/domain/exportImport/plan.ts` | à lire |  |
| `src/domain/exportImport/planSince.test.ts` | à lire |  |
| `src/domain/exportImport/rev01.constat2.test.ts` | à lire |  |
| `src/domain/exportImport/sha256.test.ts` | à lire |  |
| `src/domain/exportImport/sha256.ts` | à lire |  |
| `src/domain/exportImport/zip.test.ts` | à lire |  |
| `src/domain/exportImport/zip.ts` | à lire |  |
| `src/domain/focusSession.test.ts` | à lire |  |
| `src/domain/focusSession.ts` | à lire |  |
| `src/domain/goalRules.test.ts` | à lire |  |
| `src/domain/goalRules.ts` | lu | Partie 1 : Lecture complète du cycle statique hérité : appels croisés dans des fonctions, pas pendant leur initialisation ; aucun plantage démontré. |
| `src/domain/health/bodyShortcutFiles.test.ts` | à lire |  |
| `src/domain/health/bodyShortcutFiles.ts` | à lire |  |
| `src/domain/health/rev01.shortcutDay.test.ts` | à lire |  |
| `src/domain/health/shortcutWeights.test.ts` | à lire |  |
| `src/domain/health/shortcutWeights.ts` | à lire |  |
| `src/domain/historyExport.test.ts` | à lire |  |
| `src/domain/historyExport.ts` | à lire |  |
| `src/domain/hlc.test.ts` | à lire |  |
| `src/domain/hlc.ts` | lu | Partie 3 : Horloges, exports, transaction gardée et horizons de remise à zéro intégralement lus ; appelants et persistance à confronter. |
| `src/domain/id.test.ts` | à lire |  |
| `src/domain/id.ts` | lu | Partie 1 : Générateur injectable RandomBytes, bits UUIDv4 et copie défensive lus ; source crypto isolée dans la fabrique. |
| `src/domain/itemFilter.ts` | à lire |  |
| `src/domain/localDate.ts` | à lire |  |
| `src/domain/model/checklist.ts` | à lire |  |
| `src/domain/model/event.ts` | à lire |  |
| `src/domain/model/externalEvent.ts` | à lire |  |
| `src/domain/model/focusSession.ts` | à lire |  |
| `src/domain/model/goal.ts` | à lire |  |
| `src/domain/model/holiday.ts` | à lire |  |
| `src/domain/model/icon.ts` | à lire |  |
| `src/domain/model/index.ts` | à lire |  |
| `src/domain/model/model.test.ts` | à lire |  |
| `src/domain/model/recurrence.ts` | à lire |  |
| `src/domain/model/reminder.ts` | à lire |  |
| `src/domain/model/routine.ts` | à lire |  |
| `src/domain/model/settings.ts` | à lire |  |
| `src/domain/model/space.ts` | à lire |  |
| `src/domain/model/task.ts` | à lire |  |
| `src/domain/notificationActions.test.ts` | à lire |  |
| `src/domain/notificationActions.ts` | à lire |  |
| `src/domain/notificationId.test.ts` | à lire |  |
| `src/domain/notificationId.ts` | à lire |  |
| `src/domain/notificationInstant.test.ts` | à lire |  |
| `src/domain/notificationInstant.ts` | à lire |  |
| `src/domain/notificationLedger.test.ts` | à lire |  |
| `src/domain/notificationLedger.ts` | à lire |  |
| `src/domain/notificationPlan.qa.test.ts` | à lire |  |
| `src/domain/notificationPlan.snooze.test.ts` | à lire |  |
| `src/domain/notificationPlan.test.ts` | à lire |  |
| `src/domain/notificationPlan.ts` | à lire |  |
| `src/domain/notificationStatus.ts` | à lire |  |
| `src/domain/notificationWindow.test.ts` | à lire |  |
| `src/domain/nutrition/barcode.test.ts` | à lire |  |
| `src/domain/nutrition/barcode.ts` | à lire |  |
| `src/domain/nutrition/checkIn.test.ts` | à lire |  |
| `src/domain/nutrition/checkIn.ts` | à lire |  |
| `src/domain/nutrition/ciqual.test.ts` | à lire |  |
| `src/domain/nutrition/ciqual.ts` | à lire |  |
| `src/domain/nutrition/config.ts` | à lire |  |
| `src/domain/nutrition/coverage.test.ts` | à lire |  |
| `src/domain/nutrition/coverage.ts` | à lire |  |
| `src/domain/nutrition/dayTotals.test.ts` | à lire |  |
| `src/domain/nutrition/dayTotals.ts` | à lire |  |
| `src/domain/nutrition/declarations.test.ts` | à lire |  |
| `src/domain/nutrition/eightWeeks.test.ts` | à lire |  |
| `src/domain/nutrition/favorites.test.ts` | à lire |  |
| `src/domain/nutrition/favorites.ts` | à lire |  |
| `src/domain/nutrition/firstCheckIn.test.ts` | à lire |  |
| `src/domain/nutrition/firstCheckIn.ts` | à lire |  |
| `src/domain/nutrition/food.test.ts` | à lire |  |
| `src/domain/nutrition/food.ts` | à lire |  |
| `src/domain/nutrition/foodSearch.test.ts` | à lire |  |
| `src/domain/nutrition/foodSearch.ts` | à lire |  |
| `src/domain/nutrition/index.ts` | à lire |  |
| `src/domain/nutrition/journal.test.ts` | à lire |  |
| `src/domain/nutrition/journal.ts` | à lire |  |
| `src/domain/nutrition/mealEntry.test.ts` | à lire |  |
| `src/domain/nutrition/mealEntry.ts` | à lire |  |
| `src/domain/nutrition/offProduct.test.ts` | à lire |  |
| `src/domain/nutrition/offProduct.ts` | à lire |  |
| `src/domain/nutrition/prefs.test.ts` | à lire |  |
| `src/domain/nutrition/prefs.ts` | à lire |  |
| `src/domain/nutrition/recipe.test.ts` | à lire |  |
| `src/domain/nutrition/recipe.ts` | à lire |  |
| `src/domain/nutrition/recipeEntry.test.ts` | à lire |  |
| `src/domain/nutrition/recipeFoodId.test.ts` | à lire |  |
| `src/domain/nutrition/recipeTypes.ts` | à lire |  |
| `src/domain/nutrition/renphoDay.test.ts` | à lire |  |
| `src/domain/nutrition/renphoDay.ts` | à lire |  |
| `src/domain/nutrition/restDay.test.ts` | à lire |  |
| `src/domain/nutrition/restDay.ts` | à lire |  |
| `src/domain/nutrition/rev01.ingredientName.test.ts` | à lire |  |
| `src/domain/nutrition/supplements.test.ts` | à lire |  |
| `src/domain/nutrition/supplements.ts` | à lire |  |
| `src/domain/nutrition/targetRecord.test.ts` | à lire |  |
| `src/domain/nutrition/targetRecord.ts` | à lire |  |
| `src/domain/nutrition/tdee.test.ts` | à lire |  |
| `src/domain/nutrition/tdee.ts` | à lire |  |
| `src/domain/nutrition/trendLearning.test.ts` | à lire |  |
| `src/domain/nutrition/trendLearning.ts` | à lire |  |
| `src/domain/nutrition/types.ts` | à lire |  |
| `src/domain/nutrition/weeklyRate.test.ts` | à lire |  |
| `src/domain/nutrition/weeklyRate.ts` | à lire |  |
| `src/domain/nutrition/weightTrend.test.ts` | à lire |  |
| `src/domain/nutrition/weightTrend.ts` | à lire |  |
| `src/domain/occurrenceDedup.test.ts` | à lire |  |
| `src/domain/occurrenceDedup.ts` | à lire |  |
| `src/domain/omitKey.ts` | à lire |  |
| `src/domain/onboarding/draft.test.ts` | à lire |  |
| `src/domain/onboarding/draft.ts` | à lire |  |
| `src/domain/onboarding/draftMeso.test.ts` | à lire |  |
| `src/domain/onboarding/expenditure.test.ts` | à lire |  |
| `src/domain/onboarding/expenditure.ts` | à lire |  |
| `src/domain/onboarding/index.ts` | à lire |  |
| `src/domain/onboarding/review.test.ts` | à lire |  |
| `src/domain/onboarding/review.ts` | à lire |  |
| `src/domain/onboarding/split.test.ts` | à lire |  |
| `src/domain/onboarding/split.ts` | à lire |  |
| `src/domain/projectRules.test.ts` | à lire |  |
| `src/domain/projectRules.ts` | à lire |  |
| `src/domain/qaRoutinesLot.test.ts` | à lire |  |
| `src/domain/quietHours.test.ts` | à lire |  |
| `src/domain/quietHours.ts` | à lire |  |
| `src/domain/recap.test.ts` | à lire |  |
| `src/domain/recap.ts` | à lire |  |
| `src/domain/recovery/baseline.ts` | à lire |  |
| `src/domain/recovery/bedtimeProposal.test.ts` | à lire |  |
| `src/domain/recovery/bedtimeProposal.ts` | à lire |  |
| `src/domain/recovery/config.ts` | à lire |  |
| `src/domain/recovery/daySummary.ts` | à lire |  |
| `src/domain/recovery/engine.test.ts` | à lire |  |
| `src/domain/recovery/exertion.ts` | à lire |  |
| `src/domain/recovery/factors.test.ts` | à lire |  |
| `src/domain/recovery/factors.ts` | à lire |  |
| `src/domain/recovery/index.ts` | à lire |  |
| `src/domain/recovery/muscleRecovery.ts` | à lire |  |
| `src/domain/recovery/nights.test.ts` | à lire |  |
| `src/domain/recovery/nights.ts` | à lire |  |
| `src/domain/recovery/notificationPrefs.test.ts` | à lire |  |
| `src/domain/recovery/notificationPrefs.ts` | à lire |  |
| `src/domain/recovery/recoveryScore.ts` | à lire |  |
| `src/domain/recovery/shortcutFiles.test.ts` | à lire |  |
| `src/domain/recovery/shortcutFiles.ts` | à lire |  |
| `src/domain/recovery/sleepDiagnostic.test.ts` | à lire |  |
| `src/domain/recovery/sleepNeed.ts` | lu | Partie 1 : Lecture complète pour qualification du candidat window : variable locale ; revue des formules réservée parties 4/6. |
| `src/domain/recovery/types.ts` | à lire |  |
| `src/domain/recovery/unusualValues.test.ts` | à lire |  |
| `src/domain/recovery/unusualValues.ts` | à lire |  |
| `src/domain/recoveryNotificationPlan.test.ts` | à lire |  |
| `src/domain/recoveryNotificationPlan.ts` | à lire |  |
| `src/domain/recurrenceEdit.test.ts` | à lire |  |
| `src/domain/recurrenceEdit.ts` | à lire |  |
| `src/domain/recurrenceNext.test.ts` | à lire |  |
| `src/domain/recurrenceNext.ts` | à lire |  |
| `src/domain/recurrenceRules.test.ts` | à lire |  |
| `src/domain/recurrenceRules.ts` | à lire |  |
| `src/domain/routineReport.firstDay.test.ts` | à lire |  |
| `src/domain/routineReport.test.ts` | à lire |  |
| `src/domain/routineReport.ts` | à lire |  |
| `src/domain/routineSchedule.test.ts` | à lire |  |
| `src/domain/routineSchedule.ts` | à lire |  |
| `src/domain/routineStats.perf.test.ts` | à lire |  |
| `src/domain/routineStreaks.test.ts` | à lire |  |
| `src/domain/routineStreaks.ts` | à lire |  |
| `src/domain/routineTestKit.ts` | lu | Partie 1 : Compteurs mutables propres aux fabriques de fixtures ; pas assimilés à un moteur métier avec état. |
| `src/domain/signingNotice.test.ts` | à lire |  |
| `src/domain/signingNotice.ts` | à lire |  |
| `src/domain/spaceRules.test.ts` | à lire |  |
| `src/domain/spaceRules.ts` | à lire |  |
| `src/domain/supplementNotificationActions.test.ts` | à lire |  |
| `src/domain/supplementNotificationActions.ts` | à lire |  |
| `src/domain/supplementNotificationPlan.test.ts` | à lire |  |
| `src/domain/supplementNotificationPlan.ts` | à lire |  |
| `src/domain/sync/catalogue.test.ts` | à lire |  |
| `src/domain/sync/compat.reintegration.test.ts` | à lire |  |
| `src/domain/sync/compat.test.ts` | à lire |  |
| `src/domain/sync/compat.ts` | lu | Partie 3 : Fusion par champ, bases, conflits, réintégration, plafonds et dérive physique intégralement lus. |
| `src/domain/sync/conflictRestore.test.ts` | à lire |  |
| `src/domain/sync/conflictRestore.ts` | à lire |  |
| `src/domain/sync/devices.test.ts` | à lire |  |
| `src/domain/sync/devices.ts` | à lire |  |
| `src/domain/sync/drift.ts` | lu | Partie 3 : Fusion par champ, bases, conflits, réintégration, plafonds et dérive physique intégralement lus. |
| `src/domain/sync/epoch.ts` | à lire |  |
| `src/domain/sync/epochCarryNotice.test.ts` | à lire |  |
| `src/domain/sync/epochCarryNotice.ts` | à lire |  |
| `src/domain/sync/epochCarryReport.test.ts` | à lire |  |
| `src/domain/sync/epochCarryReport.ts` | à lire |  |
| `src/domain/sync/epochCarryReportView.ts` | à lire |  |
| `src/domain/sync/epochOrphan.test.ts` | à lire |  |
| `src/domain/sync/epochPublishBound.test.ts` | à lire |  |
| `src/domain/sync/errorFamily.ts` | à lire |  |
| `src/domain/sync/firstPublication.test.ts` | à lire |  |
| `src/domain/sync/firstPublication.ts` | à lire |  |
| `src/domain/sync/format.bounds.test.ts` | à lire |  |
| `src/domain/sync/format.test.ts` | à lire |  |
| `src/domain/sync/format.ts` | à lire |  |
| `src/domain/sync/limits.test.ts` | à lire |  |
| `src/domain/sync/limits.ts` | lu | Partie 3 : Fusion par champ, bases, conflits, réintégration, plafonds et dérive physique intégralement lus. |
| `src/domain/sync/merge.test.ts` | à lire |  |
| `src/domain/sync/merge.ts` | lu | Partie 3 : Fusion par champ, bases, conflits, réintégration, plafonds et dérive physique intégralement lus. |
| `src/domain/sync/naturalIds.ts` | à lire |  |
| `src/domain/sync/naturalIdsDay.test.ts` | à lire |  |
| `src/domain/sync/naturalIdsMeasurement.test.ts` | à lire |  |
| `src/domain/sync/naturalIdsRecovery.test.ts` | à lire |  |
| `src/domain/sync/naturalIdsRecoveryFactor.test.ts` | à lire |  |
| `src/domain/sync/orphanRelist.ts` | à lire |  |
| `src/domain/sync/ownDeletion.test.ts` | à lire |  |
| `src/domain/sync/ownDeletion.ts` | à lire |  |
| `src/domain/sync/ownState.ts` | lu | Partie 3 : Arrivée par tranches, finalisation des curseurs, états propres et publication intégralement lus. A-009 étendu : curseur couvert avancé malgré champ inconnu perdu. |
| `src/domain/sync/parse.test.ts` | à lire |  |
| `src/domain/sync/parse.ts` | à lire |  |
| `src/domain/sync/pendingFiles.test.ts` | à lire |  |
| `src/domain/sync/pendingFiles.ts` | à lire |  |
| `src/domain/sync/positions.ts` | lu | Partie 3 : Arrivée par tranches, finalisation des curseurs, états propres et publication intégralement lus. A-009 étendu : curseur couvert avancé malgré champ inconnu perdu. |
| `src/domain/sync/publishRotation.test.ts` | à lire |  |
| `src/domain/sync/publishRotation.ts` | à lire |  |
| `src/domain/sync/repairs.ts` | à lire |  |
| `src/domain/sync/retention.test.ts` | à lire |  |
| `src/domain/sync/retention.ts` | lu | Partie 3 : Éligibilité des instantanés, accusés, expiration, purge et ordre des oublis intégralement lus ; contrat natif à vérifier en partie 8b. |
| `src/domain/sync/schemaRepublish.ts` | lu | Partie 3 : Conservation des créations incomplètes, détection et republication intégralement lues, confrontées à ADR 0018. |
| `src/domain/sync/stored.ts` | à lire |  |
| `src/domain/sync/storedQa.test.ts` | à lire |  |
| `src/domain/sync/syncTables.ts` | à lire |  |
| `src/domain/syncBanners.test.ts` | à lire |  |
| `src/domain/syncBanners.ts` | lu | Partie 3 : Cycle intégral, reprises, publication, entretien, états et choix des bandeaux lus ; état de réintégration transmis au statut, raccordement interface à terminer. |
| `src/domain/syntheticTimer.test.ts` | à lire |  |
| `src/domain/syntheticTimer.ts` | à lire |  |
| `src/domain/taskPostpone.test.ts` | à lire |  |
| `src/domain/taskPostpone.ts` | à lire |  |
| `src/domain/taskRules.test.ts` | à lire |  |
| `src/domain/taskRules.ts` | à lire |  |
| `src/domain/taskSchedule.test.ts` | à lire |  |
| `src/domain/taskSchedule.ts` | à lire |  |
| `src/domain/taskTrash.test.ts` | à lire |  |
| `src/domain/taskTrash.ts` | à lire |  |
| `src/domain/textEncoding.test.ts` | à lire |  |
| `src/domain/textEncoding.ts` | à lire |  |
| `src/domain/timeFormat.arch.test.ts` | à lire |  |
| `src/domain/timeFormat.test.ts` | à lire |  |
| `src/domain/timeFormat.ts` | à lire |  |
| `src/domain/timeZone.test.ts` | à lire |  |
| `src/domain/timeZone.ts` | à lire |  |
| `src/domain/timeZoneLocalToUtc.test.ts` | à lire |  |
| `src/domain/todayList.test.ts` | à lire |  |
| `src/domain/todayList.ts` | lu | Partie 1 : Lecture complète du cycle statique hérité : appels croisés dans des fonctions, pas pendant leur initialisation ; aucun plantage démontré. |
| `src/domain/training/bodyweight.ts` | à lire |  |
| `src/domain/training/circuit.position.test.ts` | à lire |  |
| `src/domain/training/circuit.test.ts` | à lire |  |
| `src/domain/training/circuit.ts` | à lire |  |
| `src/domain/training/closure.test.ts` | à lire |  |
| `src/domain/training/closure.ts` | à lire |  |
| `src/domain/training/confidence.test.ts` | à lire |  |
| `src/domain/training/confidence.ts` | lu | Partie 1 : Lecture complète pour qualification du candidat window : variable locale ; revue des formules réservée parties 4/6. |
| `src/domain/training/config.ts` | à lire |  |
| `src/domain/training/constraints.test.ts` | à lire |  |
| `src/domain/training/constraints.ts` | à lire |  |
| `src/domain/training/cycleWeek.test.ts` | à lire |  |
| `src/domain/training/cycleWeek.ts` | à lire |  |
| `src/domain/training/decision.ts` | à lire |  |
| `src/domain/training/dep01.positionTotal.test.ts` | à lire |  |
| `src/domain/training/dumbbellPair.test.ts` | à lire |  |
| `src/domain/training/dumbbellPair.ts` | à lire |  |
| `src/domain/training/equipment.ts` | à lire |  |
| `src/domain/training/equipmentBackfill.test.ts` | à lire |  |
| `src/domain/training/equipmentFilter.test.ts` | à lire |  |
| `src/domain/training/estimate1rm.test.ts` | à lire |  |
| `src/domain/training/estimate1rm.ts` | à lire |  |
| `src/domain/training/exerciseCatalog.ts` | à lire |  |
| `src/domain/training/exerciseResolution.test.ts` | à lire |  |
| `src/domain/training/exerciseResolution.ts` | à lire |  |
| `src/domain/training/exerciseSheet.test.ts` | à lire |  |
| `src/domain/training/exerciseSheet.ts` | à lire |  |
| `src/domain/training/explain.test.ts` | à lire |  |
| `src/domain/training/explain.ts` | à lire |  |
| `src/domain/training/explainNotes.test.ts` | à lire |  |
| `src/domain/training/generateSession.test.ts` | à lire |  |
| `src/domain/training/generateSession.ts` | à lire |  |
| `src/domain/training/generationTypes.ts` | à lire |  |
| `src/domain/training/index.ts` | à lire |  |
| `src/domain/training/loadGrid.test.ts` | à lire |  |
| `src/domain/training/loadGrid.ts` | à lire |  |
| `src/domain/training/media.test.ts` | à lire |  |
| `src/domain/training/media.ts` | à lire |  |
| `src/domain/training/mesocycle.prog01.test.ts` | à lire |  |
| `src/domain/training/mesocycle.test.ts` | à lire |  |
| `src/domain/training/mesocycle.ts` | à lire |  |
| `src/domain/training/positionRank.ts` | à lire |  |
| `src/domain/training/prescribe.i408.test.ts` | à lire |  |
| `src/domain/training/prescribe.property.test.ts` | à lire |  |
| `src/domain/training/prescribe.review.test.ts` | à lire |  |
| `src/domain/training/prescribe.test.ts` | à lire |  |
| `src/domain/training/prescribe.ts` | à lire |  |
| `src/domain/training/prescriptionInput.test.ts` | à lire |  |
| `src/domain/training/prescriptionInput.ts` | à lire |  |
| `src/domain/training/programDay.test.ts` | à lire |  |
| `src/domain/training/programDay.ts` | à lire |  |
| `src/domain/training/programModes.test.ts` | à lire |  |
| `src/domain/training/programModes.ts` | à lire |  |
| `src/domain/training/programPause.test.ts` | à lire |  |
| `src/domain/training/programPause.ts` | à lire |  |
| `src/domain/training/recoverySplit.ts` | à lire |  |
| `src/domain/training/redDay.test.ts` | à lire |  |
| `src/domain/training/redDay.ts` | à lire |  |
| `src/domain/training/replay.test.ts` | à lire |  |
| `src/domain/training/replay.ts` | à lire |  |
| `src/domain/training/restDefault.test.ts` | à lire |  |
| `src/domain/training/restDefault.ts` | à lire |  |
| `src/domain/training/rev01.bodyweight.test.ts` | à lire |  |
| `src/domain/training/rev01.position.test.ts` | à lire |  |
| `src/domain/training/routineCircuit.test.ts` | à lire |  |
| `src/domain/training/routineCircuit.ts` | à lire |  |
| `src/domain/training/routineRules.test.ts` | à lire |  |
| `src/domain/training/routineRules.ts` | à lire |  |
| `src/domain/training/session.test.ts` | à lire |  |
| `src/domain/training/session.ts` | à lire |  |
| `src/domain/training/strengthScore.test.ts` | à lire |  |
| `src/domain/training/strengthScore.ts` | à lire |  |
| `src/domain/training/types.ts` | à lire |  |
| `src/domain/training/warmup.test.ts` | à lire |  |
| `src/domain/training/warmup.ts` | à lire |  |
| `src/domain/types.test.ts` | à lire |  |
| `src/domain/types.ts` | à lire |  |
| `src/domain/week.test.ts` | à lire |  |
| `src/domain/week.ts` | lu | Partie 1 : Lecture complète du cycle statique hérité : appels croisés dans des fonctions, pas pendant leur initialisation ; aucun plantage démontré. |
| `src/domain/weekFromIso.test.ts` | à lire |  |
| `src/features/ErgoP5.test.tsx` | à lire |  |
| `src/features/ErgoScreens.test.tsx` | à lire |  |
| `src/features/app/AppContainerContext.test.tsx` | à lire |  |
| `src/features/app/AppContainerContext.tsx` | lu | Partie 1 : Injection, instance par conteneur, état transverse et diagnostics lus ; héritages identifiés. |
| `src/features/app/AppStatusBanner.test.tsx` | à lire |  |
| `src/features/app/AppStatusBanner.tsx` | à lire |  |
| `src/features/app/DbFailureDetails.css` | à lire |  |
| `src/features/app/DbFailureDetails.tsx` | lu | Partie 1 : Démarrage différé, arrêt, suivi des étapes, diagnostics et erreurs absorbées lus ; relais partie-01. |
| `src/features/app/ErgoToday.test.tsx` | à lire |  |
| `src/features/app/ErgoToday02.test.tsx` | à lire |  |
| `src/features/app/FileSaveFailure.css` | à lire |  |
| `src/features/app/FileSaveFailure.tsx` | à lire |  |
| `src/features/app/RecoveryFailure.tsx` | à lire |  |
| `src/features/app/SectionNotice.css` | à lire |  |
| `src/features/app/SectionNotice.test.tsx` | à lire |  |
| `src/features/app/SectionNotice.tsx` | lu | Partie 1 : Frontières Suspense/erreur, réessai, préchargement et composition des sections lus ; parcours complets réservés partie 7. |
| `src/features/app/ShellChrome.css` | à lire |  |
| `src/features/app/ShellChrome.tsx` | à lire |  |
| `src/features/app/StartupBlocked.test.tsx` | à lire |  |
| `src/features/app/StartupBlocked.tsx` | à lire |  |
| `src/features/app/StartupWatchdog.tsx` | lu | Partie 1 : Démarrage différé, arrêt, suivi des étapes, diagnostics et erreurs absorbées lus ; relais partie-01. |
| `src/features/app/TodayPcSide.tsx` | à lire |  |
| `src/features/app/TodayScreen.css` | à lire |  |
| `src/features/app/TodayScreen.test.tsx` | à lire |  |
| `src/features/app/TodayScreen.tsx` | à lire |  |
| `src/features/app/UndoToast.css` | à lire |  |
| `src/features/app/UndoToast.test.tsx` | à lire |  |
| `src/features/app/UndoToast.tsx` | à lire |  |
| `src/features/app/UpdateRestoreAction.tsx` | à lire |  |
| `src/features/app/a9AfterApply.test.tsx` | à lire |  |
| `src/features/app/appStatus.ts` | à lire |  |
| `src/features/app/appStore.ts` | lu | Partie 1 : Injection, instance par conteneur, état transverse et diagnostics lus ; héritages identifiés. |
| `src/features/app/bootstrap.recoveryWriter.test.ts` | à lire |  |
| `src/features/app/bootstrap.storage.test.ts` | à lire |  |
| `src/features/app/bootstrap.sync.test.ts` | à lire |  |
| `src/features/app/bootstrap.test.ts` | à lire |  |
| `src/features/app/bootstrap.ts` | lu | Partie 1 : Composition, ordre des attentes, publication des erreurs et nettoyage lus ; réintégration/garde à approfondir en parties 2/3. |
| `src/features/app/container.test.ts` | à lire |  |
| `src/features/app/container.ts` | lu | Partie 1 : Injection, instance par conteneur, état transverse et diagnostics lus ; héritages identifiés. |
| `src/features/app/dbFailure.test.tsx` | à lire |  |
| `src/features/app/desktop.test.tsx` | à lire |  |
| `src/features/app/desktop.ts` | à lire |  |
| `src/features/app/fileSaveFailure.test.tsx` | à lire |  |
| `src/features/app/globalErrors.test.ts` | à lire |  |
| `src/features/app/globalErrors.ts` | à lire |  |
| `src/features/app/idle.ts` | lu | Partie 1 : Frontières Suspense/erreur, réessai, préchargement et composition des sections lus ; parcours complets réservés partie 7. |
| `src/features/app/lazyHosts.test.tsx` | à lire |  |
| `src/features/app/lazyScreens.css` | à lire |  |
| `src/features/app/lazyScreens.inventory.test.tsx` | à lire |  |
| `src/features/app/lazyScreens.test.tsx` | à lire |  |
| `src/features/app/lazyScreens.tsx` | lu | Partie 1 : Frontières Suspense/erreur, réessai, préchargement et composition des sections lus ; parcours complets réservés partie 7. |
| `src/features/app/logJournalBoot.ts` | à lire |  |
| `src/features/app/navigation.test.ts` | à lire |  |
| `src/features/app/navigation.ts` | à lire |  |
| `src/features/app/notice.ts` | à lire |  |
| `src/features/app/recoveryFailure.test.tsx` | à lire |  |
| `src/features/app/saveFile.ts` | à lire |  |
| `src/features/app/screenNames.ts` | à lire |  |
| `src/features/app/settingsLedger.ts` | à lire |  |
| `src/features/app/shareStartupLog.ts` | à lire |  |
| `src/features/app/shortcuts.test.ts` | à lire |  |
| `src/features/app/shortcuts.ts` | à lire |  |
| `src/features/app/shortcutsHelp.test.ts` | à lire |  |
| `src/features/app/shortcutsHelp.ts` | à lire |  |
| `src/features/app/shortcutsQa.test.ts` | à lire |  |
| `src/features/app/shortcutsWiring.test.ts` | à lire |  |
| `src/features/app/startup.test.ts` | à lire |  |
| `src/features/app/startup.ts` | lu | Partie 1 : Démarrage différé, arrêt, suivi des étapes, diagnostics et erreurs absorbées lus ; relais partie-01. |
| `src/features/app/startupSteps.test.ts` | à lire |  |
| `src/features/app/startupSteps.ts` | lu | Partie 1 : Démarrage différé, arrêt, suivi des étapes, diagnostics et erreurs absorbées lus ; relais partie-01. |
| `src/features/app/tabShortcuts.dom.test.tsx` | à lire |  |
| `src/features/app/tabShortcuts.test.ts` | à lire |  |
| `src/features/app/tabShortcuts.ts` | à lire |  |
| `src/features/app/timeZoneWatcher.test.ts` | à lire |  |
| `src/features/app/timeZoneWatcher.ts` | lu | Partie 1 : Démarrage différé, arrêt, suivi des étapes, diagnostics et erreurs absorbées lus ; relais partie-01. |
| `src/features/app/todayTestPreload.ts` | à lire |  |
| `src/features/app/undo.test.ts` | à lire |  |
| `src/features/app/undo.ts` | à lire |  |
| `src/features/app/updateFailure.test.tsx` | à lire |  |
| `src/features/app/updateFailureQa.test.tsx` | à lire |  |
| `src/features/app/updateRestore.ts` | à lire |  |
| `src/features/app/updateRestoreReview.test.tsx` | à lire |  |
| `src/features/bodyProgress/BodyProgress.css` | à lire |  |
| `src/features/bodyProgress/BodyProgress.test.tsx` | à lire |  |
| `src/features/bodyProgress/BodyProgress.tsx` | à lire |  |
| `src/features/bodyProgress/BodyProgressErgo02.test.tsx` | à lire |  |
| `src/features/bodyProgress/BodyZones.tsx` | à lire |  |
| `src/features/bodyProgress/bodyZone.test.ts` | à lire |  |
| `src/features/bodyProgress/bodyZone.ts` | à lire |  |
| `src/features/cardio/Cardio.css` | à lire |  |
| `src/features/cardio/CardioGps.test.tsx` | à lire |  |
| `src/features/cardio/CardioGps.tsx` | à lire |  |
| `src/features/cardio/CardioProgress.test.tsx` | à lire |  |
| `src/features/cardio/CardioProgress.tsx` | à lire |  |
| `src/features/cardio/CardioView.test.tsx` | à lire |  |
| `src/features/cardio/CardioView.tsx` | à lire |  |
| `src/features/cardio/gpsFigures.ts` | à lire |  |
| `src/features/notifications/index.test.ts` | à lire |  |
| `src/features/notifications/index.ts` | à lire |  |
| `src/features/notifications/noUnusualValuesNotification.test.ts` | à lire |  |
| `src/features/notifications/recoveryNotifications.test.ts` | à lire |  |
| `src/features/notifications/recoveryNotifications.ts` | à lire |  |
| `src/features/notifications/supplementActions.test.ts` | à lire |  |
| `src/features/notifications/supplementActions.ts` | à lire |  |
| `src/features/notifications/supplementNotifications.test.ts` | à lire |  |
| `src/features/notifications/supplementNotifications.ts` | à lire |  |
| `src/features/notifications/supplementWake.test.ts` | à lire |  |
| `src/features/notifications/supplementWake.ts` | à lire |  |
| `src/features/nutrition/CheckInErgo03.test.tsx` | à lire |  |
| `src/features/nutrition/ErgoNutrition.test.tsx` | à lire |  |
| `src/features/nutrition/ErgoP2.test.tsx` | à lire |  |
| `src/features/nutrition/NutritionRemainingCard.test.tsx` | à lire |  |
| `src/features/nutrition/NutritionRemainingCard.tsx` | à lire |  |
| `src/features/nutrition/NutritionScreen.css` | à lire |  |
| `src/features/nutrition/NutritionScreen.test.tsx` | à lire |  |
| `src/features/nutrition/NutritionScreen.tsx` | à lire |  |
| `src/features/nutrition/NutritionStates.test.tsx` | à lire |  |
| `src/features/nutrition/StrategyErgo03.test.tsx` | à lire |  |
| `src/features/nutrition/catalogue/ciqualCatalogue.test.ts` | à lire |  |
| `src/features/nutrition/catalogue/ciqualCatalogue.ts` | à lire |  |
| `src/features/nutrition/checkIn/CheckIn.css` | à lire |  |
| `src/features/nutrition/checkIn/CheckInErgo02.test.tsx` | à lire |  |
| `src/features/nutrition/checkIn/CheckInView.tsx` | à lire |  |
| `src/features/nutrition/checkIn/weekSummary.test.ts` | à lire |  |
| `src/features/nutrition/checkIn/weekSummary.ts` | à lire |  |
| `src/features/nutrition/dashboard/Charts.tsx` | à lire |  |
| `src/features/nutrition/dashboard/DashboardView.tsx` | à lire |  |
| `src/features/nutrition/dashboard/DashboardView.weighIn.test.tsx` | à lire |  |
| `src/features/nutrition/dashboard/model.test.ts` | à lire |  |
| `src/features/nutrition/dashboard/model.ts` | à lire |  |
| `src/features/nutrition/dayType.test.ts` | à lire |  |
| `src/features/nutrition/dayType.ts` | à lire |  |
| `src/features/nutrition/journal/DayCompleteness.test.tsx` | à lire |  |
| `src/features/nutrition/journal/EntryEditor.tsx` | à lire |  |
| `src/features/nutrition/journal/JournalView.tsx` | à lire |  |
| `src/features/nutrition/quickAdd/QuickAddForm.tsx` | à lire |  |
| `src/features/nutrition/recipes/IngredientPicker.tsx` | à lire |  |
| `src/features/nutrition/recipes/RecipeEditor.tsx` | à lire |  |
| `src/features/nutrition/recipes/RecipeHits.tsx` | à lire |  |
| `src/features/nutrition/recipes/RecipeQuantityStep.tsx` | à lire |  |
| `src/features/nutrition/recipes/Recipes.css` | à lire |  |
| `src/features/nutrition/recipes/Recipes.test.tsx` | à lire |  |
| `src/features/nutrition/recipes/RecipesView.tsx` | à lire |  |
| `src/features/nutrition/recipes/recipeModel.test.ts` | à lire |  |
| `src/features/nutrition/recipes/recipeModel.ts` | à lire |  |
| `src/features/nutrition/recipes/recipeSearch.ts` | à lire |  |
| `src/features/nutrition/scan/BarcodeScanView.tsx` | à lire |  |
| `src/features/nutrition/scan/scanBarcode.test.ts` | à lire |  |
| `src/features/nutrition/scan/scanBarcode.ts` | à lire |  |
| `src/features/nutrition/search/CustomFood.test.tsx` | à lire |  |
| `src/features/nutrition/search/CustomFoodForm.tsx` | à lire |  |
| `src/features/nutrition/search/Favorites.test.tsx` | à lire |  |
| `src/features/nutrition/search/FavoritesCiqual.test.tsx` | à lire |  |
| `src/features/nutrition/search/FoodSearchPanel.tsx` | à lire |  |
| `src/features/nutrition/search/OffSearch.test.tsx` | à lire |  |
| `src/features/nutrition/search/catalogueSearch.test.ts` | à lire |  |
| `src/features/nutrition/search/catalogueSearch.ts` | à lire |  |
| `src/features/nutrition/search/favoritesStore.ts` | à lire |  |
| `src/features/nutrition/search/offLookup.test.ts` | à lire |  |
| `src/features/nutrition/search/offLookup.ts` | à lire |  |
| `src/features/nutrition/search/offMessages.ts` | à lire |  |
| `src/features/nutrition/search/resolveFood.ts` | à lire |  |
| `src/features/nutrition/shared.tsx` | à lire |  |
| `src/features/nutrition/strategy/RestTargetForm.tsx` | à lire |  |
| `src/features/nutrition/strategy/StrategyView.tsx` | à lire |  |
| `src/features/nutrition/strategy/TargetForm.tsx` | à lire |  |
| `src/features/nutrition/strategy/useFutureConfirm.test.tsx` | à lire |  |
| `src/features/nutrition/strategy/useFutureConfirm.tsx` | à lire |  |
| `src/features/nutrition/supplements/Supplements.css` | à lire |  |
| `src/features/nutrition/supplements/SupplementsFix0242.test.tsx` | à lire |  |
| `src/features/nutrition/supplements/SupplementsTodayCard.test.tsx` | à lire |  |
| `src/features/nutrition/supplements/SupplementsTodayCard.tsx` | à lire |  |
| `src/features/nutrition/supplements/SupplementsView.test.tsx` | à lire |  |
| `src/features/nutrition/supplements/SupplementsView.tsx` | à lire |  |
| `src/features/nutrition/supplements/SupplementsViewErgo02.test.tsx` | à lire |  |
| `src/features/nutrition/supplements/constancy.test.ts` | à lire |  |
| `src/features/nutrition/supplements/constancy.ts` | à lire |  |
| `src/features/nutrition/supplements/replan.ts` | à lire |  |
| `src/features/nutrition/useCases.test.ts` | à lire |  |
| `src/features/nutrition/useCases.ts` | à lire |  |
| `src/features/nutrition/useNutritionData.ts` | à lire |  |
| `src/features/nutrition/useNutritionStale.test.tsx` | à lire |  |
| `src/features/nutrition/workoutSync.test.tsx` | à lire |  |
| `src/features/onboarding/BodyMap.tsx` | à lire |  |
| `src/features/onboarding/OnboardingErgo02.test.tsx` | à lire |  |
| `src/features/onboarding/OnboardingFlow.css` | à lire |  |
| `src/features/onboarding/OnboardingFlow.test.tsx` | à lire |  |
| `src/features/onboarding/OnboardingFlow.tsx` | à lire |  |
| `src/features/onboarding/OnboardingHost.test.tsx` | à lire |  |
| `src/features/onboarding/OnboardingHost.tsx` | à lire |  |
| `src/features/onboarding/OptionCards.tsx` | à lire |  |
| `src/features/onboarding/StepsBasics.tsx` | à lire |  |
| `src/features/onboarding/StepsPlan.tsx` | à lire |  |
| `src/features/onboarding/firstSession.ts` | à lire |  |
| `src/features/onboarding/launch.basePresence.test.ts` | à lire |  |
| `src/features/onboarding/launch.ts` | à lire |  |
| `src/features/onboarding/onboardingData.test.ts` | à lire |  |
| `src/features/onboarding/onboardingData.ts` | à lire |  |
| `src/features/recovery/FactorJournalCard.tsx` | à lire |  |
| `src/features/recovery/RecoveryFactors.test.tsx` | à lire |  |
| `src/features/recovery/RecoveryProgress.tsx` | à lire |  |
| `src/features/recovery/RecoveryToday.css` | à lire |  |
| `src/features/recovery/RecoveryToday.test.tsx` | à lire |  |
| `src/features/recovery/RecoveryToday.tsx` | à lire |  |
| `src/features/recovery/UnusualValuesCard.tsx` | à lire |  |
| `src/features/recovery/display.test.ts` | à lire |  |
| `src/features/recovery/display.ts` | à lire |  |
| `src/features/recovery/factorJournal.ts` | à lire |  |
| `src/features/security/AppLockGate.test.tsx` | à lire |  |
| `src/features/security/AppLockGate.tsx` | à lire |  |
| `src/features/security/LockScreen.tsx` | à lire |  |
| `src/features/security/appLockBoot.ts` | à lire |  |
| `src/features/security/appLockLateContent.test.tsx` | à lire |  |
| `src/features/security/appLockLazyFailure.test.tsx` | à lire |  |
| `src/features/security/appLockQa.test.tsx` | à lire |  |
| `src/features/security/appLockScreenFailure.test.tsx` | à lire |  |
| `src/features/security/appLockStore.ts` | à lire |  |
| `src/features/security/excursion.ts` | à lire |  |
| `src/features/security/lockLayer.ts` | à lire |  |
| `src/features/security/privacyCover.ts` | à lire |  |
| `src/features/security/security.css` | à lire |  |
| `src/features/security/startAppLock.test.tsx` | à lire |  |
| `src/features/security/startAppLock.ts` | à lire |  |
| `src/features/security/systemSettingsAction.ts` | à lire |  |
| `src/features/settings/AboutSection.tsx` | à lire |  |
| `src/features/settings/AppearanceScreen.css` | à lire |  |
| `src/features/settings/AppearanceScreen.test.tsx` | à lire |  |
| `src/features/settings/AppearanceScreen.tsx` | à lire |  |
| `src/features/settings/AppleHealthScreen.test.tsx` | à lire |  |
| `src/features/settings/AppleHealthScreen.tsx` | à lire |  |
| `src/features/settings/BackupRow.tsx` | à lire |  |
| `src/features/settings/BackupSheet.css` | à lire |  |
| `src/features/settings/BackupSheet.tsx` | à lire |  |
| `src/features/settings/BodyScreen.css` | à lire |  |
| `src/features/settings/BodyScreen.test.tsx` | à lire |  |
| `src/features/settings/BodyScreen.tsx` | à lire |  |
| `src/features/settings/ExportFull.test.tsx` | à lire |  |
| `src/features/settings/ExportImportScreen.test.tsx` | à lire |  |
| `src/features/settings/ExportImportScreen.tsx` | à lire |  |
| `src/features/settings/HealthBodyImportSection.test.tsx` | à lire |  |
| `src/features/settings/HealthBodyImportSection.tsx` | à lire |  |
| `src/features/settings/LinkRow.tsx` | à lire |  |
| `src/features/settings/PlusErgo02.test.tsx` | à lire |  |
| `src/features/settings/ProfileCard.tsx` | à lire |  |
| `src/features/settings/RecoveryImportSection.test.tsx` | à lire |  |
| `src/features/settings/RecoveryImportSection.tsx` | à lire |  |
| `src/features/settings/RecoveryNotificationsSection.css` | à lire |  |
| `src/features/settings/RecoveryNotificationsSection.test.tsx` | à lire |  |
| `src/features/settings/RecoveryNotificationsSection.tsx` | à lire |  |
| `src/features/settings/ResetDataScreen.test.tsx` | à lire |  |
| `src/features/settings/ResetDataScreen.tsx` | à lire |  |
| `src/features/settings/SecuritySection.tsx` | à lire |  |
| `src/features/settings/SettingsPanels.tsx` | à lire |  |
| `src/features/settings/SettingsPc.test.tsx` | à lire |  |
| `src/features/settings/SettingsScreen.css` | à lire |  |
| `src/features/settings/SettingsScreen.desktop.test.tsx` | à lire |  |
| `src/features/settings/SettingsScreen.test.tsx` | à lire |  |
| `src/features/settings/SettingsScreen.tsx` | à lire |  |
| `src/features/settings/SettingsScreenPc.tsx` | à lire |  |
| `src/features/settings/SigningAbout.dom.test.tsx` | à lire |  |
| `src/features/settings/TimerTestRow.test.tsx` | à lire |  |
| `src/features/settings/TimerTestRow.tsx` | à lire |  |
| `src/features/settings/appearance.ts` | à lire |  |
| `src/features/settings/backup.test.tsx` | à lire |  |
| `src/features/settings/backupLabels.test.ts` | à lire |  |
| `src/features/settings/backupLabels.ts` | à lire |  |
| `src/features/settings/backupOrigin.sheet.test.tsx` | à lire |  |
| `src/features/settings/backupScheduler.ts` | à lire |  |
| `src/features/settings/backupSchedulerStatus.ts` | à lire |  |
| `src/features/settings/backupStore.ts` | à lire |  |
| `src/features/settings/healthBodyImport/index.ts` | à lire |  |
| `src/features/settings/healthBodyImport/service.test.ts` | à lire |  |
| `src/features/settings/healthBodyImport/service.ts` | à lire |  |
| `src/features/settings/index.ts` | à lire |  |
| `src/features/settings/logs/LogsScreen.css` | à lire |  |
| `src/features/settings/logs/LogsScreen.test.tsx` | à lire |  |
| `src/features/settings/logs/LogsScreen.tsx` | à lire |  |
| `src/features/settings/logs/logExport.ts` | à lire |  |
| `src/features/settings/logs/logsQa.test.tsx` | à lire |  |
| `src/features/settings/logs/logsRow.test.tsx` | à lire |  |
| `src/features/settings/logs/logsUnavailable.test.tsx` | à lire |  |
| `src/features/settings/logs/sentinel.test.tsx` | à lire |  |
| `src/features/settings/logs/syncReport.test.ts` | à lire |  |
| `src/features/settings/logs/syncReport.ts` | à lire |  |
| `src/features/settings/logs/useLogJournal.ts` | à lire |  |
| `src/features/settings/prog01AfterMerge.test.tsx` | à lire |  |
| `src/features/settings/recoveryImport/afterRecompute.test.ts` | à lire |  |
| `src/features/settings/recoveryImport/index.ts` | à lire |  |
| `src/features/settings/recoveryImport/service.test.ts` | à lire |  |
| `src/features/settings/recoveryImport/service.ts` | à lire |  |
| `src/features/settings/recoveryImport/statusMessage.test.ts` | à lire |  |
| `src/features/settings/recoveryImport/statusMessage.ts` | à lire |  |
| `src/features/settings/recoveryImport/triggers.test.ts` | à lire |  |
| `src/features/settings/restoreFlow.ts` | à lire |  |
| `src/features/settings/restoreIos.test.tsx` | à lire |  |
| `src/features/settings/restoreMemo.ts` | à lire |  |
| `src/features/settings/restoreMemoPeek.ts` | à lire |  |
| `src/features/settings/restoreQa.closed.test.tsx` | à lire |  |
| `src/features/settings/restoreQa.sheet.test.tsx` | à lire |  |
| `src/features/settings/restoreQuiesce.ts` | à lire |  |
| `src/features/settings/restoreQuiet.test.ts` | à lire |  |
| `src/features/settings/settingsStore.ts` | à lire |  |
| `src/features/settings/settingsUseCases.test.ts` | à lire |  |
| `src/features/settings/settingsUseCases.ts` | à lire |  |
| `src/features/settings/syntheticTimer.test.ts` | à lire |  |
| `src/features/settings/syntheticTimer.ts` | à lire |  |
| `src/features/settings/theme.test.ts` | à lire |  |
| `src/features/settings/theme.ts` | lu | Partie 1 : Import dynamique Tauri hors façade à consigner ; exceptions ignorées explicitement pour barre de titre facultative. |
| `src/features/settings/themeInit.test.tsx` | à lire |  |
| `src/features/settings/useBackupLabelContext.ts` | à lire |  |
| `src/features/settings/useSyncValue.ts` | à lire |  |
| `src/features/shortcuts/ShortcutsHelp.css` | à lire |  |
| `src/features/shortcuts/ShortcutsHelp.tsx` | à lire |  |
| `src/features/shortcuts/ShortcutsSettingsSection.css` | à lire |  |
| `src/features/shortcuts/ShortcutsSettingsSection.tsx` | à lire |  |
| `src/features/shortcuts/index.ts` | à lire |  |
| `src/features/shortcuts/registerShellShortcuts.ts` | à lire |  |
| `src/features/shortcuts/shortcuts.dom.test.tsx` | à lire |  |
| `src/features/signing/SigningAbout.tsx` | à lire |  |
| `src/features/signing/requestPermission.ts` | à lire |  |
| `src/features/signing/signingNotice.test.ts` | à lire |  |
| `src/features/signing/signingNotice.ts` | à lire |  |
| `src/features/signing/signingNoticeQa.test.ts` | à lire |  |
| `src/features/signing/signingRun.ts` | à lire |  |
| `src/features/signing/signingStatus.ts` | à lire |  |
| `src/features/signing/signingText.ts` | à lire |  |
| `src/features/signing/testKit.ts` | à lire |  |
| `src/features/strength/StrengthScore.css` | à lire |  |
| `src/features/strength/StrengthScore.test.tsx` | à lire |  |
| `src/features/strength/StrengthScore.tsx` | à lire |  |
| `src/features/sync/CarryReport.css` | à lire |  |
| `src/features/sync/CarryReportSheet.tsx` | à lire |  |
| `src/features/sync/ConflictList.css` | à lire |  |
| `src/features/sync/ConflictList.test.tsx` | à lire |  |
| `src/features/sync/ConflictList.tsx` | à lire |  |
| `src/features/sync/ForgetDeviceDialog.tsx` | à lire |  |
| `src/features/sync/IosPairingRow.tsx` | à lire |  |
| `src/features/sync/IosPairingScreen.css` | à lire |  |
| `src/features/sync/IosPairingScreen.tsx` | à lire |  |
| `src/features/sync/JoinProgress.tsx` | à lire |  |
| `src/features/sync/ResetSyncDialog.tsx` | à lire |  |
| `src/features/sync/RestoreChoiceDialog.tsx` | à lire |  |
| `src/features/sync/RestoreChoiceHost.tsx` | à lire |  |
| `src/features/sync/RestoreMarkerResume.tsx` | à lire |  |
| `src/features/sync/SyncDetailsCarryReport.tsx` | à lire |  |
| `src/features/sync/SyncDetailsCarryReportHost.tsx` | à lire |  |
| `src/features/sync/SyncDetailsConflicts.tsx` | à lire |  |
| `src/features/sync/SyncDetailsDedup.test.tsx` | à lire |  |
| `src/features/sync/SyncDetailsDedup.tsx` | à lire |  |
| `src/features/sync/SyncDetailsFolder.tsx` | à lire |  |
| `src/features/sync/SyncDetailsForget.css` | à lire |  |
| `src/features/sync/SyncDetailsForget.test.tsx` | à lire |  |
| `src/features/sync/SyncDetailsForget.tsx` | à lire |  |
| `src/features/sync/SyncDetailsOwnDeletion.css` | à lire |  |
| `src/features/sync/SyncDetailsOwnDeletion.test.tsx` | à lire |  |
| `src/features/sync/SyncDetailsOwnDeletion.tsx` | à lire |  |
| `src/features/sync/SyncDetailsOwnDeletionHost.tsx` | à lire |  |
| `src/features/sync/SyncDetailsPairing.test.tsx` | à lire |  |
| `src/features/sync/SyncDetailsPairing.tsx` | à lire |  |
| `src/features/sync/SyncDetailsPairingQa.test.tsx` | à lire |  |
| `src/features/sync/SyncDetailsPending.test.tsx` | à lire |  |
| `src/features/sync/SyncDetailsRescue.tsx` | à lire |  |
| `src/features/sync/SyncDetailsReset.test.tsx` | à lire |  |
| `src/features/sync/SyncDetailsReset.tsx` | à lire |  |
| `src/features/sync/SyncDetailsScreen.css` | à lire |  |
| `src/features/sync/SyncDetailsScreen.tsx` | à lire |  |
| `src/features/sync/SyncDetailsVersion.test.tsx` | à lire |  |
| `src/features/sync/SyncDetailsVersion.tsx` | lu | Partie 3 : Service et affichage de réintégration intégralement lus ; 7 tests verts sur le seul fichier yIos02, hors sandbox après blocage spawn EPERM avant exécution. |
| `src/features/sync/SyncDeviceName.tsx` | à lire |  |
| `src/features/sync/SyncNowButton.test.tsx` | à lire |  |
| `src/features/sync/SyncNowButton.tsx` | à lire |  |
| `src/features/sync/SyncRefonte.test.tsx` | à lire |  |
| `src/features/sync/SyncScreens.test.tsx` | à lire |  |
| `src/features/sync/SyncSettingsSection.css` | à lire |  |
| `src/features/sync/SyncSettingsSection.test.tsx` | à lire |  |
| `src/features/sync/SyncSettingsSection.tsx` | à lire |  |
| `src/features/sync/SyncStatusLine.tsx` | à lire |  |
| `src/features/sync/carryReportBanner.test.tsx` | à lire |  |
| `src/features/sync/carryReportBannerLine.ts` | à lire |  |
| `src/features/sync/carryReportBannerRace.test.ts` | à lire |  |
| `src/features/sync/carryReportLoadFailure.test.tsx` | à lire |  |
| `src/features/sync/carryReportOpen.ts` | à lire |  |
| `src/features/sync/carryReportReview2.test.tsx` | à lire |  |
| `src/features/sync/carryReportScenario.test.tsx` | à lire |  |
| `src/features/sync/carryReportSheet.test.tsx` | à lire |  |
| `src/features/sync/carryReportText.ts` | à lire |  |
| `src/features/sync/carryWarnings.test.tsx` | à lire |  |
| `src/features/sync/conflictLabels.test.ts` | à lire |  |
| `src/features/sync/conflictText.ts` | à lire |  |
| `src/features/sync/deviceNames.test.tsx` | à lire |  |
| `src/features/sync/failureKinds.ts` | à lire |  |
| `src/features/sync/finalRemarks.test.tsx` | à lire |  |
| `src/features/sync/forgetBanner.test.tsx` | à lire |  |
| `src/features/sync/forgetBannerQa.test.tsx` | à lire |  |
| `src/features/sync/forgetText.ts` | à lire |  |
| `src/features/sync/keyPresence.ts` | à lire |  |
| `src/features/sync/olderDeviceBanner.test.tsx` | à lire |  |
| `src/features/sync/olderDeviceText.retry.test.tsx` | à lire |  |
| `src/features/sync/pairing-window/PairingView.test.tsx` | à lire |  |
| `src/features/sync/pairing-window/PairingView.tsx` | à lire |  |
| `src/features/sync/pairing-window/RecoveryKeyEntry.tsx` | à lire |  |
| `src/features/sync/pairing-window/main.tsx` | lu | Partie 1 : Entrées et initialisation du thème lues ; fenêtre pairing distincte sans StrictMode ; thème système à vérifier partie 7c. |
| `src/features/sync/pairing-window/pairing.css` | à lire |  |
| `src/features/sync/pairing-window/pairingPlatform.ts` | à lire |  |
| `src/features/sync/pairing-window/pairingQa.test.tsx` | à lire |  |
| `src/features/sync/pairing-window/pairingText.ts` | à lire |  |
| `src/features/sync/pairing-window/pairingWindowStates.test.tsx` | à lire |  |
| `src/features/sync/pairingDefects.test.tsx` | à lire |  |
| `src/features/sync/pairingHub.ts` | à lire |  |
| `src/features/sync/pairingMatrix.test.tsx` | à lire |  |
| `src/features/sync/pairingReview17.test.tsx` | à lire |  |
| `src/features/sync/pairingScreens.test.tsx` | à lire |  |
| `src/features/sync/pairingStatus.ts` | à lire |  |
| `src/features/sync/publishBlockedCause.test.tsx` | à lire |  |
| `src/features/sync/quit.test.ts` | à lire |  |
| `src/features/sync/reloadRetry.ts` | à lire |  |
| `src/features/sync/remoteChanges.ts` | à lire |  |
| `src/features/sync/resetBanner.test.tsx` | à lire |  |
| `src/features/sync/resetReason.ts` | à lire |  |
| `src/features/sync/resetText.ts` | à lire |  |
| `src/features/sync/restoreChoiceHost.test.tsx` | à lire |  |
| `src/features/sync/segmentGapText.test.tsx` | à lire |  |
| `src/features/sync/startSync.test.tsx` | à lire |  |
| `src/features/sync/startSync.ts` | lu | Partie 3 : Service et affichage de réintégration intégralement lus ; 7 tests verts sur le seul fichier yIos02, hors sandbox après blocage spawn EPERM avant exécution. |
| `src/features/sync/startSyncQa.test.tsx` | à lire |  |
| `src/features/sync/syncConflictUseCases.ts` | à lire |  |
| `src/features/sync/syncI18nQa.test.ts` | à lire |  |
| `src/features/sync/syncQa.test.tsx` | à lire |  |
| `src/features/sync/syncRestoreControl.ts` | à lire |  |
| `src/features/sync/syncRestoreState.ts` | à lire |  |
| `src/features/sync/syncStore.ts` | à lire |  |
| `src/features/sync/syncText.ts` | lu | Partie 3 : Service et affichage de réintégration intégralement lus ; 7 tests verts sur le seul fichier yIos02, hors sandbox après blocage spawn EPERM avant exécution. |
| `src/features/sync/syncedData.test.tsx` | à lire |  |
| `src/features/sync/testKit.ts` | à lire |  |
| `src/features/sync/waitingLong.test.tsx` | à lire |  |
| `src/features/sync/yIos01.test.tsx` | à lire |  |
| `src/features/sync/yIos02.test.tsx` | lu | Partie 3 : Service et affichage de réintégration intégralement lus ; 7 tests verts sur le seul fichier yIos02, hors sandbox après blocage spawn EPERM avant exécution. |
| `src/features/sync/yIos02Pairing.test.tsx` | à lire |  |
| `src/features/sync/yTech02Warnings.test.tsx` | à lire |  |
| `src/features/sync/yTech02WarningsQa.test.tsx` | à lire |  |
| `src/features/training/EquipmentView.tsx` | à lire |  |
| `src/features/training/Ergo02Load.test.tsx` | à lire |  |
| `src/features/training/Ergo02Screens.test.tsx` | à lire |  |
| `src/features/training/LibraryView.tsx` | à lire |  |
| `src/features/training/RoutineCircuit.test.tsx` | à lire |  |
| `src/features/training/RoutineCircuitUi.tsx` | à lire |  |
| `src/features/training/RoutineReorder.test.tsx` | à lire |  |
| `src/features/training/RoutinesView.tsx` | à lire |  |
| `src/features/training/TrainingScreen.css` | à lire |  |
| `src/features/training/TrainingScreen.test.tsx` | à lire |  |
| `src/features/training/TrainingScreen.tsx` | à lire |  |
| `src/features/training/content.test.ts` | à lire |  |
| `src/features/training/content.ts` | à lire |  |
| `src/features/training/content02.originals.json` | à lire |  |
| `src/features/training/content02.test.ts` | à lire |  |
| `src/features/training/cycle/CycleView.css` | à lire |  |
| `src/features/training/cycle/CycleView.test.tsx` | à lire |  |
| `src/features/training/cycle/CycleView.tsx` | à lire |  |
| `src/features/training/cycle/currentCycle.ts` | à lire |  |
| `src/features/training/cycle/sessionLink.test.ts` | à lire |  |
| `src/features/training/cycle/sessionLink.ts` | à lire |  |
| `src/features/training/history/History.css` | à lire |  |
| `src/features/training/history/History.test.tsx` | à lire |  |
| `src/features/training/history/HistoryDetail.tsx` | à lire |  |
| `src/features/training/history/HistoryReplay.test.tsx` | à lire |  |
| `src/features/training/history/HistorySetRow.tsx` | à lire |  |
| `src/features/training/history/HistoryTimeline.test.tsx` | à lire |  |
| `src/features/training/history/HistoryTimelineView.tsx` | à lire |  |
| `src/features/training/history/HistoryView.tsx` | à lire |  |
| `src/features/training/labels.ts` | à lire |  |
| `src/features/training/library/ExerciseSheetStats.tsx` | à lire |  |
| `src/features/training/library/Sheet.css` | à lire |  |
| `src/features/training/loadDisplay.test.ts` | à lire |  |
| `src/features/training/loadDisplay.ts` | à lire |  |
| `src/features/training/media/ExerciseMedia.css` | à lire |  |
| `src/features/training/media/ExerciseMedia.test.tsx` | à lire |  |
| `src/features/training/media/ExerciseMedia.tsx` | à lire |  |
| `src/features/training/media/exerciseMediaFiles.ts` | à lire |  |
| `src/features/training/session/ActiveSession.tsx` | à lire |  |
| `src/features/training/session/Circuit.css` | à lire |  |
| `src/features/training/session/Circuit.test.tsx` | à lire |  |
| `src/features/training/session/CircuitUi.tsx` | à lire |  |
| `src/features/training/session/CycleSessionLink.test.tsx` | à lire |  |
| `src/features/training/session/ErgoP1.test.tsx` | à lire |  |
| `src/features/training/session/ErgoP3.test.tsx` | à lire |  |
| `src/features/training/session/ErgoSession.test.tsx` | à lire |  |
| `src/features/training/session/ExerciseProgression.test.tsx` | à lire |  |
| `src/features/training/session/ExerciseProgression.tsx` | à lire |  |
| `src/features/training/session/ExerciseProgressionConstraints.test.tsx` | à lire |  |
| `src/features/training/session/ExerciseProgressionCycle.test.tsx` | à lire |  |
| `src/features/training/session/ExerciseProgressionNotes.test.tsx` | à lire |  |
| `src/features/training/session/ExerciseProgressionPair.test.tsx` | à lire |  |
| `src/features/training/session/ExerciseProgressionPosition.test.tsx` | à lire |  |
| `src/features/training/session/ExerciseWarmup.test.tsx` | à lire |  |
| `src/features/training/session/GeneratedSession.css` | à lire |  |
| `src/features/training/session/GeneratedSession.test.tsx` | à lire |  |
| `src/features/training/session/GeneratedSession.tsx` | à lire |  |
| `src/features/training/session/Progression.css` | à lire |  |
| `src/features/training/session/RecoverySession.css` | à lire |  |
| `src/features/training/session/RecoverySession.tsx` | à lire |  |
| `src/features/training/session/RecoverySplitProposed.test.tsx` | à lire |  |
| `src/features/training/session/RedDay.test.tsx` | à lire |  |
| `src/features/training/session/Session.css` | à lire |  |
| `src/features/training/session/SessionClosure.test.tsx` | à lire |  |
| `src/features/training/session/SessionScreen.test.tsx` | à lire |  |
| `src/features/training/session/SessionScreen.tsx` | à lire |  |
| `src/features/training/session/SetRow.tsx` | à lire |  |
| `src/features/training/session/StartSession.tsx` | à lire |  |
| `src/features/training/session/Summary.css` | à lire |  |
| `src/features/training/session/SummaryFigures.tsx` | à lire |  |
| `src/features/training/session/TodaySessionCard.tsx` | à lire |  |
| `src/features/training/session/TodaySessionCycle.test.tsx` | à lire |  |
| `src/features/training/session/TodaySessionPc.test.tsx` | à lire |  |
| `src/features/training/session/TodaySessionPreview.test.tsx` | à lire |  |
| `src/features/training/session/TodaySessionUnreadable.test.tsx` | à lire |  |
| `src/features/training/session/WorkoutSummary.tsx` | à lire |  |
| `src/features/training/session/generationInput.test.ts` | à lire |  |
| `src/features/training/session/generationInput.ts` | à lire |  |
| `src/features/training/session/prescriptionContext.ts` | à lire |  |
| `src/features/training/session/redDayState.ts` | à lire |  |
| `src/features/training/session/restTimer.test.ts` | à lire |  |
| `src/features/training/session/restTimer.ts` | à lire |  |
| `src/features/training/session/todaySessionPreview.ts` | à lire |  |
| `src/features/training/trainingNavigation.test.tsx` | à lire |  |
| `src/features/training/trainingState.test.ts` | à lire |  |
| `src/features/training/trainingState.ts` | à lire |  |
| `src/features/updater/UpdateBanner.css` | à lire |  |
| `src/features/updater/UpdateBanner.test.tsx` | à lire |  |
| `src/features/updater/UpdateBanner.tsx` | à lire |  |
| `src/features/updater/index.ts` | à lire |  |
| `src/features/updater/updateChecks.ts` | à lire |  |
| `src/features/updater/updater.test.ts` | à lire |  |
| `src/features/updater/updaterNoPlugin.test.ts` | à lire |  |
| `src/features/updater/updaterStore.ts` | à lire |  |
| `src/i18n/appUpdateRestoreText.test.ts` | à lire |  |
| `src/i18n/appUpdateRestoreText.ts` | à lire |  |
| `src/i18n/backupRestoreText.test.ts` | à lire |  |
| `src/i18n/backupRestoreText.ts` | à lire |  |
| `src/i18n/bodyProgressText.ts` | à lire |  |
| `src/i18n/bodyText.ts` | à lire |  |
| `src/i18n/cardioText.ts` | à lire |  |
| `src/i18n/circuitText.ts` | à lire |  |
| `src/i18n/dataResetText.ts` | à lire |  |
| `src/i18n/dayOrdinal.test.ts` | à lire |  |
| `src/i18n/exerciseLoad.test.ts` | à lire |  |
| `src/i18n/exportImportText.ts` | à lire |  |
| `src/i18n/fileFailureText.test.ts` | à lire |  |
| `src/i18n/fileFailureText.ts` | à lire |  |
| `src/i18n/format.ts` | à lire |  |
| `src/i18n/formatBackup.ts` | à lire |  |
| `src/i18n/formatDonePeriod.test.ts` | à lire |  |
| `src/i18n/formatPrefs.qa.test.ts` | à lire |  |
| `src/i18n/formatPrefs.ts` | à lire |  |
| `src/i18n/formatRoutine.test.ts` | à lire |  |
| `src/i18n/formatRoutine.ts` | à lire |  |
| `src/i18n/formatToday.test.ts` | à lire |  |
| `src/i18n/formatWeek.test.ts` | à lire |  |
| `src/i18n/formatWeekday.ergo03.test.ts` | à lire |  |
| `src/i18n/fr.appUpdate.ts` | à lire |  |
| `src/i18n/fr.appUpdateRestore.ts` | à lire |  |
| `src/i18n/fr.appearance.ts` | à lire |  |
| `src/i18n/fr.backup.ts` | à lire |  |
| `src/i18n/fr.backupRestore.ts` | à lire |  |
| `src/i18n/fr.body.ts` | à lire |  |
| `src/i18n/fr.bodyProgress.ts` | à lire |  |
| `src/i18n/fr.capture.ts` | à lire |  |
| `src/i18n/fr.cardio.ts` | à lire |  |
| `src/i18n/fr.circuit.ts` | à lire |  |
| `src/i18n/fr.dataReset.ts` | à lire |  |
| `src/i18n/fr.events.ts` | à lire |  |
| `src/i18n/fr.exportImport.ts` | à lire |  |
| `src/i18n/fr.health.ts` | à lire |  |
| `src/i18n/fr.importCsv.ts` | à lire |  |
| `src/i18n/fr.logs.ts` | à lire |  |
| `src/i18n/fr.notifications.ts` | à lire |  |
| `src/i18n/fr.nutrition.ts` | à lire |  |
| `src/i18n/fr.onboarding.ts` | à lire |  |
| `src/i18n/fr.progression.ts` | à lire |  |
| `src/i18n/fr.recipes.ts` | à lire |  |
| `src/i18n/fr.recovery.ts` | à lire |  |
| `src/i18n/fr.recoveryFactors.ts` | à lire |  |
| `src/i18n/fr.recoveryNotifications.ts` | à lire |  |
| `src/i18n/fr.routineCircuit.ts` | à lire |  |
| `src/i18n/fr.routines.ts` | à lire |  |
| `src/i18n/fr.scan.ts` | à lire |  |
| `src/i18n/fr.sections.ts` | à lire |  |
| `src/i18n/fr.security.ts` | à lire |  |
| `src/i18n/fr.shortcuts.ts` | à lire |  |
| `src/i18n/fr.signing.ts` | à lire |  |
| `src/i18n/fr.startupBlocked.ts` | à lire |  |
| `src/i18n/fr.strength.ts` | à lire |  |
| `src/i18n/fr.supplementNotifications.ts` | à lire |  |
| `src/i18n/fr.supplements.ts` | à lire |  |
| `src/i18n/fr.syncCarryReport.ts` | à lire |  |
| `src/i18n/fr.syncConflicts.ts` | à lire |  |
| `src/i18n/fr.syncEngine.ts` | à lire |  |
| `src/i18n/fr.syncField.ts` | à lire |  |
| `src/i18n/fr.syncFolder.ts` | à lire |  |
| `src/i18n/fr.syncForget.ts` | à lire |  |
| `src/i18n/fr.syncOlderDevice.ts` | à lire |  |
| `src/i18n/fr.syncOwnDeletion.ts` | à lire |  |
| `src/i18n/fr.syncPairing.ts` | à lire |  |
| `src/i18n/fr.syncPublishCause.ts` | à lire |  |
| `src/i18n/fr.syncReset.ts` | à lire |  |
| `src/i18n/fr.syncRestore.ts` | à lire |  |
| `src/i18n/fr.syncVersion.ts` | à lire |  |
| `src/i18n/fr.timer.ts` | à lire |  |
| `src/i18n/fr.today.ts` | à lire |  |
| `src/i18n/fr.todayPc.ts` | à lire |  |
| `src/i18n/fr.training.ts` | à lire |  |
| `src/i18n/fr.trainingCycle.ts` | à lire |  |
| `src/i18n/fr.trainingGeneration.ts` | à lire |  |
| `src/i18n/fr.trainingMedia.ts` | à lire |  |
| `src/i18n/fr.trainingRecovery.ts` | à lire |  |
| `src/i18n/fr.ts` | à lire |  |
| `src/i18n/fr.workoutReplay.ts` | à lire |  |
| `src/i18n/healthPrivacy.test.ts` | à lire |  |
| `src/i18n/healthText.ts` | à lire |  |
| `src/i18n/i18n.test.ts` | à lire |  |
| `src/i18n/index.ts` | lu | Partie 0 : Résolution des chemins, interpolation, repli clé ; complément AST et typecheck. |
| `src/i18n/logsText.test.ts` | à lire |  |
| `src/i18n/logsText.ts` | à lire |  |
| `src/i18n/native/fr.json` | à lire |  |
| `src/i18n/noDeadCatalogs.test.ts` | à lire |  |
| `src/i18n/noLegacyWords.test.ts` | à lire |  |
| `src/i18n/nutritionText.ts` | à lire |  |
| `src/i18n/onboardingText.ts` | à lire |  |
| `src/i18n/permissionTexts.test.ts` | à lire |  |
| `src/i18n/plural.test.ts` | à lire |  |
| `src/i18n/plural.ts` | à lire |  |
| `src/i18n/plusText.ts` | lu | Partie 0 : Catalogue local fr, faux positif initial du scanner éliminé par résolution des bindings. |
| `src/i18n/progressionText.ts` | à lire |  |
| `src/i18n/recipesText.ts` | à lire |  |
| `src/i18n/recoveryFactorsText.ts` | à lire |  |
| `src/i18n/recoveryText.ts` | à lire |  |
| `src/i18n/routineCircuitText.ts` | à lire |  |
| `src/i18n/sectionsText.ts` | à lire |  |
| `src/i18n/settingsRefonteText.ts` | lu | Partie 0 : Catalogue local fr et interpolation ; pas un alias du catalogue racine. |
| `src/i18n/strengthText.ts` | à lire |  |
| `src/i18n/supplementsText.ts` | à lire |  |
| `src/i18n/syncCarryReportText.test.ts` | à lire |  |
| `src/i18n/syncCarryReportText.ts` | à lire |  |
| `src/i18n/syncOlderDeviceText.ts` | à lire |  |
| `src/i18n/syncOwnDeletionText.ts` | à lire |  |
| `src/i18n/syncPublishCauseText.ts` | à lire |  |
| `src/i18n/syncRefonteText.ts` | lu | Partie 0 : Catalogue local fr et interpolation ; sémantique des conflits à confronter partie 3. |
| `src/i18n/syncRescue.ts` | lu | Partie 0 : Catalogue local, commentaire anglais obsolète ; contrat reprise à confronter partie 3. |
| `src/i18n/syncRestoreText.ts` | à lire |  |
| `src/i18n/syncTexts.a11y.test.ts` | à lire |  |
| `src/i18n/taskStamp.test.ts` | à lire |  |
| `src/i18n/timerText.ts` | à lire |  |
| `src/i18n/todayPcText.ts` | à lire |  |
| `src/i18n/todayText.ts` | à lire |  |
| `src/i18n/trainingCycleText.ts` | à lire |  |
| `src/i18n/trainingGenerationText.ts` | à lire |  |
| `src/i18n/trainingMediaText.ts` | à lire |  |
| `src/i18n/trainingRecoveryText.ts` | à lire |  |
| `src/i18n/trainingText.ts` | lu | Partie 0 : Wrapper de catalogue et formateurs lus ; validation numérique approfondie réservée partie 4. |
| `src/i18n/tutoiement.test.ts` | à lire |  |
| `src/i18n/types.ts` | à lire |  |
| `src/i18n/unusedKeys.test.ts` | à lire |  |
| `src/i18n/workoutReplayText.ts` | à lire |  |
| `src/main.tsx` | lu | Partie 1 : Composition, ordre des attentes, publication des erreurs et nettoyage lus ; réintégration/garde à approfondir en parties 2/3. |
| `src/platform/appVersion.test.ts` | à lire |  |
| `src/platform/appVersion.ts` | à lire |  |
| `src/platform/backup/backup.test.ts` | à lire |  |
| `src/platform/backup/backupIos.test.ts` | à lire |  |
| `src/platform/backup/index.ts` | à lire |  |
| `src/platform/backup/memory.ts` | à lire |  |
| `src/platform/backup/recovery.test.ts` | à lire |  |
| `src/platform/backup/recovery.ts` | à lire |  |
| `src/platform/backup/recoveryAvailable.ts` | à lire |  |
| `src/platform/backup/recoveryMessage.test.ts` | à lire |  |
| `src/platform/backup/startupRecovery.ts` | à lire |  |
| `src/platform/backup/tauriBackup.ts` | lu | Partie 1 : Port, normalisation des erreurs et ordre check/prepare/close/restore lus ; garanties Rust réservées parties 2/8. |
| `src/platform/backup/triggers.test.ts` | à lire |  |
| `src/platform/backup/types.ts` | à lire |  |
| `src/platform/barcode/index.ts` | à lire |  |
| `src/platform/barcode/testing.ts` | à lire |  |
| `src/platform/biometric/biometric.test.ts` | à lire |  |
| `src/platform/biometric/fake.ts` | à lire |  |
| `src/platform/biometric/guard.ts` | à lire |  |
| `src/platform/biometric/index.ts` | à lire |  |
| `src/platform/biometric/tauriBiometric.ts` | à lire |  |
| `src/platform/biometric/types.ts` | à lire |  |
| `src/platform/capture.ios.consistency.test.ts` | à lire |  |
| `src/platform/database.ts` | lu | Partie 1 : Façades, sélection runtime/OS, garde de démarrage et contrat du driver lus ; comportement natif réservé partie 8. |
| `src/platform/dbDiagnostics.ts` | à lire |  |
| `src/platform/desktop/consistency.test.ts` | à lire |  |
| `src/platform/desktop/index.test.ts` | à lire |  |
| `src/platform/desktop/index.ts` | à lire |  |
| `src/platform/desktop/log.ts` | à lire |  |
| `src/platform/desktop/releases.ts` | à lire |  |
| `src/platform/desktop/tauriDesktop.test.ts` | à lire |  |
| `src/platform/desktop/tauriDesktop.ts` | à lire |  |
| `src/platform/desktop/testing.ts` | à lire |  |
| `src/platform/desktop/types.ts` | à lire |  |
| `src/platform/files/browser.ts` | à lire |  |
| `src/platform/files/errorCode.ts` | à lire |  |
| `src/platform/files/files.test.ts` | à lire |  |
| `src/platform/files/index.ts` | à lire |  |
| `src/platform/files/iosFiles.test.tsx` | à lire |  |
| `src/platform/files/iosFiles.ts` | à lire |  |
| `src/platform/files/memory.ts` | à lire |  |
| `src/platform/files/open.ts` | à lire |  |
| `src/platform/files/tauriFiles.ts` | à lire |  |
| `src/platform/files/types.ts` | à lire |  |
| `src/platform/geolocation/geolocation.test.ts` | à lire |  |
| `src/platform/geolocation/geolocationGuard.test.ts` | à lire |  |
| `src/platform/geolocation/index.ts` | à lire |  |
| `src/platform/geolocation/tauriGeolocation.ts` | à lire |  |
| `src/platform/geolocation/types.ts` | à lire |  |
| `src/platform/geolocation/unavailable.ts` | à lire |  |
| `src/platform/haptics/fake.ts` | à lire |  |
| `src/platform/haptics/haptics.test.ts` | à lire |  |
| `src/platform/haptics/index.ts` | à lire |  |
| `src/platform/haptics/tauriHaptics.ts` | à lire |  |
| `src/platform/haptics/types.ts` | à lire |  |
| `src/platform/healthkit/healthkit.test.ts` | à lire |  |
| `src/platform/healthkit/healthkitSwift.test.ts` | à lire |  |
| `src/platform/healthkit/index.ts` | à lire |  |
| `src/platform/healthkit/tauriHealthKit.ts` | à lire |  |
| `src/platform/healthkit/types.ts` | à lire |  |
| `src/platform/healthkit/unavailable.ts` | à lire |  |
| `src/platform/healthkit/validation.ts` | à lire |  |
| `src/platform/index.ts` | lu | Partie 1 : Façades, sélection runtime/OS, garde de démarrage et contrat du driver lus ; comportement natif réservé partie 8. |
| `src/platform/liveActivity/index.ts` | à lire |  |
| `src/platform/liveActivity/liveActivity.test.ts` | à lire |  |
| `src/platform/liveActivity/liveActivitySources.test.ts` | à lire |  |
| `src/platform/liveActivity/tauriLiveActivity.ts` | à lire |  |
| `src/platform/liveActivity/types.ts` | à lire |  |
| `src/platform/liveActivity/unavailable.ts` | à lire |  |
| `src/platform/logs/buffer.test.ts` | à lire |  |
| `src/platform/logs/buffer.ts` | à lire |  |
| `src/platform/logs/index.ts` | à lire |  |
| `src/platform/logs/logsStatic.test.ts` | à lire |  |
| `src/platform/logs/memory.ts` | à lire |  |
| `src/platform/logs/sanitize.test.ts` | à lire |  |
| `src/platform/logs/sanitize.ts` | à lire |  |
| `src/platform/logs/tauriLogs.ts` | à lire |  |
| `src/platform/logs/types.ts` | à lire |  |
| `src/platform/lotM.consistency.test.ts` | à lire |  |
| `src/platform/network.dom.test.tsx` | à lire |  |
| `src/platform/network.ts` | à lire |  |
| `src/platform/notifications/actions.test.ts` | à lire |  |
| `src/platform/notifications/actions.ts` | à lire |  |
| `src/platform/notifications/consistency.test.ts` | à lire |  |
| `src/platform/notifications/fake.ts` | à lire |  |
| `src/platform/notifications/fakeActions.ts` | à lire |  |
| `src/platform/notifications/fakeBridge.ts` | à lire |  |
| `src/platform/notifications/index.ts` | à lire |  |
| `src/platform/notifications/notificationClock.ts` | à lire |  |
| `src/platform/notifications/notificationLedger.ts` | à lire |  |
| `src/platform/notifications/notifications.test.ts` | à lire |  |
| `src/platform/notifications/recoveryKinds.test.ts` | à lire |  |
| `src/platform/notifications/resolver.test.ts` | à lire |  |
| `src/platform/notifications/supplementCategory.test.ts` | à lire |  |
| `src/platform/notifications/tauriNotificationActions.ts` | à lire |  |
| `src/platform/notifications/tauriNotifications.test.ts` | à lire |  |
| `src/platform/notifications/tauriNotifications.ts` | à lire |  |
| `src/platform/notifications/timerNotification.test.ts` | à lire |  |
| `src/platform/notifications/timerNotification.ts` | à lire |  |
| `src/platform/notifications/types.ts` | à lire |  |
| `src/platform/notifications/unavailable.ts` | à lire |  |
| `src/platform/notifications/validate.ts` | à lire |  |
| `src/platform/ocr/index.ts` | à lire |  |
| `src/platform/ocr/nativeOcr.test.ts` | à lire |  |
| `src/platform/ocr/nativeOcr.ts` | à lire |  |
| `src/platform/ocr/testing.ts` | à lire |  |
| `src/platform/ocr/types.ts` | à lire |  |
| `src/platform/off/index.ts` | à lire |  |
| `src/platform/off/off.test.ts` | à lire |  |
| `src/platform/off/parse.ts` | à lire |  |
| `src/platform/off/tauriOff.ts` | à lire |  |
| `src/platform/off/testing.ts` | à lire |  |
| `src/platform/photoImage/picker.ts` | à lire |  |
| `src/platform/privacyShield/index.ts` | à lire |  |
| `src/platform/privacyShield/privacyShield.test.ts` | à lire |  |
| `src/platform/privacyShield/tauriPrivacyShield.ts` | à lire |  |
| `src/platform/quiet.ts` | à lire |  |
| `src/platform/relaunch.ts` | à lire |  |
| `src/platform/runtime.ts` | lu | Partie 1 : Façades, sélection runtime/OS, garde de démarrage et contrat du driver lus ; comportement natif réservé partie 8. |
| `src/platform/shortcutFiles/index.ts` | à lire |  |
| `src/platform/shortcutFiles/shortcutFiles.test.ts` | à lire |  |
| `src/platform/signing/fake.ts` | à lire |  |
| `src/platform/signing/index.ts` | à lire |  |
| `src/platform/signing/signing.test.ts` | à lire |  |
| `src/platform/signing/tauriSigning.ts` | à lire |  |
| `src/platform/signing/tauriSigningAlert.ts` | à lire |  |
| `src/platform/signing/types.ts` | à lire |  |
| `src/platform/speech/index.ts` | à lire |  |
| `src/platform/speech/speech.test.ts` | à lire |  |
| `src/platform/speech/tauriSpeech.test.ts` | à lire |  |
| `src/platform/speech/tauriSpeech.ts` | à lire |  |
| `src/platform/speech/testing.ts` | à lire |  |
| `src/platform/speech/types.ts` | à lire |  |
| `src/platform/speech/unavailable.ts` | à lire |  |
| `src/platform/sync/barcodeScanner.ts` | à lire |  |
| `src/platform/sync/faultPlan.test.ts` | à lire |  |
| `src/platform/sync/faultPlan.ts` | à lire |  |
| `src/platform/sync/index.ts` | à lire |  |
| `src/platform/sync/lotY4.test.ts` | à lire |  |
| `src/platform/sync/memory.bounds.test.ts` | à lire |  |
| `src/platform/sync/memory.fixes.test.ts` | à lire |  |
| `src/platform/sync/memory.test.ts` | à lire |  |
| `src/platform/sync/memory.ts` | à lire |  |
| `src/platform/sync/memoryFaults.test.ts` | à lire |  |
| `src/platform/sync/syncFsConformance.test.ts` | à lire |  |
| `src/platform/sync/tauriScan.test.ts` | à lire |  |
| `src/platform/sync/tauriSync.test.ts` | à lire |  |
| `src/platform/sync/tauriSync.ts` | à lire |  |
| `src/platform/sync/types.test.ts` | à lire |  |
| `src/platform/sync/types.ts` | à lire |  |
| `src/platform/systemSettings/index.ts` | à lire |  |
| `src/platform/systemSettings/systemSettings.test.ts` | à lire |  |
| `src/platform/systemSettings/tauriSystemSettings.ts` | à lire |  |
| `src/platform/systemSettings/testing.ts` | à lire |  |
| `src/platform/tauri/migrationBackup.test.ts` | à lire |  |
| `src/platform/tauri/migrationBackup.ts` | lu | Partie 1 : PRAGMA checkpoint, busy=0 exigé, invocation backup et propagation d'erreur ; analyse des sauvegardes réservée partie 2. |
| `src/platform/tauri/sqlDriver.test.ts` | à lire |  |
| `src/platform/tauri/sqlDriver.ts` | lu | Partie 1 : Façades, sélection runtime/OS, garde de démarrage et contrat du driver lus ; comportement natif réservé partie 8. |
| `src/platform/tauri/startupGate.test.ts` | à lire |  |
| `src/platform/timeZone.ts` | à lire |  |
| `src/sync/apply.ts` | lu | Partie 3 : Application, savepoints, lignes partielles, tombstones, groupes HLC et curseurs intégralement lus ; vérifications croisées encore ouvertes. |
| `src/sync/carryNoticeState.ts` | à lire |  |
| `src/sync/dataReset.ts` | lu | Partie 3 : Horloges, exports, transaction gardée et horizons de remise à zéro intégralement lus ; appelants et persistance à confronter. |
| `src/sync/deadline.ts` | à lire |  |
| `src/sync/deps.ts` | à lire |  |
| `src/sync/deviceStatus.test.ts` | à lire |  |
| `src/sync/deviceStatus.ts` | à lire |  |
| `src/sync/eligible.ts` | lu | Partie 3 : Éligibilité des instantanés, accusés, expiration, purge et ordre des oublis intégralement lus ; contrat natif à vérifier en partie 8b. |
| `src/sync/engine.ts` | lu | Partie 3 : Cycle intégral, reprises, publication, entretien, états et choix des bandeaux lus ; état de réintégration transmis au statut, raccordement interface à terminer. |
| `src/sync/epochCarryReportAck.ts` | à lire |  |
| `src/sync/epochCarryReportBanner.ts` | à lire |  |
| `src/sync/epochSwitch.ts` | à lire |  |
| `src/sync/forget.ts` | à lire |  |
| `src/sync/guarded.ts` | lu | Partie 3 : Horloges, exports, transaction gardée et horizons de remise à zéro intégralement lus ; appelants et persistance à confronter. |
| `src/sync/index.ts` | lu | Partie 3 : Horloges, exports, transaction gardée et horizons de remise à zéro intégralement lus ; appelants et persistance à confronter. |
| `src/sync/join.ts` | lu | Partie 3 : Arrivée par tranches, finalisation des curseurs, états propres et publication intégralement lus. A-009 étendu : curseur couvert avancé malgré champ inconnu perdu. |
| `src/sync/log.ts` | à lire |  |
| `src/sync/maintenance.ts` | lu | Partie 3 : Cycle intégral, reprises, publication, entretien, états et choix des bandeaux lus ; état de réintégration transmis au statut, raccordement interface à terminer. |
| `src/sync/meta.ts` | à lire |  |
| `src/sync/olderWriter.ts` | lu | Partie 3 : Conservation des créations incomplètes, détection et republication intégralement lues, confrontées à ADR 0018. |
| `src/sync/orphanEpoch.ts` | à lire |  |
| `src/sync/ownDeletion.ts` | à lire |  |
| `src/sync/publishDeferred.test.ts` | à lire |  |
| `src/sync/publishRotation.ts` | à lire |  |
| `src/sync/publisher.ts` | lu | Partie 3 : Arrivée par tranches, finalisation des curseurs, états propres et publication intégralement lus. A-009 étendu : curseur couvert avancé malgré champ inconnu perdu. |
| `src/sync/purge.ts` | à lire |  |
| `src/sync/reader.ts` | lu | Partie 3 : Application, savepoints, lignes partielles, tombstones, groupes HLC et curseurs intégralement lus ; vérifications croisées encore ouvertes. |
| `src/sync/repair.ts` | lu | Partie 3 : Application, savepoints, lignes partielles, tombstones, groupes HLC et curseurs intégralement lus ; vérifications croisées encore ouvertes. |
| `src/sync/reset.ts` | à lire |  |
| `src/sync/restoreChoice.ts` | à lire |  |
| `src/sync/scheduler.test.ts` | à lire |  |
| `src/sync/scheduler.ts` | à lire |  |
| `src/sync/schedulerPending.test.ts` | à lire |  |
| `src/sync/service.ts` | lu | Partie 3 : Service et affichage de réintégration intégralement lus ; 7 tests verts sur le seul fichier yIos02, hors sandbox après blocage spawn EPERM avant exécution. |
| `src/sync/snapshot.ts` | lu | Partie 3 : Instantanés fusion/remplacement, export, traces et effacement SQL intégralement lus. A-009 : colonne inconnue de table connue ignorée en fusion, preuve ciblée journal/instantané. |
| `src/sync/status.ts` | lu | Partie 3 : Cycle intégral, reprises, publication, entretien, états et choix des bandeaux lus ; état de réintégration transmis au statut, raccordement interface à terminer. |
| `src/sync/sync.perf.test.ts` | à lire |  |
| `src/ui/AppShell.css` | à lire |  |
| `src/ui/AppShell.layout.test.ts` | à lire |  |
| `src/ui/AppShell.test.tsx` | à lire |  |
| `src/ui/AppShell.tsx` | à lire |  |
| `src/ui/Button.css` | à lire |  |
| `src/ui/Button.test.tsx` | à lire |  |
| `src/ui/Button.tsx` | à lire |  |
| `src/ui/ChoiceDialog.css` | à lire |  |
| `src/ui/ChoiceDialog.test.tsx` | à lire |  |
| `src/ui/ChoiceDialog.tsx` | à lire |  |
| `src/ui/ConfirmDialog.css` | lu | Partie 0 : Voile hors tokens A-002 ; contraintes de largeur, safe area et débordement lues. |
| `src/ui/ConfirmDialog.test.tsx` | à lire |  |
| `src/ui/ConfirmDialog.tsx` | à lire |  |
| `src/ui/ErgoShared.test.tsx` | à lire |  |
| `src/ui/HeroFigure.tsx` | à lire |  |
| `src/ui/Icon.test.tsx` | à lire |  |
| `src/ui/Icon.tsx` | à lire |  |
| `src/ui/Kbd.css` | à lire |  |
| `src/ui/Kbd.test.tsx` | à lire |  |
| `src/ui/Kbd.tsx` | à lire |  |
| `src/ui/ListSkeleton.css` | à lire |  |
| `src/ui/ListSkeleton.tsx` | à lire |  |
| `src/ui/MissingValue.test.tsx` | à lire |  |
| `src/ui/MissingValue.tsx` | à lire |  |
| `src/ui/Rule.tsx` | à lire |  |
| `src/ui/SectionTitle.tsx` | à lire |  |
| `src/ui/SegmentedControl.css` | à lire |  |
| `src/ui/SegmentedControl.test.tsx` | à lire |  |
| `src/ui/SegmentedControl.tsx` | à lire |  |
| `src/ui/Sheet.css` | lu | Partie 0 : Couleur de fond hors tokens A-002 ; états, safe area et hauteur lus. |
| `src/ui/Sheet.test.tsx` | à lire |  |
| `src/ui/Sheet.tsx` | à lire |  |
| `src/ui/Skeleton.css` | à lire |  |
| `src/ui/Skeleton.motion.test.ts` | à lire |  |
| `src/ui/StatusBanner.css` | à lire |  |
| `src/ui/StatusBanner.test.tsx` | à lire |  |
| `src/ui/StatusBanner.tsx` | à lire |  |
| `src/ui/Switch.css` | à lire |  |
| `src/ui/Switch.test.tsx` | à lire |  |
| `src/ui/Switch.tsx` | à lire |  |
| `src/ui/TabIcon.tsx` | à lire |  |
| `src/ui/TabRail.css` | à lire |  |
| `src/ui/TabRail.test.tsx` | à lire |  |
| `src/ui/TabRail.tsx` | à lire |  |
| `src/ui/Toast.css` | à lire |  |
| `src/ui/Toast.test.tsx` | à lire |  |
| `src/ui/Toast.tsx` | à lire |  |
| `src/ui/WeekdayToggles.css` | à lire |  |
| `src/ui/WeekdayToggles.tsx` | à lire |  |
| `src/ui/ergo01bRules.test.ts` | à lire |  |
| `src/ui/ergoRules.test.ts` | à lire |  |
| `src/ui/iconStyle.ts` | à lire |  |
| `src/ui/index.ts` | à lire |  |
| `src/ui/layoutRules.test.ts` | à lire |  |
| `src/ui/mobileLayout.test.ts` | à lire |  |
| `src/ui/theme/charte.test.ts` | à lire |  |
| `src/ui/theme/contrast.test.ts` | à lire |  |
| `src/ui/theme/contrastCss.test.ts` | à lire |  |
| `src/ui/theme/figures.css` | à lire |  |
| `src/ui/theme/fonts.css` | à lire |  |
| `src/ui/theme/iosInputZoom.test.ts` | à lire |  |
| `src/ui/theme/noHardCodedColors.test.ts` | à lire |  |
| `src/ui/theme/tokens.css` | à lire |  |
| `src/ui/theme/tokens.test.ts` | à lire |  |
| `src/ui/useFocusTrap.test.tsx` | à lire |  |
| `src/ui/useFocusTrap.ts` | à lire |  |
| `src/ui/useLayout.test.tsx` | à lire |  |
| `src/ui/useLayout.ts` | à lire |  |
| `src/vite-env.d.ts` | à lire |  |
| `tests/bundle/bundleMeasure.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/bundle/bundleMeasure.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/bundle/measureStart.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/bundle/pairingBundle.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/bundle/startBundle.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/bundle/startModules.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/bundle/startModules.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/D-01.spec.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/FIX-092-onglets.spec.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/I-02.spec.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/I-03.spec.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/I-04.spec.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/I-06.spec.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/I3-07-onboarding.spec.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/I6-03b-routine-circuit.spec.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/I6-05-complements.spec.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/I6-06-cardio.spec.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/P-04.spec.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/RESET-01-repartir-de-zero.spec.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/V0-7-1-mise-en-page.spec.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/Y-IOS-01.spec.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/Y-IOS-02-FIX-01.spec.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/Y-IOS-02-parcours.spec.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/Y-IOS-02.spec.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/db-open-failure.spec.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/globalSetup.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/helpers/app.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/helpers/backups.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/helpers/files.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/helpers/frames.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/helpers/layout.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/helpers/notifications.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/helpers/onboarding.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/helpers/settings.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/helpers/sync.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/helpers/today.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/layoutHelper.spec.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/lot-f-qa.spec.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/lot-f-screens.spec.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/parcours/Y10-oublier-appareil.spec.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/parcours/Y11-reinitialiser.spec.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/perf-start.spec.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/e2e/smoke.spec.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/legacy-schema/0001_core_tables.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/legacy-schema/0002_task_done_at_index.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/legacy-schema/0003_task_series_template.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/legacy-schema/0004_task_discarded.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/legacy-schema/0005_external_calendar.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/legacy-schema/0006_routine_pause.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/legacy-schema/0007_pro_quiet_hours.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/legacy-schema/0008_checklist_icon.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/legacy-schema/0009_event_reminder_offsets.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/legacy-schema/0010_holiday.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/legacy-schema/0011_search_index.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/legacy-schema/0012_task_external_event.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/legacy-schema/0013_focus_session.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/legacy-schema/0014_focus_session_project.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/legacy-schema/0015_sync_tables.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/legacy-schema/0016_sync_natural_ids.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/legacy-schema/0017_calendar_account_username.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/legacy-schema/0018_apple_reminders.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/legacy-schema/0019_epoch_carry_report.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/legacy-schema/catalogue.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/legacy-schema/index.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/legacy-schema/isolation.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/legacy-schema/naturalIds.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/legacy-schema/repairs.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/migrations/sample.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/nutrition/dayKit.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/nutrition/eightWeeks.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/pairingMatrixKit.tsx` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/pairingWorld.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/pendingRepositories.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/sync/forgetRandom.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/training/generation.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/training/index.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/training/mesocycle.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/training/progression.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/training/warmup.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/fixtures/training/workout.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/nsis/installerScript.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/setup/dom.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/setup/settle.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/sim/httpSim.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/sim/index.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/sim/ports.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/sim/syncCloudSim.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/sim/syncCodec.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/sim/syncCrash.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/sim/syncDevice.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/sim/syncFolderSim.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/sim/syncOrphanSession.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/sim/syncStartup.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/sim/syncVectors.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/sim/syncVersions.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/smoke/nsisScript.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/smoke/pc-demarrage.spec.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/smoke/pc-installeur.spec.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/smoke/pixels.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/eslintGuards.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/smoke/nsisScript.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/smoke/pixels.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/smoke/smokeConf.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sqlFrontReference.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sqlPragmaScan.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/apply.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/applyFaultyRecord.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/capsRules.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/closedSegments.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/closedSegmentsQa.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/closedSegmentsSim.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/concurrentWrites.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/conflicts/devSyncHook.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/conflicts/kit.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/conflicts/largeQueueResume.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/conflicts/list.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/conflicts/parcours10.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/conflicts/publishFreesDatabase.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/conflicts/qaList.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/conflicts/qaPublisherSlices.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/conflicts/qaRestore.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/conflicts/qaRewriteDuringPublish.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/conflicts/qaTwoDevices.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/conflicts/restore.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/conflicts/stampBeforeWrite.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/conflicts/texts.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/conflicts/wholeRowDuringPublish.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/crashPoints.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/cycleJournal.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/deletions.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/deviceStatus.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/engine.property.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/engineCarryReportImport.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/epochCarry.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/epochCarryForget.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/epochCarryGuard.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/epochCarryInterface.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/epochCarryKit.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/epochCarryNewerOrder.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/epochCarryOptionB.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/epochCarryReplacedParent.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/epochCarryReplacedParentResume.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/epochCarryReplacedParentRules.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/epochCarryReport.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/epochCarryReportRules.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/epochCarryScenario.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/epochConcurrent.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/evictedHeadRotation.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/fallbackClock.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/firstPublicationCrashPoints.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/firstPublicationLoadFailure.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/fix0181/foodFavoriteCatalogue.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/fix0181/foodFavoriteSync.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/forget/forgetCancel.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/forget/forgetDifferential.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/forget/forgetHygiene.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/forget/forgetInterrupt.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/forget/forgetQa.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/forget/forgetRegistry.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/forget/forgetReplay.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/forget/forgetScope.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/forget/forgetSecondReview.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/forget/forgetSeen.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/forget/forgetSim.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/forget/forgetSnapshotAuthor.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/forget/memoryForget.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/forget/retentionForget.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/forget/snapshotJson.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/healthFolderSeparation.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/hideBarrier.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/hideDeadline.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/hostile/cloudSimDeletions.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/hostile/evictedHeadReaders.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/hostile/fakesLoadFixtures.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/hostile/mixedOldEpochDeletion.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/hostile/ownDeletionReturn.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/hostile/readFailure.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/hostile/scenario1OldRule.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/hostile/scenario1Orphan.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/hostile/scenario2CrashBeforeState.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/hostile/scenario3ReadIo.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/hostile/scenario4DurableDelete.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/hostile/scenario5MuteFollowUp.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/hostile/scenario5MuteTransport.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/hostile/scenario6EvictedHeadSegment.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/i0/catalogue.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/i0/exportImport.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/i0/profileWeight.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/i0/weightIdentity.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/i1/trainingTables.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/i2/progressionSync.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/i3/mesocycleSync.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/i4/nutritionSync.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/i4/recipeSync.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/i5/recoverySync.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/i6/bodyProgressCatalogue.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/i6/bodyProgressSync.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/i6/cardioCatalogue.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/i6/cardioSync.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/i6/circuitSync.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/i6/healthBodySync.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/i6/recoveryFactorCatalogue.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/i6/recoveryFactorSync.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/i6/routineCircuitSync.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/i6/supplementSync.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/manualSync.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/offline.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/ownDeletionPersistence.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/pairing/join.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/pairing/joinAfterRecords.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/pairing/joinInterrupt.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/pairing/needsPairing.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/pairing/orphanEpoch.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/pairing/orphanRelisted.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/pairing/parcours11.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/pairing/stateDeletedInflight.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/pairing/stateTransitions.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/positions.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/positionsQa.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/publishRead.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/publisherRules.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/purgeKit.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/purgeNaturalIds.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/purgeRules.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/reset/resetAdr18.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/reset/resetConcurrent.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/reset/resetExposure.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/reset/resetHygiene.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/reset/resetInterrupt.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/reset/resetKit.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/reset/resetLostClosed.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/reset/resetMemory.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/reset/resetMergeNullRow.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/reset/resetOrder.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/reset/resetQa.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/reset/resetQaDefects.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/reset/resetSim.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/reset/resetSingle.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/reset/resetText.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/reset01/dataResetLocal.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/reset01/dataResetRowRule.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/reset01/dataResetSync.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/restore.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/restoreChoice.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/restoreOtherDevice.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/restoreThenForget.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/resumeCrash.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/rotationModuleLoad.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/segmentGaps.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/service.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/serviceBanners.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/sim/folderSimDeviceWait.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/snapshotGuards.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/snapshotRules.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/stateRewrites.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/stateRewritesQa.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/stateRewritesRules.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/storedQa.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/strayFiles.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/syncRepository.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/syncTestFiles.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/tombstoneProperties.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/twoDevices.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/versions/applyRecette.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/versions/failureVisible.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/versions/formatMajor.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/versions/olderWriter.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/versions/reintegrate.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/versions/reintegrateQa.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/versions/startupHook.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/versions/texts.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/versions/threeVersions.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/versions/twoVersions.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/visibleLosses.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/workoutClosure.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/workoutClosureReview.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/workoutJoinBefore.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/writeStateAfterSnapshot.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/yTech02.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/yTech02Epochs.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/yTech02Qa.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/sync/yTech02QaFinal.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/syncCodec.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/syncCodecQa.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/syncSeparation.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/theme/cssContrastKit.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/update/bookmarkKeychain.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/update/firstLaunch.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/update/publishedVersion.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/update/qaInterruptions.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/update/reintegrationIos.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/update/reviewBackupReuse.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/update/versionsPcIphone.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/unit/viteDevServer.test.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `tests/visual/capture.spec.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `vite.config.ts` | lu | Partie 1 : Gardes statiques, sideEffects, entrées et graphe du démarrage lus ; A-007 reproduit par sondes ESLint. |
| `vitest.bundle.config.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `vitest.config.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `vitest.nsis.config.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
| `vitest.perf.config.ts` | à lire | Ajout partie 1 : source suivie au tag absente de l’inventaire initial. |
