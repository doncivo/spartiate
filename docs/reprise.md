# Reprise — dépôt Spartiate

État au 2026-11-02 (FMT-01). Mémoire inter-sessions (D-52, ≤ 5 Ko). Règles : AGENTS.md et CLAUDE.md. PRD v6.3 en chapitres : docs/prd/README.md. Décisions D-22 à D-66 dans docs/decisions.md ; les décisions approuvées priment sur les textes historiques.

## Fusionné

SPA-000 (#1 à #7, #9, #10 ; #8 fermée sans fusion). SPA-001a (#11, renommage Spartiate). #12 (inventaire, tickets SPA-002 / 003). #15 (001b-front, D-63). #16 (001b-périphérie 1/2 : Rust, plugins, workflows).

## Ouvert

- **#17 FMT-01** (branche fmt-rust, D-66) : cargo fmt, 16 tests de lecture de source insensibles à la mise en forme, étape `cargo fmt --check` dans tests.yml. Suite desktop 727 verts en local ; CI à lire par Ali.
- En attente de 001b, à rebaser puis fusionner ensuite : **#13** (tickets SPA-004 à 010 ; chemins à revérifier) et **#14** (préparation de la base neuve ; l'arbitrage d'Ali sur les cinq choix de docs/spa-001b-base-neuve.md est à reporter en **D-65**).

## Ordre

FMT-01 → 001b-périphérie 2/2 (i18n français seul, archivage D-40 dans docs/archive/circletasks/ ; `npm run test:bundle` avant le push) → 001b-base (migration 0001, catalogue, identités, adaptations de synchro, repositories, formulaire profil / poids, APP_SCHEMA_VERSION = 1, capture ; restes « reminders » : AppStatusBanner, domaine, repositories) → SPA-002 → 003 → 004 → 005 → spikes 006 / 007 → 008 → 009 → 010. P-09 / P-10 avant les modules métier.

## Conteneur de données (D-54)

%APPDATA%\fr.spartiate.app a été supprimé par Ali le 2 novembre, mais `tauri dev` a été relancé pendant 001b-front : le dossier a pu être recréé au schéma 19. Ali le revérifie et le supprime avant le premier lancement de 001b-base.

## Preuves suspendues à rétablir

- Y-IOS-01 « a publié » et I-06 « données affichées après mise à jour » : 001b-base.
- Action « Voir » après refus des notifications : SPA-004.
- Étape e2e de performance au démarrage (`@perf`, retirée par D-63) : SPA-009 / 010.

## Notes

- SPA-009 : fenêtre PC initiale adaptée à l'écran, minimum 1 024 × 700.
- D-60 : Rust local autorisé pour synchro, garde et coffre (`-j 2`) ; e2e et smoke jamais en local.
- Secrets : RELEASES_TOKEN avant la première publication Windows (SPA-002) ; nouvelle paire minisign Spartiate en SPA-002 (ne pas réutiliser celle de CircleTasks), clé privée et mot de passe dans TAURI_SIGNING_PRIVATE_KEY / _PASSWORD ; updater non enregistré avant. Jamais de valeur dans le dépôt.
- Fournisseur IA et plafond : Ali avant I4. Médias : Ali avant I1. Coexistence CircleTasks : preuve en SPA-004, pas acquise. Première utilisation réelle annoncée par Ali : fin du laboratoire (D-38).
- PR obligatoire, pas de push main ni force ; aucune surveillance de CI en boucle ; aucun CONFIRMED depuis une lecture de code.
