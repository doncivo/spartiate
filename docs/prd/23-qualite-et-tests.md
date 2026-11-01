## 23. Qualité et tests

### 23.1 Pyramide (scripts `package.json` hérités, D-35)

| Niveau | Outil | Cible | Seuil |
| --- | --- | --- | --- |
| Domaine | Vitest (`test`, projets `node` et `dom`) | `src/domain/**` : moteur, mésocycle, nutrition, récupération, parse | Couverture `src/domain/**` ≥ 80 % (lignes, fonctions, branches, instructions — seuil hérité, jamais relâché) ; objectif 90 % pour `src/domain/training` seulement ; 100 % des vecteurs des § 11–16 verts |
| DB | Vitest + `@sqlite.org/sqlite-wasm` en mémoire (tests colocalisés `src/db/**`, commande ciblée § 20.4) | Migrations 0001 → N, repositories, catalogue de synchro | Toutes les tables publiées couvertes ; parité natif / Wasm = H-18 |
| Synchro | Vitest (vecteurs ADR 0011 repris) + tests Rust | Chiffrement, HLC, fusion, tombstones, instantanés, reset, oubli d'appareil, reprise | Vecteurs existants + `profile` / `body_weight` (I0), `recovery_day`, `workout` séance close (I1+) |
| Rust | `cargo test --locked --features test-hooks --test desktop`, `cargo test --locked -p tauri-plugin-sql --features sqlite`, `cargo clippy --locked -- -D warnings`, `cargo fmt --check` (à ajouter à `tests.yml`, SPA-001b lot workflows : il ne les lance pas, D-47) | Commandes, `app_signing_info`, sauvegardes, plugin SQL vendored, client HTTP, coffre | Zéro warning ; en CI (Windows) |
| Front | `typecheck` (TS strict), `lint` (ESLint config CircleTasks) | Tout `src/` ; contraste AA : `src/ui/theme/contrast.test.ts` (Vitest, paires CircleTasks héritées ; SPA-009 l’adapte aux tokens § 18.4, aucun script `test:contrast`, D-47) | Zéro erreur |
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
| `tests.yml` | push de branche, PR | ubuntu (lint, typecheck, Vitest `node` × 5 et `dom` × 3, couverture fusionnée, cargo audit, e2e `pc` et `iphone` × 4, perf et bundle) ; windows (`cargo test`, smoke Windows) ; ne lance ni `cargo clippy`, ni `cargo fmt --check`, ni `npm audit` : à ajouter (SPA-001b, lot workflows, D-47) | Seul workflow de tests ; termine par le statut **« suite verte »**, exigé pour fusionner dans `main` avec branche à jour |
| `build-windows.yml` | tag `vX.Y.Z`, manuel | windows-latest (build) ; ubuntu (publication) | build NSIS, signature updater, `latest.json`, publication sur `spartiate-releases` sur tag seulement |
| `build-ios.yml` | tag `ios-vX.Y.Z`, manuel (IPA en artefact ; publication sur tag seulement) | macos-latest (build) ; ubuntu (publication) | `tauri ios build --ci --no-sign`, codesign ad-hoc + entitlements (D-14), contrat plist, lipo, `make-source-json`, `check-source`, publication vers `spartiate-releases` |

Il n'existe ni workflow `ci.yml` ni workflow e2e séparé. Dépôts **publics** (D-13) : minutes macOS gratuites. Fixtures entièrement synthétiques (D-38) ; aucune donnée personnelle, même anonymisée.

### 23.3 Matrice de non-régression à chaque release

Mise à jour SideStore conserve la base (H-5, prouvée en SPA-010 puis rejouée) · expiration lue et notifiée (I-02) · synchro bidirectionnelle PC ↔ iPhone sur 3 tables au moins · séance interrompue par verrouillage reprise · export puis import identique (hash `data.json`) · aucune régression visuelle.
