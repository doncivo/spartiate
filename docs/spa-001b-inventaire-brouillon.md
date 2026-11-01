# SPA-001b — Inventaire préparatoire au niveau des symboles

PREP-001B-002 · 1er novembre 2026 · base lue : eb93e83c5d31c537913ee6aa4dc2f4016a89f508 (main avant 001a).

**Brouillon, non validé par Ali, aucune purge autorisée.** Analyse en lecture seule des couplages de SPA-001, D-44. Ce document n'est pas l'inventaire exhaustif final : il précise les points de composition et le cœur couplé, recense toutes les méthodes de SyncRepository, puis délimite le reste à détailler après fusion de 001a. Il ne remplace pas la validation de docs/spa-001b-inventaire.md (**à créer — SPA-001b, app-shell avec sync-icloud**). Aucun code modifié, aucun travail I1.

## Lecture des décisions

Garder = contrat conservé ; Garder vidé = hôte conservé, consommateurs métier retirés ; Adapter (synchro) = modification circonscrite avec invariant explicite ; Supprimer = fonction CircleTasks réellement retirée, avec ses seuls tests devenus sans objet ; Archiver = preuve historique déplacée, liens conservés. Une ligne groupée nomme chaque symbole auquel la même décision s'applique. Ce n'est jamais une instruction de suppression de dossier.

Invariants : **S1** protocole chiffré, formats et validation inchangés ; **S2** HLC par champ, fusion déterministe, identité et rejeu convergents ; **S3** transaction gardée, file persistante et curseurs cohérents, reprise après interruption ; **S4** suppression logique, rétention puis tombstone de purge, absence de résurrection implicite ; **S5** instantané/reset/changement d'époque/oubli d'appareil sans perte silencieuse ; **S6** seuls profile et body_weight publiés en I0, settings entièrement local ; **S7** erreur durable visible, persistante, effacée au succès. Ces codes sont développés ici pour rendre chaque adaptation vérifiable, pas pour changer le protocole D-26.

## Dépendances explicites de SPA-001a non fusionnée

- Tous les noms actifs (app, crate, coffre, dossier iCloud, base, sauvegardes, logs, releases, guides) sont encore ceux de CircleTasks sur cette base. Refaire les recherches sur le commit **fusionné** de 001a avant validation ; ne jamais lire ni modifier l'autre worktree pour anticiper ses changements.
- `TAURI_DB_URL`, `ALLOWED_URL`, `DB_FILE` : renommage ensemble par 001a ; **Garder** ce contrat en 001b. `APP_SCHEMA_VERSION` reste 19 en 001a ; passage à 1 seulement avec la nouvelle base de 001b.
- Updater : état non configuré sans requête attendu de 001a ; **Garder** jusqu'à SPA-002, qui rétablit vraie clé et endpoint. Aucun retour à une clé CircleTasks.
- Guides et historique : D-40 partiellement traité en 001a (notamment journal) ; examiner le résultat avant d'archiver, sans écraser de registre Spartiate. Découpage PRD et registre docs/a-creer.md dépendent de 001a ; ce brouillon ne les crée pas.
- Tests identity/agents/docs-paths et script rename sont attendus de 001a, pas acquis ici. Les agents et leur répertoire sont hors lecture et écriture dans cette session ; leurs responsabilités ci-dessous proviennent uniquement des tickets/décisions.
- Aucun changement des formats historiques `AAD_VERSION = 'ct/1'`, extensions .ctj/.cts ou state.ctx pour satisfaire un grep de marque : ce sont des éléments de protocole (S1), à qualifier comme héritage dans le contrôle d'identité.

## Point de composition minimal — avant toute suppression

| Fichier / symboles observés | Décision | Motif / contrat de réception |
| --- | --- | --- |
| `src/features/app/bootstrap.ts` : bootstrapDatabase, failureKind, publishStartFailure | Garder | Ouverture, migration sauvegardée et diagnostic visible restent indispensables |
| Même fichier : reintegrateAfterMigration | Adapter (synchro) | Nouveau catalogue, inconnus réintégrés sans perdre les horloges : S2, S3, S6 |
| Même fichier : bootstrapApp, BootstrapAppOptions | Garder vidé | Retirer assemblage calendriers/métier et ledger des rappels ; conserver HLC, accès données, sauvegardes, synchro, erreurs de démarrage |
| Même fichier : developmentCalendarSetup | Supprimer | Simulateur calendrier de développement, aucun consommateur dans la coquille |
| Même fichier : appels createSettingsLedger, createLedgerStore, openNotificationScheduler, openNotificationActionSource | Garder vidé | Débrancher ordonnanceur métier ; ne pas supprimer l'infrastructure de notification nécessaire à la signature iOS |
| `src/features/app/container.ts` : AppContainer, AppContainerParts, createAppContainer | Garder vidé | Ports d'infrastructure conservés ; retirer ports métier avec leurs consommateurs |
| Même fichier : defineFeatureStore, FeatureStore | Garder | Injection/store générique |
| `src/features/app/navigation.ts` : TAB_IDS, TABS, Route, DEFAULT_ROUTES, DetailTarget, Overlay, INITIAL_NAVIGATION, useNavigationStore | Garder vidé | Cinq sections I0 ; plus de routes tâches/routines/calendriers ; pas d'écran I1 implémenté |
| `src/features/app/tabsConfig.ts` : useTabsConfigStore | Garder vidé | Cinq sections fixes, configuration métier retirée |
| `src/db/repositories/sql/index.ts` : createSqlRepositories | Garder vidé | Conserver settings, syncMeta, syncConflicts, sync, carryReports ; brancher profil/poids au lot base final |
| Même fabrique : spaces, projects, tasks, recurrences, routines, routineLogs, reminders, goals, events, holidays, focusSessions, search, stats, checklists, checklistItems, externalEvents, calendarAccounts, appleLinks, occurrenceDedup | Supprimer | Chaque propriété et fabrique métier avec ses consommateurs ; pas de façade vide prétendant fonctionner |
| Même fichier : reintegrateUnknownFields | Adapter (synchro) | Réexport conservé, règles du nouveau catalogue : S2, S3, S6 |
| `src/platform/database.ts` : openDatabase, createMigrationBackup ; `src/db/driver.ts` : SqlDriver, SqlExecutor, DbError, classifySqliteMessage, toDbError ; `src/db/serializedDriver.ts` : createSerializedDriver | Garder | Pilotes et transactions indépendants du métier ; pas de relâchement des gardes ou délais |
| `src/db/index.ts` : réexports driver/migrator/migrationBackup/migrations | Garder vidé | Remplacer seulement registre de migrations et exports métier devenus absents |
| `src/ui/AppShell.tsx` : AppShell, useDetailSlot ; `src/ui/TabRail.tsx` : TabRail | Garder | Coquille réelle, avec useLayout (1 024 px) ; fidélité visuelle SPA-009 |

## Noyau de synchro : localisation réelle des couplages

| Fichier / symboles | Décision | Motif et invariants à prouver |
| --- | --- | --- |
| `src/sync/apply.ts` : applyOps | Adapter (synchro) | Retirer branche settings et ancienne identité métier ; appliquer catalogue I0. S2, S3, S4, S6 ; conflit par champ et rejeu sur deux bases |
| Même fichier : reminderTargetRestored (fonction locale de applyOps) et branche reminder de restauration | Supprimer | Rappels CircleTasks retirés ; conserver le chemin générique de restauration/tombstone, S4 testé sur profil/poids |
| Même fichier : readOrphanTraces, applyOpsIsolated, recordRejected, mergeTouched | Garder | Conserver isolation savepoint et suivi des rejets ; si shape du catalogue impose un edit, reclasser Adapter avec S2/S3/S7 avant code |
| `src/sync/repair.ts` : runRepairs | Garder vidé | Retirer recalcul routine.paused et fermeture focus ; pas de nouvelle règle sportive I1 ; conserver temporairement le point d'appel compilable |
| `src/domain/sync/repairs.ts` : routinePausedFrom, focusSessionsToClose, PausePeriod, OpenFocusSession | Supprimer | Règles exclusivement routines/focus ; leurs vecteurs métier partent avec elles |
| `src/sync/purge.ts` : purgeRows | Adapter (synchro) | Couplage indirect appelé par snapshots/époques : retirer cascade rappels et deleteExternalEventsOf, conserver garde/enfants/traces atomiques. S3, S4, S5 |
| Même fichier : REMINDER_TARGETS, résultat reminders et calculs associés | Supprimer | Mettre à jour les consommateurs dans snapshot/epochSwitch dans le même lot compilable |
| `src/sync/snapshot.ts` : snapshotPages, applySnapshotTombstones, replaceFromSnapshot | Adapter (synchro) | Retirer settings partagés, espaces fixes et collecte des rappels ; settings locaux jamais effacés par remplacement. S2, S3, S4, S5, S6 |
| Même fichier : loadSnapshot, snapshotMaxHlc, admitSnapshot, mergeSnapshot, keepSnapshotUnknown | Garder | Admission/version/horloges/inconnus/reprise conservés ; fixtures I0 à fournir |
| `src/sync/epochSwitch.ts` : carriedOf, carryPolicy, reapply | Adapter (synchro) | Retirer filtre settings, métadonnée space_id et remontée done.reminders ; conserver report explicite des lignes retenues et erreurs. S2, S3, S4, S5, S6, S7 |
| Même fichier : queueOwnRowsForRepublish, materialize, carryNewer, switchEpoch, releaseCarried, recordCarryReport, reportFailed | Garder | Machine d'époque et reprise ; vérifier transitivité du catalogue, pas de réécriture du protocole |
| `src/domain/sync/naturalIds.ts` : routineLogId, holidayId, RLOG_RE, HOLIDAY_RE | Supprimer | Identités CircleTasks sans consommateur après purge |
| Même fichier : NaturalIdTable, isNaturalId, expectedNaturalId | Adapter (synchro) | Identités D-55 pour profile unique et body_weight (date locale, source), fuseau stocké. S2/S6 ; création hors ligne, répétition, suppression/recréation |
| `src/domain/sync/syncTables.ts` : SYNC_TABLES, TABLES, COLUMNS, syncTable, syncColumn, childRelations, tableRank, publishedColumns, isValidRowId, isValidValue, isPurgeable | Adapter (synchro) | Catalogue exact profil/poids et règles naturelles ; conserver validation avant SQL, ordre déterministe et purge. S1, S2, S4, S6 |
| Même fichier : SHARED_SETTING_KEYS, settingKeyScope, SettingKeyScope, FIXED_SPACE_IDS | Supprimer | Aucun réglage publié, aucun espace fixe ; retirer les appels dans tout le graphe, pas seulement l'export |
| `src/domain/sync/format.ts` : SYNC_TABLE_ORDER | Adapter (synchro) | Ordre canonique I0 concordant avec catalogue : S1/S6 |
| Même fichier : SYNC_FORMAT_MAJOR, AAD_VERSION, STATE_FILE, STATE_NEXT_FILE, JOURNAL_EXTENSION, SNAPSHOT_EXTENSION, validateurs et noms de fichiers | Garder | Formats et chiffrement hérités ; aucun renommage cosmétique du protocole |
| `src/sync/publisher.ts` : materializeOutbox | Garder | Consomme syncTable, aucune branche settings spécifique constatée ; catalogue I0 suffit. Preuve négative settings dans journaux ET snapshots, coupure des écritures concurrentes et reprise conservées |
| Même fichier : readOutboxPaged, createSlicer, buildRecords, buildRecordsSliced, splitOp, batchRecords, publishOutbox, readInflight, ROW_REPUBLISH_FIELD | Garder | Pagination, découpage et publication persistante indépendants du métier ; fixtures I0 sans changer protocole ni budgets |

Les pauses et clôtures focus se trouvent dans runRepairs, la suppression des événements externes dans purgeRows ; ne pas attribuer ces implémentations à applyOps parce que le ticket les cite comme couplages d'application.

## Base neuve et capture

| Source / symboles | Décision | Motif / invariant |
| --- | --- | --- |
| `src/db/migrations/0015_sync_tables.ts` : CAPTURE_TABLES_V15, SHARED_SETTING_KEYS_V15 | Supprimer | Tables/clé settings CircleTasks ; aucun trigger métier actif dans la base I0 |
| Même fichier : captureTriggers, migration0015SyncTables ; migration0016 et migration0019EpochCarryReport dans leurs fichiers de migrations | Adapter (synchro) | Reprendre le DDL technique final 0015 + 0016 + 0019 dans la nouvelle migration, puis retirer l'ancien registre. Capture limitée profil/poids ; S2/S3/S4/S6 |
| `src/db/migrations/index.ts` : migrations | Garder vidé | Une seule migration I0 ; aucun chemin 19 → 1 toléré |
| `src-tauri/src/backup.rs` : APP_SCHEMA_VERSION | Garder vidé | Valeur 1 avec schéma I0 final, garder quotas et vérifications de restauration |

`src/db/migrations/0001_spartiate_init.ts` : **à créer — SPA-001b, data-model**. Repositories profil/poids : **à créer — SPA-001b, data-model**, noms/chemins à arrêter dans l'inventaire final et enregistrer dans docs/a-creer.md après 001a. Garder migrateur et schema_migrations, vérifier qui crée cette dernière pour éviter un doublon.

D-54 : une base de laboratoire schéma 19 est refusée sans altération par le schéma 1. Avant premier lancement 001b, Ali seul supprime le conteneur exact prévu par D-54 après vérification de cible ; aucun agent ne le lit ou supprime dans cette préparation. Si usage réel annoncé, procédure annulée. Tests en Wasm mémoire et répertoires synthétiques isolés ; checksums divergents et version future refusés, sauvegardes avant migration et parité Wasm/natif H-18 séparément prouvées.

D-55 : profil unique, fusion HLC par champ ; poids identifié par date locale et source manual/health, fuseau enregistré ; seconde saisie manuelle du jour remplace, health retient l'échantillon le plus récent et son health_uuid. Le modèle I0 n'autorise pas à commencer le plugin Santé ici. Suppression logique via deleted_at et outbox ; sync_tombstone seulement lors de la purge héritée après rétention (D-57), pas à chaque DELETE logique. Récréation de la même identité et deux créations hors ligne doivent converger.

## Lots périphériques : carte de poursuite (pas une liste de git rm)

| Zone / point d'entrée vérifié | Décision | Motif et complément avant validation finale |
| --- | --- | --- |
| Features métier listées dans SPA-001, leurs domaines/i18n/tests | Supprimer | Relever les exports et derniers importeurs par lot vertical après débranchement ; ne pas supprimer de tests de protocole utilisant des fixtures métier sans les réécrire |
| `src/features/security` | Garder | Code conservé, entrée masquée D-37 ; activation différée |
| `src/features/settings`, `src/features/shortcuts` | Garder vidé | Apparence, sauvegarde, diagnostics, à propos et raccourcis utiles ; détails symbole par symbole encore à relever |
| `src/platform/notifications` | Garder vidé | Séparer rappels métier et notification d'expiration de signature ; cartographie des appelants requise avant retrait |
| `src/platform/speech`, `src/platform/ocr` ; plugins speech/vision | Garder | Infrastructure I6, sans écran de capture CircleTasks ; aucun travail I6 entrepris |
| `src/i18n` : chargeurs, types, ensureLocale et catalogues | Garder vidé | FR seul, catalogue à la demande ; retirer EN et textes métier avec leurs tests ; liste exacte d'exports à relever |
| `src-tauri/src/lib.rs`, `src-tauri/src/desktop.rs`, `src-tauri/src/ios_setup.rs` : enregistrements de commandes/plugins | Garder vidé | Débrancher calendriers/capture/focus et plugins retirés, garder sauvegarde/coffre/synchro/signature |
| `src-tauri/src/export_common.rs` : allowed_extension, mime_for, sanitize_file_name, decode_name, body_bytes | Garder | Transport de fichiers générique, ne pas le supprimer parce que les écrans export métier disparaissent |
| `src-tauri/src/import.rs` : has_import_extension, read_import_file, display_name, import_open_file | Garder vidé | Entrée CSV CircleTasks à retirer/neutraliser explicitement jusqu'à SPA-005 ; helpers réutilisables à réévaluer avec ce ticket |
| Plugins reminders / web-auth | Supprimer | Avec inscriptions Cargo/build/lib/capabilities/plist/tests ; ne pas confondre reminders Apple et notifications d'expiration conservées |
| `.github/workflows/tests.yml`, `.github/workflows/build-windows.yml`, `.github/workflows/build-ios.yml` | Garder vidé | Retirer étapes et secrets CT_GOOGLE ; ajouter clippy/fmt/npm audit selon D-47 dans le lot 001b, pas dans cette préparation |
| `tests/e2e/globalSetup.ts` : globalSetup, appels startCalendarSims / startSyncFolderSim | Garder vidé | Retirer startCalendarSims, garder startSyncFolderSim et sa fermeture ; le simulateur iCloud reste requis |
| `playwright.config.ts` : SIM_ENV_DEV, PERF_SERVER, WEBKIT_SERVER, ONLY_WEBKIT, DEV_SERVER et testMatch iphone-webkit | Garder vidé | Retirer variables calendriers ; remplacer sélection des trois specs métier par sélection I0 vérifiée ; garder serveurs et projets utiles |
| `tests/sim/index.ts`, `tests/sim/ports.ts` | Garder vidé | Séparer exports/ports calendriers de ceux de synchro ; ne pas supprimer le dossier entier |
| `tests/sim/googleSim.ts`, `tests/sim/caldavSim.ts`, `tests/sim/caldavFixtures.ts`, `tests/sim/reminders-sim.ts` | Supprimer | Simulateurs métier après retrait des importeurs ; httpSim à garder tant qu'un simulateur conservé l'importe |
| `tests/sim/syncFolderSim.ts`, `tests/sim/syncCloudSim.ts`, `tests/sim/syncDevice.ts`, `tests/sim/syncCodec.ts`, `tests/sim/syncVectors.ts`, `tests/sim/syncVersions.ts`, `tests/sim/syncStartup.ts`, `tests/sim/syncCrash.ts`, `tests/sim/syncOrphanSession.ts` | Garder | Infrastructure de preuve de synchro ; adapter fixtures métier séparément. Précision motivée de la ligne trop large tests/sim du ticket |
| `tests/visual/capture.spec.ts` : imports setWheels, createTask, openToday, insertGoals, insertChecklists, insertFocusSessions, insertEvents, insertRoutines, insertTasks, GOOGLE_ACCOUNT | Garder vidé | Retirer scènes métier avant leurs helpers ; préserver les helpers encore importés ailleurs ; nouvelles scènes SPA-009 |
| `tests/bundle/`, `tests/nsis/`, `tests/smoke/`, scripts ios/release/smoke | Garder | Garde 358 400 octets gzip, installation, livraison et contrats ; adapter fixtures d'identité seulement si 001a l'exige |
| Documents historiques D-40 (stories, maquettes-refonte, essais, backlog, audits, reprises CircleTasks) | Archiver | Sous docs/archive/circletasks, conserver liens de preuve ; contrôler ce que 001a a déjà déplacé |

Les dossiers de ce tableau sont des périmètres à explorer dans la future session 001b, pas des symboles prétendument inventoriés. Les fichiers interdits à cette session restent intacts. Les nouveaux chemins proposés seront recensés par ticket/propriétaire dans le registre D-50 après fusion de 001a.

## Exécution future et réception

1. Après fusion 001a : relever son commit, compléter exports/importeurs des zones périphériques, actualiser chemins et registre, produire l'inventaire final ; **validation d'Ali avant toute suppression**.
2. Point de composition minimal compilable avec anciennes features non montées ; puis lots verticaux D-44 : métier, repositories/migrations, synchro, Rust, plugins, workflows, i18n, tests/config, archives ; base neuve/coquille fonctionnelle en dernier. Grouper les retraits liés si un lot isolé ne compile pas, sans introduire de façade de succès fictif.
3. Chaque lot : tests rouges commités avant code, puis code vert et typecheck ; tableaux de suppressions de tests motivés. Tests ciblés locaux sans couverture ; suite complète/80 % domain et Rust/e2e en CI seulement. Bundle avant chaque push, pas de seuil modifié.
4. Réception synchro : adapter `tests/unit/sync/apply.test.ts`, `syncRepository.test.ts`, `deletions.test.ts`, `tombstoneProperties.test.ts`, `snapshotGuards.test.ts`, `restoreThenForget.test.ts`, `resumeCrash.test.ts`, `twoDevices.test.ts` aux fixtures profil/poids ; garder les preuves du protocole. Couvrir catalogue négatif settings, divergence HLC, duplication/rejeu, snapshot/reset, oubli et reprise. Relecture sync-icloud obligatoire pour tout diff de synchro ; pas une délégation effectuée par cette préparation.
5. Défaut de protocole ou besoin de modifier S1–S5 : arrêt et arbitrage, pas d'extension implicite à I1. D-56 cadence < 60 s appartient à SPA-008.

Passes PREP-001B-002 : product-owner — préparation seulement, gate I0 conservé ; module — relevé des couplages ci-dessus ; QA — chemins et inventaire des méthodes confrontés aux fichiers suivis ; revue locale distincte — cohérence D-44/D-54/D-55 et limites du brouillon. Revue PR D-53 après CI verte reste ouverte. Les stories d'exécution ne sont pas déclarées faites.

## Annexe — chaque méthode de SyncRepository

Sources présentes : `src/db/repositories/syncRepository.ts` (contrat) et `src/db/repositories/sql/syncRepository.ts` (implémentation createSyncRepository). La décision s'applique aux deux. Garder n'autorise pas de SQL métier caché : vérifier les branches lors du lot, puis reclasser toute modification avec invariant. Les méthodes génériques gardées conservent leurs tests avec fixtures I0.

| Méthode | Décision | Motif / invariant |
| --- | --- | --- |
| setGuard | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| clearGuard | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| assertGuardEmpty | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| readOutbox | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| outboxCount | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| clearPublished | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| dropOutbox | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| dropPending | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| clearOutbox | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| addOutbox | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| maxOutboxSeq | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| readRows | Adapter (synchro) | Réexaminer branches SQL et catalogue pour profil/poids, retirer exceptions settings/espaces ; S2, S3, S4, S6. |
| readClocks | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| readRowsWithClocks | Adapter (synchro) | Réexaminer branches SQL et catalogue pour profil/poids, retirer exceptions settings/espaces ; S2, S3, S4, S6. |
| pendingFields | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| existingIds | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| insertRow | Adapter (synchro) | Réexaminer branches SQL et catalogue pour profil/poids, retirer exceptions settings/espaces ; S2, S3, S4, S6. |
| updateRow | Adapter (synchro) | Réexaminer branches SQL et catalogue pour profil/poids, retirer exceptions settings/espaces ; S2, S3, S4, S6. |
| writeClocks | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| replaceClocks | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| exportRows | Adapter (synchro) | Réexaminer branches SQL et catalogue pour profil/poids, retirer exceptions settings/espaces ; S2, S3, S4, S6. |
| deleteRows | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| deletedRows | Adapter (synchro) | Réexaminer branches SQL et catalogue pour profil/poids, retirer exceptions settings/espaces ; S2, S3, S4, S6. |
| withChildren | Adapter (synchro) | Réexaminer branches SQL et catalogue pour profil/poids, retirer exceptions settings/espaces ; S2, S3, S4, S6. |
| detachLiveChildren | Adapter (synchro) | Réexaminer branches SQL et catalogue pour profil/poids, retirer exceptions settings/espaces ; S2, S3, S4, S6. |
| detachField | Adapter (synchro) | Réexaminer branches SQL et catalogue pour profil/poids, retirer exceptions settings/espaces ; S2, S3, S4, S6. |
| targetReminders | Supprimer | Accès métier rappels/routines/focus/cache calendrier ; retirer appelants avant méthode. |
| maxRowHlc | Adapter (synchro) | Réexaminer branches SQL et catalogue pour profil/poids, retirer exceptions settings/espaces ; S2, S3, S4, S6. |
| getStates | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| saveState | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| getMeta | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| setMeta | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| insertConflicts | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| countConflictsSince | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| listConflicts | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| tombstones | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| insertTombstones | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| removeTombstone | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| exportTombstones | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| tombstoneCount | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| clearTombstones | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| putUnknown | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| exportUnknown | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| clearUnknown | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| savepoint | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| rollbackToSavepoint | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| releaseSavepoint | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| park | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| parked | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| parkedForRow | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| removeParked | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| parkedCount | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| enforceCaps | Garder | Infrastructure générique de garde/file/horloges/état/conflits/traces/inconnus/reprise ; contrat conservé. |
| routinePauses | Supprimer | Accès métier rappels/routines/focus/cache calendrier ; retirer appelants avant méthode. |
| setRoutinePaused | Supprimer | Accès métier rappels/routines/focus/cache calendrier ; retirer appelants avant méthode. |
| openFocusSessions | Supprimer | Accès métier rappels/routines/focus/cache calendrier ; retirer appelants avant méthode. |
| closeFocusSession | Supprimer | Accès métier rappels/routines/focus/cache calendrier ; retirer appelants avant méthode. |
| deleteExternalEventsOf | Supprimer | Accès métier rappels/routines/focus/cache calendrier ; retirer appelants avant méthode. |
