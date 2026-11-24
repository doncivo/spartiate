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
9. C-016 : `isCompletedWorkSet` ne compte que les séries de travail et chronométrées.
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

- **D-489** (C-012, Q-9 option B) : durée d'une série chronométrée = haut de sa plage cible (secondes) ; 45 s pour les autres métriques ou une
  cible illisible ; l'aperçu de la carte « Séance du jour » lit la métrique du catalogue. Q-9 reste ouverte (A ou C possibles).
- **D-490** (C-025) : inactivité en jours civils dans le fuseau de l'appareil au moment du calcul (`-getTimezoneOffset()`), UTC sans
  fuseau ; instant illisible : aucune décote ; comparaison d'instants ISO par `Date.parse`, ordre des chaînes si l'un est illisible.
- **D-491** (C-007) : grille de barre = charges du pas déclaré (incrément, sinon 2 × plus petit disque) montables avec les disques déclarés
  (nombre par côté) ; un profil embarqué (un disque par masse) garde sa grille (20 à 237,5 kg par 2,5).
- **D-492** (C-029) : plusieurs poulies sans identifiant : seules les charges disponibles sur toutes ; aucune commune : aucune grille.
- **D-493** (§ 11) : surcharges par exercice de 10 constantes, bornées (`TUNABLE_BOUNDS` : plafond de hausse ≤ 10 %, recalibrage ≤ 5 %,
  décharge 0,5 à 1…) ; hors bornes, illisible ou clé inconnue : ignorée ; la décharge d'un cycle (entrée `deloadLoad`) l'emporte.
  Stockage et écran d'édition non faits : ils exigent une migration (partie données et synchro).
- **D-494** (C-004) : recalibrage borné à un cran : le 1RM recalibré enregistré suit la charge retenue (1RM × charge / référence).
- **D-495** (C-030) : rampe d'un lesté sur le total (corps × fraction + lest), lest arrondi vers le bas ; sous le premier lest disponible,
  poids du corps seul (une étape) ; poids de corps inconnu ou sans grille : aucune rampe.
- **D-496** (C-010) : la structure de la séance compte les séries de travail et chronométrées ; une série prévue changée en dégressive fait
  baisser le nombre de séries de la ligne (question posée) ; un exercice fait seulement en dégressives ou partielles n'est ni retiré ni ajouté.

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
| C-010 | `e490f8bc` | `270a5921`, `5902f708` | SessionClosure.test.tsx : attente changée et expliquée (D-496) |
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
src/features/training, src/features/today, src/features/progress, src/db/repositories, src/i18n (résultat ci-dessous) ; `tsc --noEmit` et
`eslint` sur les fichiers touchés : propres. Dépassements de délai isolés sous charge (programImport.qa, SessionScreen, CycleView), verts
seuls : déjà vus en 0.29.1, aucun lien avec ce lot.

## Passe code-reviewer (à froid, même agent, diff relu après les tests)

À faire par la relecture du lot (agent distinct) ; points relus ici : C-007 bornée (`MAX_LOADS`), C-025 sans effet quand les formats sont
identiques (`Z`), C-013 n'altère pas les lignes `routine` (test dédié), § 11 sans surcharge = même objet de configuration (aucun effet).

## Statuts proposés

| ID | Statut |
|---|---|
| C-004 | fait (SEANCE-0292, D-494) |
| C-006 | fait (SEANCE-0292) |
| C-007 | fait (SEANCE-0292, D-491) |
| C-010 | fait (SEANCE-0292, D-496) |
| C-012 | fait en choix prudent (SEANCE-0292, D-489 ; Q-9 reste ouverte) |
| C-013 | fait (SEANCE-0292, D-472) |
| C-014 | fait (SEANCE-0292) |
| C-015 | fait (SEANCE-0292) |
| C-016 | fait (SEANCE-0292) |
| C-017 | fait : règle figée par un test (D-473) |
| C-019 | fait (SEANCE-0292) |
| C-021 | fait (SEANCE-0292) |
| C-023 | fait (SEANCE-0292) |
| C-024 | sans défaut côté domaine (test qui fige) ; double compte par la saisie : C-071 |
| C-025 | fait (SEANCE-0292, D-490) |
| C-026 | à trancher (Q-11) ; règle actuelle figée par un test |
| C-027 | fait : règle figée par un test (D-474) |
| C-029 | fait (SEANCE-0292, D-492) |
| C-030 | fait (SEANCE-0292, D-495) |
| C-177 | fait (SEANCE-0292) |
| § 11 | fait en partie (moteur, D-493) ; reste : stockage et édition des surcharges (migration, partie données et synchro) |
| § 11.2-5 | fait (C-004, C-027) |
| § 11.2-7 | fait (C-006, C-007, C-029) |
| § 12.1-4 | fait (C-012 en choix prudent, C-013) |
