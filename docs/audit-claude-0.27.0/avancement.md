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
| 7c Plus, onboarding, coquilles | L | en cours : 6 relecteurs lancés |
| 8a Rust hors sync | L | à faire |
| 8b Swift | M | à faire |
| 9 Sécurité et confidentialité | M | à faire |
| 10 Performance | S | à faire |
| 11 Tests et CI | L | à faire |
| 12 Conformité PRD et documentation | M | à faire |

## Journal

- 20/11 : worktree, branche, squelette, générateur de couverture (892 fichiers de production dans le périmètre).
- 20/11 : partie 4 terminée. Bloquant C-001 (assisté inversé) poussé dans bloquants.md. Points « à vérifier » relayés en 7a : C-018, C-020, C-024.
- 20/11 : partie 5 terminée, aucun bloquant. Outil preuves/lu.mjs pour consigner les lectures.
- 20/11 : partie 6 terminée, aucun bloquant (C-049 journée rouge manquée en début d'apprentissage : important).
- 20/11 : partie 7a terminée. C-005 reclassé bloquant (faute de frappe prescrite). Motifs et contrastes de tous les écrans faits (preuves/partie7-motifs.mjs, contrastes.mjs) ; contrastes à consigner en 7c.
- 20/11 : partie 7b terminée. Graphe d'imports : preuves/atteignables.mjs (30 fichiers inaccessibles, dont src/platform/ocr). 7c lancée en 6 lots.
