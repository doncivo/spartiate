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
| 4 Moteur d'entraînement | L | en cours |
| 5 Nutrition | M | à faire |
| 6 Récupération et Santé | M | à faire |
| 7a Aujourd'hui et Entraînement | L | à faire |
| 7b Nutrition et Progrès | L | à faire |
| 7c Plus, onboarding, coquilles | L | à faire |
| 8a Rust hors sync | L | à faire |
| 8b Swift | M | à faire |
| 9 Sécurité et confidentialité | M | à faire |
| 10 Performance | S | à faire |
| 11 Tests et CI | L | à faire |
| 12 Conformité PRD et documentation | M | à faire |

## Journal

- 20/11 : worktree, branche, squelette, générateur de couverture (892 fichiers de production dans le périmètre).
