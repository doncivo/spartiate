# Reprise — dépôt Spartiate

État au 2026-11-02 (arrêt de session SPA-001b au point d’étape). Mémoire inter-sessions (D-52, ≤ 5 Ko). Règles : AGENTS.md et CLAUDE.md, fusionnés en 001a (D-42). PRD v6.3 en chapitres : docs/prd/README.md. Décisions D-22 à D-59 dans docs/decisions.md ; les décisions approuvées priment sur les textes historiques. Benchmark : archive de recherche, aucun périmètre nouveau.

## Fusionné

SPA-000 clos : dépôt issu de CircleTasks, remote circletasks en lecture seule (push DISABLED), spartiate-releases créé. Fusionnées : #1 à #7, #9 et #10 (réconciliation CADRAGE-01, D-54 à D-59 : SPA-001 v2.4 et reprise restaurés). #8 fermée sans fusion (contenu entré par #9). Le résultat du run initial 41192279832 reste à consigner, sans le présumer vert.

## SPA-001a — renommage (branche spa-001a-renommage poussée, PR #11)

Fait : tests rouges (2346b2dc) ; `scripts/release/rename.mjs` exécuté, rapport dans la PR ; updater non configuré (D-30) ; icône régénérée depuis `content/brand/spartiate.svg` ; CLAUDE.md et AGENTS.md fusionnés ; PRD v6.3 en chapitres (`docs/prd/`, source `docs/archive/PRD-v6.2.md`, corrections dans `scripts/release/fixtures/prd-v6.3-changes.json`) ; registre `docs/a-creer.md` ; journal et changelog CircleTasks archivés dans `docs/archive/circletasks/`. Version finale reçue par la relecture Codex : ADR 0017 appliquée (séparation cryptographique, fichiers .spx / .spj / .sps, garde de dossier par noms ; le risque du dossier renommé est refusé et traité), tests iPhone et non-écriture de folder.json / own.json présents, preuve rouge de l'updater sur main consignée. Reste : `tests.yml` vert sur la PR #11, corrections de la relecture Codex (D-53), fusion. Le reste de `docs/` CircleTasks (stories, audits, backlog, essais, maquettes-refonte) est archivé par 001b, lot (i).

## SPA-001b — point d’étape (arrêt de session)

- `spa-001b-purge` (locale, non poussée, commit rouge volontaire dans `scripts/release/purge.test.ts`) : inventaire validé (D-62), avis de signature déplacé dans `src/features/signing/` et découplé, écarts consignés au journal de `docs/spa-001b-inventaire.md`.
- `spa-001b-wip` (locale, non verte, jamais poussée) : 15 features retirées, 5 sections fixes, conteneur et bootstrap réduits, Réglages épurés ; ~150 erreurs de typage, surtout des tests. Base de départ de 001b-front.
- Décisions d’Ali : `signingAlertFailure` dans À propos accepté pour I0 (SPA-004 remet l’alerte sur Aujourd’hui) ; `conflictRestore.ts` Garder si générique sinon Adapter, `syncConflictUseCases.ts` Adapter, en 001b-sync avec relecture sync-icloud, S1 à S5 intacts ; `tabsConfig.ts` et `domain/tabs.ts` supprimés.
- Découpage : 001b-front, 001b-sync, 001b-rust, 001b-docs (réunissable avec rust), puis base neuve et coquille. Chaque sous-PR verte et fusionnable seule, `purge.test.ts` découpé par sous-PR, jamais de branche rouge poussée.
- `spa-001b-front` (locale, non verte, jamais poussée) : wip fusionnée en squash + pont minimal de synchro ; le code source compile, restent ~170 erreurs de typage dans des tests (dont 12 tests de synchro sur fixtures tâches). Arrêt demandé à Ali.
- D-54 : Ali supprime `%APPDATA%r.spartiate.app` avant le premier lancement de la base neuve.

## Notes pour les tickets suivants

- SPA-009 : fenêtre PC initiale adaptée à l'écran (constat 001a : elle dépasse de l'écran d'Ali), minimum 1 024 × 700.
- D-60 : Rust local autorisé pour les changements de synchro, de garde ou de coffre ; e2e et smoke jamais en local.

## Secrets et décisions attendues

- RELEASES_TOKEN : prêt avant la première publication Windows SPA-002, réutilisé pour SPA-003 ; jamais de valeur dans le dépôt.
- Nouvelle paire minisign Spartiate : SPA-002 ; clé publique dans la configuration, privée et mot de passe dans TAURI_SIGNING_PRIVATE_KEY / TAURI_SIGNING_PRIVATE_KEY_PASSWORD. Ne pas réutiliser la clé CircleTasks. Retirer CT_GOOGLE_* en 001b. L'updater n'est pas enregistré tant que SPA-002 n'a pas posé clé et endpoint.
- Fournisseur IA et plafond : Ali avant I4. Médias : Ali avant I1. Coexistence CircleTasks : preuve SPA-004, pas acquise. Première utilisation réelle de Spartiate annoncée par Ali : fin du laboratoire D-38.

## Ordre et règles

001a → fusion → inventaire approuvé → 001b → SPA-002 → 003 → 004 → 005 → spikes 006/007 → 008 → 009 → 010. Compléments P-04 à P-08 intégrés aux tickets ; P-09 / P-10 avant les modules métier.

PR obligatoire, pas de push main ni force. Bundle ≤ 358 400 octets gzip avant push ; tests légers ciblés en local ; suite complète, e2e et Rust lourds en CI ; aucune surveillance en boucle. Données réelles CircleTasks intouchables ; aucun statut CONFIRMED depuis une lecture de code. Une revue bornée au diff après CI verte (D-53).
