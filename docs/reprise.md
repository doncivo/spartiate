# Reprise — dépôt Spartiate

État au 2026-11-01. Mémoire inter-sessions (D-52). Règles : AGENTS.md et CLAUDE.md ; leur adaptation Spartiate reste SPA-001a (D-42). PRD v6.2 inchangé ; décisions D-22 à D-59 dans docs/decisions.md. Les décisions approuvées priment sur les textes historiques. Benchmark : archive de recherche, aucun périmètre nouveau.

## Fusionné

SPA-000 clos : dépôt issu de CircleTasks, remote circletasks en lecture seule (push DISABLED), spartiate-releases créé. PR #1 à #10 fusionnées (#8 remplacée par #9 puis restaurée par #10). PR #5 : 24 agents ; #6 : benchmark ; #7 : D-49 à D-53 et SPA-001 v2.3. Le résultat du run initial 41192279832 reste à consigner, sans le présumer vert.

## Préparation en cours

CADRAGE-01 (fusionné) : SPA-001 v2.4, cohérence des fiches, benchmark non normatif et docs/preparation-spa.md (P-01 à P-10 : responsables, échéances, preuves et propositions PRD). Aucun changement applicatif ni PRD dans ce lot. Lire seulement les lignes concernant le ticket à ouvrir. P-02 à P-07 tranchés par D-54 à D-59 ; P-01, P-08 à P-10 restent des contrats.

## Prochaine session : SPA-001a

- Appliquer SPA-001.md et D-49 à D-53 : tests rouges, script de renommage idempotent, retouches, contrôles ciblés, PR ; capture icône/fenêtre soumise à Ali avant push.
- Architect maintient les contrats des fiches ; ci-release écrit leurs contrôles ; qa-test possède la configuration Vitest ; docs-writer porte seulement les décisions approuvées au PRD ; product-owner tient reprise, journal et tickets.
- PRD v6.3 : report D-47/D-48 et découpage D-49 avec preuve de conservation du contenu. Préserver toutes les décisions existantes. Reporter aussi D-58 (versions) et D-59 (HealthKit) au § 7 et § 26.2.
- Ne pas modifier le PRD sur la base du benchmark. Protéger les données CircleTasks, y compris dans les contrôles automatiques et le script de renommage.
- Fichiers futurs, propriétaires et tickets : registre docs/a-creer.md à produire en 001a (D-50). Icône : ui-design-system dès 001a ; contrôles : ci-release. Entitlements durables et copie CI : ios-mobile / ci-release en SPA-003. Matrice de capacités, recette appareil et inventaire : product-owner en 001b.

## Avant SPA-001b

Inventaire au niveau des symboles validé par Ali (D-44). Appliquer D-54 (Ali supprime le conteneur de laboratoire avant 001b) et D-55 (identités profil / pesée). Gardes du migrateur conservées. settings hors publication I0 ; 24 fiches conservées ; AppShell / TabRail et rupture 1 024 px.

## Secrets et décisions attendues

- RELEASES_TOKEN : prêt avant la première publication Windows SPA-002, réutilisé pour SPA-003 ; jamais de valeur dans le dépôt.
- Nouvelle paire minisign Spartiate : SPA-002 ; clé publique dans la configuration, privée et mot de passe dans TAURI_SIGNING_PRIVATE_KEY / TAURI_SIGNING_PRIVATE_KEY_PASSWORD. Ne pas réutiliser la clé CircleTasks. Retirer CT_GOOGLE_* en 001b.
- Fournisseur IA et plafond : Ali avant I4. Médias : Ali avant I1. Coexistence CircleTasks : preuve SPA-004, pas acquise. Première utilisation réelle de Spartiate annoncée par Ali : fin du laboratoire D-38.

## Ordre et règles

001a → fusion → inventaire approuvé → 001b → SPA-002 → 003 → 004 → 005 → spikes 006/007 → 008 → 009 → 010. Compléments P-04 à P-08 intégrés aux tickets correspondants ; P-09/P-10 avant les modules métier.

PR obligatoire, pas de push main ni force. Bundle ≤ 358 400 octets gzip avant push ; tests légers ciblés en local ; suite complète, e2e et Rust lourds en CI ; aucune surveillance en boucle. Données réelles CircleTasks intouchables ; aucun statut CONFIRMED depuis une lecture de code. Une revue bornée au diff après CI verte (D-53), rapport ≤ 40 lignes.
