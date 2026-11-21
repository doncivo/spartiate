# MOTEUR-0281 — poids de corps et chronométrés, retour à une prescription antérieure, filtres de la bibliothèque (lot 0.28.1)

Groupe de trois sous-tickets (D-374 : une branche, une PR, un commit rouge puis un commit vert par sous-ticket). Phase 3, point 3.2 de
`docs/LOT-0.28.0.md`. Budget L (400 k). Modules : training et domain-logic. Chapitres : PRD § 11.1 à 11.6
(`docs/prd/11-moteur-de-progression-src-domain-training.md`), § 14.2 et 14.3 (`docs/prd/14-bibliotheque-d-exercices-et-profils-de-materiel.md`),
§ 13.2 (séance active, affichage de la proposition). Constats : C-189, C-191 (audit Claude 0.27.0, `tracabilite.md` lignes 11.3, 11.5, 14.2).

## Passe product-owner

### MOTEUR-0281a — § 11.3 « Sans charge » : poids de corps (reps puis lest), chronométrés (secondes)

Aujourd'hui `prescribe` rend « non prise en charge » pour toute métrique hors `load-reps` (`prescribe.ts:104`, figé par
`prescribe.test.ts:259`, C-189). Périmètre : métriques `bodyweight-reps` (45 exercices du catalogue) et `time` (5). Restent hors moteur :
`distance` (portés) et l'assisté du catalogue en `bodyweight-reps` (`pull-up-assisted`, choix FIX-ASSIST gardé par `fixAssist.test.ts`).

- A1 Given un exercice au poids du corps sans lest, dernière séance 3 × [10, 9, 8] (plage 8-12), When `prescribe`, Then échelle de
  répétitions (+1 sur la série 2 : 10 · 10 · 8), aucun lest, phrase « au poids du corps, une répétition de plus sur la série 2 ».
- A2 Given 3 × 12 au haut de la plage et des haltères (2 à 50 kg) ou une ceinture de lest dans le profil, When `prescribe`, Then lest du plus
  petit cran disponible (2 kg avec les haltères de la salle), répétitions ramenées au bas de la plage (3 × 8), raisons `top-reached` puis
  `ballast-added`, phrase « Lest +2 kg et retour à 8 répétitions ».
- A3 Given 3 × 12 au haut de plage et aucun matériel de lest (ni ceinture, ni haltère, ni gilet), Then aucune proposition de lest :
  une répétition de plus au-delà du haut de plage, raison `ballast-unavailable`, la phrase dit pourquoi.
- A4 Given un lest de 4 kg déjà porté et le haut de plage atteint, Then lest suivant de la grille (6 kg), retour au bas de la plage ; au lest
  maximal du matériel : `equipment-max`, une répétition de plus.
- A5 Given ressenti Dur (ou RIR ≤ 1) au haut de plage, Then mêmes valeurs (`hold-hard`), aucun lest ajouté.
- A6 Given un gainage chronométré, dernière séance 3 × 45 s, cible 45 s, When `prescribe`, Then +4 s par série (pas prudent : 10 % du temps
  tenu arrondi en dessous, au moins 1 s, au plus 5 s : +10 % au plus dès 10 s), phrase « +4 s par série : 3 × 45 s tenues la dernière fois ».
- A7 Given 3 séries chronométrées inégales [45, 45, 40] ou sous la cible, Then seule la première série sous les autres (ou sous la cible)
  gagne un pas, sans dépasser la meilleure série (ou la cible) ; les autres inchangées.
- A8 Given un deload demandé, Then moitié des séries, mêmes répétitions ou secondes, lest × 0,8 arrondi vers le bas à la grille (ou retiré),
  RIR 4+ ; given une pause de 3 semaines ou une récupération basse, Then mêmes valeurs que la référence, aucune hausse, la phrase le dit.
- A9 Given une séance à moins de 50 % de séries faites, Then elle est ignorée (référence : la séance d'avant), note « séance non prise en
  compte » ; une séance de deload n'est jamais une référence.
- A10 Explication : toutes les phrases dans `src/i18n/fr.progression.ts` (catalogue existant de la progression) ; la séance active affiche
  « Poids du corps × 10 · 10 · 8 », « Lest 2 kg × 8 · 8 · 8 » ou « 49 s · 49 s · 49 s » et « Accepter » remplit les répétitions (ou la
  durée, pour une série chronométrée) des séries vides, comme pour une charge. Même entrée → même prescription ; `ENGINE_VERSION` 3 → 4.
- A11 Non-régression : l'assisté (C-001, C-011) et toute prescription `load-reps` sont inchangés (suites existantes vertes).

### MOTEUR-0281b — § 11.5 « Retour à une prescription antérieure »

- B1 Given des décisions de séances closes 60 kg × 10 (S1), 62,5 kg × 8 (S2, hausse), When la fiche de l'exercice est ouverte, Then
  « Revenir à la prescription précédente » propose 60 kg × 10 · 10 · 10 (valeurs retenues de la décision d'avant la dernière hausse).
- B2 When Ali appuie, Then une confirmation dit les valeurs ; « Annuler » n'écrit rien ; « Revenir » écrit UNE décision tracée
  (`recommendation_decision`, `accepted = 0`, raison `revert-previous`), sans supprimer ni modifier aucune décision ni séance.
- B3 Then la prochaine proposition de la séance active reprend ces valeurs (décision postérieure à la dernière séance close, référence du
  moteur), avec la phrase « Retour à la prescription précédente, demandé depuis la fiche ».
- B4 Given aucune hausse dans les décisions (ou aucune décision), Then le bouton n'est pas proposé et la fiche dit pourquoi ; given le retour
  déjà fait, Then il n'est pas reproposé tant qu'aucune nouvelle décision n'existe.
- B5 Hausse = charge plus lourde (assisté : assistance plus faible) ; pour un exercice sans charge (poids du corps sans lest, chronométré) à
  lest égal, plus de répétitions ou de secondes au total.
- B6 La décision de retour est attachée à la dernière séance close de l'exercice : publiée avec elle (règle D-27 inchangée, aucune table
  publiée ne change) ; elle n'efface ni le marqueur de deload ni le choix de fatigue de cette séance (`history`).

### MOTEUR-0281c — § 14.2 filtres par muscle et par pattern

- C1 Given la bibliothèque, When Ali choisit un muscle (liste des muscles du catalogue, groupée par région), Then seuls les exercices qui
  sollicitent ce muscle restent ; When il choisit un pattern de mouvement, Then seuls ceux de ce pattern.
- C2 Les filtres se combinent entre eux et avec le groupe, « compatibles seulement » et la recherche texte ; « Tous » les lève.
- C3 Règle pure dans `src/domain/training` ; textes en i18n ; écran déjà à la demande, bundle de départ inchangé.
- C4 Body map : le composant `src/features/onboarding/BodyMap.tsx` existe, mais il travaille sur les groupes de l'onboarding (priorité /
  évité) avec son propre catalogue de textes ; filtre livré en liste accessible (sélecteur groupé), body map de la bibliothèque proposée en suite.

### Hors périmètre

Fatigue intra-séance, stagnation et décote de position pour les exercices sans charge (aucune charge à réduire, comparaison de
répétitions seulement : reporté) ; 1RM et Strength Score des exercices au poids du corps ; métrique `distance` ; gilet lesté (aucun
identifiant de matériel dans `content/exercises/equipment.json`, proposition à content-data) ; plage de la routine (le retour ne touche pas
la routine, seulement la proposition).

## Passe agent du module (training + domain-logic)

- 0281a : `src/domain/training/bodyweightProgression.ts` (règle pure, `ballastLoads`, `timeStepSec`), appelée par `prescribe` ; types
  (`HistorySet.durationSec`, `Prescription.metric`, raisons `ballast-added`, `ballast-unavailable`, `time-step`, raisons principales
  `ballast-add`, `time-increase`, `time-ladder`), `config.ts` (`timeStepMaxSec: 5`, `ENGINE_VERSION` 4) ; `explain.ts` (11 phrases, aucune
  alerte « charge réduite » pour un exercice sans charge) ; `progressionRepository.history` lit `duration_sec`. Séance active
  (`src/features/training/session/ExerciseProgression.tsx`, touché par nécessité alors que SESS-01 est en revue : valeur, écriture de la
  durée, champs de « Modifier » ; conflit de fusion possible, limité à ce fichier) ; textes `src/i18n/fr.progression.ts`.
- 0281b : `src/domain/training/revertPrescription.ts` (`revertProposal`, `isHarder`, `revertDecisionPrescription`) ; repository
  `decisions(exerciseId)`, marque `revert` à la lecture, `history` ignore une décision de retour pour les marqueurs de séance ; fiche :
  `src/features/training/library/RevertPrescription.tsx` (confirmation `ConfirmDialog`), textes `src/i18n/fr.training.ts`.
- 0281c : `src/domain/training/libraryFilter.ts` (`matchesLibraryFilters`, `muscleOptions`), deux sélecteurs dans `LibraryView.tsx`.
- Aucune migration ; aucune table publiée ne change (la décision de retour est une ligne `recommendation_decision` ordinaire, attachée à
  une séance close : publiée par la règle D-27 existante) ; `src/sync/**` et `src/domain/sync/**` non touchés ; export / import inchangés.
