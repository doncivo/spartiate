# SUIVIS-029 — suivis complémentaires : pas, zone 2, notes sur 10, VISBODY (lot 0.29.0, PROG-02)

Statut : code et tests verts en local (branche SUIVIS-029, non poussée, sans PR) ; constats d’Ali à faire. Budget M à L. Modules : recovery (pas, notes), training (cardio, zone 2),
nutrition / corps (VISBODY), data-model (aucune migration, voir « Données »).
Chapitres : PRD § 16 (récupération ; les notes n'y entrent pas), § 17.1 (indicateurs de Progrès, Corps), § 18.4 (charte), § 20.2
(modèle de données, `measurement`), § 21 (export / import), § 26.2 (H-25). Décisions citées : D-113 (genres de mesure sans migration,
précédent I6-04), D-99 (Corps publié), D-55 (réglages non publiés), D-220 à D-224 (cardio), D-292 (usage réel : fixtures synthétiques),
D-410 (aucun fournisseur d'IA).

## Passe product-owner : critères

### a — objectif de pas (SUIVIS-029a)

- A-1 (réglage) — Given Progrès › Suivis, When Ali règle l'objectif quotidien (1 000 à 50 000 pas, entier), Then il est gardé dans le
  réglage local `today.prefs` (défaut 8 000) ; une saisie hors bornes ou illisible est refusée avec sa plage, rien n'est écrit.
- A-2 (Aujourd'hui) — Given l'iPhone et un total de pas du jour dans `pas.csv` importé, When Aujourd'hui s'affiche, Then la carte
  « Suivis du jour » dit « 6 500 / 8 000 pas (81 %) » et une barre (doublée du texte, jamais la couleur seule) ; objectif atteint : « objectif
  atteint ». Carte chargée à la demande (bundle de départ non augmenté).
- A-3 (raison, H-25 UNVERIFIED) — Given aucun `pas.csv` jamais lu (absent ou illisible), ou un fichier lu sans total pour aujourd'hui, ou une
  lecture impossible, ou le PC (pas locaux à l'iPhone, non publiés), When la carte s'affiche, Then la valeur est « — » suivie de sa raison,
  jamais 0.
- A-4 (Progrès) — Given des totaux par jour, When Progrès › Suivis s'ouvre, Then la moyenne hebdomadaire des 4 dernières semaines (du lundi)
  est affichée sur les jours connus (« moyenne sur n jours connus »), avec le nombre de jours à l'objectif ; semaine sans pas : « — ».

### b — cardio en zone 2 (SUIVIS-029b)

- B-1 (FC max) — Given une FC max saisie (100 à 230 bpm), Then elle prime ; sinon, Given l'année de naissance du profil, Then FC max =
  220 − (année courante − année de naissance) ; sinon « — » avec la raison (« renseigne ton année de naissance ou ta FC max »).
- B-2 (zone) — Zone 2 = [arrondi(60 % FC max) ; arrondi(70 % FC max)] bpm, bornes incluses, affichée avec sa règle.
- B-3 (minutes) — Given les séances cardio (saisies ou GPS, `cardio_session`), When la semaine est calculée, Then une séance dont la FC moyenne
  est dans la zone compte pour toute sa durée ; une séance hors zone compte 0 ; une séance sans FC moyenne n'est jamais comptée et elle est
  dite (« n séances sans FC moyenne ») ; minutes par semaine (du lundi) sur 4 semaines, face à l'objectif hebdomadaire réglable (10 à 1 200
  min, défaut 150).
- B-4 (Progrès) — Given Progrès › Suivis, Then la section Zone 2 dit la FC max et sa source, la zone, les minutes par semaine et l'objectif ;
  sans FC max : « — » et la raison, aucune minute inventée.

### c — notes sur 10 (SUIVIS-029c)

- C-1 (un geste) — Given Aujourd'hui, When Ali touche un chiffre de 1 à 10 sur « Fatigue » ou « Qualité du sommeil », Then la note du jour
  est enregistrée aussitôt (boutons ≥ 44 pt, nom accessible « Fatigue : 7 sur 10 », état pressé) ; facultatif, jamais bloquant.
- C-2 (une fois par jour, modifiable le jour même) — Given une note déjà saisie aujourd'hui, When Ali touche un autre chiffre, Then elle est
  remplacée (une ligne par jour et par note) ; « Effacer » la retire ; les jours passés ne se modifient pas depuis Aujourd'hui.
- C-3 (Progrès) — Given des notes, When Progrès › Suivis s'ouvre, Then deux courbes sur 30 jours (jour sans note : courbe coupée, jamais 0),
  moyenne et nombre de jours notés.
- C-4 (aucun effet sur la récupération) — Given des notes, Then le moteur de récupération (`src/domain/recovery`) ne les lit pas : Recovery,
  Exertion, besoin de sommeil et modulation sont inchangés (test d'architecture et de vecteur).

### d — mesures VISBODY (SUIVIS-029d)

- D-1 (saisie) — Given Progrès › Corps, When Ali saisit un bilan VISBODY (date, poids, masse grasse %, masse musculaire, graisse viscérale,
  eau, métabolisme de base, masse maigre et masse grasse par segment si présentes), Then chaque champ est facultatif (au moins un), borné
  (bornes plausibles du domaine, refus avec la plage), date ni future ni impossible ; réenregistrer la même date remplace le bilan (un champ
  vidé est retiré).
- D-2 (courbes et écart) — Given au moins un bilan, Then chaque mesure présente montre sa dernière valeur, sa courbe et l'écart au bilan
  précédent qui la porte (« +0,4 kg depuis le 02/11/2026 ») ; un seul bilan : « premier bilan », jamais un faux zéro.
- D-3 (poids séparé) — Given un poids VISBODY, Then il n'entre PAS dans les pesées ni dans la tendance de poids (aucune écriture
  `body_weight`).
- D-4 (données corporelles) — Jamais envoyées, jamais journalisées (aucune valeur dans un journal technique) ; publiées comme les
  mensurations (`measurement`, D-99), exportées et réimportées avec leur unité.

### Communs

- Bundle de départ jamais augmenté (mesure normalisée de fin ≤ début) ; textes dans `src/i18n/fr.tracking.ts` (chargé avec les blocs) ;
  jetons seulement ; fixtures synthétiques.

## Données (passe data-model)

Aucune migration, aucune table nouvelle : précédent D-113 (I6-04). Les notes et les bilans VISBODY sont des GENRES nouveaux de la table
publiée `measurement` (identifiant naturel `measurement|AAAA-MM-JJ|genre`, fusion par HLC, valeurs masquées du journal des conflits) :
`note_fatigue`, `note_sleep` (score 1 à 10) et `visbody_*` (unité dans le nom ; métabolisme de base en décakilocalories,
`visbody_bmr_dakcal`, la colonne `value` étant bornée à moins de 1 000 par le CHECK de la 0012). Catalogue `src/domain/sync/syncTables.ts`
NON modifié ; `src/sync/**` non touché. Export : unité par genre dans `contenu.json` et le CSV (FIX-0173). Réglages des objectifs : clé
LOCALE `today.prefs` (`settings` non publiés, D-55).

## Passes (agent du module, qa-test, code-reviewer)

| Sous-ticket | Rouge | Vert |
| --- | --- | --- |
| a — pas | 9597f522 | fef49b57 |
| b — zone 2 | fc8c81b4 | c3b1688e |
| c — notes sur 10 | 41dee499 | 30eea60d |
| d — VISBODY | 10058bd1 | ffd843f1 |

Puis f0f57895 (mesure du bundle : clé `today.prefs` placée, notes écrites dans `measurements.ts` pour ne pas créer de bloc partagé ; copie
réduite de la courbe et des règles CSS dans le bloc Corps pour la même raison) et 761caa5f (qa-test : bornes exactes, semaine du lundi, âge
limite, séparation des genres ; aucun défaut trouvé).

- Agent du module : règles pures `src/domain/tracking` (objectifs, pas, zone 2, notes réexportées) et `src/domain/bodyProgress/visbody.ts` ;
  écrans `src/features/tracking` (carte « Suivis du jour » à la demande depuis Aujourd'hui, Progrès › Suivis à la demande depuis Progrès) et
  `src/features/bodyProgress/VisbodySection.tsx` (dans Progrès › Corps) ; catalogues `fr.tracking.ts`, `fr.visbody.ts`.
- qa-test : `tracking.qa.test.ts`, test de séparation des genres ; gardes `plural.test.ts` et `unusedKeys.test.ts` vertes (trois familles
  construites de `fr.tracking.ts`, deux de `fr.visbody.ts`, déclarées au WHITELIST).
- code-reviewer (relecture à froid du diff) : aucune lecture de note par `src/domain/recovery` ni par l'import Raccourcis (test C-4) ; aucune
  écriture `body_weight` ; aucune valeur dans un journal ; `src/sync/**` et `src/domain/sync/**` non touchés ; dataReset : `today.prefs`
  effacé à « Repartir de zéro », comme les objectifs de nutrition.
- Vérifications locales : `tsc` propre ; eslint propre sur tous les fichiers touchés ; 52 fichiers de tests ciblés verts (695 tests) ;
  bundle de départ 193 879 octets normalisés au début, 193 878 à la fin.

## Décisions proposées (sans numéro, révisables par Ali)

1. Pas : objectif quotidien par défaut 8 000 (1 000 à 50 000), réglage LOCAL `today.prefs` (non publié, D-55 : à régler sur chaque appareil) ;
   source `pas.csv` seule (H-25 reste UNVERIFIED) ; raisons de « — » : PC, jamais lu (absent ou illisible), sans total du jour, lecture
   impossible. Moyenne hebdomadaire sur les jours connus, semaines du lundi, 4 semaines.
2. Zone 2 : FC max saisie (100 à 230) prioritaire, sinon 220 − (année courante − année de naissance) ; zone = arrondi de 60 % à 70 % de la
   FC max, bornes incluses ; une séance cardio compte pour TOUTE sa durée si sa FC moyenne est dans la zone, 0 sinon ; sans FC moyenne :
   non comptée et dite. Objectif hebdomadaire par défaut 150 min (10 à 1 200).
3. Notes sur 10 : fatigue (1 = pas fatigué, 10 = épuisé) et qualité du sommeil (1 = très mauvaise, 10 = excellente), une par jour, modifiables
   le jour même, PUBLIÉES (genres `note_*` de `measurement`) ; AUCUN effet sur la récupération (choix prudent).
4. VISBODY : genres `visbody_*` de `measurement` (16 : poids, masse grasse, masse musculaire, graisse viscérale, eau en kg, métabolisme de base
   saisi en kcal et stocké en décakilocalories, masses maigre et grasse de 5 segments), PUBLIÉS comme les mensurations ; le poids d'un bilan
   n'entre PAS dans les pesées ni dans la tendance.
5. Aucune migration : précédent D-113. Conséquence : une version antérieure à 0.29.0 qui reçoit ces genres (synchro) les garde sans les
   afficher, mais refuse une archive d'export qui en contient (genre inconnu) : mettre à jour le PC et l'iPhone le même jour.

## Constats à faire par Ali

- Pas : avec `pas.csv` lu, la carte « Suivis du jour » montre « n / 8 000 pas » ; sans fichier, « — » et la raison (H-25 non constaté).
- Zone 2 : une séance cardio saisie avec une FC moyenne dans la zone apparaît en minutes dans Progrès › Suivis.
- Notes : un geste sur Aujourd'hui (iPhone et PC), puis la courbe dans Progrès ; la note saisie sur un appareil arrive sur l'autre.
- VISBODY : un bilan saisi dans Progrès › Corps, courbe et écart au bilan suivant ; vu sur l'autre appareil après synchro.

## Écarts au brief

- Aucune table nouvelle (genres de `measurement`, D-113) : `syncTables.ts` intact, la table `measurement` était déjà publiée ; relecture
  sync-icloud non requise par D-26 (aucun fichier de synchro touché), mais le contenu publié s'enrichit de genres nouveaux : à signaler.
- Rouge de 029a : le test de bundle ajouté avait une expression régulière mal échappée (erreur de typage), corrigée dans le vert ; le helper
  `fr()` du test des pas normalise les espaces comme Testing Library (corrigé dans le vert). Rouge de 029d : `bodyWeights().list()` corrigé
  en `listRecent(10)` (méthode réelle du dépôt) dans le vert.
- Réglages des objectifs dans Progrès › Suivis (pas dans Plus) ; mesure du bundle obtenue en nommant la clé `today.prefs` (placement choisi).
- Branche partie de c107a876 : `main` a reçu REPAS-029 depuis (pas de fusion faite ici, comme demandé).

## Relecture sync-icloud et à froid

Verdict : approuvé avec réserves ; réserves levées ci-dessous (rouge avant vert, sauf le test de garde).

1. Synchro des genres nouveaux : `tests/unit/sync/i6/trackingKindsSync.test.ts` (c334da76). Un iPhone insère en SQL `visbody_bmr_dakcal` = 178.3
   et `note_fatigue` = 1, comme une 0.29.0. Le PC reçoit des lignes identiques ; `sync_unknown` et `sync_parked` restent vides ; les cycles
   se font sans erreur ; `list()` sans genre ne rend que les zones. Test de garde, vert par construction (catalogue et table inchangés).
2. Préremplissage VISBODY sans arrondi : rouge 66b28ca2, vert 7ed19142. 72,45 kg reste 72,45 quand on corrige un autre champ ; l'arrondi au
   dixième ne sert plus qu'à l'affichage des courbes et des écarts.
3. Échec de lecture des suivis : rouge 79889553, vert fe2a843b. Sur Aujourd'hui et dans Progrès, un échec de lecture s'affiche (alerte et
   « Réessayer ») : plus de promesse sans gestionnaire de rejet. Les objectifs illisibles ne retombent plus en silence sur les valeurs par défaut.
4. Consigné (comme D-113) : une 0.28.1 qui a reçu ces genres par la synchro produit un export complet qu'elle refuse elle-même à
   l'import (genre inconnu) ; la 0.29.0 importe cet export sans perte.

Contrôles : `plural.test.ts` et `unusedKeys.test.ts` verts. Bundle de départ : 193 878 octets normalisés, sous les 193 879 du début.
