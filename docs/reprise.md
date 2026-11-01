# Reprise — dépôt Spartiate

État au 2026-11-01 (fin de session SPA-001a). Mémoire inter-sessions (D-52, ≤ 5 Ko). Règles : AGENTS.md et CLAUDE.md, fusionnés en 001a (D-42). PRD v6.3 en chapitres : docs/prd/README.md. Décisions D-22 à D-59 dans docs/decisions.md ; les décisions approuvées priment sur les textes historiques. Benchmark : archive de recherche, aucun périmètre nouveau.

## Fusionné

SPA-000 clos : dépôt issu de CircleTasks, remote circletasks en lecture seule (push DISABLED), spartiate-releases créé. Fusionnées : #1 à #7, #9 et #10 (réconciliation CADRAGE-01, D-54 à D-59 : SPA-001 v2.4 et reprise restaurés). #8 fermée sans fusion (contenu entré par #9). Le résultat du run initial 41192279832 reste à consigner, sans le présumer vert.

## SPA-001a — renommage (branche spa-001a-renommage, PR ouverte)

Fait : tests rouges (2346b2dc) ; `scripts/release/rename.mjs` exécuté, rapport dans la PR ; updater non configuré (D-30) ; icône régénérée depuis `content/brand/spartiate.svg` ; CLAUDE.md et AGENTS.md fusionnés ; PRD v6.3 en chapitres (`docs/prd/`, source `docs/archive/PRD-v6.2.md`, corrections dans `scripts/release/fixtures/prd-v6.3-changes.json`) ; registre `docs/a-creer.md` ; journal et changelog CircleTasks archivés dans `docs/archive/circletasks/`. Reste : capture icône et fenêtre validée par Ali avant push, `tests.yml` vert, revue D-53 (rapport ≤ 40 lignes). Le reste de `docs/` CircleTasks (stories, audits, backlog, essais, maquettes-refonte) est archivé par 001b, lot (i).

## Avant SPA-001b

- Fusion de 001a, puis inventaire au niveau des symboles `docs/spa-001b-inventaire.md` validé par Ali (D-44) : nouvelle session.
- D-54 : Ali supprime lui-même `%APPDATA%\fr.spartiate.app` (chemin exact affiché, aucun joker) avant le premier lancement de 001b. D-55 : identités profil / pesée. Gardes du migrateur conservées. `settings` hors publication I0 ; 24 fiches conservées ; AppShell / TabRail et rupture 1 024 px.
- Tests métier CircleTasks laissés verts en 001a et supprimés en 001b : liste dans la PR.

## Secrets et décisions attendues

- RELEASES_TOKEN : prêt avant la première publication Windows SPA-002, réutilisé pour SPA-003 ; jamais de valeur dans le dépôt.
- Nouvelle paire minisign Spartiate : SPA-002 ; clé publique dans la configuration, privée et mot de passe dans TAURI_SIGNING_PRIVATE_KEY / TAURI_SIGNING_PRIVATE_KEY_PASSWORD. Ne pas réutiliser la clé CircleTasks. Retirer CT_GOOGLE_* en 001b. L'updater n'est pas enregistré tant que SPA-002 n'a pas posé clé et endpoint.
- Fournisseur IA et plafond : Ali avant I4. Médias : Ali avant I1. Coexistence CircleTasks : preuve SPA-004, pas acquise. Première utilisation réelle de Spartiate annoncée par Ali : fin du laboratoire D-38.

## Ordre et règles

001a → fusion → inventaire approuvé → 001b → SPA-002 → 003 → 004 → 005 → spikes 006/007 → 008 → 009 → 010. Compléments P-04 à P-08 intégrés aux tickets ; P-09 / P-10 avant les modules métier.

PR obligatoire, pas de push main ni force. Bundle ≤ 358 400 octets gzip avant push ; tests légers ciblés en local ; suite complète, e2e et Rust lourds en CI ; aucune surveillance en boucle. Données réelles CircleTasks intouchables ; aucun statut CONFIRMED depuis une lecture de code. Une revue bornée au diff après CI verte (D-53).
