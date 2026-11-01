# Fichiers métier renommés en 001a, supprimés en 001b

SPA-001a, risques et plan B : un test dont la fonction métier dépend de l'identité reste **vert** en 001a (chaîne d'identité adaptée par `rename.mjs`) et est supprimé avec sa fonction en 001b, lot indiqué. Total : 122 fichiers sur 398 touchés. Liste produite à partir du rapport de `node scripts/release/rename.mjs` ; l'inventaire `docs/spa-001b-inventaire.md` la précise au niveau des symboles. Aucun `fixme`, aucun test désactivé.

## Lot 001b (e) plugins reminders / web-auth et façades — 13 fichiers

- `src-tauri/plugins/reminders/Cargo.toml`
- `src-tauri/plugins/reminders/ios/Package.swift`
- `src-tauri/plugins/reminders/ios/Sources/RemindersPlugin.swift`
- `src-tauri/plugins/reminders/src/lib.rs`
- `src-tauri/plugins/web-auth/Cargo.toml`
- `src-tauri/plugins/web-auth/ios/Package.swift`
- `src-tauri/plugins/web-auth/ios/Sources/WebAuthPlugin.swift`
- `src-tauri/plugins/web-auth/src/lib.rs`
- `src/platform/calendars/consistency.test.ts`
- `src/platform/calendars/memory.test.ts`
- `src/platform/calendars/memory.ts`
- `src/platform/calendars/types.ts`
- `src/platform/calendars/webAuth.test.ts`

## Lot 001b (d) Rust — 5 fichiers

- `src-tauri/src/calendars/google.rs`
- `src-tauri/src/calendars/http.rs`
- `src-tauri/tests/desktop/calendars.rs`
- `src-tauri/tests/desktop/capture.rs`
- `src-tauri/tests/desktop/focus.rs`

## Lot 001b (b) repositories et migrations — 1 fichiers

- `src/db/repositories/sql/calendarWrites.test.ts`

## Lot 001b (a) domaines et catalogues i18n métier — 41 fichiers

- `src/domain/calendarRefresh.test.ts`
- `src/domain/csvImport.ts`
- `src/domain/csvImportHardening.test.ts`
- `src/domain/historyExport.test.ts`
- `src/domain/historyExport.ts`
- `src/domain/orphanSecrets.test.ts`
- `src/domain/orphanSecrets.ts`
- `src/domain/pdfDocument.ts`
- `src/domain/reportLayout.test.ts`
- `src/i18n/en.appUpdate.ts`
- `src/i18n/en.appUpdateRestore.ts`
- `src/i18n/en.appleReminders.ts`
- `src/i18n/en.backup.ts`
- `src/i18n/en.backupRestore.ts`
- `src/i18n/en.calendars.ts`
- `src/i18n/en.capture.ts`
- `src/i18n/en.logs.ts`
- `src/i18n/en.notificationPreviews.ts`
- `src/i18n/en.notifications.ts`
- `src/i18n/en.onboarding.ts`
- `src/i18n/en.scan.ts`
- `src/i18n/en.security.ts`
- `src/i18n/en.shortcuts.ts`
- `src/i18n/en.signing.ts`
- `src/i18n/en.stats.ts`
- `src/i18n/en.syncEngine.ts`
- `src/i18n/en.syncFolder.ts`
- `src/i18n/en.syncForget.ts`
- `src/i18n/en.syncOwnDeletion.ts`
- `src/i18n/en.syncPairing.ts`
- `src/i18n/en.syncReset.ts`
- `src/i18n/en.syncRestore.ts`
- `src/i18n/en.ts`
- `src/i18n/fr.appleReminders.ts`
- `src/i18n/fr.calendars.ts`
- `src/i18n/fr.capture.ts`
- `src/i18n/fr.notificationPreviews.ts`
- `src/i18n/fr.onboarding.ts`
- `src/i18n/fr.scan.ts`
- `src/i18n/fr.stats.ts`
- `src/i18n/fr.ts`

## Lot 001b (a) features métier, leurs domaines, i18n et tests — 32 fichiers

- `src/features/calendars/CalendarsScreen.test.tsx`
- `src/features/calendars/appleReminders/AppleRemindersReadOnly.test.tsx`
- `src/features/calendars/appleReminders/appleGuards.ts`
- `src/features/calendars/appleReminders/appleQa.test.ts`
- `src/features/calendars/appleReminders/appleTaskWrites.ts`
- `src/features/calendars/appleReminders/remindersWrites.test.ts`
- `src/features/calendars/calendarUseCases.test.ts`
- `src/features/calendars/calendarsStore.connectModule.test.ts`
- `src/features/calendars/calendarsStore.google.test.ts`
- `src/features/calendars/calendarsStore.icloud.test.ts`
- `src/features/calendars/calendarsStore.username.test.ts`
- `src/features/calendars/providerFactory.test.ts`
- `src/features/calendars/providerFactory.ts`
- `src/features/calendars/qaEdgeCases.test.ts`
- `src/features/capture/scan/ScanDialog.test.tsx`
- `src/features/goals/GoalAttach.test.tsx`
- `src/features/goals/GoalsAddOnce.test.tsx`
- `src/features/goals/GoalsPinned.test.tsx`
- `src/features/goals/GoalsProgress.test.tsx`
- `src/features/goals/GoalsScreen.test.tsx`
- `src/features/goals/testKit.tsx`
- `src/features/reminders/RemindersStatus.dom.test.tsx`
- `src/features/reminders/notificationActions.test.ts`
- `src/features/reminders/recapNotifications.test.ts`
- `src/features/reminders/replanNotifications.test.ts`
- `src/features/reminders/signingNotice.test.ts`
- `src/features/reminders/signingNoticeQa.test.ts`
- `src/features/reminders/signingText.ts`
- `src/features/stats/ExportDialog.test.tsx`
- `src/features/stats/exportActions.ts`
- `src/features/tasks/createTaskUseCases.ts`
- `src/features/today/TodayAgenda.test.tsx`

## Lot 001b (h) tests et configuration Playwright — 30 fichiers

- `tests/e2e/D-01.spec.ts`
- `tests/e2e/H-03.spec.ts`
- `tests/e2e/I-02.spec.ts`
- `tests/e2e/I-03.spec.ts`
- `tests/e2e/I-04.spec.ts`
- `tests/e2e/I-06.spec.ts`
- `tests/e2e/J12-objectif.spec.ts`
- `tests/e2e/K-02.spec.ts`
- `tests/e2e/K-05.spec.ts`
- `tests/e2e/K-06.spec.ts`
- `tests/e2e/N-01.spec.ts`
- `tests/e2e/OB-01.spec.ts`
- `tests/e2e/OB-02.spec.ts`
- `tests/e2e/OB-03.spec.ts`
- `tests/e2e/OB-04.spec.ts`
- `tests/e2e/OB-05.spec.ts`
- `tests/e2e/P-04.spec.ts`
- `tests/e2e/P-07.spec.ts`
- `tests/e2e/Y-IOS-01.spec.ts`
- `tests/e2e/Y-IOS-02-FIX-01.spec.ts`
- `tests/e2e/Y-IOS-02-parcours.spec.ts`
- `tests/e2e/Y-IOS-02.spec.ts`
- `tests/e2e/helpers/backups.ts`
- `tests/e2e/lot-f-qa.spec.ts`
- `tests/e2e/lot-f-screens.spec.ts`
- `tests/sim/caldavFixtures.ts`
- `tests/sim/syncCloudSim.ts`
- `tests/sim/syncCodec.ts`
- `tests/sim/syncFolderSim.ts`
- `tests/visual/capture.spec.ts`

