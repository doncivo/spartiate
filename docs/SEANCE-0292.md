# SEANCE-0292 — Séance et moteur, partie A : moteur de progression et génération

Lot 0.29.2 (docs/LOT-0.29.2.md), registre « séance et moteur », partie A : C-004, C-006, C-007, C-010, C-012, C-013 (D-472), C-014, C-015,
C-016, C-017 (D-473), C-019, C-021, C-023, C-024, C-025, C-026, C-027 (D-474), C-029, C-030, C-177, § 11 (constantes ajustables par exercice),
§ 11.2-5, § 11.2-7, § 12.1-4. Chapitres : 11 (moteur), 12 (génération, mésocycle), 13 (séance, résumé, replay), 14.3 (profils de matériel).
Source des constats : audit Claude 0.27.0 (`.codex-tmp/lot028/constats-claude.md`, non suivi par git ; résumés dans docs/backlog.md).
Branche `SEANCE-0292` depuis `origin/main` (`3de66bf6`). Aucune migration, aucun fichier de synchro, rien ajouté au bundle de départ
(`src/domain/training` hors de tests/bundle/start-modules.json). `ENGINE_VERSION` inchangée (aucune valeur par défaut modifiée) ;
`GENERATION_VERSION` 2 → 3 (C-012, C-013 changent une séance générée).

## Passe product-owner (critères par ligne)

1. C-004 : étant donné une confiance < 0,4 (provisoire) et « Facile », alors le recalibrage +5 % monte d'au plus un cran de la grille
   (100 × 8 → 102,5 kg, pas 105) ; entre 0,4 et 0,6, +5 % entier.
2. C-006 : étant donné une décharge (I2 × 0,8 ou cycle × 0,9), alors la charge est arrondie vers le bas au matériel, sans répétition ajoutée.
3. C-007 : étant donné les disques déclarés par côté, alors la grille de barre ne contient que des charges montables (barre + 2 × somme de
   disques d'un côté), au pas déclaré.
4. C-010 : étant donné des séries dégressives ou partielles, alors elles ne comptent pas dans l'écart de routine (« Mettre à jour la
   routine ? ») ; un exercice fait seulement en dégressives n'est ni retiré ni modifié.
5. C-012 (Q-9 non tranchée, option B en choix prudent) : étant donné un exercice chronométré, alors la durée estimée d'une série est sa durée
   cible (planche 3 × 60 s, repos 60 s : 300 s), dans la génération et l'aperçu du jour ; 45 s pour les autres.
6. C-013 (D-472) : étant donné un exercice placé par la génération (substitution, rotation), alors sa plage est 5–10 (polyarticulaire) ou
   8–15 (isolation) ; une ligne de la routine garde sa plage écrite ; un chronométré garde sa cible en secondes.
7. C-014 : étant donné un instant de validation illisible, alors le replay le traite comme absent (ordre par position, repos inconnu, compté
   dans `missingInstants`).
8. C-015 : étant donné un exercice qui n'a que des échauffements dans un groupe, alors il n'en est pas membre.
9. C-016 : `isCompletedWorkSet` ne compte que les séries de travail et chronométrées (relecture A : fonction morte, supprimée, `0f49bac0`).
10. C-017 (D-473) : la rotation ignore une dernière séance dont le jour a été vidé ou qui a été supprimée (règle figée par un test).
11. C-019 : un jour de la semaine non entier est ignoré ; « Lundi2 », « Lundi_x » ne sont pas un lundi (mot entier).
12. C-021 : le seuil « à ménager » se compare à la valeur mesurée (49,6 % : à ménager, affiché 50 %).
13. C-023 : à score égal, « > 99 » l'emporte sur « 99 » (et « 10 » sur « < 10 »).
14. C-024 (à vérifier) : le Strength Score ajoute une fois le poids de corps au lest saisi.
15. C-025 : l'inactivité se compte en jours civils du fuseau de l'appareil ; les instants se comparent comme instants, pas comme chaînes.
16. C-026 (à vérifier) : dire si une décision postérieure à la dernière séance doit être réduite par la décharge, la pause ou la journée rouge.
17. C-027 (D-474) : « Dur » bloque la hausse de charge, pas l'échelle de répétitions (règle figée).
18. C-029 : pile de machine illisible (NaN) : aucune grille ; plusieurs poulies : charges communes ; matériel interdit : ne fournit pas la grille.
19. C-030 : échauffement d'un exercice lesté calculé sur la charge totale ; poids de corps inconnu : aucune rampe.
20. C-177 : propriétés du moteur indépendantes de sa sortie ; générateur avec assisté, lesté, décharge, Recovery, position.
21. § 11 : constantes du moteur ajustables par exercice (surcharges bornées, tracées dans `activeConfig`).
22. § 11.2-5, § 11.2-7, § 12.1-4 : lignes de synthèse, closes par 1, 17 ; 2, 3, 18 ; 5, 6.

## Passe agent du module

- `prescribe.ts` : C-004 (cran unique sous `provisionalBelow`, 1RM recalibré à la charge retenue), C-006 (`snapDownAtLeastMin` en décharge),
  C-025 (`compareInstants`, `utcOffsetMinutes`), § 11 (`withExerciseOverrides` dans `prescribe` et `prescribeUnloaded`).
- `loadGrid.ts` : C-007 (`sideSums`, grille filtrée aux charges montables), C-029 (bornes finies, poulies à charges communes, interdit écarté).
- `closure.ts` (C-010), `session.ts` (C-016), `replay.ts` (C-014, `instantOf`), `circuit.ts` (C-015), `programDay.ts` (C-019),
  `recoverySplit.ts` (C-021), `strengthScore.ts` (C-023, `BOUND_RANK`), `warmup.ts` (C-030), `generateSession.ts` (C-012 `setDurationSec`,
  `estimateSessionSec(…, metricOf)` ; C-013), `constraints.ts` et `estimate1rm.ts` (C-025), `config.ts` (§ 11 `TUNABLE_BOUNDS`,
  `GENERATION_VERSION` 3), `types.ts`, `prescriptionInput.ts`.
- Features : `todaySessionPreview.ts` (C-012 métrique, C-025 fuseau), `ExerciseProgression.tsx` (C-025 fuseau, C-030 poids de corps).
- Vecteurs : `src/domain/training/seance0292.test.ts` (une section par ligne), `prescribe.c177.property.test.ts` (C-177).

## Décisions proposées (Claude (choix prudent) ; révisable par Ali ; à reporter dans docs/decisions.md)

- **D-506** (C-012, Q-9 option B) : durée d'une série chronométrée = haut de sa plage cible (secondes) ; 45 s pour les autres métriques ou une
  cible illisible ; l'aperçu de la carte « Séance du jour » lit la métrique du catalogue. Q-9 reste ouverte (A ou C possibles).
- **D-507** (C-025) : inactivité en jours civils dans le fuseau de l'appareil au moment du calcul (`-getTimezoneOffset()`), UTC sans
  fuseau ; instant illisible : aucune décote ; comparaison d'instants ISO par `Date.parse`, ordre des chaînes si l'un est illisible.
- **D-508** (C-007) : grille de barre = charges du pas déclaré (incrément, sinon 2 × plus petit disque) montables avec les disques déclarés
  (nombre par côté) ; un profil embarqué (un disque par masse) garde sa grille (20 à 237,5 kg par 2,5).
- **D-509** (C-029) : plusieurs poulies sans identifiant : seules les charges disponibles sur toutes ; aucune commune : aucune grille.
- **D-510** (§ 11) : surcharges par exercice de 10 constantes, bornées (`TUNABLE_BOUNDS` : plafond de hausse ≤ 10 %, recalibrage ≤ 5 %,
  décharge 0,5 à 1…) ; hors bornes, illisible ou clé inconnue : ignorée ; la décharge d'un cycle (entrée `deloadLoad`) l'emporte.
  Stockage et écran d'édition non faits : ils exigent une migration (partie données et synchro).
- **D-511** (C-004) : recalibrage borné à un cran : le 1RM recalibré enregistré suit la charge retenue (1RM × charge / référence).
- **D-512** (C-030) : rampe d'un lesté sur le total (corps × fraction + lest), lest arrondi vers le bas ; sous le premier lest disponible,
  poids du corps seul (une étape) ; poids de corps inconnu ou sans grille : aucune rampe.
- **D-513** (C-010) : la structure de la séance compte les séries de travail et chronométrées ; une série prévue changée en dégressive fait
  baisser le nombre de séries de la ligne (question posée) ; un exercice fait seulement en dégressives ou partielles n'est ni retiré ni ajouté.
- **D-530** (C-006, relecture à froid A, point important) : l'arrondi vers le bas au cran du matériel, sans répétition ajoutée, vaut aussi
  pour la décharge I2 du cycle de 5 semaines (charge × 0,8) et plus seulement pour la décharge × 0,9 des cycles de 4 et 6 semaines
  (D-269 (2)). Écart consigné avec D-269 (1), qui déclarait la table 5 semaines « inchangée » : séries ÷ 2, × 0,8 et RIR ≥ 4 restent
  identiques ; seul le cran change (avant : cran le plus proche de la cible, répétition parfois ajoutée, `snapToEquipment` ; après :
  cran inférieur, répétitions de la référence). Preuve : `src/domain/training/seance0292.test.ts:53` (ligne 54 depuis `c8bb4e7f`, import ajouté ; haltères 26 kg × 10 → 20 kg, 20,8
  arrondi vers le bas, aucune `snap-extra-rep`). Code `prescribe.ts:278-280` inchangé par la relecture ; révisable par Ali.

## Questions (à reporter dans docs/decisions-a-prendre.md)

### Q-11 — Décision d'Ali postérieure à la dernière séance et réductions (C-026)

Constat : une décision (modification ou retour en arrière depuis la fiche) datée après la dernière séance de l'exercice est reprise telle
quelle, même en semaine de décharge, après 3 semaines de pause ou un jour de journée rouge acceptée (règle I2-02 « l'entrée d'Ali
l'emporte », figée par constraints.test.ts et redDay.test.ts ; seance0292.test.ts la fige à nouveau).
- A. Garder la règle (décision jamais modulée).
- B. La décision devient la référence et la décharge, la pause et la journée rouge la réduisent comme une référence d'historique
  (fatigue et stagnation non) ; phrase de la contrainte, « ta décision » en référence.
- C. Seule la décharge (semaine programmée) la réduit ; pause et journée rouge non.

Recommandation : B (une semaine de décharge à pleine charge contredit le § 12.2). Conséquences : changement d'attente de deux tests
existants ; correctif prêt (essai local : fichier `c026-option-b.patch` du dossier temporaire `.codex-tmp` du dépôt principal, hors git, rouge 2e4894f6 puis vert sur la suite du domaine, sauf les
deux tests qui figent A).

## Hors périmètre de cette partie (consigné)

- § 11 : stockage des surcharges par exercice (catalogue embarqué et personnalisés) et écran d'édition : migration additive (partie données
  et synchro, relecture sync-icloud).
- C-024 : le double compte ne vient que de la saisie (champ « Charge (kg) » des tractions) : C-071 (libellé « Lest (kg) »), ligne distincte.
- C-026 option B : aussi à porter sur `prescribeUnloaded` (exercices au poids du corps) si Ali la choisit.

## Passe qa-test

Rouge (constaté en local) → vert, commits de `origin/main..SEANCE-0292` :

| Ligne | Rouge | Vert | Remarque |
|---|---|---|---|
| C-004 | `29d4d9a5` | `70fbce52` | 105 → 102,5 kg |
| C-006 | `ac642e99` | `e231bc12` | [11, 11] → [10, 10] |
| C-007 | `0e9a9748` | `8a8e12c1` | loadGrid.test.ts:76 (figeait C-007) réécrit ; attente erronée du rouge (45 kg montable) corrigée dans le vert |
| C-010 | `e490f8bc` | `270a5921`, `5902f708` | SessionClosure.test.tsx : attente changée et expliquée (D-513) |
| C-016 | `525f05fa` | `7cccbe0e` | |
| C-012 | `b099cf38` | `21853b53` | 255 → 300 s |
| C-013 | `c71a575a` | `7358f048` | generateSession.test.ts : deux attentes changées et expliquées (D-472) |
| C-014 | `1501ca7d` | `4135a970` | |
| C-015 | `35e4bcbb` | `03e803e6` | |
| C-017 | — | `93ddc30d` | test qui fige D-473 (vert d'emblée, comportement conservé) |
| C-019 | `5fbeb6f6` | `b289bc0e` | |
| C-021 | `525d0cfa` | `1cbf3e6f` | |
| C-023 | `9a6dde35` | `ddd64278` | le cas « < 10 » passe déjà (ordre des normes) : non-régression |
| C-024 | — | `e7c1f61f` | vérification : test qui fige (sans défaut côté domaine) |
| C-025 | `479b25ff` | `55cf5a97` | |
| C-026 | `2e4894f6` | `6360c7ca` | rouge réécrit en test qui fige la règle actuelle (Q-11) |
| C-027 | — | `a40d7588` | test qui fige D-474 |
| C-029 | `d13f4837` | `76338127` | |
| C-030 | `26656c36` | `c8f5361b` | |
| C-177 | — | `c0eb6bf2` | test seul ; preuve de non-autoréférence : plafond muté à +30 % dans prescribe.ts (non commité), la nouvelle propriété échoue, l'ancienne passe |
| § 11 | `3f440cb5` | `606dd731` | |

Lancés en local (`CI=1 … --maxWorkers=1 --coverage.enabled=false`) : src/domain/training (904 verts), src/domain/onboarding,
src/features/training, src/features/today, src/features/progress, src/db/repositories, src/i18n : 244 fichiers, 2 141 tests verts en un passage ; `tsc --noEmit` et
`eslint` sur les fichiers touchés : propres. Dépassements de délai isolés sous charge (programImport.qa, SessionScreen, CycleView), verts
seuls : déjà vus en 0.29.1, aucun lien avec ce lot.

## Passe code-reviewer (à froid, même agent, diff relu après les tests)

À faire par la relecture du lot (agent distinct) ; points relus ici : C-007 bornée (`MAX_LOADS`), C-025 sans effet quand les formats sont
identiques (`Z`), C-013 n'altère pas les lignes `routine` (test dédié), § 11 sans surcharge = même objet de configuration (aucun effet).

Relecture 1 à froid, partie A (agent distinct, plage `3de66bf6..daa11408`) : à corriger, un point important documentaire et quatre mineurs.

| Point | Gravité | Suite | Commit |
|---|---|---|---|
| C-006 : arrondi vers le bas étendu à la décharge I2 × 0,8 du cycle de 5 semaines (`prescribe.ts:278-280`), contre D-269 (1) | important | D-530 proposée, cite `seance0292.test.ts:53` ; aucun changement de code | `3f4aa90b` |
| `seance0292.test.ts:112` et `:120` : test en double | mineur | un seul gardé | `a5bace2e` |
| C-016 : `isCompletedWorkSet` sans appelant en production | mineur | supprimée (fonction morte), tests retirés ; justification ci-dessous | `0f49bac0` |
| C-025 : `compareInstants` non transitif quand un seul instant est lisible (`estimate1rm.ts:151`) | mineur | illisible toujours après les lisibles ; rouge constaté puis vert (cycle a < b < c < a) | `c8bb4e7f` |
| C-177 : propriété du plafond qui sort tôt sans mesure (`prescribe.c177.property.test.ts:83`) | mineur | compteur minimal (50 cas mesurés sur 200 tirés ; relevés 98 à 115) ; rouge constaté au seuil 1000 | `08a2d239` |
| § 11 « fait en partie » (surcharges sans stockage) | constat | inchangé : part en données et synchro | — |

C-016, justification de la suppression : chaque décompte de séries de travail a déjà sa règle, aucun ne veut « validée + saisie conforme +
travail ou chronométrée » sur une `WorkoutSet` : `routineDiff` compte la structure (séries non supprimées de travail et chronométrées, validées
ou non, D-513) ; `summarizeWorkout.validatedWorkSets`, affiché « Séries » au résumé et sur la carte partagée, compte les validées hors
échauffement, dégressives comprises (voulu : la brancher retirerait les dégressives du résumé sans décision) ; le 1RM et `prescribe` lisent des
`HistorySet` (`setKind === 'work'`, `minCompletedFraction`). Une fonction exportée sans appelant donnait une fausse garantie : supprimée.

## Statuts proposés

| ID | Statut |
|---|---|
| C-004 | fait (SEANCE-0292, D-511) |
| C-006 | fait (SEANCE-0292, D-530 proposée : écart avec D-269 (1)) |
| C-007 | fait (SEANCE-0292, D-508) |
| C-010 | fait (SEANCE-0292, D-513) |
| C-012 | fait en choix prudent (SEANCE-0292, D-506 ; Q-9 reste ouverte) |
| C-013 | fait (SEANCE-0292, D-472) |
| C-014 | fait (SEANCE-0292) |
| C-015 | fait (SEANCE-0292) |
| C-016 | fait (SEANCE-0292 : `isCompletedWorkSet` supprimée, sans appelant, relecture A) |
| C-017 | fait : règle figée par un test (D-473) |
| C-019 | fait (SEANCE-0292) |
| C-021 | fait (SEANCE-0292) |
| C-023 | fait (SEANCE-0292) |
| C-024 | sans défaut côté domaine (test qui fige) ; double compte par la saisie : C-071 |
| C-025 | fait (SEANCE-0292, D-507) |
| C-026 | à trancher (Q-11) ; règle actuelle figée par un test |
| C-027 | fait : règle figée par un test (D-474) |
| C-029 | fait (SEANCE-0292, D-509) |
| C-030 | fait (SEANCE-0292, D-512) |
| C-177 | fait (SEANCE-0292) |
| § 11 | fait en partie (moteur, D-510) ; reste : stockage et édition des surcharges (migration, partie données et synchro) |
| § 11.2-5 | fait (C-004, C-027) |
| § 11.2-7 | fait (C-006, C-007, C-029) |
| § 12.1-4 | fait (C-012 en choix prudent, C-013) |

---

# SEANCE-0292 — partie B : écrans de séance, historique, matériel

Lignes : C-008, C-022, C-066, C-069, C-071 (avec C-024), C-072, C-077, C-078, C-080, C-081, C-082, C-083, BL-110, BL-111, BL-112, BL-121,
BL-160, § 10.3, § 13.3 b, § 13.4, § 13.8 c, § 14.3 a, § 14.3 b, § 17.1 a. Chapitres : 10.3, 13, 14.3, 17.1. Source : audit Claude 0.27.0
(`.codex-tmp/lot028/constats-claude.md`, hors git) et docs/backlog.md. Aucune migration, aucun fichier de synchro ; rien d'ajouté au départ
(écrans touchés tous chargés à la demande : Entraînement, Séance, Journal, Matériel, Cardio ; `src/domain/training` et `src/domain/cardio`
hors de tests/bundle/start-modules.json).

## Passe product-owner (critères par ligne)

1. C-008 : 61 points immobiles alternant à 10 m, précision 20 m : 0 m (au lieu de 600 m) ; une marche réelle reste mesurée.
2. C-022 : un premier point décalé de 300 m ne bloque pas les suivants et n'ajoute pas 300 m ; au-delà de 10 000 points, l'allure du dernier
   km suit les derniers points.
3. C-066 : « 12,16 » ou « 20,1 » refusés avec un message qui dit de séparer par des points-virgules ; « 1,25 » accepté.
4. C-081 : « 20 × 4 ; 10 » donne 4 disques de 20 kg par côté, relu tel quel ; un poids en double est refusé ; supprimer le profil actif
   efface le réglage local dans la même transaction.
5. C-071 : tractions, dips et lestés : champ « Lest (kg) » et aide « poids du corps non compris » ; assisté : « Assistance (kg) » ; en séance
   et à la correction du journal.
6. C-069 : « Accepter » après une validation pas encore redessinée ne touche pas la série validée.
7. C-072 / § 13.4 : une série validée rouverte en séance est tracée (`corrected_at`) ; une correction du journal ne vide pas la charge d'un
   exercice à charge.
8. C-077 : un double appui sur « Nouvelle routine », « Ajouter le programme », « Dupliquer pour modifier », « Activer » n'écrit qu'une fois.
9. C-078 : la saisie d'une série à faire survit à la destruction de l'écran ; un report GPS n'écrase pas une saisie en cours sans le demander.
10. C-080 : une lecture ancienne de la proposition n'écrase pas la nouvelle ; une liste parcourue au clavier n'écrit pas à chaque flèche.
11. C-082 / § 13.8 c : le journal montre toutes les séances closes (pages de 50), chacune ouvrable donc corrigeable et supprimable.
12. C-083 (à vérifier, appareil) : heure par sélecteur natif, durée au pavé décimal (« 45,30 » = 45:30) ; annonce VoiceOver du suivi au plus
    une fois par minute ou par 100 m.
13. BL-121 : les gênes actives écartent leurs patterns et les exercices du muscle gêné des remplaçants proposés en séance, et le disent.
14. BL-160 : après « Fermer le résumé », l'onglet Entraînement montre son accueil, pas « Nouvelle séance ».
15. § 10.3 : notifications demandées à la fin de la première séance, jamais au premier repos (le repos reste dans l'app).
16. § 14.3 b : matériel forcé et interdit modifiables dans un profil ; les deux à la fois refusé.
17. Lignes de synthèse : § 13.4 (7), § 13.8 c (7, 11), § 14.3 a (3, 4), § 14.3 b (16, C-029 en partie A).
18. BL-110, BL-111, BL-112, § 13.3 b, § 17.1 a : non faits dans cette partie (voir « Hors périmètre »).

## Passe agent du module (partie B)

- Domaine : `cardio/track.ts` (C-008 pas minimal, C-022 point en attente, fenêtre `recent`, `trackLastKmSecPerKm`), `cardio/session.ts` (C-083),
  `training/weightList.ts` (nouveau : `parseWeightList`, `parsePlateList`), `equipment.ts` (doublons), `assisted.ts` (`loadFieldOf`),
  `session.ts` (`correctionIssues`, `draftEntryPatch`), `replacement.ts` (`avoid`, `avoided`).
- Dépôts : `equipmentProfileRepository` (suppression et réglage local d'un seul tenant), `workoutRepository` (`unvalidateSet` date
  `corrected_at`, `closedPage`).
- Écrans : `EquipmentView` (listes, disques « × n », forcé / interdit, une écriture à la fois), `RoutinesView` (une création à la fois),
  `SetRow` (libellé de charge, saisie gardée, type au clavier), `ActiveSession` (`saveDraft`, repos au clavier), `ExerciseProgression`
  (relecture dans la transaction, drapeau par chargement), `HistorySetRow` / `HistoryDetail` (libellé, charge non vidée), `HistoryView`
  (pages), `ReplaceExercise` (gênes), `SessionScreen` (fermeture du résumé, autorisation des notifications), `restTimer` (aucune demande au
  repos, `askPermission`), `CardioView` (report en attente, heure, durée), `CardioGps` (annonce). Nouveau : `session/keyboardSelect.ts`.
- Textes : `fr.training.ts`, `fr.trainingSession.ts`, `fr.cardio.ts` (pluriel par `tPlural`, clé « autre » sans « {n} <nom> »).

## Décisions proposées, partie B (Claude (choix prudent) ; révisable par Ali ; à reporter dans docs/decisions.md)

- **D-514** (C-008) : pas minimal d'un segment GPS = max(3 m, précision annoncée du point).
- **D-515** (C-022) : tant qu'un seul point est gardé, un saut irréaliste est mis en attente ; confirmé par le point suivant, il remplace le
  premier point ; isolé, il reste ignoré. Allure du dernier km lue d'une fenêtre récente (mémoire, jamais codée), vivante au-delà du plafond.
- **D-516** (C-066) : liste de poids séparée par « ; » ; une décimale hors des multiples de 0,25 kg (« 12,16 ») est refusée avec un message
  qui dit de séparer par des points-virgules, jamais devinée.
- **D-517** (C-081) : disques saisis « poids × nombre » (nombre par côté, 1 à 20 ; sans nombre : 1) ; un poids deux fois dans une liste est
  refusé (domaine et écran) ; la suppression d'un profil actif efface le réglage local dans la même transaction.
- **D-518** (C-071) : champ « Lest (kg) » (métrique poids du corps ou fraction de poids de corps) avec l'aide « poids du corps non compris »,
  « Assistance (kg) » pour un assisté, « Charge (kg) » sinon ; en séance et à la correction.
- **D-519** (C-072, § 13.4) : « Annuler la validation » d'une série validée date `corrected_at` (colonne publiée existante, publiée à la
  clôture) ; les valeurs d'avant ne sont pas gardées (Q-13).
- **D-520** (C-072) : une correction ne vide pas la charge d'une série d'exercice à charge (`load-reps`) ; la modifier reste permis.
- **D-521** (C-078) : la saisie d'une série à faire est écrite dans `workout_set` (séance ouverte, jamais publiée) à la sortie d'un champ et
  une seconde après la dernière frappe, sans redessiner la séance ; un champ illisible ou hors bornes n'écrit rien ; « Accepter » ne remplit
  pas une série déjà saisie (règle I2-01 inchangée).
- **D-522** (C-078) : un report GPS arrivé pendant une saisie (modification ou champ tapé) attend « Remplacer par le suivi GPS » ou « Garder ma
  saisie » ; formulaire vierge : rempli directement.
- **D-523** (C-082) : journal par pages de 50 (« Afficher les séances plus anciennes »), chaque page lue en deux requêtes.
- **D-524** (C-080) : une liste parcourue au clavier (flèches, Début, Fin, Page) écrit à Entrée ou à la sortie du champ ; au doigt ou à la
  souris, aussitôt ; chaque chargement de la proposition a son propre drapeau (une lecture d'un chargement précédent n'écrit rien).
- **D-525** (BL-121) : les gênes actives (patterns et muscle gêné, `injuryAvoidance`) écartent les remplaçants proposés en séance, comme dans
  la séance proposée ; leur nombre est dit ; la recherche libre de la bibliothèque reste ouverte.
- **D-526** (§ 10.3) : aucune demande d'autorisation au repos (repos dans l'app, texte qui le dit) ; à la clôture d'une séance sur l'iPhone,
  l'autorisation est demandée si elle n'a jamais été décidée (donc à la fin de la première séance) ; jamais sur le PC.
- **D-527** (BL-160) : « Fermer le résumé » ramène à l'accueil de l'Entraînement ; « Nouvelle séance » (carte du jour) propose la copie.
- **D-528** (C-083) : heure de début par le sélecteur natif (`type="time"`) ; durée au pavé décimal, « , » ou « . » valent « : » suivis de deux
  chiffres (« 45,30 ») ; l'annonce VoiceOver du suivi change au plus chaque minute ou chaque 100 m.
- **D-529** (§ 14.3 b) : matériel forcé et interdit modifiables par cases dans la modification d'un profil ; un même matériel forcé et interdit
  est refusé (`forced-forbidden`, règle existante).

## Questions, partie B (à reporter dans docs/decisions-a-prendre.md)

### Q-12 — Pause de séance (BL-110, § 13.2 « Pause / abandonner »)

Constat : une pause qui ne retire pas son temps de la durée publiée n'a pas d'effet utile ; la durée est `ended_at − started_at`.
- A. Colonnes additives `workout.paused_at` et `workout.paused_ms` (publiées avec la séance close ; anciens exports et journaux : 0) ; chrono,
  résumé, énergie Apple Santé et replay hors pause ; repos annulé pendant la pause.
- B. Pause locale (réglage de l'appareil) : chrono figé à l'écran, durée publiée inchangée.
- C. Pas de pause : « Abandonner » seulement (déjà présent).

Recommandation : A. Conséquences : migration additive et relecture sync-icloud (partie données et synchro) ; écran de séance ensuite.

### Q-13 — Trace d'une correction de série (C-072, § 13.4, § 13.8)

Constat : seule la date (`corrected_at`) est gardée, pas la valeur d'avant.
- A. Garder la date seule (état actuel, D-519).
- B. Colonne additive `workout_set.corrected_from` (JSON des valeurs d'avant la dernière correction), publiée ; « corrigée : 80 → 82,5 kg ».
- C. Table publiée `workout_set_correction` (historique complet des corrections).

Recommandation : B (une ligne lisible, sans table nouvelle). Conséquences : migration additive, relecture sync-icloud, affichage au journal.

### Q-14 — « Fermer le résumé » (BL-160)

- A. Retour à l'accueil de l'Entraînement (choix prudent D-527, fait).
- B. Rester sur « Nouvelle séance » ; un nouvel appui sur l'onglet actif ramène à son accueil (règle de navigation commune, coquille).

Recommandation : A (moins de gestes ; B demande une règle de navigation commune à tous les onglets).

## Hors périmètre de la partie B (consigné)

- BL-110 : pause de séance, Q-12 (données et synchro : colonnes additives `paused_at`, `paused_ms`).
- C-072 : valeurs d'avant une correction, Q-13 (données et synchro : colonne `corrected_from` ou table).
- C-072 / D-519 : `corrected_at` est désormais daté aussi pour une série rouverte en séance ouverte (colonne et moment de publication
  inchangés : publiée à la clôture) ; à faire relire par sync-icloud avec la PR (valeur publiée nouvelle, aucun champ nouveau).
- § 13.3 b : action « +30 s » de la notification de repli : catégorie d'action iOS et traitement de l'action (rôles notifications et
  ios-mobile, `src/platform/notifications`, plugin notification-actions) ; côté séance, `workouts.extendRest(30)` est prêt.
- BL-111 (retour à la prescription précédente depuis l'explication en séance ; carte du corps), BL-112 (sans charge : fatigue intra-séance,
  stagnation, décote de position ; métrique distance), § 17.1 a (records signalés en séance) : non commencés (budget de la session) ;
  restent « à faire (0.29.x, séance et moteur, M) ».
- C-083 (appareil) : constat ajouté dans docs/constats-ali.md (clavier, sélecteur, annonce VoiceOver) ; H-35 (distance après arrière-plan)
  reste son constat existant. Constats ajoutés aussi pour C-078 (fermeture forcée) et § 10.3 (demande en fin de première séance).
- Échecs préexistants vus en local, indépendants de la partie B (tests inchangés ; RedDay constaté aussi sur le commit parent) : premier test
  de RedDay.test.tsx (« Recovery 20 (other) ») et premier test de SessionClosure.test.tsx (« Démarrer « Haut A » » introuvable) : délai
  d'un premier rendu à froid ; verts ensuite dans le même fichier.

## Passe qa-test (partie B)

Rouge (constaté en échec en local) → vert, commits de la partie B (après `2dc11eee`) :

| Ligne | Rouge | Vert | Remarque |
|---|---|---|---|
| C-008 | `2f43871c` | `1b9d9f78` | 600 → 0 m ; track.test.ts : points précis à 2 m (règle des 3 m isolée) |
| C-022 | `690b7f48` | `7e1bc0f6` | deux attentes du rouge corrigées dans le vert (pas sous la précision) |
| C-066 | `debb5d92` | `5e3cbc43` | |
| C-081 | `0cba305e` | `98a9ac1a` | |
| C-071 (C-024) | `d00062f3` | `1307b6c1`, `983ba316` | FixAberrPlausible.test.tsx : libellé « Assistance (kg) » accepté |
| C-069 | `c65b04b3` | `594d06d0` | requête du test limitée à la séance ouverte |
| C-072 / § 13.4 | `68eae2ea` | `7275df11` | |
| C-077 | `2c76c41c` | `85216396` | « Ajouter une série » déjà gardé (busy) : non-régression |
| C-078 | `0095cde2` | `003b5185`, `69ea834f` | `69ea834f` : typage (exactOptionalPropertyTypes) |
| C-080 | `1cc177d4` | `27339353` | |
| C-082 / § 13.8 c | `ffc13a99` | `3afcc1ae` | nom de ligne lu seul dans le test |
| BL-121 | `8afcf55c` | `299e37c6` | |
| § 10.3 | `445c564c` | `aa30a78f` | |
| BL-160 | `d7c91fcd` | `747dcf70` | SessionClosure.test.tsx : deux attentes changées (D-527) |
| C-083 | `da6944b1` | `bebf2726` | CardioGps.test.tsx : 0,22 → 0,2 km ; reste le constat d'appareil |
| § 14.3 b | `80e27013` | `a22137e6` | |
| (renumérotation) | — | `5e2261e8` | D-489 à D-505 → D-506 à D-522 (Ali a pris D-489 à D-505) |

Lancés en local (`CI=1 … --maxWorkers=1 --coverage.enabled=false`) : src/features/training, src/features/cardio, src/features/today,
src/domain/training, src/domain/cardio, dépôts séance et matériel : 154 fichiers, 1 385 tests, 1 383 verts en un passage ; les 2 rouges
(LibraryFilters.test.tsx, ExerciseProgressionNotes.test.tsx, fichiers non modifiés) sont verts seuls (délai sous charge, comme en partie A) ;
src/i18n (27 fichiers, 243 tests), scripts/release docs-paths et agents : verts. `tsc --noEmit` et `eslint` sur les fichiers touchés :
propres. Bundle de départ : aucun module touché n'est dans tests/bundle/start-modules.json (écrans et catalogues à la demande) ; mesure
laissée à la CI. e2e non lancés (CI).

## Passe code-reviewer (partie B, à froid, même agent)

À faire par la relecture du lot (agent distinct) ; points relus ici : C-078 n'écrit que des séries à faire d'une séance ouverte (jamais
publiée) et ne redessine pas la séance ; C-080 `useKeyboardSelect` garde l'écriture immédiate au doigt (tests existants inchangés) ; C-082
borne la page à 100 et ne lit plus une séance à la fois ; D-519 ne crée aucun champ (relecture sync-icloud demandée, valeur publiée
nouvelle) ; § 10.3 ne demande rien sur le PC.

Relecture 1 à froid, partie B (agent distinct, plage `2dc11eee..f6dd64c4`) : à corriger, trois mineurs (BL-141 → BL-160 déjà fait, `dfdb821a`).

| Point | Gravité | Suite | Commit |
|---|---|---|---|
| `fr.training.ts:171` : commentaire « (C-066) 12,16 » orphelin sur la clé de C-081 | mineur | déplacé au-dessus de `errorWeightSeparator` | `679e6c01` |
| `SetRow.tsx:156` : enregistrement différé (1 s) annulé au démontage | mineur | saisie enregistrée au démontage (`flushRef`, gardes inchangées : rien si rien de tapé) ; rouge constaté puis vert | `3e2b2ddf` |
| `ReplaceExercise.tsx:67` : échec de lecture des gênes ignoré | mineur | texte i18n `replaceInjuriesUnread` (« Gênes déclarées illisibles : les remplaçants proposés n’en tiennent pas compte. ») ; rouge constaté puis vert | `8eab6371` |

Tests locaux après corrections : src/domain/training (69 fichiers, 908 verts), src/features/training/session (45 fichiers, 237 verts), src/i18n
et ReplaceRace (29 fichiers, 246 verts) ; `tsc --noEmit` et `eslint` sur les fichiers touchés : propres.

## Statuts proposés (partie B)

| ID | Statut |
|---|---|
| C-008 | fait (SEANCE-0292, D-514) |
| C-022 | fait (SEANCE-0292, D-515) |
| C-066 | fait (SEANCE-0292, D-516) |
| C-069 | fait (SEANCE-0292) |
| C-071 | fait (SEANCE-0292, D-518) ; ferme le double compte de C-024 |
| C-072 | fait en partie (SEANCE-0292, D-519, D-520) ; reste la valeur d'avant la correction (Q-13, données et synchro) |
| C-077 | fait (SEANCE-0292) |
| C-078 | fait (SEANCE-0292, D-521, D-522) ; constat d'appareil ajouté (fermeture forcée) |
| C-080 | fait (SEANCE-0292, D-524) |
| C-081 | fait (SEANCE-0292, D-517) |
| C-082 | fait (SEANCE-0292, D-523) |
| C-083 | code fait (SEANCE-0292, D-528) ; reste le constat d'appareil (docs/constats-ali.md) |
| BL-110 | à trancher (Q-12) ; puis données et synchro (colonnes additives) |
| BL-111 | à faire (0.29.x, séance et moteur, M) : non commencé (budget) |
| BL-112 | à faire (0.29.x, séance et moteur, M) : non commencé (budget) |
| BL-121 | fait (SEANCE-0292, D-525) |
| BL-160 | fait (SEANCE-0292, D-527 ; Q-14) |
| § 10.3 | fait (SEANCE-0292, D-526) ; constat d'appareil ajouté |
| § 13.3 b | reste : catégorie et action « +30 s » (rôles notifications et ios-mobile) |
| § 13.4 | fait en partie (C-072) ; reste Q-13 |
| § 13.8 c | fait en partie (C-072, C-082) ; reste Q-13 |
| § 14.3 a | fait (C-066, C-081) |
| § 14.3 b | fait (SEANCE-0292, D-529 ; C-029 en partie A) |
| § 17.1 a | à faire (0.29.x, séance et moteur, M) : non commencé (budget) |
