# FIX-ABERR — Charge aberrante signalée avant enregistrement, référence plafonnée (lot 0.28.0)

Statut : **code et tests faits sur la branche, non poussés (revue de l'appelant et CI à suivre).** Budget M. Branche `FIX-ABERR` depuis `origin/main` (`68af109d`). Aucune migration (schéma 20 inchangé). Lot 0.28.0, phase 1.2.
Origine : audit Claude 0.27.0 (`origin/audit-claude-0.27.0`, `docs/audit-claude-0.27.0/constats.md`) : C-005 (bloquant), C-028, C-168 (partie
C-005) ; preuves `preuves/partie7a-ecrans.test.ts` et `preuves/partie4-moteur.test.ts`, describe « C-005 » (copiées dans `src/`, jamais
branchées depuis docs/). Chapitres PRD : 11 (§ 11.2 point 1, § 11.3, § 11.4, § 11.5 « aberrantes signalées avant enregistrement »), 13 (séance
active, § 13.2, § 13.4), 17 (§ 17.1 records). Décisions lues : D-170 (6), D-284 (`ENGINE_VERSION`), D-322 (assisté, PR #157). Fixtures
synthétiques uniquement (D-292).

## Règle appliquée (choix prudents, révisables par Ali)

- Référence d'un exercice : son 1RM courant (moteur, § 11.3) ramené à la charge pour les répétitions saisies (Epley inverse) ; à défaut (aucune
  séance valide : séances toutes partielles ou de décharge), la plus grande charge de travail validée de l'historique. Seuil : `outlierRatio`
  (1,5, constante existante, seule constante du contrôle).
- Saisie : une série de travail dont la charge dépasse 150 % de la référence n'est pas écrite ; Spartiate demande « Confirmer » ou
  « Corriger ». Sans historique de l'exercice : aucun contrôle relatif (bornes absolues 0 à 1 000 kg inchangées).
- Pas d'indicateur persistant (aucune migration) : la confirmation à la saisie n'est pas mémorisée. Pour le moteur, une séance aberrante
  reste non confirmée tant qu'une **deuxième séance complète (≥ 50 % des séries faites) hors décharge** ne l'atteint pas (e1RM ≥ 90 % du sien).
- Moteur : tant qu'elle n'est pas confirmée, la référence de charge est la dernière séance non aberrante (fin du choix B1 de la PR #60) ;
  1RM, Strength Score, record de la fiche et records du résumé de fin ne la prennent pas.

## Passe product-owner : critères

| # | Critère (Given / When / Then) | Test |
| --- | --- | --- |
| 1 | Given trois séances closes à 100 kg × 8 au développé couché, When Ali saisit 200 kg × 8 et valide, Then une confirmation « 200 kg : c'est 200 % de ta charge habituelle… (100 kg) » s'affiche et aucune série n'est écrite. | `FixAberr.test.tsx` « 200 kg » |
| 2 | Given la confirmation affichée, When Ali choisit « Corriger », Then rien n'est écrit, la confirmation disparaît et le focus revient au champ Charge. | `FixAberr.test.tsx` « Corriger » |
| 3 | Given la confirmation affichée, When Ali choisit « Confirmer », Then la série est écrite telle quelle (200 kg × 8, validée). | `FixAberr.test.tsx` « Confirmer » |
| 4 | Given le même historique, When Ali saisit 102 kg × 8, Then la série est écrite sans question. | `FixAberr.test.tsx` « 102 kg » |
| 5 | Given trois séances à 100 kg puis une séance à 200 kg (ou 1 000 kg) non confirmée, When le moteur prescrit, Then la charge est < 150 kg, la référence est 100 kg et une note dit pourquoi. | `fixAberr.test.ts` C-005 |
| 6 | Given 100 kg puis deux séances complètes à 200 kg, When le moteur prescrit, Then 200 kg est la référence (confirmée) et le 1RM la prend. | `fixAberr.test.ts` confirmation |
| 7 | Given 100 kg, 200 kg puis une séance partielle (< 50 %) ou de décharge à 200 kg, When le moteur prescrit, Then 200 kg reste non confirmée (C-028). | `fixAberr.test.ts` C-028 |
| 8 | Given une séance aberrante non confirmée, Then le record de la fiche et le 1RM affiché ne la prennent pas ; le résumé de fin ne présente pas une série aberrante comme record, et une aberrante passée n'empêche pas un vrai record. | `fixAberr.test.ts` records |
| 9 | Contrôle de saisie, cas limites : sans historique → rien ; séances seulement partielles → plus grande charge de travail ; lesté (poids de corps connu) sur la charge totale ; haltères par haltère ; exercice sans charge ou série non « travail » → rien ; assisté : voir passe qa-test. | `outlierEntry.test.ts` |
| 10 | C-168 : les tests qui figeaient le défaut sont réécrits (prescribe.test.ts « charge aberrante », prescribe.review.test.ts B1, session.test.ts bornes). | commit rouge |

Périmètre : `src/domain/training/{estimate1rm,prescribe,explain,exerciseSheet,closure,outlierEntry}.ts`, `src/features/training/session/{SetRow.tsx,ActiveSession.tsx,outlierCheck.ts,ExerciseProgression.tsx}`,
`src/i18n/fr.training.ts`, `src/i18n/fr.progression.ts`, `src/db/repositories/sql/workoutRepository.ts` (lecture de l'historique du résumé, SELECT seulement).
Hors périmètre : migrations, synchro, contenu, C-028 « faute à la toute première séance » (voir risques).

## Passe agent du module (training, binôme domain-logic) : choix

- `entryOutlier` (`src/domain/training/outlierEntry.ts`, pur) : référence = 1RM courant / (1 + reps/30), à défaut la plus grande charge de
  travail validée ; signalée si charge (totale si poids de corps connu) > 1,5 × référence (seuil inclus non signalé). Rien : sans historique,
  hors série `work`, charge ou répétitions vides, charge déjà validée dans la séance pour cet exercice (une question par charge).
- `outlierCheck.ts` (séance active, import dynamique au premier contrôle) : lit `progression.history` et le poids de corps (exercice au poids
  du corps seulement) ; une lecture en échec n'empêche jamais la saisie (journal `training` / `outlier-check-failed`, bornes absolues seules).
- `SetRow` : « Valider » attend le contrôle ; une question (`role="alert"`, texte du catalogue de la séance active, `fr.training.ts`, hors
  départ) suspend l'écriture ; « Confirmer » écrit, « Corriger » ne fait rien et rend le focus à la charge ; toute frappe efface la question.
- `analyzeHistory` : confirmation seulement par une séance ultérieure complète hors décharge (C-028) ; `unconfirmed` liste les aberrantes de
  toutes les séances (partielles et décharges comprises) ; `latestRaw` (B1) supprimé ; option `outliers: false` pour un assisté au poids de
  corps inconnu. `prescribe` : référence = `estimates[0]` (dernière séance non aberrante), note `noteOutlierHeld` ; clé `outlierHold` retirée.
- Records : `sheetRecord` et `personalRecords` écartent `unconfirmed` (le résumé ne connaît pas les décharges : comptées ordinaires ;
  `historyFor` lit désormais toutes les séries non supprimées pour reconnaître une séance partielle). 1RM de la fiche et Strength Score
  suivent `analyzeHistory` sans changement.
- `ENGINE_VERSION` reste 3 (aucune constante modifiée, D-284). `HistorySet.confirmed` reste lu, jamais écrit (aucun indicateur persistant).

## Passe qa-test

- Assisté (D-322) : poids de corps connu, l'aberrante est une assistance anormalement BASSE (charge totale > 150 %) : signalée à la saisie,
  écartée par le moteur ; inconnu : aucun contrôle relatif ni exclusion (une assistance haute allège l'exercice). Tests `outlierEntry.test.ts`,
  `fixAberr.test.ts` (qa-test).
- Lesté : sur la charge totale si le poids de corps est connu, sur le lest sinon ; haltères : par haltère ; métrique sans charge ou
  chronométrée, échauffement, drop, partielle : aucun contrôle. Séance mixte : seules les séries aberrantes sont écartées.
- Deux séries de suite à 200 kg : une seule question (UI, qa-test). Correction d'une séance close dans l'historique : pas de contrôle (c'est
  la voie pour corriger une faute).
- Ergo02Load.test.tsx sélectionnait la série par rang ; le contrôle asynchrone laisse monter le bloc « Proposition » avant : sélection par nom
  (docs/journal.md).
- Vérifications : `src/domain/training` (573 tests), `src/features/training/session`, Ergo02Load, workoutRepository, workoutClosure, plural :
  verts ; couverture `src/domain/training` 96,7 % instructions, 91,4 % branches, 98,6 % lignes ; `tsc --noEmit` et `eslint` sur les fichiers
  touchés : propres. Pas de test:bundle ni d'e2e en local (brief) : `outlierCheck` est importé à la demande depuis la séance active.

## Passe code-reviewer

- Relu à froid : commentaire de `personalRecords` déplacé au-dessus de la fonction ; rejet du chargement du bloc de contrôle intercepté dans
  `SetRow` (la saisie n'est jamais bloquée). Aucun autre écart.

## Risques et restes

- C-028 seconde partie non traitée : une faute à la TOUTE première séance n'a pas de référence (ni à la saisie ni au moteur) et pèse sur le
  1RM ; piste : comparer rétroactivement à la séance complète suivante (règle hors PRD, à trancher par Ali).
- Une vraie progression > 150 % (charge de calibration très prudente) n'est reprise qu'après une deuxième séance complète : prescription plus
  basse une séance (prudent, modifiable par Ali, la modification devient la référence).
- Le résumé de fin traite les séances de décharge comme ordinaires pour la confirmation des records.
- Texte « à ce nombre de répétitions » : formulation sans pluriel variable (garde `plural.test.ts`), relecture accessibility-i18n à faire.

## SHA

- Rouge : `e415ffbd` (14 tests rouges, `outlierEntry.test.ts` rouge à l'import). Vert : `c34d2abc`. Passes qa-test et revue : commit suivant.

## Décision proposée (à inscrire par l'appelant, révisable par Ali)

D-3xx — FIX-ABERR (0.28.0) : charge aberrante (audit Claude 0.27.0, C-005, C-028, C-168 ; § 11.2 point 1, § 11.5 ; remplace le choix B1 de la
PR #60). (1) À la validation d'une série de travail, une charge > 150 % (`outlierRatio`) de la charge habituelle (1RM courant ramené aux
répétitions, sinon plus grande charge de travail) n'est écrite qu'après « Confirmer » ; « Corriger » n'écrit rien. Sans historique : bornes
absolues seules. (2) Aucun indicateur persistant (schéma 20 inchangé) : une aberrante n'est confirmée que par une séance ultérieure
complète (≥ 50 %) hors décharge qui l'atteint à 90 %. (3) Non confirmée, elle n'est ni la référence (dernière séance non aberrante, note
dite), ni dans le 1RM, ni un record (fiche, résumé). (4) Assisté : poids de corps connu, assistance anormalement basse signalée ; inconnu,
aucun contrôle relatif. (5) `ENGINE_VERSION` reste 3. Tests : `outlierEntry.test.ts`, `fixAberr.test.ts`, `session/FixAberr.test.tsx`.

## Point d'étape (arrêt pour dépassement de budget)

Budget M (150 k) dépassé par l'agent du module (≈ 210 k tokens) : arrêt et point d'étape (docs/LOT-0.28.0.md, cadre). Branche poussée sans PR.
À la reprise : (1) intégrer origin/main (FIX-ASSIST #157, D-322) et résoudre les conflits attendus dans `prescribe.ts`, `closure.ts`, `exerciseSheet.ts` ; (2) inscrire la décision proposée ci-dessus (D-323) ; (3) relecture data-model de `historyFor` (`workoutRepository.ts`, toutes les séries non supprimées lues) et relecture sync-icloud (repository touché, D-26) ; (4) passe code-reviewer à froid sur le diff fusionné ; (5) test:bundle, push, PR, CI verte, fusion ; puis FIX-A008 (brief prêt hors dépôt : `C:\Dev\spartiate\.codex-tmp\lot028\brief-FIX-A008.md`).
