# FIX-PROGRAMME — Séance du jour faite, reprise au 2e cycle, échange de jours, durée de la revue, écart de routine (lot 0.28.0, phase 2)

Statut : **en cours** (rouge puis vert, qa-test, consignés ci-dessous). 6e des 10 correctifs de l'audit Claude (constats C-063, C-064, C-065,
C-117, C-003). Budget M (150 k) ; dépassement seulement consigné (D-333). Branche `FIX-PROGRAMME` depuis `origin/main` (`77a89e5d`). Rôles :
training, domain-logic. Chapitres PRD : 11 (progression), 12 (génération, mésocycle, routines), 13 (séance active, § 13.8 « Mettre à jour la
routine ? »). Décisions lues : D-243, D-267, D-269, D-315, D-316, D-318. Fixtures synthétiques uniquement ; aucune donnée d'Ali.
`src/sync/**` et `src/domain/sync/**` : ni lus pour décider, ni modifiés (D-26 non déclenché) ; aucune migration.

## Passe product-owner : critères

| # | Constat | Critère (Given / When / Then) | Test |
| --- | --- | --- | --- |
| 1 | C-003 | Given un jour de routine où le même exercice occupe deux lignes hors groupe (3 + 2 séries), When la séance est faite à l'identique (5 séries), Then `routineDiff` ne propose aucun écart ; les séries sont appariées aux lignes dans l'ordre (blocs contigus ou groupe), jamais agrégées par exercice. | `fixProgramme.domain.test.ts` |
| 2 | C-003 | Given le même jour, When une série du premier bloc est retirée (2 + 2), Then l'écart porte sur la ligne 1 seule (3 → 2) ; When une série est ajoutée au second bloc (3 + 3), Then ligne 2 seule (2 → 3) ; When tout le second bloc est retiré, Then la ligne 2 est « retirée ». Jamais une ligne écrite au total de l'exercice. | `fixProgramme.domain.test.ts` |
| 3 | C-063 | Given des jours rattachés à un jour de la semaine et la séance du lundi close le lundi même, When on lit la séance du jour ce lundi, Then elle n'est plus proposée : état « faite » avec la prochaine séance prévue ; la même séance close le lundi précédent ne compte pas (le jour reste proposé). | `fixProgramme.domain.test.ts` |
| 4 | C-063 | Given la carte « Séance du jour » ce lundi après la séance close, When elle s'affiche, Then « Séance du jour faite. Prochaine séance jeudi : … », aucun « Lancer la séance », « Autre séance… » reste. | `FixProgramme.screens.test.tsx` |
| 5 | C-064 | Given un premier cycle lancé avec la semaine de reprise, When il est terminé « sans suite » sans quitter l'écran, Then l'interrupteur « Semaine de reprise » revient éteint et le 2e cycle lancé n'a pas `ramp_up`. | `FixProgramme.screens.test.tsx` |
| 6 | C-065 | Given deux jours, Jour 1 « Lundi » et Jour 2 « Mardi », When on les échange dans l'éditeur (ou Jour 1 « Lundi » → « Aucun » et Jour 2 « Aucun » → « Lundi »), Then l'enregistrement réussit et la base porte l'échange ; un doublon dans le brouillon reste refusé par `validateRoutine`. | `FixProgramme.screens.test.tsx`, `fixProgramme.domain.test.ts` |
| 7 | C-117 | Given un onboarding fini à 4 semaines puis `training.cycleWeeks` passé à 6 (ou 7, ou « illimité »), When « Revoir mes réglages » est terminée sans toucher la durée, Then `training.cycleWeeks` est inchangé ; la revue part du réglage courant quand il vaut 4, 5 ou 6 ; une durée changée dans la revue est écrite. | `onboardingData.fixprogramme.test.ts` |

Périmètre écrit : `src/domain/training/closure.ts`, `programDay.ts`, `routineRules.ts` ; `src/domain/onboarding/review.ts` ;
`src/features/training/session/TodaySessionCard.tsx`, `src/features/training/cycle/CycleView.tsx`, `src/features/training/RoutinesView.tsx` ;
`src/features/onboarding/onboardingData.ts` ; `src/i18n/fr.training.ts` (deux textes) ; tests nommés ci-dessus ; cette fiche.
