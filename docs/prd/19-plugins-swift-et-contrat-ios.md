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
| `NSPhotoLibraryUsageDescription` | **Interdite** (`forbiddenKeys` de `plist-contract.json`) : sur iPhone, photo de repas et étiquette passent par la caméra seule ; l’import d’image reste une fonction PC ; toute ouverture de la photothèque demande un ADR (D-47) | Oui |
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
