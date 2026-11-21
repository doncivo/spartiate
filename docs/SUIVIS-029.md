# SUIVIS-029 — suivis complémentaires : pas, zone 2, notes sur 10, VISBODY (lot 0.29.0, PROG-02)

Statut : en cours (branche SUIVIS-029, non poussée, sans PR). Budget M à L. Modules : recovery (pas, notes), training (cardio, zone 2),
nutrition / corps (VISBODY), data-model (aucune migration, voir « Données »).
Chapitres : PRD § 16 (récupération ; les notes n'y entrent pas), § 17.1 (indicateurs de Progrès, Corps), § 18.4 (charte), § 20.2
(modèle de données, `measurement`), § 21 (export / import), § 26.2 (H-25). Décisions citées : D-113 (genres de mesure sans migration,
précédent I6-04), D-99 (Corps publié), D-55 (réglages non publiés), D-220 à D-224 (cardio), D-292 (usage réel : fixtures synthétiques),
D-410 (aucun fournisseur d'IA).

## Passe product-owner : critères

### a — objectif de pas (SUIVIS-029a)

- A-1 (réglage) — Given Progrès › Suivis, When Ali règle l'objectif quotidien (1 000 à 50 000 pas, entier), Then il est gardé dans le
  réglage local `tracking.goals` (défaut 8 000) ; une saisie hors bornes ou illisible est refusée avec sa plage, rien n'est écrit.
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
LOCALE `tracking.goals` (`settings` non publiés, D-55).
