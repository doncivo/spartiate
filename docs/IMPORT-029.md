# IMPORT-029 — Import d'un programme collé ou photographié (lot 0.29.0, IA-0b, I6-08 compris)

Itération : I6 | Taille : L | Version : 0.29.0 | Schéma : inchangé, aucune migration | Modules : training, domain-logic, ios-mobile (OCR existant, aucun Swift nouveau)
Chapitres : 17 (§ 17.4), 14 (§ 14.1, bibliothèque), 12 (§ 12.5, routine ordinaire), 18 (§ 18.4, écrans), 19 (OCR d'un programme papier, D-200), 26 (§ 26.2).
Décisions citées : D-200 (OCR natif conservé pour l'import de programme), D-410 (aucun fournisseur d'IA), D-415 (pas d'import Hevy / Strong).

> Aucune donnée réelle lue ni écrite (D-38) ; programmes des tests et du guide inventés. Le texte collé et l'image ne quittent jamais l'appareil (aucune API).

## Passes

### 1. product-owner — critères Given / When / Then

- **C-1 (bloc structuré)** Étant donné le bloc JSON du guide `docs/guide-import-programme.md` (`{name?, sessions:[{name, exercises:[{name, sets, repsMin, repsMax, rir?}]}]}`, § 17.4), éventuellement entouré de texte ou d'une clôture de code, quand Ali le colle, alors chaque séance et chaque exercice sont lus tels quels ; un exercice au champ manquant ou hors bornes (séries 1 à 20, répétitions 1 à 999, min ≤ max, RIR 0 à 5) est montré avec sa raison, jamais écarté en silence ; un JSON illisible est dit tel quel.
- **C-2 (lignes libres)** Étant donné des lignes « Squat 4×8-10 », « Curl 3 x 12 », « Rowing 4x8 RIR 2 », « Développé couché : 3 séries de 10 », « 3 séries de 8 à 10 répétitions », « Gainage 3 x 30 s », « repos 90 s », des puces ou numéros en tête, quand Ali les colle, alors chaque ligne donne un exercice (séries, plage, RIR, repos facultatif) ; « Jour A — Poussée », « Séance 1 », « # Haut », « Pectoraux : » ouvrent une séance ; un nom seul suivi d'une ligne « 3 x 12 » forme un exercice (lecture d'une photo en colonnes) ; « RIR 2 » seul s'applique à l'exercice précédent.
- **C-3 (rien d'ignoré)** Étant donné une ligne non reconnue (aucune série × répétitions, séries sans nom, valeur hors bornes, RIR orphelin), quand l'aperçu s'affiche, alors elle est montrée telle quelle, avec son numéro et sa raison en français ; une partie de ligne non lue (« tempo 3-1-1 ») est montrée sous l'exercice.
- **C-4 (rapprochement)** Étant donné les noms lus, quand l'aperçu s'affiche, alors chaque nom est rapproché de la bibliothèque (embarqués et personnels actifs) après normalisation (accents, casse, articles, pluriels, synonymes simples : haltère / dumbbell / db, barre / barbell, poulie / câble, DC, RDL…) avec un score de 0 à 1 : score ≥ 0,85 et 0,05 d'avance sur le suivant = proposé (présélectionné, modifiable) ; entre 0,5 et ce seuil = choix parmi les 3 meilleurs ; en dessous = « à choisir » dans le sélecteur de la bibliothèque existant. Le calcul est déterministe et pur (`src/domain/training/programImport.ts`).
- **C-5 (aperçu, confirmation)** Étant donné l'aperçu complet (nom de routine modifiable, séances, exercices rapprochés, séries, plage, RIR, lignes non reconnues), quand un exercice n'a pas d'exercice de la bibliothèque, alors « Créer la routine » reste indisponible avec la raison ; Ali peut retirer un exercice de l'import ; rien n'est écrit avant « Créer la routine ».
- **C-6 (création)** Quand Ali confirme, alors une routine Libre est créée en une transaction par `trainingRoutines().create` (tables existantes, aucune migration), noms figés de la bibliothèque, repos lu sinon repos par défaut de l'exercice ; elle s'ouvre dans l'éditeur ordinaire, synchronisée comme toute routine.
- **C-7 (entrée)** Entraînement › Routines porte « Importer un programme » ; l'écran est un bloc à la demande avec son catalogue `fr.programImport`, hors du départ (assertion du test de bundle), bundle de départ jamais augmenté.
- **C-8 (photo, IMPORT-029b)** Étant donné l'iPhone (Vision) ou le PC (Windows.Media.Ocr), même façade `src/platform/ocr`, quand Ali choisit une photo ou une capture, alors les lignes lues remplissent le texte (modifiable) puis passent par le même analyseur ; moteur absent (navigateur) : « Lecture d'image disponible sur iPhone et sur PC » ; échec de lecture : raison dite, texte inchangé. L'image n'est jamais enregistrée. PDF : aucune voie sans dépendance nouvelle, reporté et dit.
- **C-9 (hypothèse)** La qualité de l'OCR sur un programme réel est l'hypothèse H-40 (registre provisoire de docs/decisions.md, chapitre 26 du PRD figé) et une ligne UNVERIFIED de `docs/capability-matrix.md`, à constater par Ali.

Hors périmètre : fournisseur d'IA (D-410), Hevy / Strong (D-415), PDF (aucune voie existante), création d'un exercice personnalisé depuis l'import (le sélecteur existant suffit), prescription des charges (aucune charge importée : la charge de départ reste saisie par Ali, D-72).

### 2. Agent du module (training, domain-logic, ios-mobile)

- **Domaine** : `src/domain/training/programImport.ts` (pur, hors du barreau `index.ts` : importé seulement par le bloc à la demande) : `parseProgramText` (bloc JSON ou lignes libres ; `rejected` avec numéro de ligne et raison ; notes `unread`, `seconds`, `rir-range`), `normalizeExerciseName`, `exerciseNameScore`, `matchExerciseName`, `importedRoutineSpec` (routine Libre, validée par `validateRoutine`). Bornes reprises de `routineRules.ts`.
- **Écran** : `src/features/training/import/ProgramImportView.tsx` (bloc à la demande ouvert par « Importer un programme » de `RoutinesView`), `PhotoReader.tsx` (029b), `ProgramImport.css` (tokens seuls) ; catalogue `src/i18n/fr.programImport.ts` et `programImportText.ts` ; clé `importProgram` dans `fr.training.ts`.
- **Données** : aucune migration, aucune table ; écriture par `trainingRoutines().create` dans `DataAccess.transaction` ; une routine ordinaire, synchronisée comme les autres (ni `src/sync/**` ni `src/domain/sync/**` touchés, relecture D-26 sans objet).
- **iPhone / PC** : façade `src/platform/ocr` existante (`openOcrService`), aucun Swift ni Rust ; sélecteur `<input type="file" accept="image/*">`, réduction à 2 000 px par canevas (image d'origine si non décodable). PDF : aucune voie sans dépendance nouvelle, reporté et dit à l'écran.
- **Guide** : `docs/guide-import-programme.md` (format, consigne à coller dans une conversation avec Claude, exemple inventé lu par les vecteurs).

### 3. qa-test

| Point | Rouge | Vert | Tests |
| --- | --- | --- | --- |
| IMPORT-029a (C-1 à C-7) | fa93a79e | 088e76ee | `src/domain/training/programImport.test.ts` (41), `src/features/training/import/ProgramImportView.test.tsx` (5), `tests/bundle/startBundle.test.ts` (3 assertions « hors du départ ») |
| IMPORT-029b (C-8) | 337d957e | 73c1a34e | `src/features/training/import/PhotoReader.test.tsx` (6, faux moteur `__CT_FAKE_OCR__` de la façade) |
| Cas limites | 3b9cd2fd | 6ba0ff07 | `src/domain/training/programImport.qa.test.ts` (19) : « 4 sets x 10 », tirets longs, retours chariot Windows, nom / ligne vide / schéma, orphelins, bornes du repos et du nom, JSON mal typé ; chaque exercice de la bibliothèque retrouvé par son nom ; mêmes mots dans un autre ordre (« de bas en haut » / « de haut en bas ») départagés |

Couverture de `programImport.ts` : 98,65 % des instructions, 95,47 % des branches. Bundle de départ normalisé : 193 879 octets au début, 193 879 à la fin (45 blocs). tsc et eslint propres sur tous les fichiers touchés.

Écart de contenu signalé à content-data (non corrigé, `content/**` hors périmètre) : « Extension de hanches à la poulie » (`cable-pull-through`) et « Extension de hanche à la poulie » (`cable-kickback`) ne diffèrent que par un pluriel ; l'import les propose donc toujours « à confirmer » (test qui le fige).

Revue (code-reviewer) : un échec après l'écriture (ouverture de l'éditeur) ne dit plus « rien n'a été enregistré » ; « Modifier le texte » puis une nouvelle analyse refait les choix (assumé : le texte a pu changer).

### 4. Fin de fiche

**Décisions proposées (numéros à donner par l'appelant, révisables par Ali)**

1. *Format du bloc structuré* : JSON `{name?, sessions:[{name?, exercises:[{name, sets, repsMin, repsMax?, rir?, restSec?}]}]}` (§ 17.4 plus `name` et `restSec` facultatifs) ; `repsMax` absent = `repsMin` ; lu entre la première `{` et la dernière `}`. Étant donné un bloc du guide, quand il est collé, alors il est lu tel quel ; preuve : C-1 (l'exemple du guide est lu par le test).
2. *Lignes libres* : titre = mot-clé en tête (Jour, Séance, Session, Day, Semaine, Entraînement, Workout, jour de la semaine, J1…), `#` en tête ou `:` final ; nom seul suivi d'une ligne « 3 x 12 » = un exercice ; RIR ou repos seul = exercice précédent ; plage de RIR : valeur haute retenue (plus de réserve) et dite ; repos sans unité = secondes ; aucun RPE converti en RIR (règle absente du PRD ; partie « non lue » montrée). Preuve : C-2, C-3, qa.
3. *Rapprochement* : normalisation (accents, casse, élisions, articles, pluriel en s / x hors -ss et -us, synonymes db / dumbbell → haltère, bb / barbell → barre, câble → poulie, kb, DC, DI, DM, OHP, RDL, SDT) ; score = 0,6 × recouvrement des mots (mots de 4 lettres et plus égaux dès 0,7 de ressemblance de bigrammes) + 0,4 × Dice des bigrammes des mots triés ; 1 seulement pour un nom identique dans le même ordre, 0,95 pour les mêmes mots dans un autre ordre ; meilleur score entre nom français et alias anglais. Seuils : **proposé** si score ≥ 0,85 et (nom identique unique, ou avance ≥ 0,05 sur le suivant) ; **à confirmer** (3 meilleurs) si score ≥ 0,5 ; **à choisir** (sélecteur de la bibliothèque) en dessous ; égalité départagée par l'identifiant. Preuve : C-4, qa.
4. *Création* : « Créer la routine » indisponible tant qu'un exercice gardé n'a pas d'exercice de la bibliothèque (ou que le nom est vide) ; retrait possible ; repos lu, sinon repos par défaut de l'exercice (borné à 0–900 s) ; aucune charge importée (D-72) ; aucun exercice personnalisé créé depuis l'import. Preuve : C-5, C-6.
5. *Photo* : même façade OCR sur l'iPhone et le PC (Windows.Media.Ocr existe : « disponible sur iPhone et sur PC » hors application installée) ; image réduite à 2 000 px, jamais enregistrée ; lignes ajoutées au texte existant ; PDF reporté (aucune voie sans dépendance nouvelle). Preuve : C-8.

**Hypothèse proposée** (registre provisoire de `docs/decisions.md` ; le chapitre 26 du PRD est figé, `scripts/release/prd-split.test.ts` refuse toute ligne nouvelle) : *H-40* — la lecture de texte native (Vision, Windows.Media.Ocr) rend un programme réel photographié ou capturé en lignes que l'analyseur comprend (noms lisibles, « 4 × 8-10 » sur la même ligne ou la suivante, ordre conservé) ; UNVERIFIED ; preuve attendue : constat d'Ali ; repli : bloc structuré du guide. Ligne UNVERIFIED ajoutée à `docs/capability-matrix.md` (numéro H-40 à confirmer : libre dans `main` et dans les branches du lot au 21/11).

**Constats d'Ali à faire** : (1) coller dans Entraînement › Routines › Importer un programme le bloc produit par Claude avec la consigne du guide, vérifier l'aperçu, créer la routine, la retrouver sur l'autre appareil après synchro ; (2) sur l'iPhone puis sur le PC, « Lire une photo ou une capture » sur la photo d'un programme papier et sur une capture d'écran : part des exercices lus sans retouche, lignes « non reconnues » (H-40).

**Écarts au brief** : H-n non inscrite au PRD § 26.2 (chapitre figé par test ; registre provisoire dans `docs/decisions.md`, que ce groupe n'écrit pas) ; PDF reporté ; « disponible sur iPhone » devenu « disponible sur iPhone et sur PC » (le PC a son OCR natif) ; pas d'e2e (CI seulement) ; budget L tenu.

## Relecture à froid (code-reviewer, agent distinct)

Verdict initial : à corriger (deux importants). Corrigés (rouge 39c11ee8, vert 2937c2bb) : la création est fermée pour de bon après l'écriture (une ouverture de l'éditeur en échec ne permettait plus une seconde routine) ; un bloc JSON très profond est refusé avec sa raison (`safeJson`) et l'analyse ne peut plus échouer en silence ; ligne de plus de 500 caractères refusée « trop longue » (expressions quadratiques sur de longues suites d'espaces), texte borné à 50 000 caractères ; « Jour 1 » vide suivi de « Jour 2 » reste une séance. Consignés : « 3 x 30 s » écrit en répétitions (guide, BL-127) ; H-40 au registre provisoire. Numéros : D-419 à D-423, H-40, BL-126 à BL-128.
