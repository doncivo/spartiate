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
- **C-9 (hypothèse)** La qualité de l'OCR sur un programme réel est l'hypothèse H-40 (PRD § 26.2) et une ligne UNVERIFIED de `docs/capability-matrix.md`, à constater par Ali.

Hors périmètre : fournisseur d'IA (D-410), Hevy / Strong (D-415), PDF (aucune voie existante), création d'un exercice personnalisé depuis l'import (le sélecteur existant suffit), prescription des charges (aucune charge importée : la charge de départ reste saisie par Ali, D-72).

### 2. Agent du module (training, domain-logic, ios-mobile)

(à compléter en fin de ticket)

### 3. qa-test

(à compléter)

### 4. Fin de fiche

(à compléter)
