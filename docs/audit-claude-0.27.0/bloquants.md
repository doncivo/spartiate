# AUDIT-CLAUDE-0.27.0 — bloquants établis

SHA audité : `d056640910db32cc9d08b940e9a6ae9e602d3b19` (`v0.27.0`). Les bloquants de Codex (A-008, A-009, branche `audit-0.26.0`) ne sont pas recopiés ici.

## C-001 — exercice assisté hors décharge : progression et réductions inversées (partie 4, 20/11)

- **Ce qu'Ali peut voir** : sur un exercice personnalisé « tractions à la machine assistée » (métrique par défaut « charge × répétitions », matériel machine assistée), la séance suivante propose plus d'assistance comme une « hausse » (exercice plus facile) ; après trois semaines sans l'exercice, ou en 2e position dans la séance, elle propose moins d'assistance (exercice plus dur).
- Cause : la charge saisie est l'assistance, mais `prescribe.ts` (cran `:303-319`, position `:224-241`), `constraints.ts:162-164` et `proposalOptions` (appelée sans `assisted`, `prescribe.ts:275`, `:369`) la traitent comme une charge ordinaire. Seules la décharge et la journée rouge sont protégées (D-273, D-284). D-284 laisse à Ali l'inactivité et la Recovery hors décharge ; l'inversion du cran et la décote de position ne sont consignées nulle part.
- Preuve : `preuves/partie4-moteur.test.ts`, tests C-001a2 (30 → 32,5 kg « hausse »), C-001b (84 jours : 30 → 25 kg), C-001c (rang 2 : 30 → 25 kg) ; sortie `preuves/resultats/partie4-moteur.log`. Données synthétiques, vraies fonctions du tag.
- Limites : n'atteint pas l'exercice assisté du catalogue (`bodyweight-reps`, non prescrit, `prescribe.ts:104`) ; suppose un exercice personnalisé, création non observée sur l'appareil d'Ali.
- Correction suggérée : traiter `assisted` comme une charge négative dans tout le moteur (cran, facteurs, position, options, échauffement C-002), avec un test par chemin.
