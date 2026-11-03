# Reprise — dépôt Spartiate

État au 2026-11-03 (001b-base). Mémoire inter-sessions (D-52, ≤ 5 Ko). Règles : AGENTS.md et CLAUDE.md. PRD v6.3 en chapitres : docs/prd/README.md. Décisions D-22 à D-68 dans docs/decisions.md ; les décisions approuvées priment sur les textes historiques.

## Fusionné

SPA-000 (#1 à #7, #9, #10 ; #8 fermée sans fusion). SPA-001a (#11). #12 (inventaire, tickets SPA-002 / 003). #14 (préparation de la base neuve, arbitrage D-65). #15 (001b-front). #16 et #18 (001b-périphérie 1/2 et 2/2). #17 (FMT-01, D-66).

## Ouvert

- **001b-base** (branche spa-001b-base, PR #20 en brouillon) : lots A schéma, B synchro (catalogue injecté), C profil et poids (repositories, écran Plus › Profil et poids, nettoyage reminders), D preuves e2e (Y-IOS-01 « a publié », I-06 « données affichées ») faits ; reste CI (gh pr checks 20 --watch), puis gh pr ready 20. Fusion par Ali.
- **#13** (tickets SPA-004 à 010 ; chemins à revérifier) attend 001b-base, à rebaser puis fusionner ensuite.

## Ordre

001b-base (migration 0001, catalogue I0, identités, adaptations de synchro, repositories, formulaire profil / poids, `APP_SCHEMA_VERSION` = 1, capture, restes « reminders ») → SPA-002 → 003 → 004 → 005 → spikes 006 / 007 → 008 → 009 → 010. P-09 / P-10 avant les modules métier.

## Conteneur de données (D-54)

%APPDATA%\fr.spartiate.app est absent (vérifié par Ali le 3 novembre). Ne pas lancer `tauri dev` avant la fin de 001b-base : il le recréerait.

## Preuves suspendues à rétablir

- Y-IOS-01 « a publié » et I-06 « données affichées après mise à jour » : réécrits sur profil / poids (tests/e2e), à confirmer par la CI de #20.
- Action « Voir » après refus des notifications : SPA-004.
- Étape e2e de performance au démarrage (`@perf`, retirée par D-63) : SPA-009 / 010.

## Notes

- SPA-009 : fenêtre PC initiale adaptée à l'écran, minimum 1 024 × 700.
- D-60 : Rust local autorisé pour synchro, garde et coffre (`-j 2`) ; e2e et smoke jamais en local.
- CI instable les 2 et 3 novembre (journal) : à surveiller.
- Secrets : RELEASES_TOKEN avant la première publication Windows (SPA-002) ; nouvelle paire minisign Spartiate en SPA-002 (ne pas réutiliser celle de CircleTasks), clé privée et mot de passe dans TAURI_SIGNING_PRIVATE_KEY / _PASSWORD ; updater non enregistré avant. Jamais de valeur dans le dépôt.
- Fournisseur IA et plafond : Ali avant I4. Médias : Ali avant I1. Coexistence CircleTasks : preuve en SPA-004. Première utilisation réelle annoncée par Ali : fin du laboratoire (D-38).
- PR obligatoire, pas de push main ni force ; aucune surveillance de CI en boucle ; aucun CONFIRMED depuis une lecture de code.

- Écarts ouverts de 001b-base (détail : docs/spa-001b-inventaire.md) : méthodes SQL de l'ancien schéma encore dans SyncRepository (rappels, pauses, Focus) ; kit de conflits sur le banc legacy ; saveHealth (iPhone seul) avec healthkit ; pas d'option vide pour sexe / objectif / expérience.
