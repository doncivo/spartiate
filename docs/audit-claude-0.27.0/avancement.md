# AUDIT-CLAUDE-0.27.0 — avancement

SHA audité : `d056640910db32cc9d08b940e9a6ae9e602d3b19` (tag `v0.27.0`). Début : 20 novembre 2026.
Worktree : `C:\Dev\spartiate\.codex-tmp\wt-audit-claude`, branche `audit-claude-0.27.0` créée depuis le tag, jamais mise à jour depuis main.

## Reprise

1. Relire `prompt.md` puis ce fichier.
2. `node docs/audit-claude-0.27.0/preuves/couverture.mjs` régénère `couverture.md` depuis `preuves/lectures.tsv` (une ligne par fichier lu).
3. Constats : `constats.md` (C-001…), bloquants recopiés dans `bloquants.md` dès leur établissement.

## Parties

| Partie | Budget | État |
|---|---|---|
| 4 Moteur d'entraînement | L | terminée le 20/11 : 45/45 fichiers, C-001 à C-030 (1 bloquant), 11 rouges, 20 vecteurs verts |
| 5 Nutrition | M | terminée le 20/11 : 39/39 fichiers (+ off.rs, notifications compléments), C-031 à C-048, 6 rouges, 8 vecteurs verts, aucun bloquant |
| 6 Récupération et Santé | M | terminée le 20/11 : 23/23 fichiers (+ healthkit.rs), C-049 à C-062, 7 rouges, 7 vecteurs verts, aucun bloquant |
| 7a Aujourd'hui et Entraînement | L | terminée le 20/11 : 98/98 fichiers (+ i18n index/types/plural), C-063 à C-085, C-005 reclassé bloquant, 4 rouges |
| 7b Nutrition et Progrès | L | terminée le 20/11 : 59/59 fichiers, C-086 à C-106, 4 rouges, aucun bloquant (C-089 photos à vérifier en 8b) |
| 7c Plus, onboarding, coquilles | L | terminée le 20/11 : 374/374 fichiers (CSS de l'onboarding, des réglages et de la synchro par motifs et lecture partielle), C-107 à C-135, 5 rouges, aucun bloquant |
| 8a Rust hors sync | L | terminée le 20/11 : 57/57 fichiers (backup_triggers.rs par structure, Cargo.lock hors relecture), C-136 à C-150, aucun bloquant |
| 8b Swift | M | en cours : 3 relecteurs |
| 9 Sécurité et confidentialité | M | en cours : historique git sans secret ; dépôt PUBLIC, données d'usage réelles dans docs/ à consigner |
| 10 Performance | S | terminée le 20/11 : bundle 196 042 octets normalisés (CI du tag), fuites relevées en partie 7 |
| 11 Tests et CI | L | à faire |
| 12 Conformité PRD et documentation | M | à faire |

## Journal

- 20/11 : worktree, branche, squelette, générateur de couverture (892 fichiers de production dans le périmètre).
- 20/11 : partie 4 terminée. Bloquant C-001 (assisté inversé) poussé dans bloquants.md. Points « à vérifier » relayés en 7a : C-018, C-020, C-024.
- 20/11 : partie 5 terminée, aucun bloquant. Outil preuves/lu.mjs pour consigner les lectures.
- 20/11 : partie 6 terminée, aucun bloquant (C-049 journée rouge manquée en début d'apprentissage : important).
- 20/11 : partie 7a terminée. C-005 reclassé bloquant (faute de frappe prescrite). Motifs et contrastes de tous les écrans faits (preuves/partie7-motifs.mjs, contrastes.mjs) ; contrastes à consigner en 7c.
- 20/11 : partie 7b terminée. Graphe d'imports : preuves/atteignables.mjs (30 fichiers inaccessibles, dont src/platform/ocr). 7c lancée en 6 lots.
- 20/11 : partie 7c terminée. Reportés en 8b : src/platform/sync/memory.ts et faultPlan.ts (non lus), exclusion iCloud des photos (C-089). Rust : unwrap/expect de production sains, CSP stricte, sql:allow-execute dans default.json (à consigner en 8a), description NSIS périmée (12).
- 20/11 : 8a et 10 consignées. Partie 9 : 3 072 commits sans secret ni base ; dépôt doncivo/spartiate PUBLIC, docs/FIX-0172.md:66 (moyenne de sommeil d'Ali) et docs/AUDIT-USAGE.md (cibles kcal réelles) à consigner.
