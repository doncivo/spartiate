# FIX-ABERR — Charge aberrante signalée avant enregistrement, référence plafonnée (lot 0.28.0)

Statut : **code et tests faits sur la branche, non poussés (revue de l'appelant et CI à suivre).** Budget M. Branche `FIX-ABERR` depuis `origin/main` (`9dbab331`, après HIST-01). Aucune migration (schéma 20 inchangé). Lot 0.28.0, phase 1.2.
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

## Suite du 20/11 (décisions d'Ali) : passe product-owner, critères 11 à 19

Décisions d'Ali du 20/11 : (1) première séance d'un exercice sans historique : contrôle de vraisemblance en multiple du poids de corps (PDC)
par type d'exercice, même dialogue « Confirmer / Corriger » ; (2) une hausse > 150 % confirmée ne devient la référence qu'après une deuxième
séance complète (comportement existant, validé). « Sans historique » : aucune série de travail retenue dans les séances closes de l'exercice
(le contrôle relatif n'a pas de référence). Plafonds proposés (constantes `PLAUSIBILITY_CONFIG`, `src/domain/training/config.ts`,
révisables par Ali) : bas du corps 3,5 × PDC, haut du corps 2,5 × PDC, isolation 1,2 × PDC, assisté : assistance < 1,0 × PDC ; PDC
inconnu : 300 / 200 / 100 kg, assistance 120 kg ; haltères : moitié du plafond du type, par haltère (un ou deux haltères tenus).

| # | Critère (Given / When / Then) | Test |
| --- | --- | --- |
| 11 | Type : matériel `assisted-pull-up-machine` → assisté (prioritaire) ; `kind` isolation → isolation ; composé dont le muscle principal (poids le plus fort) est du bas du corps, ou de pattern squat / hinge / lunge → bas ; autre composé → haut. Catalogue : squat, soulevé de terre, rack pull → bas ; développé couché, rowing → haut ; curl, mollets → isolation ; traction assistée → assisté. Un exercice personnalisé suit les mêmes champs. | `plausibility.test.ts` « type » |
| 12 | Given PDC 80 kg et aucun historique, When Ali valide une série de travail, Then question au-delà de 280 kg (bas), 200 kg (haut), 96 kg (isolation) ; au plafond : sans question ; 0,5 kg au-dessus : signalé. | `plausibility.test.ts` « PDC connu » |
| 13 | Given PDC 80 kg, assisté, Then une assistance de 79,5 kg passe, 80 kg (≥ PDC, absurde) est signalé. | `plausibility.test.ts` « assisté » |
| 14 | Given PDC inconnu, Then plafonds absolus 300 / 200 / 100 kg (au plafond : rien ; au-dessus : signalé) ; assistance > 120 kg signalée. | `plausibility.test.ts` « PDC inconnu » |
| 15 | Given des haltères (charge saisie par haltère), Then plafond moitié du type : 140 / 100 / 48 kg par haltère à PDC 80, 150 / 100 / 50 kg sans PDC. | `plausibility.test.ts` « haltères » |
| 16 | Given un exercice lesté (PDC × fraction), PDC connu, Then la charge totale (PDC × fraction + lest) est comparée ; PDC inconnu : le lest contre le plafond absolu. | `plausibility.test.ts` « lesté » |
| 17 | Given un historique avec au moins une série de travail retenue, Then pas de contrôle de vraisemblance (le relatif s'applique) ; hors série de travail, charge vide, charge déjà validée dans la séance : rien. | `plausibility.test.ts` « historique » |
| 18 | Testing Library, base réelle, développé couché sans historique, PDC 80 kg : 201 kg × 5 → « 201 kg : c'est plus de 2,5 fois ton poids de corps… », rien d'écrit ; « Corriger » n'écrit rien, focus sur la charge ; « Confirmer » écrit 201 kg ; 200 kg écrit sans question ; PDC inconnu : 201 kg signalé (200 kg au plus) ; traction assistée à 80 kg d'assistance signalée. | `session/FixAberrPlausible.test.tsx` |
| 19 | Point 2 figé : 100 kg puis une séance complète à 200 kg (confirmée à la saisie) → référence 100 kg ; une deuxième séance complète à 200 kg → référence 200 kg. | `fixAberr.test.ts` « point 2 » |

### Suite du 20/11 : passe agent du module (choix)

- `plausibilityClass` (`outlierEntry.ts`, pur) : assisté (`assisted-pull-up-machine`, prioritaire), isolation (`kind`), bas si muscle
  principal (poids le plus fort) du bas du corps ou pattern squat / hinge / lunge (rack pull, good morning, extension lombaire restent bas),
  sinon haut. Données existantes seulement (aucun champ de contenu ajouté) ; un exercice personnalisé suit les mêmes champs.
- `entryImplausible` : appliqué seulement sans série de travail retenue dans l'historique clos (le relatif `entryOutlier` a priorité) ;
  plafond = multiple × PDC, × 0,5 par haltère (un ou deux haltères tenus : la charge saisie est celle d'un haltère, ERGO-02) ; PDC inconnu ou
  ≤ 0 : plafond absolu (× 0,5 par haltère). Lesté de PDC connu : charge totale (PDC × fraction + lest) ; inconnu : lest. Seuil inclus non
  signalé, sauf assisté de PDC connu (assistance ≥ PDC signalée, absurde). Une question par charge : rien si une charge égale ou plus forte
  est déjà validée dans la séance.
- `PLAUSIBILITY_CONFIG` (`config.ts`) : constantes nommées, une par type, hors `ProgressionConfig` ; aucune prescription ne change,
  `ENGINE_VERSION` reste 3 (D-284).
- `outlierCheck.ts` : lit le PDC à chaque contrôle (`bodyweightNow`, échec = inconnu) ; `OutlierAsk` devient une union (`relative` /
  `plausible`) ; métrique `bodyweight-reps` désormais contrôlée (défaut trouvé : `pull-up-assisted` et `pull-up` ont cette métrique,
  le contrôle de la première passe ne s'appliquait donc jamais à la traction assistée du catalogue). `SetRow` : `outlierText`, cinq textes
  `sessionPlausibleAsk*` dans `fr.training.ts` (catalogue de la séance active, hors départ).

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

### Suite du 20/11 : passe qa-test

- Cas limites ajoutés (vert) : historique d'assisté dont toutes les assistances atteignent le PDC (ne compte pas, contrôle appliqué) ; part par
  haltère jamais appliquée à un assisté ; exercice personnalisé (isolation sur machine d'assistance → assisté, pattern lunge sans muscle →
  bas, carry → haut) ; configuration révisée fournie par l'appelant ; UI : après « Confirmer », même charge sans nouvelle question ;
  « Corriger » puis même charge : la question revient.
- Retouches de tests dans le commit vert (pas de règle changée) : libellé « Charge par haltère (kg) » accepté pour le curl aux haltères
  (ERGO-02), typage du catalogue dans `plausibility.test.ts`.
- Vérifications : `src/domain/training`, `src/features/training/session`, Ergo02Load, `src/i18n` : 95 fichiers, 1 015 tests verts (avant
  les cas qa-test), puis `plausibility.test.ts` + `FixAberrPlausible.test.tsx` : 33 verts ; couverture `outlierEntry.ts` 97,2 %
  instructions, 96,7 % branches, 100 % lignes ; `tsc --noEmit` et `eslint` sur les fichiers touchés : propres.

## Passe code-reviewer

- Relu à froid : commentaire de `personalRecords` déplacé au-dessus de la fonction ; rejet du chargement du bloc de contrôle intercepté dans
  `SetRow` (la saisie n'est jamais bloquée). Aucun autre écart.

### Revue 1 (relecture à froid de l'appelant, 20/11) : constats et corrections

1. Régression : `personalRecords` (`closure.ts`) et `sheetRecord` (`exerciseSheet.ts`) appelaient `analyzeHistory` sans poids de corps :
   pour un lesté, repérage sur le lest seul (lest 5 puis 10 kg × 8 : aucune question à la saisie, mais 10 kg écarté des records, sans
   signal). Corrigé au plus prudent : exercice lesté (catalogue `CATALOG_BODYWEIGHT_LOAD_IDS`, gardé aligné par un test ; personnalisé par
   `bodyweight_fraction` > 0, lu dans la même requête que le matériel, `traitsFor`) : aucun repérage d'aberrante pour les records (le poids
   de corps n'est pas lu par le résumé ni par la fiche). Tests `fixAberr.test.ts` « revue 1 », `workoutClosure.test.ts` « revue 1 ».
2. Garde DOC-PRIV : l'assouplissement `20ef6ac5` est annulé (forme au tutoiement à nouveau refusée sur tous les fichiers) ;
   `FixAberrPlausible.test.tsx` interpole le poids de corps synthétique (`BODY_KG`, `BODY`), aucun chiffre littéral après « ton poids de corps ».
3. SHA de la fiche : ceux de l'ancien historique (avant HIST-01) remplacés par les ancêtres réels de HEAD.
4. Suggestions faites : `outlierCheck.ts` lit `isAssistedEquipment` ; `prescribe.test.ts` « charge aberrante » revient à `toEqual` sur la liste
   exacte des raisons (`outlier-excluded`, `history-reference`, `top-reached`). Non faite (plus qu'un petit changement, reste) : dater une
   séance passée du résumé par `ended_at` et exclure les décharges de la confirmation (D-323 (2)) demande que `historyFor` renvoie
   `ended_at` et l'indicateur de décharge avec chaque série (type de retour du repository changé, relecture data-model).

### Relecture data-model de `historyFor` (revue 1)

Toutes les séries non supprimées des séances closes antérieures, pour les exercices de la séance : jointure `workout`, filtre
`s.exercise_id IN (…)` servi par l'index `idx_workout_set_exercise`, lots de 400 identifiants ; coût modéré (lu à la clôture et au résumé
seulement), accepté ; `traitsFor` ajoute la colonne `bodyweight_fraction` à la lecture existante de `exercise`. Aucun schéma, aucune migration.

### Relecture accessibility-i18n (passe distincte) : `sessionPlausibleAsk*`, `sessionOutlierAsk*`

Tutoiement constant (« ton poids de corps », « Confirme », « corrige ») ; aucune heure ; nombres au format français (`formatNumber` :
« 2,5 », « 0,6 », « 48,5 kg », « 2 × 48,5 kg ») ; « fois » invariable, aucun pluriel variable (garde `plural.test.ts`) ; question en
`role="alert"`, sens porté par le texte et les boutons « Confirmer » / « Corriger » (composant `Button` du système), jamais par la couleur
seule ; textes dans `fr.training.ts` (catalogue de la séance active, hors départ). Remarque non bloquante : « {percent} % » utilise une espace
ordinaire (coupure de ligne possible avant « % ») ; une espace insécable fine serait plus juste, à traiter avec la charte typographique.
Résultat : conforme.

## Risques et restes

- C-028 seconde partie non traitée : une faute à la TOUTE première séance n'a pas de référence (ni à la saisie ni au moteur) et pèse sur le
  1RM ; piste : comparer rétroactivement à la séance complète suivante (règle hors PRD, à trancher par Ali).
- Une vraie progression > 150 % (charge de calibration très prudente) n'est reprise qu'après une deuxième séance complète : prescription plus
  basse une séance (prudent, modifiable par Ali, la modification devient la référence).
- Le résumé de fin traite les séances de décharge comme ordinaires pour la confirmation des records.
- Texte « à ce nombre de répétitions » : formulation sans pluriel variable (garde `plural.test.ts`), relecture accessibility-i18n à faire.

- Vraisemblance (20/11) : plafonds proposés, faux positifs prévisibles chez un pratiquant fort à sa toute première séance (presse à cuisses
  > 280 kg, hip thrust, shrugs ou mollets machine > 96 kg à PDC 80) : une question, « Confirmer » suffit, une fois par charge et par séance.
- Traction assistée du catalogue (`bodyweightFraction` null) : le contrôle RELATIF reste inactif (D-322 lit la fraction) ; seule la
  vraisemblance s'applique. À trancher avec FIX-ASSIST si Ali le souhaite.
- PDC lu à chaque validation de série de travail (une lecture de plus, échec = inconnu).
- Lesté : aucune aberrante repérée pour les records (résumé, fiche) ; une faute de frappe de lest confirmée à la saisie peut devenir un record.
- Résumé de fin : séance passée datée par sa dernière série validée, décharges comptées ordinaires (revue 1, point 4, reste).

## SHA

- Rouge : `f560ac6c` (14 tests rouges, `outlierEntry.test.ts` rouge à l'import). Vert : `c3c35244`. Passes qa-test et revue : `a88a4d53` ;
  point d'étape : `915a3a80` ; intégrations de main : `0d850d48` (FIX-ASSIST #157), `5b6db1cf` (HIST-01).

- Suite du 20/11 : rouge `de2ae9ba` (25 tests rouges : `plausibility.test.ts` rouge à l'import, 6 de `FixAberrPlausible.test.tsx` ; les
  vecteurs « au plafond, sans question » et le point 2 verts dès le rouge, gardes). Vert : `636085a9`. Passe qa-test et fiche : `74d4927e`. Décisions D-323 et D-325 inscrites par l'appelant : `18836475`.
- Revue 1 : rouge `fc1032d5` (5 tests rouges : lesté au résumé, à la fiche, au résumé par le repository, alignement du catalogue) ;
  garde DOC-PRIV rétablie (annule `20ef6ac5`) : `6ba4fe2d` ; vert : `d41a2b43` ; fiche et vérifications (73 fichiers, 832 tests verts : `src/domain/training`, `src/features/training/session`, `workoutClosure`, `privacy` ; `tsc` et `eslint` propres) : commit suivant.

## Budget (D-324)

Budget M (150 k) déjà dépassé à la première passe (≈ 210 k) ; suite du 20/11 ≈ 75 k de plus, soit ≈ 285 k cumulés, sous l'arrêt de 300 k
(D-324, décision d'Ali du 20/11 : consigner et continuer). Pas de point d'étape supplémentaire ; il reste les étapes de reprise ci-dessous.

## Décisions : D-323 et D-325 (docs/decisions.md)

D-323 — FIX-ABERR (0.28.0) : charge aberrante (audit Claude 0.27.0, C-005, C-028, C-168 ; § 11.2 point 1, § 11.5 ; remplace le choix B1 de la
PR #60). (1) À la validation d'une série de travail, une charge > 150 % (`outlierRatio`) de la charge habituelle (1RM courant ramené aux
répétitions, sinon plus grande charge de travail) n'est écrite qu'après « Confirmer » ; « Corriger » n'écrit rien. Sans historique : bornes
absolues seules. (2) Aucun indicateur persistant (schéma 20 inchangé) : une aberrante n'est confirmée que par une séance ultérieure
complète (≥ 50 %) hors décharge qui l'atteint à 90 %. (3) Non confirmée, elle n'est ni la référence (dernière séance non aberrante, note
dite), ni dans le 1RM, ni un record (fiche, résumé). (4) Assisté : poids de corps connu, assistance anormalement basse signalée ; inconnu,
aucun contrôle relatif. (5) `ENGINE_VERSION` reste 3. Tests : `outlierEntry.test.ts`, `fixAberr.test.ts`, `session/FixAberr.test.tsx`. Point (2) validé par Ali le 20/11 (test `fixAberr.test.ts` « point 2 »).


D-325 — FIX-ABERR (0.28.0), vraisemblance à la première séance (décision d'Ali du 20/11 ; § 11.5 ; complète D-323). (1) Sans série de
travail retenue dans l'historique clos d'un exercice, une série de travail au-delà du plafond de son type n'est écrite qu'après « Confirmer »
(« Corriger » n'écrit rien). (2) Type tiré du catalogue (personnalisé : mêmes champs) : assisté (machine d'assistance) ; isolation (`kind`) ;
composé du bas (muscle principal du bas du corps ou pattern squat / hinge / lunge) ; composé du haut. (3) Plafonds `PLAUSIBILITY_CONFIG` :
bas 3,5 × PDC, haut 2,5 × PDC, isolation 1,2 × PDC ; assisté : assistance ≥ 1,0 × PDC signalée ; PDC inconnu : 300 / 200 / 100 kg,
assistance > 120 kg ; haltères : moitié du plafond, par haltère ; lesté de PDC connu : charge totale. Seuil inclus non signalé (sauf
assisté). (4) Une question par charge et par séance ; aucun indicateur persistant ; `ENGINE_VERSION` reste 3. Choix prudents, révisables
par Ali. Tests : `plausibility.test.ts`, `session/FixAberrPlausible.test.tsx`.

## Point d'étape (arrêt pour dépassement de budget)

Budget M (150 k) dépassé par l'agent du module (≈ 210 k tokens) : arrêt et point d'étape (docs/LOT-0.28.0.md, cadre). Branche poussée sans PR.
À la reprise : (1) intégrer origin/main (FIX-ASSIST #157, D-322) et résoudre les conflits attendus dans `prescribe.ts`, `closure.ts`, `exerciseSheet.ts` ; (2) inscrire la décision proposée ci-dessus (D-323) ; (3) relecture data-model de `historyFor` (`workoutRepository.ts`, toutes les séries non supprimées lues) et relecture sync-icloud (repository touché, D-26) ; (4) passe code-reviewer à froid sur le diff fusionné ; (5) test:bundle, push, PR, CI verte, fusion ; puis FIX-A008 (brief prêt hors dépôt : `C:\Dev\spartiate\.codex-tmp\lot028\brief-FIX-A008.md`).
