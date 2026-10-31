# Reprise — état courant du dépôt Spartiate

Fichier court, pour tout agent (Claude Code, Codex ou autre) : l'état vivant et les décisions applicables. Chaque jalon remplace la section « État au … ». Règles de travail : `AGENTS.md`. Stack : `CLAUDE.md`. Spécification : `docs/PRD.md` (v6.2, vivant, D-22). Décisions : `docs/decisions.md` (D-1 à D-21 dans le PRD § 26.1, D-22 à D-48 ici). Rôles : `.claude/agents/README.md`. Maquettes : `docs/maquettes/` (D-21). Benchmark des six apps de référence : `docs/benchmark.md`.

## État au 2026-10-31, soir

### Fusionné dans `main` (785261dc)
- SPA-000 clos : dépôt créé par clone de `doncivo/circletasks` (remote `circletasks` en lecture seule, push `DISABLED`), `doncivo/spartiate-releases` vide. PR #1 PRD v6.1 + 24 maquettes, PR #2 SPA-001 v1, PR #3 relecture Codex, PR #4 PRD v6.2 + SPA-001 v2 + D-22…D-45, PR #5 24 fiches agents (D-46), D-47, D-48, SPA-001 v2.2. Run `tests.yml` 41192279832 sur `main` intact : résultat final à inscrire ici par Ali (`gh run view 41192279832`).

### À faire avant tout code (dans la PR SPA-001a)
- PRD v6.3 par `docs-writer` : corrections D-47 (AppShell / TabRail, `src/ui/theme/tokens.css`, rupture 1 024 px, commandes CI réelles, `contrast.test.ts`, caméra seule sur iPhone, `settings` hors catalogue, quotas 14 / 5 / 3, `withGlobalTauri: false` explicite) et D-48 (rubrique Relais au gabarit § 24.5). Chemins encore faux à corriger au passage : `src/platform/ios` (→ `src/platform/<plugin>`), `src-tauri/gen/apple/Spartiate.entitlements` (→ `src-tauri/ios/Spartiate.entitlements`, copié en CI).
- Fiches agents : chemins erronés `tests/desktop/config.rs` → `src-tauri/tests/desktop/config.rs` (ai-integration, desktop-tauri, ios-mobile, security-privacy) ; `src/lib.rs` → `src-tauri/src/lib.rs` (ios-mobile:21, où il s'agit du `src/lib.rs` **du plugin**, à préciser). Couverts par `agents.test.ts` (chaînes proscrites à étendre : `tests/desktop/config.rs` sans préfixe).
- Fichiers annoncés et encore absents, à créer par leur propriétaire au ticket indiqué : `content/brand/spartiate.svg` (ui-design-system, 001a) ; `scripts/release/identity.test.ts`, `scripts/release/agents.test.ts` (001a) ; `docs/capability-matrix.md`, `docs/qa/iphone.md`, `docs/journal.md` Spartiate, `docs/spa-001b-inventaire.md` (001b) ; `src-tauri/ios/Spartiate.entitlements`, `scripts/ios/apply-entitlements.mjs` (SPA-003) ; `CHANGELOG.md` (001a, docs-writer).

### Décisions d'Ali attendues (hors code)
- Q-1 garder CircleTasks installée à côté (H-16) → vérifié en SPA-004.
- Q-2 fournisseur IA et plafond mensuel → avant I4.
- Q-3 sources des médias d'exercices → I1.
- Q-5 FR seul : appliqué par défaut en 001b.
- Première utilisation réelle de Spartiate : à annoncer (D-38, fin du conteneur de laboratoire).

### Secrets et comptes (jamais de valeur dans le dépôt)
- `RELEASES_TOKEN` (fine-grained, contenu de `spartiate-releases`) : SPA-003.
- Paire minisign Spartiate pour l'updater Windows : SPA-002 — `npm run tauri signer generate -- -w <chemin hors dépôt>\spartiate.key`, clé publique dans `tauri.conf.json`, clé privée et mot de passe dans `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. La clé CircleTasks ne sert jamais.
- `CT_GOOGLE_*` : retirés des workflows en 001b.

### Règles en vigueur
- Jamais de push direct sur `main`, jamais de `--force`, jamais de `rm -rf` ; une PR par ticket ; CI verte et relecture Codex avant fusion ; passes product-owner → agent du module → qa-test → code-reviewer par le même agent.
- Données réelles : `%APPDATA%\fr.circletasks.planner` et `iCloud Drive/CircleTasks` intouchables. Conteneur `fr.spartiate.app` = laboratoire jusqu'à l'annonce d'Ali (D-38).
- Preuve rouge avant code ; aucun `fixme` ; bundle de départ ≤ 358 400 octets gzip mesuré avant push ; e2e, smoke et Rust lourds en CI ; aucune boucle de surveillance de la CI ; aucun statut CONFIRMED depuis une lecture de code.

### Reste à faire, dans l'ordre
SPA-001a → fusion → `docs/spa-001b-inventaire.md` validé par Ali → SPA-001b → SPA-002 (Windows, clé minisign, updater) → SPA-003 (iOS CI, entitlements) → SPA-004 (SideStore, expiration, H-16) → SPA-005 (export / import profil-poids) → SPA-006 / 007 (spikes HealthKit, Live Activity) → SPA-008 (synchro deux appareils) → SPA-009 (coquilles fidèles aux maquettes, contraste) → SPA-010 (mesure, I-06, go / no-go I0).
