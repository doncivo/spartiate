# ERGO-02b — Bundle de départ par la configuration du build, règles d'écran dans src/domain, mineurs d'ERGO-02 et de PROG-01 (lot 0.25.0)

Statut : **en cours.** Budget M. Branche `ERGO-02b` depuis `origin/main` (`b5f14316`, après FIX-0243, schéma 19). Aucune migration attendue. Lot 0.25.0 (docs/LOT-0.25.0.md) : pas de tag à la fusion.
Origine : D-264 (4), revue d'ERGO-02 (docs/ERGO-02.md, points 4 et 5), mineurs de PROG-01 (docs/PROG-01.md, passe code-reviewer), D-265 et D-274 (bundle).
Chapitres PRD : 11 et 13 (records, charges), 14 (cardio), 15 (nutrition, check-in), 18 (Aujourd'hui, réglages, états), 23.1 (budget du bundle). Fixtures synthétiques uniquement.

## Passe product-owner : critères

| # | Critère (Given / When / Then) | Tests |
| --- | --- | --- |
| 1 | Build de production → bundle de départ (mesure normalisée) sous 198 694 octets (0.22.3), en absorbant +154 (D-265) et +372 (D-274) ; liste blanche et plafond inchangés ; index.html garde ses liens `modulepreload` ; aucun bloc du départ ne précharge un autre bloc du départ. Passe architect consignée. | `startBundle.test.ts`, mesure normalisée |
| 2 | Règles de calcul des écrans dans src/domain, pures et testées : allure du dernier km (`lastKmSecPerKm`), règle de record de la fiche d'exercice, rythme hebdomadaire du check-in (`weeklyRateKg`) ; les écrans les importent, comportement identique. | tests du domaine, tests d'écran existants verts |
| 3 | « par haltère » cohérent dans les écarts de fr.progression (charge d'un haltère : « 26 kg par haltère ») ; `heldFor` réemployé (TodayPcSide, aperçu de séance), sans double logique. | tests des écrans concernés |
| 4 | Aujourd'hui PC : la semaine affichée suit le réglage « Début de semaine » (lundi ou dimanche). | test d'écran |
| 5 | Raison « aperçu illisible » distincte de « à saisir ». | test d'écran |
| 6 | Chaînes inutilisées retirées des catalogues i18n (`sessionTodayLoad`, `unknown`, et toute clé sans appelant trouvée par script), avec garde. | test de garde |
| 7 | Tests ajoutés : coche « pris » des Compléments ; dates Renpho sur les 5 lignes (BodyProgress). | tests |
| 8 | Jours d'entraînement par défaut repris de la routine active (et non lundi, mardi, jeudi, vendredi, samedi figés). | test |
| 9 | Réglage du mésocycle fait à l'onboarding : appliqué au premier cycle seulement, pas aux suivants. | test |

## Passes

**Passe architect** (option A, lecture seule) : pistes mesurées une à une (polyfill, préchargements entre blocs du départ, noms de fichiers en hachage seul, `base`, regroupements, options du minifieur) ; retenue : polyfill retiré et préchargements entre blocs du départ filtrés (−1 866 sur main), sans toucher la normalisation ni la liste blanche ; noms en hachage seul refusés (normalisation inopérante). D-287.

**Agents des modules (rouge puis vert).** Index git partagé entre agents parallèles : deux commits mêlent des fichiers de deux points (signalé, historique non réécrit).
| Critère | Point | Rouge | Vert | Échec observé au rouge |
| --- | --- | --- | --- | --- |
| 1 | Préchargement (performance) | `95d70208` | `6822c909` | `main → types` cité par un bloc du départ ; polyfill dans `tokens` ; 199 428 ≥ 198 694 |
| 1 | Bloc `localDate` sorti du départ par `daysSinceWeekStart` (constaté à la mesure) | `e13ec0e0` | `665fa605` | `daysFromWeekStart is not a function` ; 45 blocs, 197 517 → 44 blocs, 197 350 |
| 2 | `lastKmSecPerKm` → src/domain/cardio (training) | `4002cccf` | `cb0ace8c` | `lastKmSecPerKm is not a function` (4) |
| 2 | Chiffres et record de la fiche → src/domain/training (training) | `c8a32ada` | `eb8f8011` (+ renommage dans `3ef0d4aa`) | `Cannot find module './exerciseSheet'` |
| 2 | `weeklyRateKg` → src/domain/nutrition (nutrition) | `23f8f5ba` | `181cf9a1` | import absent |
| 3 | « par haltère » dans les écarts (training) | `4febc15a` | `1b53059a` | « +2 kg : 3 × 10… » sans « par haltère » |
| 3 | `heldFor` / `heldLookup` réemployés (training) | `f32d89d5` | `cbfb151e` + `2b8cbcd7` | garde : imports absents, `dumbbellsHeld` recomposé |
| 4 | Semaine d'Aujourd'hui PC selon « Début de semaine » (nutrition, app) | `a5f63b1f` | `cbfb151e` | semaine restée du lundi au dimanche (2) |
| 5 | « aperçu illisible » (training) | `5d488b17` | `cf5f394f` | `expected '— à saisir' to contain 'aperçu illisible'` |
| 7 | Coche « pris » des Compléments : test seul (comportement juste) | — | `c080b80d` | prouvé par mutation (message retiré, bascule figée) |
| 7 | Dates Renpho sur les 5 lignes : test seul | — | `51b484a3` | prouvé par mutation (une date pour toutes) |
| 8 | Jours d'entraînement par défaut de la routine active (nutrition) | `3ef0d4aa` | `0e751bbc` | 3 échecs (D-288) |
| 9 | Onboarding au premier cycle seulement (training) | `586da1e2` | `1853a6af` | après un cycle clos, « 5 semaines » non coché |

**qa-test.** (à venir)

**code-reviewer.** (à venir)
