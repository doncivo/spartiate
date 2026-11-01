## 3. Pile et fork

```
                 PC Windows (WebView2)        iPhone 16 Pro Max (WKWebView)
                 ───────────────────────      ─────────────────────────────
  React / TS     ui ─ features ─ i18n   ←→   ui ─ features ─ i18n
                        │  platform (windows)        │  platform (ios : plugins Swift)
                        ▼                            ▼
  Domaine        src/domain (training · nutrition · recovery · sync-catalog)   ← règles métier, pur TS
                        │
  Données        src/db/repositories → SQLite (tauri-plugin-sql)
                        │
  Synchro        src/sync + Rust (AES-256-GCM, HLC) ⇄ iCloud Drive/Spartiate/<device>/ ⇄ autre appareil
```
*Schéma des couches (ADR 0001 CircleTasks) : domain ← db ← sync, platform, features, ui, i18n.*

### 3.1 Pile (ADR 0001 de CircleTasks, reprise)

React 18, Vite, TypeScript 6 strict (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`), Zustand 5, SQLite via `tauri-plugin-sql`, Rust (Tauri 2), plugins Swift iOS dans `src-tauri/plugins/`. Tests : Vitest (projets `node` et `dom`), Testing Library, Playwright (projets `pc` et `iphone` en Chromium sur le front Vite + SQLite Wasm, `iphone-webkit` distinct et filtré sur une liste de specs, `perf`, smoke Windows sur le binaire réel, `visual` ; tous en CI seulement), `cargo test --locked --features test-hooks --test desktop` et `cargo test --locked -p tauri-plugin-sql --features sqlite` (plugin SQL vendored). Cible `es2022`. Polices et icônes : à redéfinir pour Spartiate (§ 19) ; Lucide conservé.

### 3.2 Ce qu'on garde du fork (tel quel)

| Élément | Pourquoi |
| --- | --- |
| Structure des couches `domain / db / sync / platform / features / ui / i18n` et leurs règles d'import | Prouvée, testée par des gardes |
| `src-tauri` : commandes, plugin SQL vendored (`src-tauri/vendor/tauri-plugin-sql`, copie locale corrigée, garde `ALLOWED_URL`), sauvegardes natives (`backup.rs`, `APP_SCHEMA_VERSION`), coffre `keyring` / Trousseau, journal technique (`applog.rs`, ADR 0014), `signing.rs` (date d'expiration), capabilities par fenêtre et par plateforme | Infrastructure neutre |
| Migrations TypeScript : registre `src/db/migrations/index.ts`, exécutées par `src/db/migrator.ts` via `SqlDriver` (driver natif en production, `@sqlite.org/sqlite-wasm` en tests et dans le navigateur), historique dans `schema_migrations`, sauvegarde avant migration (`migrationBackup.ts`) | Mécanisme neutre ; le registre est réinitialisé pour Spartiate (D-23, § 20.4) |
| `src/sync` + `src/domain/sync` + `src-tauri/src/sync` : synchro iCloud Drive chiffrée, HLC par champ, fusion par champ, tombstones, instantanés, appairage par QR, clé de secours, oubli d'appareil, réinitialisation (ADR 0005, 0010, 0011) | Le PC ↔ iPhone de Spartiate. Le protocole et ses invariants sont conservés ; le catalogue, les repositories de synchro et les règles métier d'application / réparation sont adaptés sous revue de l'agent `sync-icloud` (D-26, § 9) |
| Table `settings` (clé / valeur, identité d'appareil `device.id`, préférences), tables techniques de synchro et `schema_migrations` (§ 20.0) | Démarrage, restauration et synchro en dépendent (D-24) |
| Plugins Swift `haptics`, `notification-actions`, `files`, `folder-bookmark`, `privacy-shield`, `speech`, `vision` ; plugin officiel `@tauri-apps/plugin-barcode-scanner` (appairage par QR) ; notifications locales (ADR 0012) | Timer, scan, export, dictée et OCR (infrastructure I6, D-33) |
| Base `spartiate.db` dans `app_config_dir()`, sauvegardes quotidiennes (14 gardées) et familles pré-migration / pré-restauration, journaux `logs/spartiate.log` + `.1` (256 Kio chacun) | Héritage exact (D-32, § 21) |
| Workflows `tests.yml`, `build-windows.yml`, `build-ios.yml` ; scripts `scripts/ios/*`, `scripts/release/*`, `scripts/smoke/*` ; contrat `plist-contract.json` ; guides d'installation (renommés en 001a) | Chaîne de livraison (D-28) |
| Scaffold : `CLAUDE.md` et `AGENTS.md` (fusionnés avec l'annexe A, D-42), `.claude/agents/*` (18 agents gardés, D-34), `.claude/settings.json`, `docs/adr`, `docs/licences.md` ; documents CircleTasks déplacés dans `docs/archive/circletasks/` ; `docs/journal.md`, `docs/decisions.md`, `docs/reprise.md` Spartiate créés vides (D-40) | Méthode de travail |
| Verrou Face ID / code (ADR 0013 § 2) : **code conservé, entrée masquée, activation différée jusqu'à ta décision** (D-37, H-17) ; bandeaux d'état (A-09), écran d'échec au démarrage et restauration de sauvegarde | Confort et sécurité |

### 3.3 Ce qu'on retire

Tout le métier CircleTasks : tâches, routines, checklists, événements, espaces Pro / Perso, objectifs, focus, statistiques, calendriers externes (`web-auth`, Google et ses secrets `CT_GOOGLE_*`, ADR 0008), rappels Apple (`reminders`, EventKit), écrans de capture OCR / vocale et leurs dépendances (`tesseract.js`, `chrono-node` ; les plugins `speech` et `vision` eux-mêmes restent comme infrastructure I6), import CSV, maquettes CircleTasks (archivées), agents métier (`calendar-integration`, `checklists-events`, `focus-time`, `quick-capture`, `routines`, `spaces-goals`, `stats-history`, `tasks-planning`). Le registre des migrations TypeScript est réinitialisé avec `0001_spartiate_init` et `APP_SCHEMA_VERSION` (Rust) repart à 1 : Spartiate ouvre une base neuve dans son propre conteneur ; aucune base CircleTasks n'est migrée ni purgée (D-23). La purge avance par lots verticaux compilables à partir d'un point de composition minimal, pas par suppression de dossiers (D-44, SPA-001b).

### 3.4 Ce qu'on ajoute

| Ajout | Où | Itération |
| --- | --- | --- |
| Moteurs `training`, `nutrition`, `recovery` | `src/domain/` | I2, I4, I5 |
| Tables Spartiate et leurs colonnes publiées (`profile` et `body_weight` dès I0, D-25) | `src/db/migrations/`, `src/domain/sync/syncTables.ts`, `SYNC_TABLE_ORDER` dans `src/domain/sync/format.ts`, `naturalIds.ts` | I0, puis I1+ |
| Plugin Swift `healthkit` (lecture, écriture, observer queries) | `src-tauri/plugins/healthkit` | I1 (spike I0) |
| Plugin Swift `live-activity` + extension ActivityKit | `src-tauri/plugins/live-activity`, cible d'extension injectée dans `gen/apple` | I1 (spike I0) |
| Plugin `camera` (photo de repas) | `src-tauri/plugins/camera` ou plugin officiel Tauri, à trancher en I4 | I4 |
| Écrans Spartiate (§ 19), design system | `src/features`, `src/ui` | I1+ |
| Contenu : exercices, Ciqual | `content/` | I1, I4 |
| Adaptateur IA (`src/platform/ai`), commandes Rust pour les appels réseau avec la clé du coffre | — | I4 |
| Cardio GPS (plugin `geolocation` officiel Tauri, iPhone seulement) | `src-tauri` | I6 |
