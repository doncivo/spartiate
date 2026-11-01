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
