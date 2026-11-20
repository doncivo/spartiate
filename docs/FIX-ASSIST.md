# FIX-ASSIST — Exercice assisté : l'assistance est une charge négative (lot 0.28.0)

Statut : **fait (revue par l'appelant à suivre).** Budget M. Branche `FIX-ASSIST` depuis `origin/main` (`d0566409`, 0.27.0). Aucune migration. Lot 0.28.0, phase 1.1.
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

## Passe agent du module (training, binôme domain-logic) : choix

- (a) Cran : `nextLoadBelow` (nouvelle, `loadGrid.ts`) sur la grille ; sans grille, −2,5 kg (`unknownIncrementKg`, D-244) ; jamais à 0 kg ni
  en dessous ni sous la plus petite charge de la grille : sinon assistance maintenue, +1 répétition, raison `assistance-min`, phrase
  « Même assistance… assistance minimale du matériel ». Le plafond +10 % reste appliqué (sur la charge totale si le poids de corps est connu).
  Recalibrage « Facile » +5 % désactivé pour un assisté (il hausserait l'assistance) : double progression ordinaire.
- (b) Réductions hors décharge (inactivité, Recovery basse, journée rouge), poids de corps connu ou non : assistance MAINTENUE (choix le plus
  prudent et cohérent avec D-170 (3), D-273, D-284 ; l'augmenter d'un cran sur une pile de 5 kg serait une baisse de difficulté forte et non
  demandée). Raison `assistance-held`, phrases « Assistance maintenue : reprise… » / « … récupération basse… », journée rouge inchangée
  (`redDayHeld`). Position : poids de corps connu, calcul existant sur la charge totale (DEP-01) gardé ; inconnu, assistance maintenue et note
  `noteAssistanceHeld`. Choix « −5 % » et « mini-deload » omis pour un assisté (`proposalOptions(…, assisted)`), « −2 répétitions »,
  variante et autre plage gardés. Décharge : D-273 / D-284 inchangés.
- (c) Échauffement : aucune rampe pour un assisté (drapeau ou matériel `assisted-pull-up-machine`) : une fraction de l'assistance est plus
  dure que le travail et, sans poids de corps, aucune rampe inversée n'est calculable.
- (d) Tonnage et records : séries d'un assisté hors tonnage et hors records (charge et volume), poids de corps connu ou non (le poids de
  corps varie d'une séance à l'autre : un record de « charge effective » serait instable) ; fiche : ni 1RM (`assisted`) ni record de charge.
  Assistés = catalogue (`CATALOG_ASSISTED_IDS`, gardé aligné sur `exercises.json` par un test) + personnalisés de la table `exercise` dont le
  matériel comprend la machine (`workoutRepository.assistedFor`). L'historique (`HistoryView`, `tonnageKg` sans argument) n'exclut que le
  catalogue : résidu mineur (voir risques).
- (e) `ENGINE_VERSION` reste 3 : aucune constante modifiée ; le dépôt n'incrémente la version qu'au changement d'une valeur de configuration
  (`config.ts` l. 4-5 ; D-170 (6), I4-08, D-273, D-284 l'ont laissée à 3 pour des changements de règle).

## Passe qa-test

- Cas limites (describe « passe qa-test » de `fixAssist.test.ts`) : assisté du catalogue `pull-up-assisted` (bodyweight-reps) non prescrit,
  sans rampe, hors tonnage par défaut ; 10 kg → 5 kg puis 5 kg (minimum de la pile) maintenu avec une répétition de plus ; sans grille
  3 → 0,5 kg et 2,6 kg maintenu (jamais 0 kg) ; poids de corps connu + cran + rang 2 : jamais une assistance au-dessus de la référence dite
  « hausse » ; « Dur » : maintien. Poids de corps connu vs inconnu couvert aux critères 1, 4, 5 et 7.
- Constat : C-001a (preuve de l'audit) passait déjà avec grille (35 kg refusé par le plafond +10 % calculé sur l'assistance) : le test rouge
  du critère 1 (30 → 25) porte le défaut. Le catalogue impose une variante « par haltère » à toute phrase en {delta} kg
  (`ExerciseProgressionPair.test.tsx`) : variantes ajoutées (jamais affichées pour une machine).
- Résultats : `src/domain/training` 42 fichiers, 580 tests verts, couverture 96,8 % instructions / 91,4 % branches / 98,6 % lignes ;
  `src/features/training` et `workoutRepository` verts (283 tests, 1 échec corrigé puis 44 tests ciblés verts) ; `workoutClosure.test.ts`
  vert ; `tsc --noEmit` et `eslint` sans erreur.
- Risques résiduels : l'historique (`HistoryView`, volume par séance) n'exclut que l'assisté du catalogue, pas un personnalisé ; alertes
  secondaires (`alertInactivity` quand la phrase principale est autre) disent encore « −x % » pour un assisté ; Recovery basse sur un assisté
  d'isolation retire toujours une série (volume seulement, prudent).

## Commits

- Rouge : `ee29597f` « FIX-ASSIST : tests rouges (C-001, C-002, C-011) » (18 + 1 tests rouges ; aucun test existant ne figeait le défaut).
- Vert : `7aa2025b` « FIX-ASSIST : l'assistance est une charge négative (C-001, C-002, C-011) ».
- Fichiers : `src/domain/training/{assisted,prescribe,constraints,loadGrid,warmup,closure,exerciseSheet,explain,config,types,index}.ts`,
  `src/domain/training/fixAssist.test.ts`, `src/i18n/fr.progression.ts`, `src/i18n/fr.training.ts`,
  `src/features/training/session/{ExerciseProgression.tsx,fixAssistText.test.ts}`, `src/features/training/library/ExerciseSheetStats.tsx`,
  `src/db/repositories/sql/{workoutRepository.ts,workoutClosure.test.ts}`.

## Proposition de décision (à numéroter par l'appelant, docs/decisions.md non modifié)

| D-??? | **FIX-ASSIST (0.28.0) : exercice assisté, l'assistance est une charge négative (audit Claude 0.27.0, C-001, C-002, C-011 ; complète D-170 (3), D-273, D-284 ; choix prudents, révisables par Ali).** Pour un exercice assisté (matériel `assisted-pull-up-machine`), la charge saisie est l'assistance. (1) Haut de plage atteint : l'assistance BAISSE d'un cran (grille du matériel ; sans grille, 2,5 kg, D-244), jamais sous la plus petite assistance de la grille ni sous 0,5 kg sans grille : sinon assistance maintenue et une répétition de plus, « assistance minimale du matériel » ; phrase « Assistance −x kg », jamais « +x kg » ; pas de recalibrage « Facile » +5 %. (2) Hors décharge, inactivité, Recovery basse et journée rouge ne baissent jamais l'assistance, poids de corps connu ou non : maintenue et dite (« Assistance maintenue… », journée rouge `redDayHeld` inchangée) ; décote de position : sur la charge totale si le poids de corps est connu (DEP-01, inchangé), sinon maintenue et dite en note ; choix « −5 % » et mini-deload omis. Décharge : D-273 / D-284 inchangés. (3) Aucune rampe d'échauffement pour un assisté. (4) Séries d'un assisté hors tonnage et hors records (charge, volume) ; fiche sans 1RM ni record de charge. (5) `ENGINE_VERSION` reste 3 (aucune constante modifiée). Tests : `src/domain/training/fixAssist.test.ts`, `src/db/repositories/sql/workoutClosure.test.ts` (describe FIX-ASSIST), `src/features/training/session/fixAssistText.test.ts`. | Claude (choix prudents) ; révisable par Ali |
