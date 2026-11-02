# Reprise — dépôt Spartiate

État au 2026-11-02 (arrêt de session 001b-périphérie). Mémoire inter-sessions (D-52, ≤ 5 Ko). Règles : AGENTS.md et CLAUDE.md, fusionnés en 001a (D-42). PRD v6.3 en chapitres : docs/prd/README.md. Décisions D-22 à D-64 dans docs/decisions.md ; les décisions approuvées priment sur les textes historiques. Benchmark : archive de recherche, aucun périmètre nouveau.

## Fusionné

SPA-000 clos : dépôt issu de CircleTasks, remote circletasks en lecture seule (push DISABLED), spartiate-releases créé. Fusionnées : #1 à #7, #9 et #10 (réconciliation CADRAGE-01, D-54 à D-59 : SPA-001 v2.4 et reprise restaurés). #8 fermée sans fusion (contenu entré par #9).

## SPA-001a — renommage (branche spa-001a-renommage poussée, PR #11)

Fait : tests rouges, `rename.mjs` exécuté, updater non configuré (D-30), icône régénérée, CLAUDE.md et AGENTS.md fusionnés, PRD v6.3 en chapitres, journal CircleTasks archivé. Relecture Codex : ADR 0017 appliquée. Reste : `tests.yml` vert sur la PR #11, corrections D-53, fusion. Le reste de `docs/` CircleTasks est archivé par 001b, lot (i).

## SPA-001b — état (2026-11-02, arrêt de session au budget)

- 001b-front fusionnée (#15, D-63). Découpage final D-64 : **001b-périphérie** (branche spa-001b-peripherie, commitée, **non poussée**, pas de PR), puis **001b-base** (migration 0001, catalogue, identités, adaptations de synchro, repositories, formulaire profil / poids, APP_SCHEMA_VERSION = 1, capture ; arbitrage des cinq choix de docs/spa-001b-base-neuve.md en D-65).
- Fait en périphérie (commit rouge puis vert par lot, purge.test.ts, 46+ tests) : lot Rust (calendars/, capture, focus_window, shortcut, tray « Ajout rapide », import neutralisé « unsupported », capabilities, façades platform/calendars|capture|focus), lot plugins (reminders, web-auth, Cargo.lock, plist, contrat plist, fixtures calendars), lot workflows (CT_GOOGLE_* retiré, tests.yml sur pull_request + push main, clippy bloquant). Locaux verts : tsc, lint, Vitest scripts/ et platform/ et features/app, cargo test config/logic/capture_ios/import/sync_key (suite desktop complète verte avant les lots plugins), cargo clippy, test:bundle.
- **Reste** : (1) i18n français seul (en.* et 50 fichiers citant Locale / 'en' : chargeurs, types, ensureLocale, réglages, tests colocalisés), (2) archivage D-40 dans docs/archive/circletasks/, (3) PR avec liste des suppressions par lot et tests retirés avec motif, (4) rapport. Avant le push : npm run test:bundle.
- Écarts à trancher par Ali (journal de docs/spa-001b-inventaire.md) : cargo fmt --check non branché (~2 500 écarts dont src/sync) ; restes « reminders » (bandeau, domaine, repositories) pour 001b-base.
- D-54 : Ali supprime %APPDATA%r.spartiate.app avant le premier lancement de la base neuve.

## Notes pour les tickets suivants

- SPA-009 : fenêtre PC initiale adaptée à l'écran, minimum 1 024 × 700.
- D-60 : Rust local autorisé pour les changements de synchro, de garde ou de coffre ; e2e et smoke jamais en local.

## Secrets et décisions attendues

- RELEASES_TOKEN : prêt avant la première publication Windows SPA-002, réutilisé pour SPA-003 ; jamais de valeur dans le dépôt.
- Nouvelle paire minisign Spartiate : SPA-002 ; clé publique dans la configuration, privée et mot de passe dans TAURI_SIGNING_PRIVATE_KEY / TAURI_SIGNING_PRIVATE_KEY_PASSWORD. Ne pas réutiliser la clé CircleTasks. Retirer CT_GOOGLE_* en 001b. L'updater n'est pas enregistré tant que SPA-002 n'a pas posé clé et endpoint.
- Fournisseur IA et plafond : Ali avant I4. Médias : Ali avant I1. Coexistence CircleTasks : preuve SPA-004, pas acquise. Première utilisation réelle de Spartiate annoncée par Ali : fin du laboratoire D-38.

## Ordre et règles

001a → fusion → inventaire approuvé → 001b → SPA-002 → 003 → 004 → 005 → spikes 006/007 → 008 → 009 → 010. Compléments P-04 à P-08 intégrés aux tickets ; P-09 / P-10 avant les modules métier.

PR obligatoire, pas de push main ni force. Bundle avant push ; tests légers ciblés en local, le reste en CI ; aucune surveillance en boucle ; aucun CONFIRMED depuis une lecture de code.
