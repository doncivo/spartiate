# PRD Spartiate v6.2 — document de référence (PC + iPhone, fork CircleTasks)

30 octobre 2026 · Ali Cherif · révision 6.2 du 31 octobre 2026 (confrontation au dépôt, D-22 à D-45)

## 0. Statut et conventions

**Version 6.2 — document de référence unique du projet Spartiate.** Il remplace le PRD Forge v5.1 et tous les documents antérieurs. À partir de cette révision, le PRD vivant est `docs/PRD.md` dans le dépôt `doncivo/spartiate` (fork de `doncivo/circletasks`) ; le document Claude reste l'archive de la v6.1 et toute révision ultérieure passe par une PR (D-22). Il est lu par sections ciblées par Claude Code et Codex. En cas de contradiction entre ce document et un ADR de CircleTasks repris, ce document prime pour Spartiate.

**Révision 6.1 (30 octobre 2026, après ta relecture)** — ajouts : § 10.0 parcours de bout en bout, § 12.5 programmes de départ, § 12.6 pause et reprise, § 13.8 / 15.7 / 16.7 fonctions reprises du benchmark qui manquaient, § 18.4 charte visuelle, § 18.5 maquettes (règle responsive et liste), § 18.6 accessibilité, décisions D-19 et D-20, hypothèse H-19. Aucune section existante n'a été modifiée.

**Révision 6.2 (31 octobre 2026)** — confrontation du PRD au dépôt réel (`doncivo/circletasks` à `c8bdb308`, identique au fork) par la relecture Codex du 31 octobre (PR #3, 43 constats, 20 modifications), arbitrée par toi. Corrections d'infrastructure, de schéma, de synchro, de CI et de preuves : migrations TypeScript (`src/db/migrations`, migrateur front, base neuve sans purge), tables techniques réelles (`settings`, `sync_*`, `conflict_log`, `epoch_carry_report` ; `app_meta` et `app_pref` abandonnés), colonnes `updated_at` / `device_id` / `hlc` et `sync_field_clock`, § 9 réécrit avec le vocabulaire canonique du § 20.2 et un périmètre de synchro explicite (D-26, D-27), workflows réels (`tests.yml`, `build-windows.yml` sur tag `vX.Y.Z`, `build-ios.yml`), secrets nommés, sauvegardes et journaux hérités exacts, plugins (`speech` / `vision` infrastructure I6, `barcode-scanner` hérité), agents réels, I-06 non prouvée sur appareil (H-5 `UNVERIFIED`), H-16 `UNVERIFIED` partout, verrou local uniformisé, découpage SPA-001a / 001b, I0 sans séance, fixtures synthétiques seulement. Décisions D-22 à D-45 au registre § 26.1 ; H-18 reformulée, H-19 scindée en H-19a / H-19b, H-20 créée, renvois H-1 / H-2 / H-8 corrigés (budget IA → H-14, écriture Santé → H-3, question HRV → H-20). Renvois de sections corrigés (synchro § 9, plugins § 19, modèle § 20, registre § 26). § 11–12, § 14–17 (contenu fonctionnel) et § 18 (hors `test:contrast` et H-19a) inchangés.

### 0.1 Ce qui change par rapport à la v5.1

| Sujet | v5.1 (Forge) | v6 (Spartiate) |
| --- | --- | --- |
| Nom | Forge (nom de code) | **Spartiate** ; identifiant `fr.spartiate.app` |
| Plateformes | iPhone seul | **PC Windows + iPhone**, même code, livrés ensemble |
| Pile | Swift 6 + SwiftUI + 4 packages Swift | **Tauri 2 : React + TypeScript strict (front commun), Rust (cœur, SQLite, synchro, chiffrement), plugins Swift pour l'iPhone** — la pile de CircleTasks |
| Moteurs | Packages Swift testés sous WSL | **TypeScript pur dans `src/domain`**, testés par Vitest sur Windows |
| Données | SwiftData, aucune sync | **SQLite (plugin Tauri SQL)** + **synchronisation chiffrée par iCloud Drive** entre PC et iPhone (ADR 0011 de CircleTasks, réutilisée) |
| HealthKit, Live Activity | Frameworks directs | **Plugins Swift Tauri** (`healthkit` nouveau, `live-activity` nouveau), sur le gabarit de `haptics`, `vision`, `speech` de CircleTasks |
| Dépôt | Neuf | **Fork de CircleTasks** : chaîne CI, SideStore, synchro, plugins, scaffold d'agents conservés ; métier et écrans remplacés |
| Installation iPhone | SideStore | Identique ; source `spartiate-releases` |
| Installation PC | — | Installeur NSIS + plugin updater, dépôt `spartiate-releases` (comme CircleTasks) |

### 0.2 Niveaux normatifs

**doit** = obligatoire ; **devrait** = recommandé, s'en écarter demande une entrée dans `docs/decisions.md` ; **peut** = option.

### 0.3 Statuts de capacité

| Statut | Sens | Preuve |
| --- | --- | --- |
| `CONFIRMED` | Exécuté sur ton iPhone ou ton PC via la chaîne réelle | Capture ou log daté |
| `INHERITED` | Prouvé sur CircleTasks, même appareil, même chaîne ; **à rejouer sur Spartiate avant d'être `CONFIRMED`** | Référence à la story CircleTasks |
| `PROTOTYPED` | Compile en CI | Build vert |
| `UNVERIFIED` | Hypothèse | — |
| `BLOCKED` | Testé, indisponible, fallback actif | Erreur documentée |
| `DEFERRED` | Reporté | Itération cible |

### 0.4 Hypothèses

Tout ce qui n'est pas vérifié est marqué `H-n` et repris au registre § 26.2 avec sa méthode de vérification. Un identifiant désigne une seule hypothèse (D-45). Les constantes numériques des moteurs sont des valeurs de départ dans des fichiers de configuration, jamais en dur.

### 0.5 Comment lire

Démarrer : § 3 à 9, § 25 à 26, annexes. Coder un moteur : § 11, 12, 15, 16 + § 20 + § 24. Coder un écran : § 18 + section fonctionnelle + § 5. Synchro : § 9 + § 20. Plugin iPhone : § 19.

## 1. Décision produit, mission, principes

### 1.1 Décision

Spartiate est une application **personnelle** de musculation, nutrition et récupération, en français, sans compte, sans abonnement, sans serveur propriétaire, sans commercialisation. Une seule base de code React exécutée dans Tauri 2 sur **PC Windows** (WebView2) et sur **iPhone 16 Pro Max** (WKWebView), livrée en une fois, comme CircleTasks. Données locales en SQLite sur chaque appareil, **synchronisées de bout en bout chiffrées par un dossier iCloud Drive**, sans serveur. L'iPhone lit l'Apple Watch Series 11 via Apple Santé et publie les résultats vers le PC. Appels IA facultatifs, explicites, avec ta clé.

### 1.2 Mission

**Savoir chaque jour quoi soulever, à quelle charge et pourquoi ; quoi manger et combien ; quand lever le pied — à partir de tes séries, de ton poids, de ton sommeil et de ta fréquence cardiaque, sur le PC comme sur l'iPhone, sans jamais perdre le contrôle de tes données.**

### 1.3 Ce que Spartiate assemble

| Brique | Référence | Repris |
| --- | --- | --- |
| Moteur de progression | Gravl | 1RM estimé, double progression, arrondi au matériel, « pourquoi cette charge » |
| Programmation | Alpha Progression | Wizard, mésocycle, deload |
| Écran de séance | Hevy | Un écran, démarrage < 10 s |
| Timer et intégration iOS | Reboot Plan | Dynamic Island, Live Activity, Apple Santé |
| Nutrition | MacroFactor | Dépense mesurée, check-in hebdo |
| Récupération | Athlytic, WHOOP, Gravl | Recovery / Exertion / sommeil, récupération par muscle |
| Pile, chaîne, synchro, scaffold | **CircleTasks** | Tauri 2, SideStore, synchro iCloud, agents, conventions |

### 1.4 Principes

1. **Explicable** : chaque charge affiche la règle qui l'a produite, par template, jamais par IA.
2. **Tu as toujours le dernier mot** : toute proposition est modifiable ; la modification est conservée et tracée.
3. **Local-first sur chaque appareil, synchro sans serveur** : rien ne quitte tes appareils et ton iCloud Drive, sauf les appels IA que tu déclenches.
4. **Règles métier dans `src/domain` uniquement**, testées par Vitest ; accès base par `src/db/repositories` uniquement (règle CircleTasks).
5. **Installation répétable avant tout** : I0 prouve PC et iPhone, mise à jour sans perte, synchro.
6. **Fiabilité avant IA** : l'IA n'est jamais dans la boucle critique d'une séance.
7. **Aucune affirmation non vérifiée** : `UNVERIFIED` ou `INHERITED` tant que ce n'est pas rejoué sur Spartiate.
8. **Aucune prétention médicale** ; l'app propose, n'interdit jamais.
9. **Aucune défaillance silencieuse** : toute erreur durable est visible dans l'app (règle CircleTasks).

## 2. Contexte — faits établis

| Élément | Fait | Conséquence |
| --- | --- | --- |
| iPhone | iPhone 16 Pro Max, iOS 18+, mode développeur activé, SideStore installé avec VPN local et fichier d'appairage (CircleTasks) | Dynamic Island, Action button, Camera Control ; installation par SideStore déjà opérationnelle |
| Watch | Apple Watch Series 11, 46 mm, watchOS 11+ | Écrit dans Apple Santé : HRV, FC de repos, sommeil avec stades, fréquence respiratoire, température du poignet, séances, pas, énergie. « Recovery HRV » non documentée comme type HealthKit (`H-20`) |
| PC | Windows, pas de Mac ; iTunes (site Apple), iloader, iCloud pour Windows avec iCloud Drive actif (CircleTasks, 5 octobre 2026) | Dev local complet : Vitest, `cargo check` partiel (les dépendances C comme SQLite exigent `xcrun` pour iOS), Tauri dev PC ; aucune commande iOS locale |
| Compte Apple | Identifiant gratuit utilisé par SideStore ; pas de Developer Program (D-5) | 7 jours de signature, 3 apps hors App Store : **SideStore + CircleTasks + Spartiate = la limite** (`H-16`), 10 identifiants d'app par semaine |
| CircleTasks | Dépôt public `doncivo/circletasks` (React 18, Vite, TypeScript 6 strict, Zustand 5, SQLite via tauri-plugin-sql, Rust Tauri 2, plugins Swift `files`, `folder-bookmark`, `haptics`, `notification-actions`, `privacy-shield`, `reminders`, `speech`, `vision`, `web-auth`) ; `build-windows.yml` (NSIS, updater) et `build-ios.yml` (IPA non signée, SideStore) ; dépôt public `doncivo/circletasks-releases` ; synchro iCloud Drive chiffrée (ADR 0011) en production entre ton PC et ton iPhone depuis octobre 2026 ; 16 ADR ; 26 agents ; AGENTS.md | Spartiate est un fork : tout cela est repris (§ 4) |
| Outils | Claude Code, Codex, GitHub, WSL2 facultatif (plus nécessaire : les moteurs sont en TypeScript) | Scaffold et conventions CircleTasks (§ 24) |
| Langue | Français ; code et identifiants en anglais | — |
| Budget | 0 € Apple ; IA à l'usage avec ta clé, plafond configurable (`H-14`) | — |
| Usage | Toi seul | Pas de personas ni KPI business |

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

## 4. Répartition PC / iPhone

Le même front tourne sur les deux ; ce qui diffère, c'est l'accès au matériel. Le PC est le poste de pilotage (programme, nutrition au clavier, analyses, exports) ; l'iPhone est le poste de terrain (séance, timer, scan, photo, Watch). Rien n'est réservé au PC sauf par confort.

| Fonction | PC | iPhone | Note |
| --- | --- | --- | --- |
| Séance active, timer, Live Activity | Possible (saisie clavier, timer in-app) | **Principal** | Live Activity et haptique iPhone seulement |
| Programme, mésocycle, routines, bibliothèque, profils de matériel | **Principal** (édition confortable) | Oui | — |
| Journal alimentaire | Saisie clavier, recettes, stratégie | Scan, photo, saisie rapide | Photo et scan iPhone seulement (caméra) |
| Pesée | Saisie manuelle | Manuelle ou Apple Santé | — |
| Récupération (HRV, FC, sommeil, scores) | **Lecture seule** des résultats publiés par l'iPhone | **Calcul** via HealthKit | Le PC n'a jamais accès à Apple Santé |
| Cardio GPS | — | Oui (I6) | — |
| Progrès, graphiques, bilans IA, exports | **Principal** | Oui | — |
| Diagnostic, journaux | Oui | Oui | Export des journaux iPhone via Fichiers / iCloud Drive |
| Notifications | Non (choix CircleTasks : le PC n'envoie pas de rappels) | Oui | — |
| Verrou | Code / Windows | Face ID / code | Code repris de CircleTasks, entrée masquée, activation différée jusqu'à ta décision (D-37, H-17) |
| Mise à jour | Bannière updater | SideStore | — |

### 4.1 Règles

- **Un seul écrivain par appareil, fusion par champ** (ADR 0011) : une séance commencée sur l'iPhone et éditée sur le PC se fusionne champ par champ avec HLC ; la séance en cours (non terminée) n'est **pas publiée** tant qu'elle n'est pas terminée, pour éviter les conflits en direct. Cette publication à la clôture est une conception et un lot de tests I1 (§ 9.1, D-27), pas un acquis du catalogue hérité.
- Les scores de récupération et les mesures HealthKit sont publiés **par l'iPhone** sous forme de résumés quotidiens (table `recovery_day`), jamais les échantillons bruts.
- Les photos (repas, progression) restent sur l'appareil qui les a prises ; seules leurs métadonnées sont publiées (option « synchroniser les photos de progression » en I6 via le dossier iCloud).
- Les clés : clé de synchro dans le coffre de chaque appareil (ADR 0011 § 2) ; clé API IA dans le coffre de chaque appareil, saisie une fois par appareil, jamais synchronisée.

## 5. Chaîne de build, installation et mise à jour

Identique à CircleTasks, avec deux dépôts publics : `doncivo/spartiate` (code) et `doncivo/spartiate-releases` (installeur PC, `latest.json`, IPA, `source.json`, `icon.png`).

### 5.1 PC Windows (`build-windows.yml`, repris)

- Runner `windows-latest` ; déclenchement manuel ou tag `vX.Y.Z` ; `npm run tauri build` → installeur NSIS ; sur tag : signature avec la clé updater (secrets GitHub `TAURI_SIGNING_PRIVATE_KEY` et `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, **nouvelle paire minisign pour Spartiate**, D-29), `latest.json`, publication sur `spartiate-releases` avec `RELEASES_TOKEN`. Les noms des secrets sont documentés, jamais leurs valeurs ; la lecture du YAML ne prouve pas leur configuration dans GitHub.
- Updater : en SPA-001a le bloc `plugins.updater` est retiré de `tauri.conf.json` et `features/updater` affiche « mises à jour non configurées », sans requête réseau ; SPA-002 le rétablit avec la clé publique Spartiate et l'endpoint `spartiate-releases`. Aucune clé vide ni factice (D-30).
- Mise à jour par la bannière in-app (plugin updater) ; le désinstalleur **ne supprime jamais les données** (REL-TECH-02 de CircleTasks, repris). L'installeur est éprouvé par le smoke CI (installe / lance / désinstalle sur le runner) ; tu l'installes toi-même quand tu le décides, aucun agent ne te demande de lancer un installeur (D-39).
- Dev local : `npm run tauri dev` sur ton PC ; tests Vitest du module en cours ; e2e Playwright, smoke et Rust en CI seulement, jamais en local sur ce PC.

### 5.2 iPhone (`build-ios.yml`, repris et complété)

1. Déclenchement manuel sur une branche (IPA en artefact) ou tag `ios-vX.Y.Z` (publication). Une seule compilation iPhone par lot.
2. `tauri ios init --ci` régénère le projet Xcode ; **script d'injection de la cible d'extension Live Activity** dans `gen/apple` (nouveau, `H-4`) ; `tauri ios build --ci --no-sign --target aarch64` ; puis **signature ad hoc avec `Spartiate.entitlements`** (`codesign -s - --entitlements …` sur le `.app` et l'extension, `H-3`) avant le zip en `Payload/`.
3. Contrôles : bundle `fr.spartiate.app`, `MinimumOSVersion` 18, arm64, front embarqué, contrat `plist-contract.json` (`NSHealthShareUsageDescription`, `NSHealthUpdateUsageDescription`, `NSCameraUsageDescription`, `NSFaceIDUsageDescription`, `NSSupportsLiveActivities`), entitlements lus par `codesign -d --entitlements`.
4. Publication : release GitHub + `source.json` (version, `buildVersion` croissant, `sha256`, taille, `iconURL`, notes depuis `CHANGELOG.md`) par les scripts repris.
5. SideStore : source `https://raw.githubusercontent.com/doncivo/spartiate-releases/main/source.json` ; installer ; mettre à jour sans jamais supprimer ; renouveler tous les 5–6 jours ; l'app lit `embedded.mobileprovision` et notifie 24 h avant (I-02 repris).

### 5.3 Ce qui est `INHERITED` (prouvé sur CircleTasks)

IPA non signée en CI ; installation par SideStore ; date d'expiration lisible (I-02) ; notifications locales avec actions ; Face ID ; Trousseau ; caméra et scan ; haptique ; Fichiers ; synchro iCloud PC ↔ iPhone ; installeur et updater PC ; minutes macOS gratuites sur dépôt public.

N'est **pas** `INHERITED` : la mise à jour SideStore N → N+1 sans perte (I-06). Côté CircleTasks, I-06 est « code fusionné, en attente de vérification appareil » : le code et ses tests existent, la recette sur l'iPhone n'a pas été archivée. H-5 reste `UNVERIFIED (code hérité)` jusqu'à la preuve Spartiate de SPA-010 (D-36).

### 5.4 Ce qui reste `UNVERIFIED`

| Point | Détail | Ticket |
| --- | --- | --- |
| **HealthKit via SideStore (H-3)** | Entitlement `com.apple.developer.healthkit` à faire porter par le binaire (signature ad hoc) pour qu'AltSign demande la capacité ; jamais testé | SPA-006 |
| **Extension Live Activity (H-4)** | Deux difficultés : injecter une cible d'extension dans le projet généré par `tauri ios init` (script sur `project.pbxproj` ou `project.yml` de Tauri), et la faire signer par SideStore (consomme un identifiant d'app) | SPA-007 |
| Signature ad hoc après `--no-sign` | `codesign` sur le `.app` produit par Tauri, avant zip ; à vérifier que SideStore accepte | SPA-003 |
| Trois apps sideloadées (H-16) | SideStore + CircleTasks + Spartiate ; aucun YAML ne le prouve | SPA-004 |
| Mise à jour N → N+1 sans perte (H-5) | Conservation de la base et du Trousseau par SideStore ; code hérité, preuve appareil ouverte | SPA-010 |

### 5.5 Débogage sans Mac

Repris de CircleTasks : écran Diagnostic (version, build, SHA, expiration, permissions, matrice, journaux expurgés), journal technique persistant (ADR 0014), export des journaux vers Fichiers / iCloud Drive lisible par Claude Code quand tu le désignes, e2e Playwright en CI pour le front (`pc` et `iphone` en Chromium sur Vite + SQLite Wasm ; `iphone-webkit` en WebKit sur une liste de specs filtrées), smoke Windows sur le binaire natif, `cargo test` pour Rust ; aucun e2e local sur ce PC ; les plugins Swift ne se testent que sur l'iPhone, par tes essais.

## 6. Matrice de capacités — état initial

Tenue à jour dans `docs/capability-matrix.md` (annexe B) par le ticket qui change un statut.

| Capacité | Statut | Précédent CircleTasks | Fallback si `BLOCKED` | Ticket |
| --- | --- | --- | --- | --- |
| Fork, renommage, purge du métier, base neuve, tests verts | `UNVERIFIED` | — | — | SPA-000, 001a, 001b |
| Build PC (NSIS), smoke installeur et updater | `INHERITED` (updater non configuré jusqu'à SPA-002, D-30) | `build-windows.yml`, smoke CI, REL-TECH-02 | — | SPA-002 |
| Build IPA non signée en CI | `INHERITED` | POC-01 | — | SPA-003 |
| Signature ad hoc après `--no-sign` avec entitlements | `UNVERIFIED` | — | Sans entitlements (perd HealthKit) | SPA-003 |
| Publication `spartiate-releases` (PC + source SideStore) | `INHERITED` | `circletasks-releases` | Import manuel | SPA-004 |
| Installation et ouverture SideStore | `INHERITED` | 1.0.x | AltStore | SPA-004 |
| Trois apps sideloadées ensemble | `UNVERIFIED` (`H-16`) | — | Retirer une app | SPA-004 |
| Mise à jour iPhone sans perte | `UNVERIFIED (code hérité)` (`H-5`) | I-06 : code fusionné, preuve appareil ouverte | Export avant mise à jour | SPA-010 |
| Date d'expiration lisible | `INHERITED` | I-02 | Saisie manuelle | SPA-004 |
| Synchro iCloud PC ↔ iPhone sur les tables Spartiate | `INHERITED` (protocole) / `UNVERIFIED` (catalogue et repositories adaptés, D-26) | ADR 0011, lots Y | Export / import manuel | SPA-008 |
| Export / import JSON | `UNVERIFIED` | P-04 (restauration, partiel) | — | SPA-005 |
| **HealthKit lecture / écriture** (plugin Swift) | `UNVERIFIED` — **risque principal** (`H-3`) | Aucun | Saisie manuelle ; séances dans l'app seulement | SPA-006 |
| HealthKit HRV / FC repos / sommeil | `UNVERIFIED` (`H-3`, `H-20`, `H-13`) | Aucun | Fatigue déclarée | I5 |
| **Live Activity / Dynamic Island** (plugin + extension) | `UNVERIFIED` — risque élevé (`H-4`) | Aucun ; extensions exclues sans test | Timer in-app + notification locale (`INHERITED`) | SPA-007 |
| Notifications locales | `INHERITED` | N-01, ADR 0012 | — | SPA-007 |
| Face ID, Trousseau, haptique, Fichiers, caméra, scan | `INHERITED` | lots I, M, Y, CAP, FILES | — | I1 / I4 |
| Camera Control | `UNVERIFIED` | — | Bouton | I4 |
| App Intents (Siri, Action button) | `UNVERIFIED` ; nécessite un plugin Swift | — | Démarrage depuis l'app | I6 |
| Widgets lisant les données | `BLOCKED` (App Groups) | contrat plist | `DEFERRED` | — |
| Background modes (observer queries HealthKit, GPS) | `UNVERIFIED` ; `UIBackgroundModes` interdit par choix sur CircleTasks | — | Lecture au premier plan | I5 / I6 |
| Quota CI | `INHERITED` (dépôt public) | — | Builds par lot | SPA-003 |
| Open Food Facts, API IA | `UNVERIFIED` | — | Ciqual + manuel | I4 |

## 7. Gate I0 — aucun travail I1 avant passage

### 7.1 Essais

1. Fork nettoyé : `npm run lint`, `npm run typecheck`, `npm run test` verts avec le métier CircleTasks retiré et une base neuve (migration `0001_spartiate_init`) ; `tests.yml` « suite verte » ; `npm run tauri dev` ouvre Spartiate sur le PC avec l'écran Diagnostic.
2. `build-windows.yml` vert sur une branche ; smoke CI : installeur NSIS installé, lancé, désinstallé sur le runner, donnée témoin conservée ; tag `v0.0.1` publié sur `spartiate-releases` ; tu installes quand tu le décides ; `v0.0.2` reçue par la bannière de mise à jour, données conservées (D-39).
3. `build-ios.yml` vert : IPA signée ad hoc, `codesign -d --entitlements` montre HealthKit ; tag `ios-v0.0.1` publié ; source ajoutée dans SideStore ; Spartiate installée et ouverte ; `ios-v0.0.2` appliquée par « Mettre à jour » sans suppression ; données conservées ; les trois apps coexistent.
4. Export / import JSON : export sur l'iPhone, import sur le PC (base vide) → mêmes compteurs et identifiants.
5. Synchro : dossier `iCloud Drive/Spartiate` choisi sur le PC, appairage de l'iPhone par QR, un poids saisi sur l'iPhone apparaît sur le PC, une modification du profil sur le PC revient sur l'iPhone, aucun conflit parasite. Aucune séance n'est exigée avant I1 (D-43).
6. HealthKit (plugin) : permission affichée ; pas du jour lus ; pesée de test écrite, lue, supprimée ; entitlements de l'app installée inspectés depuis Diagnostic.
7. Live Activity (plugin + extension) : compteur visible sur l'écran verrouillé et dans la Dynamic Island ; extension signalée par SideStore ; notification locale à la date programmée.
8. Diagnostic complet sur les deux appareils ; journaux exportés et lus.
9. Mesure : durées des jobs, minutes CI.

### 7.2 Seuil de passage

**Obligatoire :** 1 à 5 et 8. **Conditionnel :** 6 et 7 peuvent être `BLOCKED` avec fallback accepté ; dans ce cas I5 est repoussé et le timer utilise le fallback. I0 prouve profil et poids synchronisés, navigation minimale, diagnostics et chaîne de livraison ; la coquille 001b est fonctionnelle et sobre, la mise en page fidèle aux maquettes est SPA-009 (D-43).

### 7.3 Fallbacks

| Situation | Fallback |
| --- | --- |
| HealthKit indisponible | Poids, sommeil (durée) et fatigue saisis à la main sur l'iPhone ou le PC ; aucune prétention HRV / FC |
| Live Activity indisponible | Timer in-app sur date de fin persistée + notification locale (prouvée) |
| Synchro en échec | Export / import manuel entre appareils ; bandeau d'état (A-09) |
| Mise à jour destructive | Export, réinstallation, import ; jamais de suppression automatique |
| Installation iPhone impossible | Diagnostiquer entitlements et signature ad hoc ; retirer la signature ad hoc pour isoler ; reconsidérer le canal (§ 26.1, D-5) |

## 8. Itérations et critères « terminé »

| Itération | Contenu | Critère « terminé » | Remplace |
| --- | --- | --- | --- |
| **I0 — Fork et pipeline** | § 7 et tickets § 25.2 | Gate § 7.2 passé, matrice remplie | — |
| **I1 — Carnet** | Bibliothèque 150 exercices, profils de matériel, routines, écran de séance (iPhone et PC), timer (Live Activity si `CONFIRMED`), historique, PR, constance, export / import, synchro des tables I1, écriture HealthKit si `CONFIRMED`, Diagnostic | Une séance entière hors ligne sur l'iPhone ; reprise après fermeture forcée ; visible sur le PC après synchro ; export / import vérifié ; 2 semaines d'usage réel | Hevy |
| **I2 — Moteur** | `src/domain/training` : 1RM avec confiance, double progression, snap, difficulté, explication, fatigue, stagnation, deload manuel ; séries pré-remplies | Fixtures déterministes ; même historique → même prescription ; zéro augmentation imposée ; adhérence ≥ 70 % sur 2 semaines | Gravl |
| **I3 — Programme** | Onboarding, génération, mésocycle, Semaine, « moins de temps », Strength Score ; édition confortable sur PC | Programme modifiable ; aucun exercice impossible ; deload non destructif ; un mésocycle suivi | Gravl + Alpha |
| **I4 — Nutrition** | `src/domain/nutrition` : cibles, journal (PC clavier, iPhone scan et photo), Ciqual + OFF, pesées, tendance, TDEE, check-in ; adaptateur IA | Journées incomplètes neutres ; check-in suspendu sans données ; photo corrigeable ; budget plafonné ; ≥ 4 j/7 loggés | MacroFactor |
| **I5 — Récupération** | Plugin HealthKit complet, `src/domain/recovery`, scores, récupération par muscle, Recovery Split, modulation, cadrans ; publication des résumés vers le PC | Scores masqués sans données ; tests 30 nuits ; aucune hausse due au score ; PC affiche la Recovery du jour | Athlytic + WHOOP |
| **I6 — Confort** | App Intents (plugin), bilans rédigés, import de programme, vidéos, cardio GPS, photos de progression synchronisées, export complet | Seules les surfaces `CONFIRMED` ; bilan avec nombres vérifiés | Reboot Plan |

Dépendances : I0 avant tout ; I2 avant I3 ; I4 et I5 indépendants après I3 ; I6 après I5. Hors périmètre définitif : app Watch, social, commercialisation, Android, form check, coach conversationnel.

## 9. Synchronisation PC ↔ iPhone

Le mécanisme de CircleTasks (ADR 0011) est repris : dossier `iCloud Drive/Spartiate`, un sous-dossier par appareil, journaux d'opérations chiffrés AES-256-GCM (clé maîtresse dans le coffre de chaque appareil, jamais dans iCloud), HLC par champ, fusion par champ, tombstones, instantanés, reprise après interruption, appairage par QR entre PC et iPhone, clé de secours imprimable, oubli d'appareil, réinitialisation, bandeaux d'état. Ces **invariants sont conservés et testés** (vecteurs existants, tests Rust).

La synchro n'est pas « inchangée » pour autant (D-26). Le fork adapte :

| Élément | Fichiers | Ce qui change |
| --- | --- | --- |
| Catalogue des tables publiées | `src/domain/sync/syncTables.ts`, `SYNC_TABLE_ORDER` dans `src/domain/sync/format.ts`, `src/domain/sync/naturalIds.ts` | Tables, colonnes et identifiants naturels Spartiate ; ordre d'application respectant les clés étrangères |
| Captures SQL et repositories de synchro | `src/db/repositories/syncRepository.ts`, `src/db/repositories/sql/syncRepository.ts`, déclencheurs de `sync_outbox` dans la migration `0001_spartiate_init` | Déclencheurs recréés pour les tables Spartiate ; méthodes métier CircleTasks (`routinePauses`, `setRoutinePaused`, `openFocusSessions`, …) retirées |
| Règles métier d'application et de réparation | `src/sync/apply.ts`, `repair.ts`, `snapshot.ts`, `epochSwitch.ts` | Restauration de rappels, recalcul des pauses de routine, fermeture des focus, suppression d'événements externes et traitement des réglages / espaces fixes retirés ; règles Spartiate (séance close, § 9.1) ajoutées |
| Réglages partagés | `settings` (mécanisme hérité) | Aucun réglage partagé en I0 ; tout partage ultérieur est une décision explicite |

Toute PR touchant `src/sync/**`, `src/domain/sync/**` ou `src-tauri/src/sync/**` est relue par l'agent `sync-icloud`, avec un périmètre écrit dans le ticket et des tests de non-régression (deux bases profil / poids, conflit, instantané, reset, oubli d'appareil, reprise). Aucun seuil de lignes ne remplace cette revue.

### 9.1 Tables publiées

Vocabulaire canonique = § 20.2 (D-25). Toute table absente de ce tableau est locale.

| Table | Publiée | Itération | Règle propre à Spartiate |
| --- | --- | --- | --- |
| `profile`, `body_weight` | Oui | **I0** | Fusion par champ ; `body_weight` unique par date et source |
| `equipment_profile` | Oui | I1 | Le profil actif reste une préférence locale (`settings`) |
| `exercise` (custom seulement ; la bibliothèque embarquée n'est pas publiée) | Oui | I1 | Identifiant naturel = `id` du JSON ; `is_custom = 0` jamais publié, dans les journaux comme dans les instantanés |
| `routine`, `routine_day`, `routine_exercise`, `mesocycle` | Oui | I1 / I3 | Édition surtout PC |
| `workout`, `workout_set` | **Oui, seulement quand la séance est close** (`ended_at` non nul) ; une séance en cours reste locale | I1 | Voir ci-dessous |
| `recommendation_decision`, `progression_profile` | Oui | I2 | `progression_profile` est **recalculable** : en cas de conflit, le dernier HLC gagne, puis recalcul local depuis l'historique |
| `food`, `food_portion` (custom + cache OFF), `meal_entry`, `nutrition_target` | Oui | I4 | — |
| `measurement` | Oui | I6 | — |
| `progress_photo` | Métadonnées seulement | I6 | Le fichier reste sur l'appareil (option « synchroniser les photos de progression » via le dossier iCloud, I6) |
| `recovery_day`, `muscle_recovery` | **Oui, écrits par l'iPhone seul** ; le PC est lecteur | I5 | Résumés quotidiens, jamais les échantillons HealthKit |
| `cardio_session` | Oui, tracé compressé | I6 | — |
| `health_sample_cache`, `ai_call`, `settings` (hors réglages partagés explicites), tables techniques § 20.0 | **Non** | — | Locales ; les métadonnées d'appareil et du moteur de synchro ne sont jamais publiées comme données métier |

**Séance close (D-27).** L'exclusion des séances ouvertes et des exercices embarqués vaut pour les journaux **et** les instantanés. Le catalogue hérité ne connaît ni filtre de ligne ni publication atomique d'un agrégat : les déclencheurs capturent chaque écriture et les instantanés ont leur propre parcours. La clôture doit rendre publiable l'agrégat complet (`workout` + ses `workout_set`) ; interruption pendant la clôture, réessai, reprise après crash, édition ultérieure d'une séance close et suppression sont conçus et testés en I1. C'est une adaptation I1, pas un acquis.

### 9.2 Règles

- Les lignes publiées portent notamment `updated_at`, `device_id` et `hlc` ; `sync_field_clock` conserve les horloges et bases par champ (§ 20.1). Les suppressions passent par les tombstones (`sync_tombstone`) ; `deleted_at` porte la suppression logique côté métier ; restauration par `deleted_at` à `null` avec un HLC plus récent.
- Les conflits (même champ modifié des deux côtés) sont consignés dans `conflict_log`, consultables et réversibles dans Plus → Appareils et synchro (écran repris).
- Un appareil qui voit une version de format supérieure se met en pause et demande la mise à jour (`SYNC_FORMAT_MAJOR`, repris).
- La synchro tourne au premier plan sur l'iPhone et en cycle périodique sur le PC (comme CircleTasks) ; une séance close sur l'iPhone est visible sur le PC au cycle suivant.
- Tests : vecteurs de synchro existants (`tests/fixtures/sync/vectors.json`) étendus aux tables Spartiate ; test de catalogue (`src/domain/sync/catalogue.test.ts`) vérifiant qu'il couvre exactement les tables « Oui » du § 9.1 ; en I0, deux bases profil / poids, conflit, instantané, reset, oubli, reprise ; en I1, scénario e2e « séance iPhone → PC → édition PC → iPhone » en CI.

## 10. Onboarding et profil

En I1, configuration minimale (unités, premier profil de matériel, dossier iCloud si tu veux synchroniser). L'onboarding complet arrive en I3, sur PC ou iPhone, et se synchronise. HealthKit (iPhone) est demandé de façon contextuelle avec un mode dégradé.

### 10.0 Parcours de bout en bout (J0 → J7)

Le fil complet, de l'installation à la première synchro, avec pour chaque étape l'application de référence dont on reprend le geste. Il sert de scénario E2E de référence (§ 23) et de check-list de la première semaine.

| Étape | Appareil | Ce qui se passe | Référence reprise | Cible |
| --- | --- | --- | --- | --- |
| 1. Installer | PC | Installeur NSIS depuis `spartiate-releases` (chaîne CircleTasks) ; premier lancement, choix du dossier iCloud Drive | CircleTasks | < 2 min |
| 2. Onboarding | PC | 8 écrans (§ 10.1) : objectif, expérience, fréquence, durée, matériel, body map, split, résultat ; estimation initiale de la dépense (Mifflin) affichée comme « point de départ, recalculé après 2 semaines » | Alpha Progression (wizard, body map) ; MacroFactor (dépense initiale honnête) | < 8 min |
| 3. Première routine | PC | Un programme de départ (§ 12.5) ou génération (§ 12.1) ; édition en grille jours × exercices ; charges de départ déduites des standards de force avec décote 10 % | Alpha Progression (éditeur), Gravl (1RM initial) | < 5 min |
| 4. Ajouter l'iPhone | PC → iPhone | Plus → Appareils → « Ajouter un iPhone » affiche un QR ; sur l'iPhone, installation via SideStore (source `spartiate-releases`), ouverture, « J'ai déjà un PC », scan du QR, appairage ; la routine et le profil arrivent en < 60 s ; aucune permission iOS demandée à ce stade | CircleTasks (SideStore, appairage ADR 0011) | < 10 min hors SideStore |
| 5. Première séance | iPhone | Aujourd'hui → Lancer (≤ 3 taps) ; séries pré-remplies ; tap sur la charge → « charge de départ estimée depuis ton niveau, affinée dès la 2ᵉ séance » ; timer de repos Live Activity ou notification ; Facile / Juste / Dur ; Finish → résumé, écriture Apple Santé (première demande de permission, ici et pas avant) | Hevy (un écran, 10 s), Gravl (explication), Reboot Plan / Alpha (Dynamic Island) | Séance ≤ durée choisie |
| 6. Synchro retour | iPhone → PC | La séance terminée est publiée ; le PC l'affiche dans Historique et Progrès sans action | CircleTasks (synchro) | < 60 s après Finish |
| 7. Deuxième séance | iPhone | Premières recommandations réelles avec « Pourquoi ? » ; rep ladder ; records détectés | Alpha (recommandations dès la 2ᵉ séance), Gravl | — |
| 8. Première semaine | Les deux | Pesées (manuelles ou Santé) ; journal nutrition facultatif tant que I4 n'est pas livré ; J+6 : notification « signature à renouveler » (I-02) ; J+7 : si ≥ 4 jours loggés, premier check-in proposé, sinon « en apprentissage » | MacroFactor (check-in), CircleTasks (expiration) | Aucun faux zéro, aucun écran vide |

Critère : un utilisateur qui suit ces 8 étapes sans lire de documentation arrive à l'étape 6 le premier jour. Le scénario est rejoué à chaque release (Playwright pour 1–3, 6 ; check-list iPhone § 23.1 pour 4, 5, 7, 8).

### 10.1 Onboarding complet (I3)

| # | Étape | Données | Règle |
| --- | --- | --- | --- |
| 1 | Toi | Sexe, naissance, taille, poids (pré-rempli depuis Apple Santé sur iPhone si autorisé) | Standards de force et macros |
| 2 | Objectif | Muscle / force / recomposition / perte de gras / maintien ; rythme en % du poids par semaine | Borné −1 % à +0,5 % |
| 3 | Expérience | Débutant / intermédiaire / avancé | Charges de départ conservatrices |
| 4 | Disponibilité | Séances par semaine, durée, jours | La durée plafonne les séries |
| 5 | Matériel | Préréglage salle / maison à affiner | Profil actif |
| 6 | Priorités | Body map : 2 muscles à prioriser, 4 à éviter ; patterns douloureux | Exclusion sans promesse de prévention |
| 7 | Split | Proposé selon la fréquence ; variété Consistent / Balanced / Varied | Modifiable |
| 8 | Résultat | Première séance + cibles du jour | Commencer / Modifier |

Brouillon persisté ; toute question non essentielle ignorable.

### 10.2 Profil éditable

Tout ce qui précède, mensurations, photos de progression (locales, synchro optionnelle I6), % MG déclaré, blessures avec check-in bimensuel, clé API et plafond (par appareil), unités, jour de check-in, notifications (iPhone), verrou (Face ID / code iPhone, code PC : code conservé, entrée masquée, activation différée jusqu'à ta décision, D-37), profil de matériel actif, synchronisation (écran repris de CircleTasks).

### 10.3 Permissions (iPhone)

| Permission | Quand | Mode dégradé |
| --- | --- | --- |
| HealthKit lecture poids | Première pesée ou étape 1 | Saisie manuelle |
| HealthKit écriture séances / pesées | Fin de première séance | Séances dans l'app seulement |
| HealthKit HRV, FC repos, sommeil | Premier écran Récupération (I5) | Fatigue déclarée |
| Notifications | Fin de première séance | Timer visible dans l'app |
| Caméra | Premier scan ou photo | Recherche texte |
| Face ID | Activation du verrou | Code |
| Localisation | Premier cardio (I6) | Cardio sans tracé |

## 11. Moteur de progression (`src/domain/training`)

Même historique → même prescription ; chaque charge explicable ; conservateur sans données ; aucun bonus cumulable. Règles issues de l'algorithme publié par Gravl et de la double progression ; constantes dans `src/domain/training/config.ts`, ajustables par exercice. Horloge et identifiants injectés (`Clock`, `IdGenerator` de CircleTasks).

### 11.1 Entrée

```ts
prescribe(input: {
  exercise: Exercise; history: readonly WorkoutSet[]; lastDecision: RecommendationDecision | null;
  profile: ProgressionProfile; equipment: EquipmentProfile; mesocycle: MesocycleContext | null;
  recovery: RecoverySnapshot | null; position: number; target: RepTarget; config: ProgressionConfig; now: Instant;
}): Prescription  // { targetSets, confidence, reasons: ReasonCode[], engineVersion, activeConfig }
```

### 11.2 Ordre de calcul (normatif)

1. **Valider** : exclure des statistiques les séries non terminées, warm-up, deload, aberrantes non confirmées (> 150 % du 1RM courant) ; les garder dans l'historique brut.
2. **Cible** : plage de reps et RIR de la semaine (mésocycle) ou de la routine ; matériel actif.
3. **Dernière prescription effective** (valeur choisie si modifiée) et historique ; sans historique : charge de départ conservatrice, confiance faible, « provisoire ».
4. **Double progression** : toutes les séries au haut de plage ET difficulté compatible → un cran ; sinon +1 rep sur une série (ladder 8-7-6 → 8-8-6 → 8-8-7 → 8-8-8) ; baisse répétée → stabilité ou réduction proposée.
5. **Difficulté** = confirmation ou prudence : `Dur` / RIR ≤ 1 bloque la hausse ; `Juste` confirme ; `Facile` / RIR ≥ 4 confirme le cran. **Exception bornée** : confiance < 60 % → `Facile` recalibre le 1RM de +5 %, une fois par exercice et par mois, jamais cumulé avec le cran.
6. **Contraintes** (fatigue, inactivité, deload, récupération) : maintien ou réduction seulement.
7. **Snap matériel** après tout : incréments, min / max, barre, stack ; au-delà du garde-fou, charge inférieure.
8. **Explication** : règles déclenchées dans l'ordre, confiance, version, source des données.
9. **Présenter sans imposer** ; la modification manuelle devient la référence et est tracée.

**Invariant** : aucune proposition > `maxGainPerSession` ; une progression de reps n'est jamais convertie en hausse de charge dans la même prescription.

### 11.3 Règles et constantes

| Règle | Spécification | Constante |
| --- | --- | --- |
| 1RM estimé | Epley `w × (1 + reps/30)` ; séries > 15 reps ou < 60 % du 1RM pondérées 0,25 ; 1RM courant = moyenne pondérée par récence (1 / 0,6 / 0,3) des 3 dernières séances ; indicatif | `maxRepsForEstimate: 15` |
| Confiance | 0,4 × (séries valides / 6, plafonné) + 0,3 × (1 − dispersion relative) + 0,3 × récence (1 si < 14 j, 0 si > 60 j) ; < 0,4 → provisoire, hausse ≤ 1 cran | `minSetsForConfident: 3` |
| Charge de départ | Niveau × standards (sexe, poids) × 0,9 | `startDiscount: 0.10` |
| Cran | +1 incrément du matériel | — |
| Position | 2ᵉ exercice d'un muscle × 0,93 ; 3ᵉ × 0,88 | `positionDiscount: [1, 0.93, 0.88]` |
| Snap | Arrondi au cran ; écart > 3 % → ± 1 rep ; sinon inférieur | `snapTolerance: 0.03` |
| Fatigue intra-séance | Baisse > 20 % de reps à charge égale → alerte, −5 % ou −2 reps, refusable | `fatigueDrop: 0.20` |
| Stagnation | 3 séances sans progression → variante, autre plage, ou mini-deload −10 % | `stallSessions: 3` |
| Inactivité | 14 j sans ce muscle : −1 %/semaine, plancher −10 % ; une séance manquée ≠ régression | `detrainStart: 14` |
| Deload | Volume d'abord : séries ÷ 2 ; charge × `deloadLoad` (0,8 par défaut, par exercice) ; RIR 4+ ; exclu des calculs, visible | `deloadLoad: 0.8` |
| Plafond | 1RM +10 % max par séance | `maxGainPerSession: 0.10` |
| Récupération (I5) | Recovery ≤ 33 ou sommeil < 6 h ou FC repos > +8 % : charge × 0,95 et −1 série sur les secondaires ; jamais de bonus | `lowRecovery: 33` |
| Machines | 1RM par profil de salle ; poids libres partagés | — |
| Sans charge | Poids de corps : reps puis lest ; chronométrés : secondes ; drop sets et partielles hors tonnage et 1RM | — |

### 11.4 Explication

Template depuis `reasons` (textes dans `src/i18n`) : « +2,5 kg — haut de plage atteint sur les 3 séries, difficulté Juste (confiance 72 %) » ; détail ligne par ligne.

### 11.5 Garde-fous

Jamais d'augmentation imposée ; modification manuelle tracée ; aberrantes signalées avant enregistrement ; série non terminée ≠ réussie ; séance < 50 % des séries ne met pas à jour le 1RM ; douleur ≠ incitation ; retour à une prescription antérieure ; absence de RIR n'empêche pas la progression.

### 11.6 Tests (Vitest)

Fixtures `tests/fixtures/training/` : nominal 8 séances, stagnation, deload, changement de salle, séance partielle, `Facile` répété, retour après 3 semaines, modification manuelle, charge aberrante, haltères pas 2 kg, stack 5 kg ; propriétés : déterminisme, monotonie du snap, plafond. Couverture `src/domain` ≥ 80 % (seuil CircleTasks), training ≥ 90 %.

## 12. Génération de séance et mésocycle (`src/domain/training`, I3)

### 12.1 Séance

`generateSession({ day, program, library, equipment, profile, recovery, timeBudgetMin, config, clock })`

1. Muscles du jour par le split (Full Body ≤ 3 j, Upper/Lower 4 j, PPL 5–6 j, custom ≤ 7) ; Recovery Split en I5 (muscles ≥ 80 %).
2. Sélection : composés puis isolations ; filtre dur sur le matériel actif ; un exercice par pattern et muscle principal ; priorités en tête ; patterns douloureux exclus avec substitution.
3. Variété Consistent / Balanced (70 % récurrents, rotation 4 semaines) / Varied (rotation par mésocycle).
4. Volume borné par le budget temps (45 s par série + repos) et la plage de séries ; reps composés 5–10, isolations 8–15.
5. Style droites / pyramide / inversée.
6. « J'ai 35 min » : retrait des isolations puis réduction des séries, plan intact.

### 12.2 Mésocycle

| Élément | Spécification | Constante |
| --- | --- | --- |
| Durée | 4–7 semaines, dernière = deload ; option illimité | `mesoWeeks: 5` |
| Séries | +1 par muscle et par semaine dans la plage | `setsPerWeekIncrement: 1` |
| Intensité | RIR 3 → 1 par défaut, borne basse choisie | `rirStart: 3, rirEnd: 1` |
| Deload | Séries ÷ 2, RIR 4+, charge × `deloadLoad` ; anticipable | — |
| Fin de bloc | Bilan → répéter / changer / régénérer | — |
| Priorités | ± 1 série hebdo | — |

### 12.3 Modes

Guidé ; Libre (Variable / Fixe / Statique) ; Importé (I6, extraction IA validée) ; Maison (poids de corps).

### 12.4 Tests

Budget ± 10 % ; aucun exercice sans matériel ; aucun doublon de pattern ; < 1 s ; changement de salle sans perte ; mésocycle 5 semaines ; deload non destructif.

### 12.5 Programmes de départ (I1, `content/programs/*.json`)

Quatre routines prêtes, livrées comme contenu (même schéma que `routine` / `routine_day` / `routine_exercise`, validées par `validate-content.mjs`, exercices référencés par leur `id` de la bibliothèque § 14). Elles sont **relues par toi** comme la bibliothèque (H-8 étendu). Référence : la sortie du générateur Alpha Progression pour « prise de muscle, intermédiaire, 4 j/semaine, \~1 h 05, salle commerciale », dont la structure et la périodisation sont reprises ci-dessous.

| Programme | Jours | Public | Split |
| --- | --- | --- | --- |
| Haut / Bas 4 j (détaillé ci-dessous) | Lun Haut A · Mar Bas A · Jeu Haut B · Ven Bas B | Intermédiaire, salle | Upper / Lower |
| Full Body 3 j | Lun · Mer · Ven, mêmes patterns, exercices alternés A / B | Débutant ou reprise | Full Body |
| PPL 6 j | Push · Pull · Legs × 2 | Avancé, > 1 h disponible | PPL |
| Maison haltères 3 j | Haltères + banc + élastiques uniquement | Déplacement, maison | Full Body |

**Haut / Bas 4 j — exemple complet (valeurs de la semaine 2 ; la périodisation ci-dessous fait varier séries et RIR)**

| Jour | Exercice (`id`) | Séries × reps | Repos |
| --- | --- | --- | --- |
| Haut A | Développé couché barre (`bench-press-barbell`) | 3 × 6–10 | 150 s |
| Haut A | Rowing barre (`row-barbell`) | 3 × 6–10 | 150 s |
| Haut A | Développé incliné haltères (`incline-press-dumbbell`) | 3 × 8–12 | 120 s |
| Haut A | Tirage vertical (`lat-pulldown`) | 3 × 8–12 | 120 s |
| Haut A | Élévations latérales (`lateral-raise-dumbbell`) | 3 × 12–15 | 60 s |
| Haut A | Curl barre (`curl-barbell`) | 2 × 8–12 | 60 s |
| Haut A | Extension triceps poulie (`triceps-pushdown-cable`) | 2 × 8–12 | 60 s |
| Bas A | Squat barre (`squat-barbell`) | 3 × 5–8 | 180 s |
| Bas A | Soulevé de terre roumain (`romanian-deadlift-barbell`) | 3 × 6–10 | 150 s |
| Bas A | Presse à cuisses (`leg-press`) | 3 × 8–12 | 120 s |
| Bas A | Leg curl (`leg-curl-machine`) | 3 × 10–15 | 90 s |
| Bas A | Mollets debout (`calf-raise-standing`) | 3 × 10–15 | 60 s |
| Bas A | Planche (`plank`) | 3 × 45 s | 60 s |
| Haut B | Développé militaire barre (`overhead-press-barbell`) | 3 × 6–10 | 150 s |
| Haut B | Tractions ou tirage assisté (`pull-up`) | 3 × 6–10 | 150 s |
| Haut B | Développé couché haltères (`bench-press-dumbbell`) | 3 × 8–12 | 120 s |
| Haut B | Rowing haltère unilatéral (`row-dumbbell-one-arm`) | 3 × 8–12 | 90 s |
| Haut B | Écarté poulie (`cable-fly`) | 2 × 12–15 | 60 s |
| Haut B | Curl incliné haltères (`curl-incline-dumbbell`) | 2 × 10–15 | 60 s |
| Haut B | Dips ou extension nuque (`dips`) | 2 × 8–12 | 90 s |
| Bas B | Soulevé de terre barre (`deadlift-barbell`) | 3 × 4–6 | 180 s |
| Bas B | Fente bulgare (`split-squat-bulgarian`) | 3 × 8–12 | 120 s |
| Bas B | Hip thrust (`hip-thrust-barbell`) | 3 × 8–12 | 120 s |
| Bas B | Leg extension (`leg-extension-machine`) | 3 × 12–15 | 90 s |
| Bas B | Mollets assis (`calf-raise-seated`) | 3 × 12–15 | 60 s |
| Bas B | Relevé de jambes (`hanging-leg-raise`) | 3 × 10–15 | 60 s |

**Périodisation du mésocycle (5 semaines, reprise de l'exemple relevé chez Alpha Progression)**

| Semaine | Séries de travail | RIR cible | Charge | Note |
| --- | --- | --- | --- | --- |
| 1 | 2 | 3 | Prescription § 11 | Introduction, charges de départ |
| 2 | 3 | 2 | § 11 | Valeurs du tableau ci-dessus |
| 3 | 3 | 1 | § 11 | — |
| 4 | 4 | 0–1 | § 11 | Pic ; aucune hausse > 10 % |
| 5 | 2 | 5+ | × 0,8 | Deload planifié, 1RM et Strength Score gelés |

Le mésocycle suivant repart en semaine 1 avec les 1RM à jour. Les quatre programmes partagent cette périodisation ; seuls les jours et les exercices changent. Un programme de départ chargé devient une routine ordinaire, modifiable, synchronisée.

### 12.6 Pause et reprise (I3)

« Mettre le programme en pause » (vacances, maladie, déplacement sans salle) : les séances ne sont pas comptées comme manquées, le streak est gelé, aucune notification. À la reprise : décote de détraînement du § 11 (à partir de 14 jours, −1 %/semaine, comme Gravl), proposition d'une semaine allégée si la pause dépasse 21 jours, mésocycle décalé et non recommencé. Le profil « Maison haltères » peut être activé le temps de la pause sans toucher au programme principal.

## 13. Séance active (I1, enrichie I2)

**Priorité :** valider une série pré-remplie en une interaction, d'une main, sans réseau, sur l'iPhone ; le même écran existe sur le PC avec saisie clavier.

### 13.1 Démarrage

Aujourd'hui (séance du jour), Entraîner (routine ou vide), Siri / Action button (I6, plugin App Intents). ≤ 3 taps depuis l'écran verrouillé.

### 13.2 Écran

| Zone | Contenu | Interactions |
| --- | --- | --- |
| Titre | Nom, chrono, FC si séance Watch en cours (I5), Finish | Pause / abandonner |
| Bandeau | Vignettes réordonnables | Glisser ; sauter |
| Exercice | Nom, image (vidéo I6), plage cible, précédent, notes | Remplacer ; retirer « ne plus proposer » |
| Séries | Précédent · charge cible · reps cible · RIR · coche ; types Warm-up / Normal / Drop / Failure / Chrono ; supersets | 1 tap ; clavier ou picker ; ajouter / supprimer ; swipe |
| Charge | Tap → « Pourquoi ? » ; calculateur de disques | — |
| Fin d'exercice | Facile / Juste / Dur ignorable ; RIR si activé | — |
| Repos | Barre collante, +30 s, passer ; auto à la validation | — |
| Fatigue déclarée | Frais / Normal / Fatigué au démarrage | — |

### 13.3 Timer

Date de fin persistée (jamais un compteur) ; Live Activity via plugin si `CONFIRMED` (compact anneau + secondes ; étendu exercice suivant, charge, +30 s, passer) ; fallback notification locale programmée (plugin notifications repris, catégorie avec action « +30 s ») ; haptique via plugin `haptics`.

### 13.4 Persistance et interruptions

Chaque série écrite dans SQLite à la validation (repository, transaction) ; reprise après verrouillage, fermeture forcée, redémarrage ; correction d'une série validée tracée. **La séance en cours n'est pas publiée** par la synchro, ni dans les journaux ni dans les instantanés ; la clôture rend publiable l'agrégat complet (`workout` + `workout_set`). Interruption pendant la clôture, réessai, suppression et correction ultérieure d'une séance close sont testés. Ce mécanisme est une adaptation I1 de la synchro (§ 9.1, D-27), non un acquis du catalogue hérité.

### 13.5 Fin de séance

Résumé (durée, séries, volume hors drop / partielles / chrono, PR, écart, prochaine séance) ; image partageable ; écriture Apple Santé (plugin, si `CONFIRMED`) : un `HKWorkout` `traditionalStrengthTraining` avec début, fin, énergie estimée ; **les séries restent dans Spartiate** (`H-3` : l'écriture dépend de l'entitlement HealthKit).

### 13.6 Rattachement d'une séance Watch

Si un `HKWorkout` de force chevauche ≥ 50 % de la séance : lier (UUID stocké), ne pas écrire ; sinon proposer l'écriture. Jamais de double écriture.

### 13.7 Tests

Reprise après 5 séries et fermeture ; timer après verrouillage ; charge impossible jamais affichée ; séance partielle ne pollue pas le 1RM ; refus HealthKit ne bloque rien ; rattachement sans doublon ; séance en cours absente de la synchro, séance terminée présente.

### 13.8 Compléments issus du benchmark (révision 6.1)

| Fonction | Spécification | Référence | Itération |
| --- | --- | --- | --- |
| Calculateur d'échauffement | Pour le premier exercice composé de chaque pattern : rampes 40 % × 8, 60 % × 5, 80 % × 2 de la charge de travail, snappées au matériel, insérées comme séries Warm-up, ignorables ; paramètres dans `config/training.json` | Alpha Progression, Hevy Pro | I2 |
| Démarrer par copie | Lancer une séance en copiant une séance passée (exercices et dernières charges) ; aucune routine créée | Hevy | I1 |
| Mise à jour de la routine | À la fin, si des exercices ont été remplacés / ajoutés / retirés ou le nombre de séries changé : « Mettre à jour la routine ? » (Oui / Cette fois seulement) | Hevy | I1 |
| Historique éditable | Corriger une série passée (charge, reps, type) depuis Historique ; recalcul du 1RM et des records ; correction tracée (`recommendation_decision` conservée) | Alpha Progression | I1 |
| Replay set par set | Timeline de la séance : charge / reps / repos réels face aux cibles, écarts en couleur | uFit AI (inspiration) | I6 |
| Circuits | Enchaînement de 3+ exercices sans repos intermédiaire, repos après le tour ; type de groupe à côté des supersets | Hevy | I6 |

## 14. Bibliothèque d'exercices et profils de matériel

### 14.1 Contenu (I1)

150 exercices en JSON embarqué (`content/exercises/exercises.json`), générés avec Claude Code et **relus par toi**, validés en CI par `scripts/content/validate-content.mjs` (Node, sans dépendance, comme les scripts CircleTasks) :

```json
{
  "id": "bench-press-barbell",
  "nameFr": "Développé couché à la barre",
  "aliasesEn": ["barbell bench press"],
  "muscles": [{"id": "chest", "weight": 1.0}, {"id": "triceps", "weight": 0.5}, {"id": "front-delts", "weight": 0.3}],
  "equipment": ["barbell", "flat-bench"],
  "pattern": "push-horizontal",
  "kind": "compound",
  "metric": "load-reps",
  "bodyweightFraction": null,
  "defaultRepRange": [5, 10],
  "defaultRestSec": 150,
  "instructions": {"setup": "…", "execution": "…", "mistakes": ["…", "…", "…"]},
  "media": {"images": ["bench-press-barbell-1.jpg", "bench-press-barbell-2.jpg"], "video": null, "license": "…", "source": "…"},
  "strengthStandardKey": "bench",
  "schemaVersion": 1
}
```

Règles : `id` unique et stable ; `nameFr` et instructions non vides ; muscles et matériel dans des listes fermées (`muscles.json`, `equipment.json`) ; pattern ∈ {push-horizontal, push-vertical, pull-horizontal, pull-vertical, hinge, squat, lunge, carry, core, isolation} ; `metric` ∈ {load-reps, bodyweight-reps, time, distance} ; chaque média a licence et source (`H-9`). Les médias sont servis depuis le bundle (hors du plafond du bundle de départ : chargés à la demande, règle CircleTasks).

### 14.2 Fiche, recherche, custom

Fiche Info / Instructions / Historique (PR, 1RM, confiance, graphique Recharts) ; recherche nom FR / alias EN, body map, matériel, pattern ; custom en I1 (table `exercise`, publiée par la synchro), complétion IA depuis le nom en I6 ; évaluation hypertrophie en I6.

### 14.3 Profils de matériel

Plusieurs profils (salle, maison, voyage), un actif par appareil (le profil actif est une préférence locale, les profils eux-mêmes sont synchronisés) ; barres (type, poids), disques (inventaire par côté), haltères (plage, pas), kettlebells, machines (stack min / max / pas, 1RM par profil), câbles, bancs, racks, poids de corps ; incréments par type ; forcés / interdits ; préréglages « salle commerciale », « maison haltères », « poids de corps ».

## 15. Nutrition adaptative (`src/domain/nutrition`, I4)

La dépense est **mesurée** depuis les apports loggés et la tendance de poids ; les cibles sont ajustées chaque semaine avec ton accord ; chaque valeur est traçable. Saisie au clavier sur PC, scan et photo sur iPhone ; tout se synchronise.

### 15.1 Formules (normatives)

- Tendance `T(t)` : EMA des pesées, demi-vie 14 jours ; pesée à > 2 % de `T` pondérée 0,25.
- Dépense sur `N` jours (21) : `TDEE = moyenne(kcal des jours complets) − (ΔT_kg / N) × 7 700`, `ΔT_kg = T(fin) − T(début)` ; lissage EMA demi-vie 7 jours.
- Initialisation Mifflin-St Jeor × activité ; pondération formule → mesure sur 28 jours.
- Jours non loggés : **jamais 0** ; imputés à l'affichage avec incertitude ; exclus du TDEE si couverture insuffisante.
- Confiance affichée (couverture, pesées).

### 15.2 Fiabilité et ajustement

| Règle | Spécification | Constante |
| --- | --- | --- |
| Couverture | ≥ 4 jours complets / 7 et ≥ 2 pesées / 7 j sur 2 semaines, sinon aucun ajustement | `minLoggedDays: 4`, `minWeighIns: 2` |
| Jour complet | Déclaré ou déduit (≥ 3 entrées sur ≥ 8 h) ; sinon `partial` / `unknown` | — |
| Amplitude | ≤ ± 150 kcal / semaine ; semaines indépendantes | `maxWeeklyDelta: 150` |
| Macros | Protéines 1,6–2,2 g/kg (± 2 g par check-in) ; lipides ≥ 0,6 g/kg ; ajustement sur glucides | — |
| Check-in | Jour configurable ; accepter / refuser / personnaliser ; relançable ; sur PC ou iPhone | `checkInWeekday` |
| Bornes | Plancher 1 200 kcal (800 sur confirmation) ; perte ≤ 1 %/semaine ; > ±25 % du TDEE → alerte et révision manuelle | — |
| Styles | Guidé / Collaboratif / Manuel | — |
| Modificateurs (I6) | Tendance de pas (iPhone) accélère les mises à jour | opt-in |

### 15.3 Saisie

| Méthode | PC | iPhone | Itération |
| --- | --- | --- | --- |
| Recherche (récents, favoris, go-tos ; Perso / Ciqual / OFF ; grammes ou portions ; provenance) | Oui | Oui | I4 |
| Quick Add, recettes, assiette | Oui | Oui | I4 |
| Code-barres (plugin officiel `@tauri-apps/plugin-barcode-scanner`, hérité de CircleTasks où il sert à l'appairage ; Camera Control si `CONFIRMED`) | — | Oui | I4 |
| Photo → API IA (aperçu, confirmation, JSON strict, lignes corrigeables, « estimation ») | Import d'une image possible | Caméra | I4 |
| Describe (texte / dictée) | Texte | Texte, dictée via plugin `speech` hérité (infrastructure conservée, écrans de capture CircleTasks supprimés, D-33) | I6 |
| Compléments avec rappels | Oui | Oui (rappels iPhone) | I6 |

### 15.4 Bases alimentaires et licences

| Base | Usage | Licence | Statut |
| --- | --- | --- | --- |
| Ciqual (ANSES) | \~3 000 génériques FR embarqués (`content/food/ciqual.json`) | Licence Ouverte Etalab 2.0 avec attribution (`H-11`) | I4 |
| Open Food Facts | Produits de marque, API publique appelée par Rust, cache local 90 jours | ODbL, attribution (`H-12`) | I4 |
| Fiches perso | Créées / corrigées, synchronisées | — | I4 |

Licences consignées dans `docs/licences.md` (fichier CircleTasks repris).

### 15.5 Écrans

Journal timeline horaire, cibles restantes, couverture du jour ; dashboard calories / macros, balance 7 j, tendance de poids et dépense avec confiance ; Stratégie. Écriture Apple Santé (iPhone, si `CONFIRMED`).

### 15.6 Tests

Fixtures 8 semaines : couverture complète, partielle, pesée aberrante, changement d'objectif, plancher ; signe de la formule ; jamais 0 ; borne ± 150.

### 15.7 Compléments issus du benchmark (révision 6.1)

| Fonction | Spécification | Référence | Itération |
| --- | --- | --- | --- |
| Étiquette nutritionnelle → fiche | Photo de l'étiquette → même adaptateur IA que la photo de repas → fiche `food` custom pré-remplie (par 100 g et par portion), à confirmer | MacroFactor | I6 |
| Repères de qualité | Sel, sucres, graisses saturées, fibres du jour face aux repères OMS, calculés depuis Ciqual ; affichage seul, jamais d'ajustement de cible ; « inconnu » quand la fiche n'a pas la donnée (jamais 0) | Reboot Plan (OMS), MacroFactor | I6 |
| Micronutriments | 8 nutriments épinglés (fer, calcium, magnésium, potassium, vitamines D, B12, C, zinc) depuis Ciqual, seuils min / cible configurables ; les fiches Open Food Facts sans donnée comptent « inconnu » (H-19b) | MacroFactor Nutrient Explorer | I6 |
| Jours hauts / bas | Répartition hebdomadaire des calories (jours d'entraînement +, repos −) à somme constante ; option de la Stratégie | MacroFactor | I4 |
| Note d'équilibre par aliment | Non retenu : classement « équilibré / à surveiller / à limiter » jugé culpabilisant et redondant avec les repères ci-dessus | Reboot Plan | — |

## 16. Récupération (`src/domain/recovery` + plugin `healthkit`, I5)

Heuristiques expérimentales inspirées de Recovery / Strain / Sleep ; jamais un diagnostic ; abstention quand les données manquent ; proposition seulement. Les mesures sont lues **sur l'iPhone** par le plugin Swift `healthkit`, les résumés quotidiens sont publiés vers le PC par la synchro.

### 16.1 Niveaux

| Niveau | Données | Comportement | Itération |
| --- | --- | --- | --- |
| A | Fatigue déclarée, historique | Récupération par muscle estimée ; suggestion prudente | I1 / I5 |
| B | Sommeil (durée) et FC repos sans baseline complète | Modulation prudente par seuils absolus, avec message | I5 |
| C | ≥ 7 nuits (14 recommandées) HRV, FC repos, sommeil | Recovery, Exertion, zone cible, besoin de sommeil | I5 |

### 16.2 Plugin `healthkit` (contrat, § 19)

| Commande | Entrée | Sortie |
| --- | --- | --- |
| `healthkit_authorize` | types lecture / écriture | statut par type |
| `healthkit_read_quantity` | type (`hrvSDNN`, `restingHeartRate`, `stepCount`, `activeEnergy`, `heartRate`, `respiratoryRate`, `wristTemperature`, `bodyMass`), fenêtre | échantillons horodatés |
| `healthkit_read_sleep` | fenêtre | segments avec stade |
| `healthkit_read_workouts` | fenêtre | workouts (type, début, fin, énergie, UUID) |
| `healthkit_write_workout` | début, fin, énergie | UUID |
| `healthkit_write_body_mass` / `delete_sample` | valeur, date / UUID | ok |
| `healthkit_observe` | types | événements vers le front (observer queries, `H-13`) |

### 16.3 Scores (niveau C)

| Score | Définition | Constante |
| --- | --- | --- |
| Baseline | Moyenne et σ glissants sur 14 nuits valides (7 min) de HRV et FC repos ; outliers > 2,5 σ exclus de la baseline | `baselineDays: 14`, `minNights: 7` |
| Recovery 0–100 | `z_hrv = (HRV − μ) / σ`, `z_fc = (μ_fc − FC) / σ_fc` ; `raw = 0,7 z_hrv + 0,3 z_fc` borné \[−2, 2\] ; `score = 50 + 25 raw`, × facteur sommeil \[0,8 ; 1,0\] ; **null** avec raison si mesure absente, < 7 nuits ou σ = 0 | `hrvWeight: 0.7` |
| Qualité | good / partial / insufficient | — |
| Exertion 0–10 | `cardio = Σ min_zone_i × w_i`, w = \[1,2,3,4,5\] (zones depuis FC max estimée ou mesurée) ; `muscu = tonnage/1000 × facteur` (0,8 / 1 / 1,2) ; `10 × (1 − e^(−(cardio+muscu)/k))` | `k: 300` |
| Zone cible | ≥ 66 → 6–8 ; 34–65 → 4–6 ; ≤ 33 → 0–3 ; null → aucune | — |
| Sommeil | Besoin = 7 h 30 + 0,2 h × max(0, Exertion\_veille − 5) + dette (7 j, plafond 3 h) ; score = durée / besoin ; régularité σ coucher 7 j | `baseSleepHours: 7.5` |
| Par muscle | 0 % après séance (séries × difficulté) → 100 % sur `recoveryHours[muscle]` (48 / 72 / 96 h) ; cardio importé retire 10 / 25 / 40 % aux jambes, 5 / 10 / 20 % au reste ; **approximation** | `recoveryHours` |

### 16.4 Effets et publication

Recovery Split ; modulation du moteur (maintien ou réduction) ; cadrans Aujourd'hui ; notification du matin ≤ 1/jour (iPhone). L'iPhone écrit `recovery_day` (date, niveau, scores, qualité, raison d'abstention) et `muscle_recovery` ; le PC les lit et les affiche, sans recalcul.

### 16.5 Présentation

Valeur ou « en apprentissage J+x/14 », qualité, contributeurs, « estimation, pas un avis médical » ; aucun cadran à faux zéro.

### 16.6 Tests

Fixtures 30 nuits : baseline, abstention, σ = 0, nuit courte, FC élevée, 3 jours sans Watch, outlier, cardio importé ; vecteurs de synchro pour `recovery_day`.

### 16.7 Compléments issus du benchmark (révision 6.1)

| Fonction | Spécification | Référence | Itération |
| --- | --- | --- | --- |
| Journal de facteurs | Cases cochées le matin (alcool, caféine après 16 h, repas tardif, stress, courbatures, maladie, voyage, entraînement tardif) ; après 30 jours et ≥ 5 occurrences, moyenne de Recovery avec / sans le facteur, affichée avec `n` ; corrélation, pas causalité, dit tel quel | WHOOP Journal, Athlytic | I6 |
| Heure de coucher cible | Besoin de sommeil (§ 16.3) − heure de lever habituelle (médiane 14 j) → heure de coucher proposée ; notification iPhone optionnelle 30 min avant | WHOOP Sleep Planner, Athlytic | I5 |
| Valeurs inhabituelles | FC repos > μ + 2 σ ou HRV < μ − 2 σ deux nuits de suite → carte « valeurs inhabituelles, repos conseillé » ; aucune hypothèse médicale | WHOOP Health Monitor (simplifié) | I6 |
| Pas | Tuile Aujourd'hui : pas du jour, moyenne 7 j (`stepCount`), sans classement ni duel | Reboot Plan | I5 |
| Récupération en séance | Si Recovery ≤ 33 au lancement : bandeau « journée rouge : maintien des charges proposé », un tap pour accepter ou ignorer | Athlytic (zone cible) | I5 |

## 17. Progrès, bilans, appels IA

### 17.1 Indicateurs

| Indicateur | Définition | Itération |
| --- | --- | --- |
| Charges et 1RM | Par exercice, bande de confiance | I2 |
| Records | Charge, reps, volume, 1RM estimé ; notification en séance | I1 |
| Volume | Séries par muscle / semaine vs plage | I3 |
| Constance | Streak, séances / semaine, calendrier | I1 |
| Corps | Tendance, dépense et confiance, mensurations, photos côte à côte | I4 / I6 |
| Strength Score | 8 groupes, barre et haltères, ajusté poids et sexe ; inchangé en deload | I3 |
| Récupération | Tendances 30 j (lues depuis `recovery_day`) | I5 |

Graphiques Recharts (dépendance CircleTasks), calculés côté front depuis les repositories, < 300 ms ; sur PC, vues larges multi-graphiques.

### 17.2 Appels IA — règles

| Règle | Spécification |
| --- | --- |
| Déclenchement | Bouton explicite, aperçu de l'envoi |
| Clé | Coffre de l'appareil (keyring Windows / Trousseau iOS, mécanisme CircleTasks) ; saisie par appareil ; jamais synchronisée ni dans le dépôt |
| Appel | Effectué **par Rust** (`reqwest`, déjà présent) avec la clé lue du coffre ; la WebView ne voit jamais la clé (règle ADR 0008) |
| Budget | Plafond mensuel par appareil, compteur, blocage |
| Données | Image de repas, texte, programme à importer, agrégats de bilan ; **jamais** HRV, FC, sommeil, poids nominatif, photos corporelles |
| Réponse | JSON validé contre un schéma écrit à la main (`src/domain/ai/parse.ts`, comme `sync/parse.ts`) ; rejet sinon ; aucune action sans confirmation |
| Fournisseur | Abstrait (`AiProvider` dans `src/platform/ai`) ; à décider avant I4 (`H-14`) |

### 17.3 Bilans (I6)

Agrégat local → texte (3 faits, 1 recommandation) → **vérification que chaque nombre existe dans l'agrégat** → affichage ; fallback template. Export CSV / JSON.

### 17.4 Import de programme (I6)

Capture, PDF ou texte → `{sessions:[{name, exercises:[{name, sets, repsMin, repsMax, rir?}]}]}` → mapping validé → routine Libre.

## 18. Navigation, écrans et états dégradés

### 18.1 Deux coquilles, un même code

|  | iPhone (16 Pro Max, iOS 18+) | PC (Windows 10/11) |
| --- | --- | --- |
| Navigation | 5 onglets bas : Aujourd'hui, Entraînement, Nutrition, Progrès, Plus | Barre latérale rétractable avec les mêmes 5 sections + Réglages ; raccourcis clavier (`Ctrl+1…5`, `Ctrl+K` recherche) |
| Largeur | Une colonne, safe areas Dynamic Island / home indicator (mécanisme CircleTasks, `src/platform`) | Fenêtre redimensionnable ≥ 1 024 × 700 ; vues maître-détail (liste à gauche, fiche à droite) |
| Gestes | Swipe, long-press, haptique (plugin `haptics` repris) | Clic droit → menus, double-clic, glisser-déposer pour réordonner |
| Séance | Minuteur système (Live Activity si `CONFIRMED`), verrouillage géré (ADR 0013) | Minuteur en fenêtre + badge dans le titre ; pas de notification système requise |
| Rôle principal | Séance, scan, photo, Santé, récupération | Programmation, bibliothèque, profils matériel, bilans, export, saisie nutrition au clavier |

Les écrans sont les mêmes composants React (`src/features/*`) ; seule la coquille (`src/ui/shell/MobileShell.tsx`, `DesktopShell.tsx`) change, choisie par `platform.kind` au démarrage. Aucun écran n'est réservé à un appareil : une fonction indisponible (caméra, Santé) affiche un état « disponible sur iPhone » explicite, jamais un bouton mort.

### 18.2 Écrans par onglet

| Onglet | Écrans | Itération |
| --- | --- | --- |
| Aujourd'hui | Cadrans récupération / sommeil / effort, séance du jour, cibles nutrition restantes, streak, état de la synchro et de la signature | I1 → I5 |
| Entraînement | Routines, Mes programmes, Lancer, Séance active, Résumé, Historique, Bibliothèque, Profils matériel | I1 → I3 |
| Nutrition | Journal, Recherche / Scan / Photo, Dashboard, Stratégie, Check-in | I4 |
| Progrès | Graphiques, Records, Strength Score, Corps, Bilans | I2 → I6 |
| Plus | Profil, Objectifs, Appareils et synchro, Apple Santé, Clé IA et budget, Export / import, Journaux, À propos et licences | I0 → I6 |

### 18.3 États dégradés (obligatoires, testés)

| Situation | Comportement |
| --- | --- |
| Aucune donnée (première semaine) | Écrans d'apprentissage « J+x », pas de faux zéro, pas de graphique vide |
| Pas de Watch / Santé refusée | Niveau A ou B (§ 16), cadrans masqués avec explication |
| iCloud absent ou hors ligne | Tout fonctionne en local ; bandeau discret « dernière synchro il y a … » ; reprise automatique (ADR 0011) |
| Conflit de synchro | Résolu par HLC par champ ; ligne dans le journal ; jamais de boîte de dialogue bloquante |
| Signature expirée dans < 24 h | Notification + bandeau Aujourd'hui (I-02 repris) ; procédure SideStore en un lien |
| Clé IA absente / budget épuisé | Fonctions IA grisées avec cause ; tout le reste intact |
| Live Activity indisponible | Minuteur en app + notification locale ; même précision |
| Verrouillage pendant une séance | Reprise exacte (timer, série en cours) à la réouverture (ADR 0013) |
| Crash | Séance en cours restaurée depuis SQLite (écriture à chaque série) |

### 18.4 Charte visuelle (D-19)

Identité **laconique, sombre, rouge et bronze**. Tokens dans `src/ui/tokens.css`, consommés par tous les composants ; aucune couleur en dur ailleurs (règle vérifiée par `lint`).

| Token | Sombre (défaut) | Clair | Usage |
| --- | --- | --- | --- |
| `--bg` | `#0D0E11` | `#F4F1EA` | Fond de page |
| `--surface` / `--surface-2` | `#15171C` / `#1D2027` | `#FFFFFF` / `#ECE8DF` | Cartes, barres |
| `--line` | `#2A2E37` | `#D8D2C6` | Séparateurs |
| `--fg` / `--fg-2` | `#EDE7DC` / `#A39C90` | `#15171C` / `#5E584F` | Texte ivoire / secondaire |
| `--accent` | `#B8322A` (hover `#D23B31`) | `#B8322A` | Rouge : bouton principal, série validée, zone rouge |
| `--bronze` / `--bronze-2` | `#C28E4C` / `#E0B577` | `#8E6530` / `#C28E4C` | Records, 1RM, scores, titres de section |
| `--ok` / `--warn` / `--info` | `#5E9E6B` / `#D9A441` / `#6F8FB3` | mêmes | Zones verte / jaune de récupération, états |

Règles de contraste (WCAG AA, vérifiées : ivoire sur fond 15,7 ; secondaire sur surface 6,6 ; bronze sur surface 6,2 ; ivoire sur rouge 4,8) : le rouge **n'est jamais une couleur de texte** sur fond sombre (3,0) — uniquement un fond portant du texte ivoire ; le vert porte du texte sombre, jamais ivoire (2,6). Un test `test:contrast` (script Node) recalculant ces ratios à chaque modification des tokens est **à créer** (D-35, ticket dédié rattaché à SPA-009) ; il n'existe pas dans CircleTasks et `lint` seul ne prouve pas toutes les règles de couleur.

| Élément | Choix |
| --- | --- |
| Typographie | Corps : police système (SF Pro sur iPhone, Segoe UI sur Windows), zéro poids embarqué ; titres et grands chiffres : capitales romaines « Cinzel » (SIL OFL, une graisse, \~60 Ko, dans le bundle) ; chiffres tabulaires partout où une valeur change (charges, timer) |
| Mode | Sombre par défaut, clair disponible, suit le système, forçable dans Plus |
| Icônes | Jeu d'icônes déjà présent dans CircleTasks s'il existe, sinon Lucide (ISC) ; trait 1,75 px ; pas d'emoji dans l'interface |
| Icône d'app | Bouclier rond bronze sur fond `#0D0E11`, lambda (Λ) rouge au centre ; SVG source dans `content/brand/`, exports 1024 px (iOS) et ICO (Windows) générés par script |
| Formes | Rayons 10 px ; grille 4 pt ; cibles tactiles ≥ 44 pt sur iPhone ; densité plus forte sur PC (tables à 32 px de ligne) |
| Ton | Libellés courts, impératifs, sans point d'exclamation ni confetti ; le chiffre d'abord, l'explication en dessous ; aucune mascotte |
| Mouvement | Transitions ≤ 200 ms ; aucune animation décorative ; respect de « réduire les animations » |

### 18.5 Maquettes

L'interface est **responsive** : un seul code, les composants se réorganisent selon la largeur (`platform.kind` ne choisit que la coquille § 18.1). Responsive ne veut pas dire identique : à 440 px un écran tient en une colonne défilante, à 1 440 px il devient maître-détail ou multi-colonnes. Les maquettes fixent donc **la disposition à chaque largeur**, pas une image par appareil ; une seule largeur suffit quand la mise en page ne fait que se reflouer.

| Maquette | 440 px | 1 440 px | Raison |
| --- | --- | --- | --- |
| Onboarding (8 écrans) | ✓ | — | Formulaire pas à pas, même disposition centrée sur PC |
| Aujourd'hui | ✓ | ✓ | Cadrans empilés vs grille 3 + 2 |
| Routine / Programme | ✓ | ✓ | Liste par jour vs grille jours × exercices |
| Séance active | ✓ | ✓ | Un écran tactile vs saisie clavier avec historique à droite |
| Résumé de séance | ✓ | — | — |
| Fiche exercice | ✓ | ✓ | Onglets vs trois colonnes |
| Profil de matériel | — | ✓ | Édition principalement sur PC ; reflow suffisant sur iPhone |
| Journal nutrition | ✓ | ✓ | Timeline vs timeline + recherche permanente |
| Dashboard nutrition | ✓ | ✓ | Cartes empilées vs grille |
| Check-in hebdo | ✓ | — | Carte unique |
| Récupération | ✓ | — | Lecture seule sur PC, même carte |
| Progrès | ✓ | ✓ | Un graphique à la fois vs tableau de bord |
| Plus → Appareils et synchro | ✓ | ✓ | QR à scanner vs QR à afficher |
| États dégradés (3) | ✓ | — | Bandeaux et cartes vides, identiques |

**Maquettes validées le 31 octobre 2026 (D-21)** : 24 planches HTML autonomes à taille réelle (iPhone 16 Pro Max 440 × 956 pt, PC 1440 × 900), même méthode que CircleTasks, mode sombre selon § 18.4, données d'exemple figées (ven. 30 oct. 2026, programme Haut / Bas 4 j, semaine 2 / 5). Livrées dans `docs/maquettes/` du fork avec `index.html` ; le PRD les désigne comme **référence visuelle** : écart PRD / maquette → la maquette est suivie et l'écart noté dans `docs/decisions.md` ; écran sans maquette → composé à partir des motifs de Plus / Réglages et consigné. `npm run visual` capture l'app et la maquette à la même taille pour comparaison à chaque lot ; les paires de captures sont relues par un humain, sans seuil de pixels automatique (D-35). Point de rupture unique `≥ 900 px` = disposition PC (H-19a : aucune largeur intermédiaire, pas d'iPad).

| Fichier | Écran | Ce que la planche fixe |
| --- | --- | --- |
| `iPhone-Onboarding.html` | Onboarding, étape 6 / 8 | Body map priorités / évités, mouvements douloureux, « ignorer » toujours possible ; gabarit des 7 autres étapes |
| `iPhone-Aujourdhui.html` · `PC-Aujourdhui.html` | Aujourd'hui | Trois cadrans, séance du jour avec charges, nutrition restante, semaine, poids ; PC en trois colonnes bornées |
| `iPhone-Routine.html` · `PC-Routine.html` | Programme | Mésocycle et périodisation S1–S5, jours, Lancer / Sauter / Deload, pause ; PC grille jours × exercices, actions de page en haut |
| `iPhone-Seance.html` · `PC-Seance.html` | Séance active | Un écran, série en cours, « Pourquoi ? », repos collant, Facile / Juste / Dur ; PC clavier, historique et explication à droite |
| `iPhone-Resume.html` | Résumé de séance | Records, écart au plan, muscle map, Apple Santé, « Mettre à jour la routine ? » |
| `iPhone-Fiche.html` · `PC-Fiche.html` | Fiche exercice | Info / Instructions / Historique ; PC recherche permanente + trois colonnes |
| `PC-Materiel.html` | Profil de matériel | Barres, disques par côté, haltères, machines et 1RM, incréments, forcés / interdits, aperçu des charges |
| `iPhone-Journal.html` · `PC-Journal.html` | Journal nutrition | Timeline horaire, provenance par aliment, jour partiel ; PC recherche au clavier, cibles à droite |
| `iPhone-Dashboard.html` · `PC-Dashboard.html` | Dashboard nutrition | Balance 7 j, tendance 28 j, dépense avec confiance et couverture ; PC + Stratégie et historique des check-ins |
| `iPhone-CheckIn.html` | Check-in hebdomadaire | Résumé, proposition motivée (lissage 4 semaines), Accepter / Personnaliser / Refuser |
| `iPhone-Recuperation.html` | Récupération | Contributeurs vs baseline, zone cible, coucher cible, par muscle, journal de facteurs |
| `iPhone-Progres.html` · `PC-Progres.html` | Progrès | Un graphique à la fois ; PC tableau de bord, Strength Score, constance, export |
| `iPhone-Appairage.html` · `PC-Appairage.html` | Appareils et synchro | Scanner / afficher le QR, clé de récupération, journal ; destructif en bas et annoncé |
| `iPhone-Degrade-Apprentissage.html` · `-HorsLigne.html` · `-Signature.html` | États dégradés | J+3 sans faux zéro, hors ligne local, signature qui expire (bannière + bandeau) |

Décisions de dessin consignées (D-21) : actions de page en barre du haut sur PC ; caméra d'appairage en bloc et non plein écran ; cadrans remplacés par « en apprentissage » la première semaine ; bandeau de signature prioritaire sur le contenu.

### 18.6 Accessibilité

Dynamic Type suivi jusqu'à « Très grand » sans troncature des charges et du timer ; zoom 100–150 % sur PC ; contraste AA (§ 18.4) ; chaque action tactile a un équivalent clavier sur PC ; « réduire les animations » et « réduire la transparence » respectés ; aucune information portée par la couleur seule (zones de récupération doublées d'un libellé).

## 19. Plugins Swift et contrat iOS

### 19.1 Plugins repris de CircleTasks

| Plugin | Type | Usage Spartiate | Décision |
| --- | --- | --- | --- |
| `haptics` | Local Swift (`src-tauri/plugins/haptics`) | Retour à chaque série validée, record, fin de repos | Repris tel quel |
| `notification-actions` | Local Swift | Fin de repos, notification du matin, expiration de signature, check-in | Repris tel quel |
| `files` / `folder-bookmark` | Local Swift | Dossier iCloud Drive de la synchro, export / import | Repris tel quel |
| `privacy-shield` | Local Swift | Masque l'app dans le sélecteur (données corporelles) | Repris, activable |
| `speech` | Local Swift | Dictée Describe (I6) | Infrastructure conservée, écrans de capture CircleTasks supprimés (D-33) |
| `vision` | Local Swift | OCR d'un programme papier (I6) | Infrastructure conservée, écrans de capture CircleTasks supprimés (D-33) |
| `barcode-scanner` | Officiel Tauri (`@tauri-apps/plugin-barcode-scanner`, `tauri-plugin-barcode-scanner`) | Appairage par QR dès I0 ; scan de code-barres alimentaire en I4 | Hérité, nécessaire dès SPA-008 ; la caméra reste autorisée pour l'appairage (D-33) |
| `reminders`, `web-auth` | Local Swift | Sans usage identifié | **Supprimés** en SPA-001b (D-18 confirmé) avec leurs dépendances Cargo, commandes, permissions, textes plist et tests ; réintroduction possible depuis l'historique git |

### 19.2 Nouveaux plugins

| Plugin | Rôle | Risque | Spike |
| --- | --- | --- | --- |
| `healthkit` | Lecture / écriture Apple Santé (§ 16.2), observer queries | `H-3` : entitlement `com.apple.developer.healthkit` doit survivre à la signature SideStore (plan D-14) | SPA-006 |
| `live-activity` | Minuteur de repos en Dynamic Island / écran verrouillé via ActivityKit | `H-4` : cible d'extension WidgetKit à injecter dans le projet Xcode généré par `tauri ios init` ; `tauri.conf.json` ne le prévoit pas | SPA-007 |
| `camera` | Photo de repas (plugin local ou officiel, à trancher) | Faible | I4 |

Structure réelle d'un plugin local CircleTasks, à suivre pour tout nouveau plugin : `src-tauri/plugins/<nom>/Cargo.toml`, `build.rs`, pont Rust dans `src/` du plugin, `ios/Package.swift`, `ios/Sources/<Nom>Plugin.swift` héritant de `Plugin` avec commandes `@objc` ; enregistrement dans `src-tauri/src/lib.rs` sous `#[cfg(target_os = "ios")]` ; permissions et capabilities générées ; façade TypeScript dans `src/platform/<nom>` là où elle existe (par exemple `src/platform/haptics`, `src/platform/speech`), avec un stub Windows retournant `unsupported`. Il n'existe pas de dossier `src/platform/ios` : la plateforme est choisie par `platform.kind`. Pas de dépendance Swift externe. Le contrat plist actuel interdit `UIBackgroundModes` : toute évolution I5 / I6 qui en aurait besoin est revue explicitement.

### 19.3 Contrat `Info.plist` (`scripts/ios/plist-contract.json`, repris et étendu)

| Clé | Valeur | Vérifiée en CI |
| --- | --- | --- |
| `CFBundleIdentifier` | `fr.spartiate.app` | Oui |
| `MinimumOSVersion` | `18.0` | Oui |
| `NSHealthShareUsageDescription` / `NSHealthUpdateUsageDescription` | Textes FR explicites | Oui (I5) |
| `NSCameraUsageDescription` | Scan et photo de repas | Oui (I4) |
| `NSSupportsLiveActivities` | `true` | Oui (si H-4 confirmé) |
| `UIBackgroundModes` | aucun (pas de fond) | Oui |
| `ITSAppUsesNonExemptEncryption` | `false` | Oui |

### 19.4 Entitlements (`src-tauri/gen/apple/Spartiate.entitlements`, D-14)

```xml
<key>com.apple.developer.healthkit</key><true/>
<key>com.apple.developer.healthkit.access</key><array/>
<key>keychain-access-groups</key><array><string>$(AppIdentifierPrefix)fr.spartiate.app</string></array>
```

Pas d'App Groups, pas d'iCloud container, pas de push (interdits en équipe personnelle, § 6). La CI exécute `codesign -s - --entitlements Spartiate.entitlements --force Spartiate.app` après `--no-sign`, puis vérifie `codesign -d --entitlements :- Spartiate.app` (SPA-003). Si SideStore n'applique pas l'entitlement HealthKit → fallback saisie manuelle (§ 16.1 niveau A/B) et `H-3` passe `BLOCKED`.

## 20. Modèle de données SQLite

Mécanisme repris de CircleTasks : migrations TypeScript dans `src/db/migrations/`, registre `src/db/migrations/index.ts`, exécutées par `src/db/migrator.ts` via `SqlDriver` (driver natif `tauri-plugin-sql` vendored en production, `@sqlite.org/sqlite-wasm` en mémoire dans les tests et le navigateur), historique dans `schema_migrations`, sauvegarde avant migration (`src/db/migrationBackup.ts`) et sauvegardes natives (`src-tauri/src/backup.rs`, `APP_SCHEMA_VERSION`). Repositories dans `src/db/repositories/` ; aucun type généré, les types sont écrits à la main. Spartiate initialise une **nouvelle base** : le registre est réinitialisé avec `0001_spartiate_init` et `APP_SCHEMA_VERSION` vaut 1 ; aucune base CircleTasks n'est migrée ni purgée (D-23).

### 20.0 Tables techniques héritées (D-24)

Conservées telles quelles, jamais publiées comme données métier :

| Table | Rôle |
| --- | --- |
| `settings` | Clé / valeur, local ou partagé : identité d'appareil (`device.id`), préférences, version ; utilisée par le démarrage (`src/features/app/bootstrap.ts`), `settingsRepository` et la restauration Rust |
| `schema_migrations` | Historique des migrations appliquées |
| `sync_guard` | Verrou d'exclusivité de la synchro |
| `sync_field_clock` | Horloges HLC et bases par champ |
| `sync_outbox` | File d'envoi alimentée par les déclencheurs |
| `sync_state`, `sync_meta` | État et métadonnées du moteur |
| `sync_tombstone` | Suppressions à propager |
| `sync_unknown`, `sync_parked` | Lignes de format inconnu ou mises en attente |
| `conflict_log` | Conflits consultables et réversibles |
| `epoch_carry_report` | Rapport local des bascules d'époque (restauration, concurrence, reset) |

`app_meta` et `app_pref` n'existent pas et ne sont pas créées : leurs usages (identité, version, préférences) sont couverts par `settings`. Les tables métier Spartiate sont celles du § 20.2 ; les déclencheurs de `sync_outbox` sont recréés pour elles dans `0001_spartiate_init`.

### 20.1 Colonnes communes

Chaque table métier porte `id TEXT PRIMARY KEY` (UUID v7), `created_at`, `updated_at`, `deleted_at` (suppression logique). Les lignes publiées portent notamment `updated_at`, `device_id` et `hlc` ; `sync_field_clock` conserve les horloges et bases par champ (mécanisme ADR 0011). Les colonnes publiées, locales et techniques de chaque table sont définies dans le catalogue (`src/domain/sync/syncTables.ts`). Les tables locales (cache, journal d'appels) n'ont ni `device_id` ni `hlc`.

### 20.2 Tables

| Table | Colonnes principales | Publiée | Itération |
| --- | --- | --- | --- |
| `profile` | sex, birth\_year, height\_cm, goal, experience, units | Oui | I0 |
| `body_weight` | date, kg, source (manual / health), health\_uuid | Oui | I0 |
| `exercise` | id, name\_fr, aliases\_en (JSON), muscles (JSON), equipment (JSON), pattern, kind, metric, bodyweight\_fraction, default\_rep\_min / max, default\_rest\_sec, instructions (JSON), media (JSON), strength\_standard\_key, is\_custom, schema\_version | Oui (custom uniquement ; les 150 embarqués sont lus du JSON) | I1 |
| `equipment_profile` | name, kind, inventory (JSON), increments (JSON) | Oui | I1 |
| `routine` / `routine_day` / `routine_exercise` | name, mode (Libre / Programme), day\_order, exercise\_id, sets, rep\_min, rep\_max, rir, rest\_sec, position | Oui | I1 |
| `mesocycle` | routine\_id, start\_date, weeks, deload\_week, status | Oui | I3 |
| `workout` | started\_at, ended\_at, routine\_day\_id, notes, rating, health\_uuid, device\_id | Oui **à la fin** (`ended_at` non nul) | I1 |
| `workout_set` | workout\_id, exercise\_id, position, set\_index, kg, reps, rir, difficulty, is\_warmup, is\_pr, rest\_sec\_actual | Oui (avec le workout) | I1 |
| `recommendation_decision` | workout\_set\_id, exercise\_id, engine\_version, prescription (JSON), reasons (JSON), accepted | Oui | I2 |
| `progression_profile` | exercise\_id, estimated\_1rm, confidence, last\_easy\_recalibration | Oui | I2 |
| `food` / `food_portion` | source (ciqual / off / custom), barcode, name, kcal, protein, fat, carbs, fiber, per\_100g (JSON) | Oui (custom + cache OFF) | I4 |
| `meal_entry` | date, time, food\_id, grams, kcal, macros (JSON), method (search / scan / photo / quickadd), confidence | Oui | I4 |
| `nutrition_target` | week\_start, kcal, protein, fat, carbs, source (auto / manual), accepted | Oui | I4 |
| `recovery_day` | date, level (A / B / C), recovery, exertion, sleep\_score, quality, abstain\_reason, inputs (JSON) | Oui (iPhone → PC) | I5 |
| `muscle_recovery` | date, muscle\_id, percent | Oui | I5 |
| `health_sample_cache` | type, start, end, value, uuid | **Non** (local iPhone) | I5 |
| `ai_call` | date, kind, tokens\_in / out, cost\_estimate, status | Non (local, par appareil) | I4 |
| `settings` (héritée, § 20.0) | key, value, portée (local / partagé) | Non en I0 ; tout réglage partagé est une décision explicite | I0 |
| `measurement` / `progress_photo` | date, kind, value / file\_name | Oui / photos : métadonnées seulement (fichiers locaux, export manuel) | I6 |
| `cardio_session` | started\_at, ended\_at, distance\_m, track (compressé), avg\_hr | Oui | I6 |

### 20.3 Index et contraintes

`workout_set(exercise_id, created_at)`, `meal_entry(date)`, `body_weight(date)`, `recovery_day(date)` ; `UNIQUE(date)` sur `recovery_day` et `body_weight` par source ; clés étrangères activées (`PRAGMA foreign_keys = ON`, déjà le cas). Les JSON sont validés à l'écriture par `src/db/parse/*.ts` (fonctions écrites à la main, règle ADR 0008).

### 20.4 Migrations

`0001_spartiate_init` crée les tables techniques du § 20.0, `profile`, `body_weight` et leurs déclencheurs de synchro (I0) ; les tables I1 et suivantes arrivent par une migration par itération, jamais créées par anticipation. Jamais de modification d'une migration publiée. Tests : Vitest + `@sqlite.org/sqlite-wasm` (driver mémoire, clés étrangères actives), commande ciblée `npx vitest run --coverage.enabled=false src/db/migrator.test.ts src/db/migrations` ; chaque migration a son test colocalisé (`000N_*.test.ts`) qui rejoue 0001 → N sur une base vide et sur des **fixtures synthétiques** (jamais une donnée réelle, D-38) et vérifie insertion, modification, suppression, restauration, `sync_guard`, file d'envoi et horloges. Le plugin SQL natif vendored est validé en CI par `cargo test --locked -p tauri-plugin-sql --features sqlite` ; la parité Wasm / natif (DDL, déclencheurs, transactions, pragmas, restauration) reste l'hypothèse H-18 (D-31). Le test de catalogue vérifie que `syncTables.ts` couvre exactement les tables marquées « Oui » au § 9.1.

## 21. Persistance, sauvegarde, export / import

### 21.1 Emplacements

La base est résolue nativement par `app_config_dir()` (plugin SQL vendored, `wrapper.rs`) : `<app_config_dir>/spartiate.db`. Trois constantes alignées désignent ce fichier et changent ensemble (D-32, SPA-001a) : `TAURI_DB_URL` (`sqlite:spartiate.db`, `src/platform/tauri/sqlDriver.ts`), `ALLOWED_URL` (garde du plugin vendored, `guard.rs` : seule URL ouvrable, jamais élargie à des noms arbitraires) et `DB_FILE` (`src-tauri/src/backup.rs`).

| Appareil | Base | Fichiers | Clé de chiffrement |
| --- | --- | --- | --- |
| Windows | `%APPDATA%\fr.spartiate.app\spartiate.db` | `backups/`, `logs/`, `media/` dans le même dossier ; exports dans Documents | Windows Credential Manager (`keyring`) |
| iPhone | Conteneur de l'app (`app_config_dir()`, `spartiate.db`) | `backups/`, `logs/`, `Documents/media/` | Trousseau iOS |
| iCloud Drive | `iCloud Drive/Spartiate/<device_id>/` : paquets chiffrés AES-256-GCM, jamais la base en clair | — | — |

**Données réelles (D-38).** Tant que tu n'as pas commencé à utiliser Spartiate (annoncé par toi, consigné dans `docs/decisions.md`), le conteneur `fr.spartiate.app` est un conteneur de laboratoire : `tauri dev` et la lecture de `spartiate.db` sont permis aux agents. Dès ta première utilisation réelle, la règle CircleTasks s'applique : aucun agent ne lit ni n'écrit ces emplacements, fixtures synthétiques uniquement, smoke / Rust / e2e en CI ; seuls les fichiers que tu désignes explicitement (un export, un journal) peuvent être lus. Les données réelles de CircleTasks (`%APPDATA%\fr.circletasks.planner`, dossier iCloud `CircleTasks`) restent interdites en permanence.

### 21.2 Sauvegarde et journaux (héritage exact, D-32)

- Écriture SQLite en WAL, `synchronous = NORMAL`, checkpoint à la fermeture (configuration CircleTasks).
- Sauvegardes natives (`backup.rs`) : quotidienne `spartiate-daily-AAAAMMJJ.db` (14 gardées), familles pré-migration et pré-restauration conservées avec leurs propres quotas ; version de schéma lue dans `schema_migrations`, repli sur `APP_SCHEMA_VERSION`. Sur PC comme sur iPhone ; sur iPhone, la synchro iCloud reste la sauvegarde hors appareil (D-16).
- Journaux (`applog.rs`, ADR 0014) : `logs/spartiate.log` (courant) et `spartiate.log.1` (précédent), 256 Kio chacun, une entrée JSON par ligne.
- Mise à jour SideStore : le code hérité conserve le conteneur ; la preuve appareil N → N+1 est ouverte (H-5 `UNVERIFIED (code hérité)`, SPA-010) ; **ne jamais supprimer l'app** ; si réinstallation nécessaire, restauration depuis la synchro ou un export.
- Toute politique différente (quota, taille, nommage) est un changement explicite à tester, pas une propriété attribuée au fork.

### 21.3 Export / import (SPA-005 en I0 sur le format Spartiate profil / poids ; complet en I1)

| Format | Contenu | Usage |
| --- | --- | --- |
| `spartiate-export-<date>.zip` | `data.json` (toutes les tables publiées + préférences), `media/`, `manifest.json` (version schéma, app, appareil, sha256) | Sauvegarde complète, migration d'appareil |
| CSV par domaine | `workouts.csv`, `sets.csv`, `nutrition.csv`, `weight.csv` | Analyse externe |
| Import | Zip Spartiate (fusion ou remplacement, aperçu avant) ; CSV Hevy / Strong (mapping exercices avec validation) en I6 (Q-4) | Reprise d'historique |

L'import passe par les repositories (jamais SQL direct), génère des HLC et entre dans la synchro comme n'importe quelle écriture. Export déclenché depuis Plus → Export / import, sur PC vers un dossier choisi, sur iPhone via la feuille de partage (plugin `files`).

### 21.4 Réinitialisation

« Effacer mes données » : confirmation en deux étapes, suppression de la base, des médias, de la clé locale et du dossier iCloud de cet appareil (procédure ADR 0011 « reset ») ; les autres appareils reçoivent un marqueur et proposent de conserver ou d'oublier.

## 22. Sécurité, journaux, clé API

| Sujet | Règle |
| --- | --- |
| Données au repos | SQLite en clair dans le conteneur de l'app (protégé par l'OS : Data Protection iOS, profil Windows) ; chiffrement complet de la base **non retenu** (D-17 : complexité vs bénéfice pour un usage personnel ; révisable) |
| Données en transit | iCloud Drive : paquets AES-256-GCM, clé dérivée lors de l'appairage QR, jamais dans iCloud (ADR 0011) ; API IA et Open Food Facts : HTTPS via `reqwest` côté Rust, `rustls`, pas de HTTP |
| Secrets | Clé IA et clé de synchro dans le coffre OS uniquement ; aucune valeur dans le dépôt, les journaux, les artefacts CI, les prompts, les exports. Secrets GitHub nommés (jamais leurs valeurs, D-29) : `RELEASES_TOKEN` (publication vers `spartiate-releases`), `TAURI_SIGNING_PRIVATE_KEY` et `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (nouvelle paire minisign Spartiate, indépendante de CircleTasks, SPA-002) ; les `CT_GOOGLE_*` hérités disparaissent en SPA-001b |
| WebView | CSP stricte héritée (`tauri.conf.json`), `withGlobalTauri: false`, commandes exposées listées dans `capabilities/*.json` par plateforme ; la WebView n'a jamais accès au réseau direct ni aux clés |
| Permissions iOS | Demandées au premier usage, chacune avec sa raison ; refus = fonction masquée, pas de relance automatique |
| Journaux | Journal technique hérité (`applog.rs`, ADR 0014) : `logs/spartiate.log` + `spartiate.log.1`, 256 Kio chacun, dans le conteneur ; **aucune donnée corporelle, alimentaire ni clé** ; identifiants d'enregistrements uniquement ; export depuis Plus → Journaux pour les transmettre aux agents (seule lecture autorisée après ta première utilisation réelle, D-38) |
| Dépendances | `npm audit` et `cargo audit` en CI (jobs CircleTasks repris) ; versions épinglées ; pas d'ajout de dépendance sans ligne dans le ticket |
| Mise à jour | IPA et NSIS publiés avec sha256 dans `source.json` et `latest.json` ; SideStore vérifie le hash ; sur PC, l'updater vérifie la signature minisign avec la clé publique Spartiate et propose le téléchargement (mécanisme CircleTasks). Jusqu'à SPA-002 l'updater est non configuré : bloc `plugins.updater` retiré, écran « mises à jour non configurées », aucune requête réseau, aucune clé vide ni factice (D-30) |
| Privé | `privacy-shield` optionnel ; verrou local (Face ID / code Windows Hello) : code conservé, entrée masquée, activation différée jusqu'à ta décision (D-37, `H-17` `DEFERRED`) |

## 23. Qualité et tests

### 23.1 Pyramide (scripts `package.json` hérités, D-35)

| Niveau | Outil | Cible | Seuil |
| --- | --- | --- | --- |
| Domaine | Vitest (`test`, projets `node` et `dom`) | `src/domain/**` : moteur, mésocycle, nutrition, récupération, parse | Couverture `src/domain/**` ≥ 80 % (lignes, fonctions, branches, instructions — seuil hérité, jamais relâché) ; objectif 90 % pour `src/domain/training` seulement ; 100 % des vecteurs des § 11–16 verts |
| DB | Vitest + `@sqlite.org/sqlite-wasm` en mémoire (tests colocalisés `src/db/**`, commande ciblée § 20.4) | Migrations 0001 → N, repositories, catalogue de synchro | Toutes les tables publiées couvertes ; parité natif / Wasm = H-18 |
| Synchro | Vitest (vecteurs ADR 0011 repris) + tests Rust | Chiffrement, HLC, fusion, tombstones, instantanés, reset, oubli d'appareil, reprise | Vecteurs existants + `profile` / `body_weight` (I0), `recovery_day`, `workout` séance close (I1+) |
| Rust | `cargo test --locked --features test-hooks --test desktop`, `cargo test --locked -p tauri-plugin-sql --features sqlite`, `cargo clippy --locked -- -D warnings`, `cargo fmt --check` | Commandes, `app_signing_info`, sauvegardes, plugin SQL vendored, client HTTP, coffre | Zéro warning ; en CI (Windows) |
| Front | `typecheck` (TS strict), `lint` (ESLint config CircleTasks) | Tout `src/` | Zéro erreur |
| E2E navigateur | Playwright (`e2e`) projets `pc` et `iphone` : Chromium sur le front Vite + SQLite Wasm, pas le binaire | Onboarding, séance complète au clavier, journal nutrition, export / import, synchro simulée (deux profils) | Scénarios nominaux par itération ; Ubuntu en CI, jamais en local |
| E2E WebKit | Playwright projet `iphone-webkit` (WebKit, `testMatch` filtré sur une liste de specs à redéfinir après la purge) | Comportements propres à WKWebView | Liste de specs Spartiate définie en SPA-001b |
| Smoke natif | `test:smoke:build` + `test:smoke` (Playwright sur le binaire Windows réel via CDP), `test:nsis` | Démarrage du binaire, installeur NSIS installe / lance / désinstalle, donnée témoin conservée (REL-TECH-02) | Vert avant publication ; Windows en CI |
| Visuel | `visual` (captures Playwright, deux largeurs : 440 px iPhone, 1 440 px PC, scénarios Spartiate à écrire en SPA-009) | Écrans de chaque onglet, états dégradés § 18.3 | Paires de captures app / maquette relues par un humain ; tout seuil de pixels automatique est un outillage à créer, avec ticket et références définies |
| Perf | `test:perf`, `test:perf:e2e` (projet `perf`), `test:bundle` | Démarrage < 1,5 s PC / < 2 s iPhone ; graphiques < 300 ms ; bundle de départ ≤ **358 400 octets gzip**, garde `tests/bundle/start-modules.json` | Budget en CI ; plafond jamais relevé |
| Installeur iOS | Scripts `scripts/ios/*` (tests Vitest) | Contrat plist, lipo arm64, `source.json`, guides | Vert avant publication |
| iPhone réel | Manuel, toi, check-list `docs/qa/iphone.md` | Install SideStore, Santé, Live Activity, verrouillage, renouvellement, mise à jour N → N+1 sans perte | Check-list signée par itération ; résultat identifié (date, version) |

Sur ton PC : seulement les tests Vitest du module en cours, avec `--coverage.enabled=false` pour un test ciblé. La suite complète, les e2e, le smoke et Rust tournent en CI.

### 23.2 CI (`.github/workflows/`, repris, D-28)

| Workflow | Déclencheur | Runner | Contenu |
| --- | --- | --- | --- |
| `tests.yml` | push de branche, PR | ubuntu (lint, typecheck, Vitest `node` × 5 et `dom` × 3, couverture fusionnée, cargo audit, e2e `pc` et `iphone` × 4, perf et bundle) ; windows (`cargo test`, smoke Windows) | Seul workflow de tests ; termine par le statut **« suite verte »**, exigé pour fusionner dans `main` avec branche à jour |
| `build-windows.yml` | tag `vX.Y.Z`, manuel | windows-latest (build) ; ubuntu (publication) | build NSIS, signature updater, `latest.json`, publication sur `spartiate-releases` sur tag seulement |
| `build-ios.yml` | tag `ios-vX.Y.Z`, manuel (IPA en artefact ; publication sur tag seulement) | macos-latest (build) ; ubuntu (publication) | `tauri ios build --ci --no-sign`, codesign ad-hoc + entitlements (D-14), contrat plist, lipo, `make-source-json`, `check-source`, publication vers `spartiate-releases` |

Il n'existe ni workflow `ci.yml` ni workflow e2e séparé. Dépôts **publics** (D-13) : minutes macOS gratuites. Fixtures entièrement synthétiques (D-38) ; aucune donnée personnelle, même anonymisée.

### 23.3 Matrice de non-régression à chaque release

Mise à jour SideStore conserve la base (H-5, prouvée en SPA-010 puis rejouée) · expiration lue et notifiée (I-02) · synchro bidirectionnelle PC ↔ iPhone sur 3 tables au moins · séance interrompue par verrouillage reprise · export puis import identique (hash `data.json`) · aucune régression visuelle.

## 24. Contrat d'exécution (Claude Code + Codex)

### 24.1 Agents (`.claude/agents/`, D-34)

Correspondance explicite avec les 26 agents de CircleTasks. Aucune étape obligatoire ne dépend d'un nom inexistant.

| Agent | Sort | Rôle sur Spartiate |
| --- | --- | --- |
| `architect`, `product-owner`, `qa-test`, `code-reviewer`, `debugger`, `docs-writer` | Gardés | Passes de travail (§ 24.2) ; `code-reviewer` vérifie couches ADR 0001, sécurité § 22, tests, DoD § 24.4 |
| `ci-release` | Gardé | Tags `vX.Y.Z` / `ios-vX.Y.Z`, workflows, `source.json`, publication ; identifiants et dépôts Spartiate |
| `desktop-tauri` | Gardé | Commandes Rust, plugin SQL vendored, sauvegardes, updater |
| `ios-mobile` | Gardé | Plugins Swift, contrat plist, entitlements ; + `healthkit`, `live-activity` |
| `sync-icloud` | Gardé | Relit toute PR touchant `src/sync/**`, `src/domain/sync/**`, `src-tauri/src/sync/**` (D-26) |
| `domain-logic` | Gardé | Moteurs `src/domain/*` : implémente uniquement depuis les § 11–16, vecteurs d'abord |
| `data-model` | Gardé | Migrations, repositories, catalogue (§ 20) |
| `ui-design-system`, `accessibility-i18n` | Gardés | Tokens § 18.4, maquettes § 18.5, accessibilité § 18.6, FR seul |
| `security-privacy`, `performance`, `notifications`, `settings-personalization` | Gardés | § 22, § 23.1 perf et bundle, ADR 0012, `settings` |
| `calendar-integration`, `checklists-events`, `focus-time`, `quick-capture`, `routines`, `spaces-goals`, `stats-history`, `tasks-planning` | **Supprimés** (métier CircleTasks, SPA-001b) | — |

### 24.2 Passes et outils

| Passe | Outil | Règle |
| --- | --- | --- |
| Spécification | Ce PRD (`docs/PRD.md`) + ADR | Toute décision nouvelle = ADR numéroté ; toute hypothèse = `H-n` dans le registre § 26 |
| Implémentation | Claude Code (Opus) | Un ticket = une branche = une PR ; **preuve rouge avant code pour toute story** : un commit qui n'ajoute que les tests et échoue, puis le commit de code qui les fait passer, les deux identifiants dans la fiche |
| Relecture croisée | Codex | Relit chaque PR ; commentaires résolus avant merge ; ne pousse jamais directement |
| Intégration | CI GitHub | Verte obligatoire ; merge par toi |
| Validation iPhone | Toi | Check-list § 23.1 ; ton retour clôt le ticket. Chaque agent assure lui-même product-owner → agent du module → qa-test → code-reviewer en passes distinctes, dans cet ordre, et consigne chaque résultat |

### 24.3 Budget et discipline

- Tokens : chaque ticket annonce un budget (S ≤ 50 k, M ≤ 150 k, L ≤ 400 k) ; dépassement = arrêt et point d'étape, pas de poursuite silencieuse.
- Interdits (AGENTS.md) : `git push --force`, `git reset --hard`, `rm -rf`, lecture des données réelles (CircleTasks toujours ; Spartiate dès ta première utilisation réelle, D-38), installation manuelle demandée à toi (D-39), suppression de l'app sideloadée, secrets dans un prompt, boucle de surveillance de la CI (une lecture à la fois, `gh pr checks` / `gh run view`), écriture hors de `C:\Dev\spartiate` et de ses worktrees.
- Tests : jamais de test désactivé, sauté ou retardé ; **pas de `test.fixme` de commodité** — on adapte le test, ou on supprime celui d'une fonction effectivement supprimée (D-35). Aucun seuil de taille ni de couverture relâché.
- Bundle de départ : plafond **358 400 octets gzip** (`tests/bundle/startBundle.test.ts`), toujours écrit en octets, jamais relevé ; tout écran hors du premier affichage d'Aujourd'hui est en chargement à la demande dès sa création ; garde par liste blanche `tests/bundle/start-modules.json` ; `npm run test:bundle` avant tout push.
- Toute capacité non prouvée reste `UNVERIFIED` dans `docs/capability-matrix.md` jusqu'à un spike documenté (log CI ou capture iPhone). Aucun statut `CONFIRMED` depuis une lecture de code (D-36).

### 24.4 Definition of Done (par ticket)

1. Critères d'acceptation du ticket couverts par un test automatisé (preuve rouge puis verte) ou, pour l'iPhone, par la check-list manuelle.
2. `tests.yml` au statut « suite verte » sur la branche à jour ; bundle mesuré avant push ; pas de nouvelle dépendance non justifiée.
3. Couches ADR 0001 respectées (vérifié par `code-reviewer`).
4. `docs/capability-matrix.md` et registre `H-n` mis à jour si le ticket touche une hypothèse.
5. Note de version (`scripts/release/release-notes.mjs`) à jour.
6. Relecture Codex résolue.

### 24.5 Gabarit de ticket

```md
# SPA-0xx — <titre>
Itération : I0 | Taille : S/M/L | Budget tokens : …
## Objectif
## Hors périmètre
## Références PRD : § … | ADR : … | Hypothèses : H-…
## Critères d'acceptation (Given / When / Then)
## Tests à écrire
## Risques et plan B
## Preuve attendue (log CI, capture, vecteur)
```

## 25. Plan de fork et tickets I0

### 25.1 Procédure de fork (SPA-000, toi + Claude Code)

1. Créer `doncivo/spartiate` (public) depuis `doncivo/circletasks` (fork GitHub ou `git clone` + nouveau remote ; l'historique est conservé pour pouvoir réintroduire un plugin).
2. Créer `doncivo/spartiate-releases` (public, vide, `source.json` initial généré par la CI).
3. Secrets GitHub, par leur nom seulement (D-29) : `RELEASES_TOKEN` (fine-grained, contenu de `spartiate-releases` uniquement) ; `TAURI_SIGNING_PRIVATE_KEY` et `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (nouvelle paire minisign générée pour Spartiate, indépendante de CircleTasks ; la clé publique correspondante entre dans `tauri.conf.json` en SPA-002). Les `CT_GOOGLE_*` ne sont pas créés et leurs références disparaissent en SPA-001b.
4. Déposer ce PRD en `docs/PRD.md` (D-22) et créer `docs/journal.md`, `docs/decisions.md`, `docs/reprise.md` vides (D-40).
5. Ajouter la source `https://raw.githubusercontent.com/doncivo/spartiate-releases/main/source.json` dans SideStore sur l'iPhone **après** la première publication.

### 25.2 Tickets I0 (ordre imposé)

| Ticket | Titre | Taille | Preuve | Dépend de |
| --- | --- | --- | --- | --- |
| SPA-000 | Fork, dépôts, secrets, README Spartiate (phrase de provenance), PRD déposé | S | Dépôts visibles, `tests.yml` « suite verte » sur le fork intact | — |
| SPA-001a | Renommage : `fr.circletasks.planner` → `fr.spartiate.app`, nom, version 0.1.0, icône ; matrice identité → consommateurs (`src-tauri/Cargo.toml` package / lib / bin, `Cargo.lock`, `main.rs`, `package-lock.json`, `index.html`, `Info.ios.plist`, scripts release / smoke, noms de sauvegarde / journal / export) ; les trois constantes de base `TAURI_DB_URL` / `ALLOWED_URL` / `DB_FILE` changées ensemble avec `guard_tests.rs` ; updater retiré (D-30) ; guides renommés et tests lecteurs adaptés (D-40) | S / M | `typecheck` / `lint` / `test` verts ; `git grep` d'identité sur fichiers suivis avec exemptions nommées (D-41) ; test d'identité couvrant URL unique et restauration | SPA-000 |
| SPA-001b | Purge : inventaire au niveau des symboles validé par toi ; point de composition minimal (`src/features/app/bootstrap.ts`, `navigation.ts`, `tabsConfig.ts`, `src/db/repositories/sql/index.ts`) puis lots verticaux compilables (D-44) ; features, agents métier, plugins `reminders` / `web-auth` et leurs dépendances Cargo / commandes / permissions / plist / tests ; registre de migrations réinitialisé `0001_spartiate_init` avec `settings`, tables techniques, `profile`, `body_weight`, déclencheurs ; `APP_SCHEMA_VERSION = 1` ; adaptation de la synchro sous revue `sync-icloud` (D-26) ; i18n `fr` seul à tous les niveaux ; e2e / visual / WebKit : imports, serveurs, sélection de specs et fixtures adaptés ; documents CircleTasks archivés (D-40) | L | App « Spartiate » démarre sur PC avec profil, poids, navigation minimale et Diagnostic ; « suite verte » ; deux bases profil / poids synchronisées en test ; aucun `test.fixme` ; bundle ≤ 358 400 octets | SPA-001a |
| SPA-002 | Build Windows NSIS + updater rétabli (clé publique Spartiate, endpoint `spartiate-releases`) + `latest.json` + `test:nsis` / smoke | S | Smoke CI : installeur installe / lance / désinstalle sur le runner, donnée témoin conservée ; `v0.0.1` publié ; `v0.0.2` reçue par la bannière (D-39) | SPA-001b |
| SPA-003 | Build iOS CI : `--no-sign`, codesign ad-hoc + `Spartiate.entitlements` (D-14), contrat plist, `source.json`, publication | M | IPA dans `spartiate-releases`, `codesign -d --entitlements` montre HealthKit | SPA-001b |
| SPA-004 | Installation SideStore + `app_signing_info` + notification 24 h (I-02 repris) ; trois apps (H-16) | S | App installée sur l'iPhone ; date d'expiration affichée dans Plus → À propos ; capture des trois apps | SPA-003 |
| SPA-005 | Export / import zip + CSV (§ 21.3) au format Spartiate sur les données I0 (profil, poids) | M | Export → reset → import = hash identique (test e2e) | SPA-002 |
| SPA-006 | **Spike HealthKit** : plugin minimal `healthkit_authorize` + lecture `bodyMass` sur l'IPA SideStore | M | Capture iPhone de la demande d'autorisation et d'une valeur lue ; sinon `H-3 = BLOCKED` + ADR fallback | SPA-004 |
| SPA-007 | **Spike Live Activity** : extension WidgetKit injectée dans `gen/apple` par script post-`tauri ios init`, minuteur fictif 60 s | L | Capture Dynamic Island ; sinon `H-4 = BLOCKED` + ADR fallback timer en app | SPA-004 |
| SPA-008 | Synchro PC ↔ iPhone : catalogue `profile`, `body_weight` ; appairage QR (plugin `barcode-scanner` hérité) ; test deux appareils | M | Poids saisi sur PC visible sur iPhone < 60 s et inversement ; vecteurs verts ; aucune métadonnée technique publiée | SPA-004, SPA-002 |
| SPA-009 | Coquilles `MobileShell` / `DesktopShell` fidèles aux maquettes § 18.5, 5 onglets, états dégradés § 18.3, scénarios `visual` Spartiate, `test:contrast` | M | Paires de captures 440 / 1 440 px relues ; `test:contrast` vert | SPA-001b |
| SPA-010 | Mesure et go / no-go I0 : preuve N → N+1 sans perte sur Spartiate (base et Trousseau, H-5 → `CONFIRMED` ou `BLOCKED`), renouvellement 7 j, consommation CI, `capability-matrix.md` à jour | S | Capture iPhone datée avant / après mise à jour ; tableau § 7 mis à jour ; décision écrite d'ouvrir I1 | Tous |

Critère de sortie I0 : SPA-000 → 005, 008, 009, 010 faits ; SPA-006 et SPA-007 **conclus** (CONFIRMED ou BLOCKED avec ADR), quel que soit le résultat. I0 ne contient aucune séance (D-43). I1 (séance et journal, § 13–14, publication à la clôture § 9.1) s'ouvre ensuite avec son propre lot de tickets.

## 26. Registre des décisions et des hypothèses

### 26.1 Décisions (D-n)

| ID | Décision | Source |
| --- | --- | --- |
| D-1 | Usage personnel, aucune commercialisation, aucun App Store | Toi |
| D-2 | Références : Gravl, Alpha Progression, Hevy, MacroFactor, WHOOP / Athlytic, Reboot Plan | Benchmark validé |
| D-3 | Cibles : iPhone 16 Pro Max (iOS 18+) + PC Windows, même code | Toi |
| D-4 | Apple Watch Series 11 46 mm comme **source de données** via Santé ; pas d'app Watch (interdit en équipe personnelle) | Contraintes § 6 |
| D-5 | Pas de compte développeur, pas de Mac : chaîne CI macOS → IPA non signée → SideStore | Toi + CircleTasks |
| D-6 | Développement Claude Code + Codex, contrat § 24 | Toi |
| D-7 | Fork de `doncivo/circletasks` (Tauri 2, React, Rust, SQLite, synchro iCloud) plutôt que projet neuf | Toi (« OK pour le fork ») |
| D-8 | Nom : **Spartiate**, identifiant `fr.spartiate.app` | Toi |
| D-9 | Moteurs (progression, mésocycle, nutrition, récupération) en TypeScript dans `src/domain`, testés Vitest sur Windows ; natif Swift limité aux plugins d'accès système | PRD v6 |
| D-10 | Séance en cours jamais publiée par la synchro avant sa fin | PRD v6 § 13 |
| D-11 | Récupération calculée sur l'iPhone, publiée en résumé vers le PC, pas de recalcul PC | PRD v6 § 16 |
| D-12 | Appels IA effectués par Rust avec clé du coffre ; données corporelles jamais envoyées | PRD v6 § 17 |
| D-13 | Dépôts publics pour minutes macOS gratuites | CircleTasks ADR 0007 |
| D-14 | Entitlements injectés par codesign ad-hoc en CI après `--no-sign` | PRD v6 § 19.4 |
| D-15 | Conventions CircleTasks reprises intégralement (ADR 0001, AGENTS.md, scripts) | PRD v6 |
| D-16 | Pas de sauvegarde locale sur iPhone au-delà de la synchro iCloud | PRD v6 § 21 |
| D-17 | Pas de chiffrement complet de la base locale | PRD v6 § 22 |
| D-18 | Suppression des plugins `reminders` et `web-auth` au fork | PRD v6 § 19.1 |
| D-19 | Charte visuelle laconique, sombre, rouge / bronze ; sombre par défaut ; tokens § 18.4 | Toi (30 oct.) |
| D-20 | Quatre programmes de départ livrés comme contenu, périodisation reprise d'Alpha Progression (§ 12.5) | Toi (30 oct.) |
| D-21 | 24 maquettes HTML validées (§ 18.5) = référence visuelle ; méthode CircleTasks (docs/maquettes, index, npm run visual) | Toi (31 oct.) |
| D-22 | Le PRD vivant est `docs/PRD.md` dans `doncivo/spartiate` à partir de v6.2 ; le document Claude reste l'archive v6.1 ; toute révision = PR | Relecture Codex 31 oct., arbitrage Ali |
| D-23 | Base Spartiate neuve : aucune migration ne purge une base CircleTasks ; registre TS `src/db/migrations/index.ts` réinitialisé avec `0001_spartiate_init` ; `APP_SCHEMA_VERSION` (Rust) = 1 | Relecture Codex 31 oct., arbitrage Ali |
| D-24 | Tables techniques héritées conservées telles quelles (`settings`, `schema_migrations`, `sync_guard`, `sync_field_clock`, `sync_outbox`, `sync_state`, `sync_tombstone`, `sync_unknown`, `sync_parked`, `conflict_log`, `sync_meta`, `epoch_carry_report`) ; `app_meta` et `app_pref` abandonnés (doublons de `settings`) | Relecture Codex 31 oct., arbitrage Ali |
| D-25 | Modèle canonique = § 20.2 ; § 9.1 réécrit avec ces noms ; `profile` et `body_weight` créés et publiés dès I0 | Relecture Codex 31 oct., arbitrage Ali |
| D-26 | Synchro non « inchangée » : catalogue (`syncTables.ts`, `SYNC_TABLE_ORDER`, `naturalIds.ts`), repositories de synchro et règles d'application / réparation adaptés ; invariants conservés et testés ; toute PR `src/sync/**`, `src/domain/sync/**`, `src-tauri/src/sync/**` relue par `sync-icloud` ; seuil « 200 lignes » supprimé | Relecture Codex 31 oct., arbitrage Ali |
| D-27 | Publication d'une séance à sa clôture (journaux et instantanés, enfants, édition ultérieure, suppression) = conception et tests I1, pas un acquis | Relecture Codex 31 oct., arbitrage Ali |
| D-28 | Workflows réels : `tests.yml` (« suite verte »), `build-windows.yml` (tag `vX.Y.Z`, manuel), `build-ios.yml` (tag `ios-vX.Y.Z`, manuel) ; commandes Rust CI `cargo test --locked --features test-hooks --test desktop`, `cargo test --locked -p tauri-plugin-sql --features sqlite`, `cargo clippy --locked -- -D warnings` | Relecture Codex 31 oct., arbitrage Ali |
| D-29 | Secrets GitHub nommés, jamais leurs valeurs : `RELEASES_TOKEN`, `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (nouvelle paire minisign, SPA-002) ; `CT_GOOGLE_*` supprimés en 001b | Relecture Codex 31 oct., arbitrage Ali |
| D-30 | Updater Windows : en 001a bloc `plugins.updater` retiré et écran « mises à jour non configurées » sans requête réseau ; SPA-002 le rétablit avec la nouvelle clé et l'endpoint `spartiate-releases` ; pas de clé vide ni factice | Relecture Codex 31 oct., arbitrage Ali |
| D-31 | Tests de migration : Vitest + `@sqlite.org/sqlite-wasm` (mémoire), `npx vitest run --coverage.enabled=false src/db/migrator.test.ts src/db/migrations` ; plugin SQL natif = copie vendored `src-tauri/vendor/tauri-plugin-sql` (garde `ALLOWED_URL`) testée par `cargo test -p tauri-plugin-sql` ; H-18 = parité Wasm / natif | Relecture Codex 31 oct., arbitrage Ali |
| D-32 | Héritage exact : base `app_config_dir()` → `spartiate.db` (`TAURI_DB_URL`, `ALLOWED_URL`, `DB_FILE` alignées) ; sauvegardes quotidiennes `spartiate-daily-AAAAMMJJ.db` gardées 14, familles pré-migration / pré-restauration ; journaux `logs/spartiate.log` + `.1`, 256 Kio chacun (ADR 0014) ; « 7 sauvegardes » et « tracing 5 × 2 Mo » de la v6.1 retirés | Relecture Codex 31 oct., arbitrage Ali |
| D-33 | Plugins : `speech` et `vision` conservés comme infrastructure I6 (écrans de capture supprimés) ; `@tauri-apps/plugin-barcode-scanner` officiel déjà présent (appairage), reclassé hérité ; `reminders` et `web-auth` supprimés (D-18 confirmé) ; structure réelle `src-tauri/plugins/<nom>/ios/Package.swift`, `ios/Sources/<Nom>Plugin.swift`, pont Rust, façade `src/platform/<nom>` là où elle existe | Relecture Codex 31 oct., arbitrage Ali |
| D-34 | Agents : 18 gardés (`architect`, `product-owner`, `qa-test`, `code-reviewer`, `debugger`, `docs-writer`, `ci-release`, `desktop-tauri`, `ios-mobile`, `sync-icloud`, `domain-logic`, `data-model`, `ui-design-system`, `security-privacy`, `performance`, `accessibility-i18n`, `notifications`, `settings-personalization`) ; 8 agents métier CircleTasks supprimés ; les noms `sync-guardian`, `ios-plugin`, `reviewer`, `domain-engineer` de la v6.1 remplacés par les noms réels | Relecture Codex 31 oct., arbitrage Ali |
| D-35 | Qualité héritée : couverture `src/domain/**` 80 % (lignes, fonctions, branches, instructions), objectif 90 % pour `src/domain/training` seul ; plafond bundle 358 400 octets gzip jamais relevé ; `visual` = paires relues par un humain ; `test:contrast` et tout seuil pixel = outillage à créer (ticket rattaché à SPA-009) ; `test.fixme` de commodité interdit | Relecture Codex 31 oct., arbitrage Ali |
| D-36 | Preuves appareil : I-06 non prouvée sur appareil côté CircleTasks ; H-5 `UNVERIFIED (code hérité)`, prouvée sur Spartiate en SPA-010 ; H-16 `UNVERIFIED` partout ; aucun `CONFIRMED` depuis une lecture de code | Relecture Codex 31 oct., arbitrage Ali |
| D-37 | Verrou local : code conservé, entrée masquée, activation différée jusqu'à décision d'Ali (§ 3.2, 4, 10.2, 22, H-17) | Relecture Codex 31 oct., arbitrage Ali |
| D-38 | Données réelles : conteneur `fr.spartiate.app` = laboratoire tant qu'Ali n'a pas commencé à utiliser Spartiate (annoncé par lui, consigné dans `decisions.md`) ; ensuite règle CircleTasks (aucune lecture, fixtures synthétiques, CI) ; « données réelles anonymisées » retiré | Relecture Codex 31 oct., arbitrage Ali |
| D-39 | Installation PC : installeur NSIS éprouvé par le smoke CI ; Ali installe lui-même quand il le décide ; aucun agent ne lui demande de lancer un installeur ; mise à jour ensuite par l'updater | Relecture Codex 31 oct., arbitrage Ali |
| D-40 | Documents CircleTasks déplacés dans `docs/archive/circletasks/` (stories, essais, reprise, journal, backlog, dettes, audits, maquettes-refonte), liens de preuve conservés ; `docs/journal.md`, `docs/decisions.md`, `docs/reprise.md` Spartiate créés vides ; tests lecteurs de guides adaptés en 001a | Relecture Codex 31 oct., arbitrage Ali |
| D-41 | Contrôle d'identité : `git grep` sur fichiers suivis avec exemptions nommées (`docs/PRD.md`, `docs/SPA-*.md`, `docs/relecture-*.md`, `docs/decisions.md`, `docs/adr/**`, `docs/archive/**`, `docs/licences.md`, `README.md`, en-têtes « repris de CircleTasks ») ; trois niveaux : nom utilisateur, identifiant technique actif, référence historique | Relecture Codex 31 oct., arbitrage Ali |
| D-42 | `CLAUDE.md` et `AGENTS.md` : fusion de l'annexe A avec les règles permanentes CircleTasks (bundle, chargement à la demande, passes distinctes, preuve rouge, pas de fixme, bundle avant push, pas de surveillance de CI en boucle, données des deux apps protégées, périmètre `C:\Dev\spartiate`) ; pas de remplacement intégral | Relecture Codex 31 oct., arbitrage Ali |
| D-43 | I0 prouve profil et poids synchronisés, navigation minimale, diagnostics, chaîne de livraison ; coquille 001b fonctionnelle et sobre, mise en page fidèle aux maquettes en SPA-009 ; le gate § 7 ne demande pas de séance avant I1 | Relecture Codex 31 oct., arbitrage Ali |
| D-44 | SPA-001 découpé en 001a (renommage, S / M) et 001b (purge, L, inventaire au niveau des symboles validé par Ali) ; 001b avance par lots verticaux compilables depuis un point de composition minimal, pas par suppression de dossiers | Relecture Codex 31 oct., arbitrage Ali |
| D-45 | Un identifiant = une hypothèse ; renvois corrigés (budget IA → H-14, écriture Santé → H-3, question HRV → H-20) ; H-19 scindée en H-19a (responsive 440 / 1 440, rupture 900 px) et H-19b (micronutriments Ciqual) | Relecture Codex 31 oct., arbitrage Ali |

### 26.2 Hypothèses (H-n) — statut au 31 octobre 2026

Un identifiant désigne une seule hypothèse (D-45). Aucune promotion depuis la seule lecture du code (D-36).

| ID | Hypothèse | Statut | Comment la lever |
| --- | --- | --- | --- |
| H-1 | Les algorithmes publiés par Gravl sont reproductibles à partir de leur documentation publique | UNVERIFIED | Vecteurs de test comparés à des exemples publiés (I2) |
| H-2 | Tauri 2 iOS supporte iOS 18 avec la WebView requise sans régression | INHERITED | Cible iOS 18 attestée par le code CircleTasks ; revalidation sur l'IPA Spartiate re-signée en SPA-004 |
| H-3 | L'entitlement HealthKit survit à la re-signature SideStore (AltSign) ; conditionne lecture et écriture Apple Santé | **UNVERIFIED — risque I0** | SPA-006 |
| H-4 | Une extension WidgetKit (Live Activity) peut être injectée dans le projet généré par `tauri ios init` et passée par SideStore | **UNVERIFIED — risque I0** | SPA-007 |
| H-5 | La mise à jour via SideStore conserve le conteneur et le Trousseau | **UNVERIFIED (code hérité)** — I-06 CircleTasks « code fusionné, en attente de vérification appareil », aucun essai archivé | Preuve appareil en SPA-010 (capture datée avant / après N → N+1) |
| H-6 | Quota CI macOS suffisant | INHERITED (D-13) | Consommation et disponibilité mesurées en SPA-010 |
| H-7 | La date d'expiration du profil est lisible par l'app | INHERITED (I-02, `app_signing_info`, implémentation attestée) | Rejoué sur l'IPA Spartiate en SPA-004 |
| H-8 | 150 exercices et quatre programmes de départ suffisent pour tes routines | UNVERIFIED | Ta relecture de la bibliothèque et des programmes (I1) |
| H-9 | Médias d'exercices disponibles sous licence compatible | UNVERIFIED | Recherche de sources (I1) ; fallback : sans image |
| H-10 | Camera Control utilisable par une WebView Tauri / plugin AVFoundation ; le scanner existant ne le prouve pas | UNVERIFIED | Spike I4 ; fallback bouton |
| H-11 | Licence Ciqual (Etalab 2.0) autorise l'embarquement | UNVERIFIED (très probable) | Lecture de la licence, note dans `docs/licences.md` (I4) |
| H-12 | API Open Food Facts accessible sans clé à l'usage prévu | UNVERIFIED | Appel de test (I4) ; la présence de `reqwest` ne prouve rien |
| H-13 | Les observer queries HealthKit se déclenchent pour une app sans mode fond (`UIBackgroundModes` interdit par le contrat plist) | UNVERIFIED | SPA-006 étendu (I5) ; fallback lecture à l'ouverture |
| H-14 | Fournisseur IA, coût mensuel et plafond configurable acceptables | UNVERIFIED | Décision avant I4 (Q-2) |
| H-15 | Recharts tient les volumes (3 ans de séries Spartiate) en < 300 ms | UNVERIFIED | `test:perf` avec fixture synthétique 3 ans sur le chemin réel des graphiques (I2) |
| H-16 | Limite de 3 apps sideloadées : SideStore + CircleTasks + Spartiate tiennent ensemble | UNVERIFIED | Vérifié en SPA-004 ; fallback : retirer une app ou bascule Spartiate seul |
| H-17 | Un verrou local (Face ID / Windows Hello) a une utilité pour toi | DEFERRED (code conservé, entrée masquée, D-37) | Ta décision (Q-6) |
| H-18 | Le driver `@sqlite.org/sqlite-wasm` des tests reproduit fidèlement le plugin SQL natif vendored : parité DDL, déclencheurs, transactions, pragmas, restauration | UNVERIFIED (outil identifié, D-31) | Tests natifs CI (`cargo test -p tauri-plugin-sql`, `--test desktop`) couvrant les mêmes scénarios que `migrator.test.ts` ; smoke Windows |
| H-19a | Deux largeurs (440 / 1 440 px, rupture unique 900 px) couvrent tous les usages, y compris zoom et texte agrandi, sans débordement autour de 900 px | UNVERIFIED | Scénarios `visual` Spartiate aux deux largeurs plus relecture à 900 px et en Dynamic Type « Très grand » (SPA-009) |
| H-19b | Ciqual fournit les 8 micronutriments épinglés pour la majorité des aliments génériques | UNVERIFIED | Comptage des colonnes Ciqual au chargement (I6) |
| H-20 | « Recovery HRV » de l'Apple Watch est lisible comme un type HealthKit (ou dérivable de `hrvSDNN`) | UNVERIFIED | Lecture des types exposés par `healthkit_read_quantity` sur l'iPhone (I5) ; fallback : HRV SDNN nocturne seule |

Règle : aucune hypothèse ne passe `CONFIRMED` sans preuve archivée (log CI, capture, vecteur) référencée dans `docs/capability-matrix.md`.

## 27. Questions ouvertes, glossaire, références

### 27.1 Questions ouvertes (à trancher par toi)

| # | Question | Échéance | Option par défaut si silence |
| --- | --- | --- | --- |
| Q-1 | Garder CircleTasks installée en parallèle (3 apps max) ? | SPA-004 | Oui, on vérifie H-16 |
| Q-2 | Fournisseur IA (Anthropic, OpenAI, autre) et plafond mensuel | Avant I4 | Abstraction `AiProvider`, choix reporté |
| Q-3 | Sources des médias d'exercices (photos libres, dessins générés, aucune) | I1 | Aucune image en I1 |
| Q-4 | Import d'historique Hevy / Strong nécessaire dès I1 ? | I1 | Reporté en I6 |
| Q-5 | Langue : FR seul ou FR + EN (i18n CircleTasks conservée) | SPA-001b | FR seul à tous les niveaux, chargement à la demande gardé |
| Q-6 | Verrou local (H-17) | I6 | Non |
| Q-7 | Objectif initial (prise de masse / perte / maintien) pour le profil par défaut | Onboarding | Saisi à l'onboarding, pas de défaut |

### 27.2 Glossaire

| Terme | Définition |
| --- | --- |
| 1RM | Charge maximale théorique sur une répétition (estimée par Epley) |
| RIR | Reps in Reserve, répétitions restantes avant l'échec |
| Double progression | Monter les reps dans la plage puis la charge |
| Mésocycle | Bloc de 4–6 semaines avec progression et deload |
| Deload | Semaine allégée (charge × 0,8) |
| TDEE | Dépense énergétique quotidienne totale, ici mesurée |
| HRV | Variabilité de la fréquence cardiaque (SDNN) |
| HLC | Hybrid Logical Clock, horodatage de la synchro par champ |
| IPA / NSIS | Paquet iOS / installeur Windows |
| SideStore | Installateur d'apps sideloadées sur iPhone, renouvelle la signature 7 j |
| Entitlement | Droit iOS déclaré à la signature (HealthKit…) |
| Live Activity | Affichage temps réel Dynamic Island / écran verrouillé |
| INHERITED | Capacité prouvée sur CircleTasks, à rejouer sur Spartiate |

### 27.3 Références

- Benchmark apps fitness (6 références) — document précédent.
- PRD Forge v5.1 — version iPhone natif, remplacée par ce document.
- Dépôt `doncivo/circletasks` : `CLAUDE.md`, `AGENTS.md`, `docs/adr/0001`, `0007`, `0008`, `0010`, `0011`, `0013`, `docs/install-iphone.md`, `.github/workflows/build-ios.yml`, `scripts/ios/*`, `docs/stories/I-02.md`, `I-06`.
- Gravl — documentation publique de l'algorithme de progression.
- Apple — HealthKit, ActivityKit, WidgetKit, équipes personnelles (limites de sideload).
- Tauri 2 — guide iOS, plugins Swift, `tauri ios init --ci`.
- SideStore — format `source.json`, renouvellement.
- ANSES Ciqual (Licence Ouverte 2.0), Open Food Facts (ODbL).

## Annexe A — `CLAUDE.md` et `AGENTS.md` du fork (fusion, D-42)

Les deux fichiers de CircleTasks ne sont **pas remplacés** : leurs règles permanentes sont conservées, le métier CircleTasks est retiré, le périmètre devient `C:\Dev\spartiate`. Le texte ci-dessous est la cible après SPA-001a / 001b.

### A.1 `CLAUDE.md` (racine du dépôt `doncivo/spartiate`)

```md
# Spartiate — mémoire projet

App personnelle d'entraînement, nutrition et récupération, pour un seul utilisateur. PC Windows (Tauri 2) et iPhone 16 Pro Max
(Tauri 2 iOS), même code React, livraison unique. Fork de CircleTasks (Tauri 2, React 18, TypeScript strict, Zustand, SQLite, Rust).
Spécification : docs/PRD.md (source de vérité, v6.2+). Décisions : docs/decisions.md et docs/adr/. Capacités : docs/capability-matrix.md.
Référence visuelle : docs/maquettes/ (24 planches du 31 octobre 2026, ouvrir index.html) ; charte en § 18.4 du PRD.
Règles de travail (passes, git, périmètre, tri des défauts, A-09) : AGENTS.md, qui vaut pour tout agent, Claude Code compris.
Archive CircleTasks : docs/archive/circletasks/ (lecture seule, liens de preuve).

## Stack
React 18, Vite, TypeScript strict, Zustand, SQLite (plugin Tauri SQL vendored dans src-tauri/vendor/tauri-plugin-sql), Rust (Tauri 2),
plugins Swift pour iOS (haptics, notification-actions, files, folder-bookmark, privacy-shield, speech, vision ; healthkit et
live-activity à venir), plugin officiel barcode-scanner. Tests : Vitest, Testing Library, Playwright, cargo test.

## Couches (ADR 0001) — dépendances dans ce sens uniquement
domain ← db ← sync, platform, features, ui, i18n
- Règles métier UNIQUEMENT dans src/domain (pur, sans import Tauri ni React).
- Accès DB UNIQUEMENT via src/db/repositories.
- Migrations TypeScript dans src/db/migrations (registre index.ts, migrateur src/db/migrator.ts, schema_migrations).
- Synchro : toute PR touchant src/sync/**, src/domain/sync/** ou src-tauri/src/sync/** est relue par l'agent sync-icloud
  avec périmètre écrit et tests de non-régression (D-26). Catalogue : src/domain/sync/syncTables.ts.
- Plugins Swift dans src-tauri/plugins/<nom>/ios, façade dans src/platform/<nom>, stub Windows obligatoire.

## Commandes
npm run dev | npm run tauri dev | npm run test | npm run lint | npm run typecheck | npm run test:bundle | npm run tauri build
Migrations : npx vitest run --coverage.enabled=false src/db/migrator.test.ts src/db/migrations
Rust (dans src-tauri) : cargo test --locked --features test-hooks --test desktop | cargo test --locked -p tauri-plugin-sql --features sqlite
| cargo clippy --locked -- -D warnings
En CI seulement : e2e (pc, iphone, iphone-webkit), visual, test:smoke, test:nsis, test:perf — jamais en local sur ce PC.

## Règles
- Un ticket SPA-xxx = une branche = une PR ; ID dans chaque commit.
- Interface en français, heures en 24 h, textes dans src/i18n, jamais en dur ; locale fr seule.
- Tokens de couleur dans src/ui/tokens.css, aucune couleur en dur ; les maquettes sont la référence visuelle.
- Pas de Mac : aucune commande iOS locale ; builds iOS via .github/workflows/build-ios.yml, installation par SideStore.
- Mise à jour PC par plugin updater et dépôt public spartiate-releases ; non configuré avant SPA-002.
- Synchro par journaux chiffrés dans iCloud Drive (hlc, schema_version) ; téléchargement forcé des fichiers avant lecture.
- Notifications émises sur l'iPhone uniquement ; le PC n'envoie aucune notification.
- Pas de secret en clair ; jetons dans le coffre système ; secrets GitHub nommés RELEASES_TOKEN, TAURI_SIGNING_PRIVATE_KEY,
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD (noms seulement).
- Bundle de départ : plafond 358 400 octets gzip (tests/bundle/startBundle.test.ts), toujours écrit en octets, jamais relevé. Tout écran,
  fenêtre, bandeau ou catalogue de textes qui ne sert pas au premier affichage d'Aujourd'hui est en chargement à la demande dès sa
  création (import dynamique, catalogue i18n chargé avec lui, assertion « hors du départ »), jamais après coup. Garde par liste blanche
  tests/bundle/start-modules.json : tout module nouveau dans le départ est refusé, la liste ne s'étend que par un commit qui le justifie ;
  mesure normalisée insensible aux hachages ; le plafond reste le dernier juge.
- Toute hypothèse non prouvée = H-n dans docs/PRD.md § 26.2 + ligne UNVERIFIED dans capability-matrix.md ; aucun CONFIRMED depuis une
  lecture de code. Toute décision structurante = ligne dans docs/decisions.md ou ADR numéroté.
- Budget tokens annoncé par ticket (S 50k / M 150k / L 400k) ; dépassement = arrêt et point d'étape.

## Délégation
Tout agent (Codex, Claude Code ou autre) assure lui-même product-owner, agent du module, qa-test puis code-reviewer en passes distinctes,
dans cet ordre, et consigne chaque résultat (détails dans AGENTS.md).

## Méthode
- Suite complète dans la CI, plus en local : unitaires, Rust, e2e pc et iphone, perf et bundle, smoke Windows sur des runners parallèles
  (.github/workflows/tests.yml, seul workflow de tests), à chaque push de branche. En local : seulement les tests du module en cours.
- Une fusion dans main attend la CI verte sur la branche (statut « suite verte », branche à jour), jamais une suite locale.
- Une seule compilation iPhone (build-ios.yml) par lot terminé, pas une par essai ; exception SideStore N → N+1 dans AGENTS.md.
- Pas de « fait » sans test rouge avant et vert après, tests verts, lint, typage et revue approuvée ; jamais de test désactivé,
  retardé ou test.fixme de commodité ; aucun échec silencieux.

## Interdits
- Lire ou écrire les données réelles de CircleTasks : %APPDATA%\fr.circletasks.planner, iCloud Drive/CircleTasks — toujours.
- Lire ou écrire les données réelles de Spartiate : %APPDATA%\fr.spartiate.app, iCloud Drive/Spartiate, conteneur iPhone — dès la
  première utilisation réelle annoncée par Ali dans docs/decisions.md (avant : conteneur de laboratoire, D-38).
- Écrire hors de C:\Dev\spartiate et de ses worktrees ; fichiers temporaires sous .codex-tmp/ (ignoré par git).
- Secrets dans le dépôt, les logs, les artefacts CI, les prompts.
- git push --force, git reset --hard, rm -rf ; boucle de surveillance de la CI (une lecture à la fois).
- Demander à Ali d'exécuter un installeur ; supprimer l'app sideloadée (perte de données).
- Envoyer des données corporelles (HRV, FC, sommeil, poids, photos) à une API.
```

### A.2 `AGENTS.md` — sections adaptées (le reste des règles permanentes CircleTasks est conservé mot pour mot)

```md
## Périmètre d'écriture et de lecture
- Interdiction d'écrire, de modifier ou de supprimer quoi que ce soit hors de C:\Dev\spartiate et de ses worktrees.
- Données réelles de CircleTasks (%APPDATA%\fr.circletasks.planner, iCloud CircleTasks) : interdites en permanence, lecture comme écriture.
- Données réelles de Spartiate : conteneur de laboratoire jusqu'à la première utilisation réelle annoncée par Ali (docs/decisions.md) ;
  ensuite interdites comme celles de CircleTasks. Fixtures synthétiques uniquement ; smoke, Rust et e2e en CI.
- Lire un fichier qu'Ali désigne explicitement (export, journal iPhone déposé dans iCloud Drive) est permis.

## Référence visuelle
docs/maquettes/ (24 planches Spartiate du 31 octobre 2026, D-21) pour tous les écrans ; écran sans maquette → motifs de Plus / Réglages,
consigné dans docs/decisions.md. Les maquettes CircleTasks sont archivées (docs/archive/circletasks/) et ne font plus référence.

## iOS
La chaîne est : CI macOS (tauri ios build --ci --no-sign) → codesign ad-hoc + entitlements → IPA → spartiate-releases/source.json
→ SideStore. Aucun agent ne possède de Mac ni de compte développeur ; toute preuve iPhone vient d'Ali (capture) ou de la CI (log).
Une seule compilation iPhone par lot ; exception N → N+1 : l'IPA installée sert de N, une compilation fournit N+1 (SPA-010).

## Synchro
Toute PR touchant src/sync/**, src/domain/sync/** ou src-tauri/src/sync/** porte un périmètre écrit, est relue par l'agent sync-icloud
et ajoute des tests de non-régression (deux bases, conflit, instantané, reset, oubli, reprise). Invariants intouchables : protocole
chiffré, HLC par champ, tombstones, reprise, reset, oubli d'appareil.

## Passes de travail
L'agent assure lui-même product-owner → agent du module → qa-test → code-reviewer en passes séparées, dans cet ordre, et consigne
chaque résultat dans la fiche. Test rouge avant, vert après, pour toute story sans exception (deux commits identifiés). Pas de
test.fixme de commodité : on adapte le test ou on supprime celui d'une fonction effectivement supprimée. Mesure du bundle
(npm run test:bundle) avant tout push. Codex relit chaque PR ; code-reviewer vérifie couches, sécurité § 22, tests, DoD § 24.4.
```

## Annexe B — `docs/capability-matrix.md` (état initial)

| Capacité | Statut | Preuve | Ticket |
| --- | --- | --- | --- |
| Build Windows NSIS + smoke installeur | INHERITED | CircleTasks `build-windows.yml`, `tests.yml` smoke-windows | SPA-002 |
| Updater Windows signé (clé Spartiate) | UNVERIFIED (non configuré avant SPA-002, D-30) | — | SPA-002 |
| Build iOS non signé en CI | INHERITED | CircleTasks `build-ios.yml` | SPA-003 |
| Installation et renouvellement SideStore | INHERITED | `docs/archive/circletasks/install-iphone.md` | SPA-004 |
| Lecture date d'expiration + notification | INHERITED | I-02 | SPA-004 |
| Mise à jour N → N+1 sans perte de données (base et Trousseau) | **UNVERIFIED (code hérité)** — H-5 ; I-06 CircleTasks non prouvée sur appareil | — | SPA-010 |
| Synchro iCloud chiffrée PC ↔ iPhone (protocole) | INHERITED | ADR 0011 + vecteurs | SPA-008 |
| Synchro des tables Spartiate (`profile`, `body_weight`) | UNVERIFIED (catalogue et repositories adaptés, D-26) | — | SPA-008 |
| Verrouillage / reprise de session | INHERITED | ADR 0013 | I1 |
| Haptique, notifications locales, fichiers, scanner QR | INHERITED | Plugins existants | I1 |
| Entitlement HealthKit via SideStore | UNVERIFIED | — | SPA-006 |
| Lecture HRV / FC / sommeil / workouts | UNVERIFIED (dépend H-3) | — | I5 |
| Recovery HRV comme type HealthKit | UNVERIFIED (H-20) | — | I5 |
| Observer queries sans mode fond | UNVERIFIED (H-13) | — | I5 |
| Live Activity (extension WidgetKit) | UNVERIFIED | — | SPA-007 |
| Widgets écran d'accueil | BLOCKED | Pas d'App Groups en équipe personnelle | — |
| App Apple Watch | BLOCKED | Interdit en équipe personnelle | — |
| Push distant | BLOCKED | Interdit en équipe personnelle | — |
| Scan code-barres alimentaire / Camera Control | UNVERIFIED (scanner présent, Camera Control non prouvé, H-10) | — | I4 |
| Appels API IA via Rust | UNVERIFIED (fournisseur Q-2, H-14) | — | I4 |
| Trois apps sideloadées simultanées | UNVERIFIED (H-16) | — | SPA-004 |
| Parité SQLite Wasm / natif | UNVERIFIED (H-18) | — | SPA-001b |
| Verrou local Face ID / Windows Hello | DEFERRED (code conservé, entrée masquée, D-37) | — | — |

*Fin du document. Toute modification passe par une nouvelle révision numérotée (v6.3, v6.4…) avec journal des changements en tête, par PR sur `docs/PRD.md` (D-22).*
