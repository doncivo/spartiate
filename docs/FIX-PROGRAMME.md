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

## Passe agent du module : corrections et choix prudents

- **C-003** (`closure.ts`, `routineDiff`) : les séries d'un exercice sont réparties entre ses lignes du jour (lignes triées par `position`).
  Blocs dans l'ordre de la séance : séries consécutives du même exercice hors groupe, ou toutes celles d'un même groupe (`circuitId`) ;
  autant de blocs que de lignes : bloc n → ligne n ; sinon répartition dans l'ordre des lignes (chacune au plus ses séries prévues, la dernière
  le reste). Ligne à 0 série : « retirée ». `workout_set` ne porte pas l'identifiant de la ligne (`routineExerciseId`) : appariement par ordre,
  sans migration. L'écriture (« Oui » de « Mettre à jour la routine ? ») reste par `lineId`, inchangée, et seulement après confirmation.
- **C-063** (`programDay.ts`, `TodaySessionCard.tsx`) : `ClosedWorkoutLike.day` (date locale du DÉBUT de la séance) ; jours rattachés et séance
  du jour close aujourd'hui (même routine, même jour) : choix `done` avec le prochain jour prévu après aujourd'hui (au plus tôt demain ; un
  seul jour rattaché : le même jour la semaine suivante). Carte : « Séance faite », « Séance du jour faite. Prochaine séance {jour} : {nom}. »,
  « Autre séance… » gardé, aucun « Lancer la séance ». Rotation (aucun jour rattaché) : inchangée, elle passait déjà au jour suivant.
- **C-064** (`CycleView.tsx`) : `setRampUp(answers?.rampUp ?? false)` à chaque relecture ; la reprise ne vaut qu'au premier cycle (D-267).
- **C-065** (`routineRules.ts` `weekdaysToRelease`, `RoutinesView.tsx` `saveDraft`) : dans la même transaction, les jours enregistrés dont
  le jour de la semaine change sont d'abord libérés (`weekday = null`), puis chaque jour reçoit le sien ; le brouillon reste contrôlé par
  `validateRoutine` (doublon refusé). Contrôle d'unicité du repository inchangé.
- **C-117** (`review.ts` `reviewStart`, `cycleWeeksToWrite`, `reviewCycleWeeks` ; `onboardingData.ts`) : la revue part de
  `training.cycleWeeks` s'il vaut 4, 5 ou 6 ; la fin n'écrit la durée qu'au premier passage ou si elle a changé dans la revue (7 et
  « illimité » ne sont plus écrasés).
- Aucune migration, aucun changement de ce qui est publié ni du moment de publication ; `src/sync/**` non touché. Modules hors du départ
  (aucun dans `tests/bundle/start-modules.json`).

## Passe qa-test

`src/domain/training/fixProgramme.qa.test.ts` (11 cas, verts) : groupe A1 B1 A2 B2 plus ligne libre du même exercice (aucun écart ; tour
ajouté au groupe : seules les lignes du groupe) ; série supprimée ou échauffement au milieu d'un bloc (bloc non coupé) ; ligne supprimée du
jour ignorée ; dimanche fait → lundi ; repos inchangé ; autre jour de la routine fait aujourd'hui par « Autre séance… » (le jour du jour reste
proposé) ; `weekdaysToRelease` (seuls les jours existants dont le jour non vide change) ; lecture 4/5/6 seulement ; écriture premier passage
ou changement ; point de départ de la revue. Non-régression lancée : `src/domain/training`, `src/features/training/session`,
`src/features/training/cycle`, `RoutineCircuit`, `RoutineReorder`, `TrainingScreen`, `Ergo02Screens`, `src/features/onboarding`,
`src/domain/onboarding`, repositories SQL des séances et des routines : verts. `tsc` et eslint (fichiers touchés, tests compris) propres.

## Preuves

- Rouge : `559a13d4` (15 échecs sur 23 : C-003 × 6, C-063 × 3, C-064, C-065 × 2, C-117 × 4). Vert : `5321f2b6`. Qa-test : commit suivant.
- Test ajusté entre rouge et vert (sans changer ce qu'il prouve) : C-064 lisait les deux cycles par `created_at` (même instant, horloge figée),
  ordre non déterministe ; lecture par statut. L'assertion rouge d'origine (interrupteur encore coché) est inchangée.

## Passe code-reviewer (à froid, agent distinct) : à corriger, puis corrigé

Code juste sur les cinq constats (répartition des séries sans perte ni doublon, date locale du début, réglages non écrasés, échange de jours en une
transaction, rouge `559a13d4` avant vert `5321f2b6`, preuve C-018 adaptée acceptable, eslint vide, 1 066 tests ciblés verts). À corriger : (1) aucun test de
la séance commencée la veille et close après minuit ; (2) rollback de C-065 non prouvé. Corrigés par deux tests d'écran dans
`FixProgramme.screens.test.tsx` (heures locales, indépendants du fuseau ; échec simulé d'`updateDay` après la libération : base intacte, « saveError »),
qui échoueraient si la date venait de `endedAt` ou sans transaction. Suggestions (3) et (4) écrites dans D-351 et D-352.

## Décisions : D-349, D-350, D-351, D-352 (docs/decisions.md)

- **D-349** : FIX-PROGRAMME (C-063, complète D-316 (2), choix prudent, révisable par Ali) : avec des jours rattachés, la séance du jour close
  le jour même (date locale de son début, même routine, même jour) n'est pas reproposée ; la carte dit « Séance du jour faite. Prochaine
  séance {jour} : {nom}. » avec « Autre séance… » ; une séance commencée la veille et close après minuit compte pour la veille.
- **D-350** : FIX-PROGRAMME (C-003, § 13.8, choix prudent) : « Mettre à jour la routine ? » apparie les séries aux lignes par ordre (blocs
  contigus ou groupe ; sinon remplissage dans l'ordre des lignes, la dernière reçoit le reste), sans colonne `routine_exercise_id` sur
  `workout_set` (aucune migration) ; une ligne d'un exercice répété sans série est proposée au retrait.
- **D-351** : FIX-PROGRAMME (C-117, complète D-315 (1)) : « Revoir mes réglages » part de la durée réglée (`training.cycleWeeks`, si 4, 5 ou
  6) et ne l'écrit que si elle change dans la revue ; 7 semaines et « illimité » ne sont jamais écrasés par une revue. Limite (revue) : si `training.cycleWeeks` vaut 7 ou « illimité », la revue affiche la durée de l'onboarding (4, 5 ou 6), pas le réglage réel ; rien n'est écrasé tant qu'on ne la change pas.
- **D-352** : FIX-PROGRAMME (C-065, complète D-316 (1)) : à l'enregistrement d'une routine, l'unicité du jour de la semaine est contrôlée sur
  le brouillon ; en base, les jours qui changent sont libérés puis écrits dans la même transaction (échange de deux jours permis).
 La libération écrit un `weekday = null` intermédiaire (une capture de synchro de plus, suivie de l'écriture finale au hlc plus récent) ; `src/sync` non touché.
## Constats d'Ali à faire

- iPhone, programme à jours rattachés : faire la séance du jour, la clore, revenir sur Aujourd'hui : « Séance du jour faite » et la
  prochaine séance, aucun « Lancer la séance ».
- Éditeur de routine : échanger deux jours de la semaine (lundi ↔ jeudi), enregistrer : accepté.

## Écarts au brief

- Preuve C-018 de `partie7a-ecrans.test.ts` adaptée : la séance close y est sans date ; la correction demandée (« passer la date des séances
  closes ») la rend nécessaire. Une séance sans date ne compte pas comme faite aujourd'hui (cas testé).
- C-064 et C-065 n'avaient pas de preuve écrite (lecture) : tests DOM ajoutés (`FixProgramme.screens.test.tsx`).
- Budget : environ 130 k, dans le budget M.
