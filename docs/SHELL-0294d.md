# SHELL-0294d — robustesse, Quitter, diagnostic, clé en mémoire, CSP (lot 0.29.4)

Lot 0.29.4 (docs/LOT-0.29.2.md, docs/LOT-0.29.2-audit.md), registre « coquille, iOS et qualité », quatrième PR (après SHELL-0294a #216, SHELL-0294b #217, SHELL-0294c).
Chapitres : 21.4 (effacement), 22 (CSP, journaux), 18.3 (états dégradés). Choix prudents : D-611 à D-613, « Claude (choix prudent) ; révisable par Ali ».
Question : Q-35. Aucune migration, aucun fichier de `src-tauri/src/sync/**` ni Swift touché.

## Passe product-owner (critères Étant donné / quand / alors)

1. C-123, BL-032 : étant donné une erreur non gérée pendant le chargement du journal, alors elle est notée ; étant donné un message libre (« poids 82,4 kg invalide »), alors seul le nom de l'erreur entre au journal ; un échec de `timeZoneWatcher` est journalisé (scope `timezone`).
2. C-129, BL-034 : étant donné une lecture ou une planification en échec dans « Sommeil et rappels », alors l'écran le dit, le journal le note, l'interrupteur reste à son état d'avant et se libère.
3. C-130 : étant donné `syncNow` qui ne répond jamais après l'effacement, alors l'app redémarre au bout de 10 s au plus.
4. C-162, BL-036 : étant donné un import du bloc de notification de repos en échec, alors l'appel suivant le retente ; le préchargement des écrans n'en lance un nouveau qu'à la fin du précédent.
5. C-139 : étant donné deux « Quitter » rapprochés, alors l'attente du front n'est pas coupée ; étant donné une icône de zone de notification impossible à créer, alors l'app démarre, le journal note `tray-failed` et fermer la fenêtre quitte.
6. C-143 : étant donné un marqueur de restauration illisible, alors il n'est pas réglé, le marqueur d'avant est gardé, `marker-unreadable` est journalisé.
7. C-144 : `db_diagnostics` ne rend aucun chemin absolu (ADR 0009), une erreur de dossier est le code `no-data-dir` ; un horodatage de sauvegarde `20269999T999999Z` est refusé.
8. C-148 : le texte d'erreur du moteur OCR (WinRT) n'atteint pas la WebView. C-149 : descriptions de l'installeur et du paquet.
9. BL-002, BL-144 : la CSP ne contient ni `'wasm-unsafe-eval'` ni `style-src 'unsafe-inline'`.

## Passe agent du module (coquille et Rust Windows)

Fichiers : `src-tauri/src/{desktop,backup,startup_gate}.rs`, `src-tauri/src/ocr/{mod,win}.rs`, `src-tauri/{tauri.conf.json,Cargo.toml}`,
`src/features/app/{globalErrors,logJournalBoot,timeZoneWatcher,lazyScreens}`, `src/features/settings/{ResetDataScreen,RecoveryNotificationsSection}.tsx`,
`src/platform/notifications/timerNotification.ts`. Pas de crate nouvelle : `zeroize` est déjà dans `Cargo.toml` et `Cargo.lock`.
Tests existants modifiés avec écart consigné : `globalErrors.test.ts` (figeait l'extrait de 120 caractères), `lazyScreens.test.tsx` (préchargement : le moment suivant attend la fin du chargement, `waitFor`
préchauffage de l'import dans un `beforeAll`, délai par défaut), `db_diagnostics.rs` (figeait le chemin absolu et le texte d'erreur du système).

## Passe qa-test (rouge → vert)

| Ligne | SHA rouge | SHA vert |
|---|---|---|
| C-123, BL-032 | e548cda2 | 86a694fa |
| C-139 | 26adc075 (rouge à la compilation : méthodes absentes) | f2b21a71 |
| BL-036 | ca63460b | 04de8a26 |
| C-130 | ccde9fcf | 04de8a26 |
| C-143, C-144 | 703a26f3 (littéraux invalides) puis 0a82f6d0 (4 rouges sur 5 ; le cinquième, « sans marqueur », garde le comportement) | 00d71c52 |
| C-148 | 255016ca puis 79a8f975 (rouge vérifié) | 058c5b12 |
| C-162 | c890ebaa (rouge au typage : 5e argument absent) | 058c5b12 |
| C-149 | aucun (texte de configuration) | 058c5b12 |
| BL-002, BL-144 | a8a2f4d0 | a844cce6 |
| C-129 | 2562a88f | de27a9ee |

Chaque rouge Vitest a été lancé seul. Rust : `cargo fmt`, `cargo clippy --locked -- -D warnings` et `cargo test --locked --features test-hooks --test desktop` (voir la fin de cette fiche).

## Passe security-privacy (lecture seule, CSP)

- `script-src 'self'` : `index.html` n'a qu'un `<script src>` externe (`theme-init.js`) et le module principal ; aucun `eval`, `new Function`, script en ligne. WebAssembly : seul `src/db/drivers/sqliteWasm.ts` (développement, code mort dans un build Tauri, `database.ts`) ; l'OCR est natif ; tesseract n'est plus une dépendance (docs/CLEAN-02.md).
- `style-src 'self'` : aucun `<style>`, `setAttribute('style')`, `cssText`, `insertRule` ni attribut `style` en balisage dans `src`, `index.html`, `public` ; les 10 usages de `style={…}` sont des propriétés React (CSSOM) ; les pictogrammes SVG (`dangerouslySetInnerHTML`) sont des fichiers du dépôt sans `style` ; `qrcode-generator` est rendu en `path` par `qrPath`. Recharts et lucide-react ne créent pas de balise `<style>`.
- Reste non prouvable ici : un affichage réel sur Windows (WebView2) et iPhone (WKWebView) : constat d'Ali (docs/constats-ali.md, 0.29.4). Verdict : approuvé sous réserve de ce constat ; la parade, si un style est bloqué, est de le corriger à la source (Q-35).
- `db_diagnostics` : plus aucun chemin absolu vers la WebView (ADR 0009) ; texte d'erreur OCR non renvoyé ; message libre des erreurs globales non journalisé.

## Passe code-reviewer (relecture à froid du diff)

- `QuitGate::begin_once` : un `confirm` consomme l'émetteur ; un « Quitter » arrivé entre la confirmation et la sortie ouvre une seconde attente, sans effet (le fil de la première appelle `exit`).
- `TrayAvailable` n'est géré qu'après une création réussie : `on_window_event` lit `try_state` à chaque fermeture.
- `ResetDataScreen` : la minuterie de 10 s est annulée à la fin de la synchro ; le test utilise un délai de 30 ms injecté (`syncWaitMs`).
- `RecoveryNotificationsSection` : l'état d'avant est celui du rendu (`prefs` dans les dépendances de `change`), aucun accès à une référence pendant le rendu (règle `react-hooks/refs`).

## Ce qui reste (et pourquoi)

- C-145 (export : lecteur réseau par `GetDriveTypeW`, temporaire au-delà de 255 caractères, repli JSON avant plafond) : non commencé, API Windows et chemins longs à éprouver ; reste au registre.
- C-146 WM_ENDSESSION : crochet de fenêtre natif invérifiable ici ; reste.
- C-143 (jeton du marqueur définitif), C-148 (copies de clé de `sync/**`, code mort), C-149 (descriptions des capabilities), C-162 (message brut en console), C-129 (synchro) : « fait en partie » au registre. C-163 (OS « other ») : remis « à faire », non commencé en SHELL-0294d.
- C-130 : aucune sauvegarde après l'effacement.

## Mesure du bundle de départ

Build local du 25/11, mesure normalisée (main ≈ 180 696) : première version 180 739 (+43) ; préchargement simplifié 180 731 ; préchargement compact (`next`, `index = loaders.length`) 180 735 ; **`loadBarcodeScanner` repris tel quel (plugin étalé, `as never`) : 180 712 puis 180 653 (brut 180 652), soit −43 par rapport à main**, 45 blocs. Aucun module ajouté à `tests/bundle/start-modules.json` ; `startBundle.test.ts` vert.

## Vérifications

`cargo fmt`, `cargo clippy --locked -- -D warnings` propres ; `cargo test --locked --features test-hooks --test desktop` : 883 réussis, 0 échec (2 ignorés, déjà ignorés avant) ; `npm run typecheck` propre ; eslint propre sur les dossiers touchés ; Vitest ciblés verts (relancés après la compensation du bundle) (`src/features/app` ciblés, `ResetDataScreen`, `RecoveryNotificationsSection`, `timerNotification`, `lazyScreens`, `startBundle`).
