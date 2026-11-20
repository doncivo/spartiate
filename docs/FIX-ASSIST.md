# FIX-ASSIST — Exercice assisté : l'assistance est une charge négative (lot 0.28.0)

Statut : **en cours.** Budget M. Branche `FIX-ASSIST` depuis `origin/main` (`d0566409`, 0.27.0). Aucune migration. Lot 0.28.0, phase 1.1.
Origine : audit Claude 0.27.0 (`origin/audit-claude-0.27.0`, `docs/audit-claude-0.27.0/constats.md`), C-001 (bloquant), C-002, C-011 ; preuve
`preuves/partie4-moteur.test.ts`, describe « C-001 » (copiée dans `src/domain/training/fixAssist.test.ts`, jamais branchée depuis docs/).
Décisions lues : D-170 (3), D-273, D-284. Chapitres PRD : 11 (§ 11.2 point 6 « maintien ou réduction seulement », § 11.3, § 11.4, § 11.5),
13 (§ 13.8 échauffement), 17 (§ 17.1 records). Fixtures synthétiques uniquement (usage réel en cours, D-292).

## Règle appliquée (choix prudent, révisable par Ali)

Pour un exercice assisté (`exercise.assisted === true` : matériel `assisted-pull-up-machine`), la charge saisie est l'assistance : moins
d'assistance = exercice plus dur. Le moteur ne présente jamais une hausse d'assistance comme une progression, ni une baisse d'assistance
comme une réduction.

## Passe product-owner : critères

| # | Critère (Given / When / Then) | Tests (`fixAssist.test.ts`) |
| --- | --- | --- |
| 1 | Assisté, 3 × 10 à 30 kg d'assistance, « Juste », haut de plage atteint, grille connue (pile 5 kg) → assistance 25 kg (un cran de moins), raison `increase`, écart −5 kg. | C-001a, cran avec grille |
| 2 | Même cas sans grille connue → 27,5 kg (−2,5 kg, `increment-unknown`, cran supposé de D-244). | C-001a2, cran sans grille |
| 3 | Assistance au minimum de la grille (5 kg) ou sans grille à 2,5 kg → assistance maintenue, une répétition de plus, raison `assistance-min` ; phrase « assistance minimale ». | minimum |
| 4 | Assisté, 84 jours sans l'exercice, poids de corps connu ou non → assistance maintenue (30 kg), raison principale inactivité, phrase « Assistance maintenue ». | C-001b, inactivité |
| 5 | Assisté, rang 2 dans la séance, poids de corps inconnu → assistance maintenue (30 kg), note « assistance maintenue » ; poids de corps connu : calcul existant sur la charge totale (assistance relevée, DEP-01) inchangé. | C-001c, position |
| 6 | Assisté en fatigue ou en stagnation → aucun choix « −5 % » ni « mini-deload » qui baisse l'assistance ; « −2 répétitions », variante et autre plage restent. | options |
| 7 | Assisté, journée rouge acceptée ou Recovery basse, poids de corps inconnu → assistance maintenue, dit (`redDayHeld`, `recoveryLowAssistHeld`). | journée rouge, Recovery |
| 8 | Assisté, « Facile » avec confiance < 60 % → aucun recalibrage +5 % (qui hausserait l'assistance) ; double progression ordinaire. | recalibrage |
| 9 | Échauffement d'un assisté → aucune série avec moins d'assistance que le travail (aucune rampe, la grille ne garantit pas une assistance supérieure utile). | C-002 |
| 10 | Tonnage et records d'une séance : les séries d'un assisté (catalogue `pull-up-assisted` ou personnalisé avec la machine) sont hors tonnage et hors records ; la fiche n'affiche ni 1RM ni record de charge pour un assisté. | tonnage, records, fiche |
| 11 | Phrase d'explication d'un cran d'assisté : « Assistance −5 kg : 3 × 10 atteint la dernière fois. », jamais « +x kg ». | phrase |
| 12 | Non-régression : exercices ordinaires, lestés, assisté en décharge (D-273, D-284) et journée rouge (D-170) inchangés ; `ENGINE_VERSION` = 3. | suites `src/domain/training`, `src/features/training` |

Périmètre : `src/domain/training/{prescribe,constraints,warmup,closure,exerciseSheet,explain,config,types}.ts`, `src/i18n/fr.progression.ts`,
`src/i18n/fr.training.ts`, `src/features/training/session/ExerciseProgression.tsx`, `src/features/training/library/ExerciseSheetStats.tsx`,
`src/db/repositories/sql/workoutRepository.ts` (identifiants assistés passés au résumé). Hors périmètre : migrations, synchro, contenu.
