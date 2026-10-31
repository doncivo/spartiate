# Reprise — état courant du dépôt Spartiate

Fichier court, pour tout agent (Claude Code, Codex ou autre) : l'état vivant et les décisions applicables. Chaque jalon remplace la section « État au … ». Règles de travail : `AGENTS.md`. Stack : `CLAUDE.md`. Spécification : `docs/PRD.md` (v6.2, vivant, D-22). Décisions : `docs/decisions.md`. Maquettes : `docs/maquettes/` (référence visuelle, D-21).

## État au 2026-10-31, midi

### Fusionné dans `main`
- SPA-000 : dépôt créé par clone de `doncivo/circletasks` (historique conservé ; remote `circletasks` en lecture seule, push `DISABLED`), `doncivo/spartiate-releases` créé vide. PR #1 (PRD v6.1 + 24 maquettes), PR #2 (ticket SPA-001 v1). Run `tests.yml` 41192279832 sur `main` intact : à consigner ici avec son résultat final.
- Relecture Codex PR #3 (`docs/relecture-codex-2026-10-31.md`) : 43 constats, tous retenus ; arbitrage D-22 à D-45 dans `docs/decisions.md` ; PRD v6.2 et SPA-001 v2 en résultent.

### En cours
- **SPA-001a** (renommage et marque) : à lancer sur `spa-001a-renommage` selon `docs/SPA-001.md` v2 ; test d'identité rouge d'abord ; PR relue par Codex avant fusion.
- Secrets GitHub : seul `RELEASES_TOKEN` nécessaire pour SPA-003 ; `TAURI_SIGNING_PRIVATE_KEY` / `_PASSWORD` (nouvelle paire Spartiate) en SPA-002. `CT_GOOGLE_*` disparaissent en 001b.

### Règles en vigueur
- Jamais de push direct sur `main`, jamais de `--force`, jamais de `rm -rf` ; une PR par ticket ; CI verte et relecture Codex avant fusion.
- Données réelles : `%APPDATA%\fr.circletasks.planner` et `iCloud Drive/CircleTasks` intouchables (app CircleTasks d'Ali toujours en service). Conteneur `fr.spartiate.app` = laboratoire jusqu'à l'annonce par Ali de sa première utilisation réelle (D-38).
- Preuve rouge avant code ; aucun `fixme` ; bundle de départ ≤ 358 400 octets gzip mesuré avant push ; e2e, smoke et Rust lourds en CI ; aucune boucle de surveillance de la CI.
- Toute capacité non prouvée reste `UNVERIFIED` dans `docs/capability-matrix.md` (créé en 001b) ; aucun statut CONFIRMED depuis une lecture de code.

### Reste à faire, dans l'ordre
SPA-001a → fusion → inventaire 001b validé par Ali → SPA-001b → SPA-002 (Windows, clé minisign, updater) → SPA-003 (iOS CI, entitlements ad-hoc) → SPA-004 (SideStore, expiration) → SPA-005 (export / import profil-poids) → SPA-006 / 007 (spikes HealthKit, Live Activity) → SPA-008 (synchro deux appareils) → SPA-009 (coquilles fidèles aux maquettes) → SPA-010 (mesure, I-06, go / no-go I0).
