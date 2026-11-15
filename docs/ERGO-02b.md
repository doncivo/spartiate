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

**Agents des modules.** (en cours)

**qa-test.** (à venir)

**code-reviewer.** (à venir)
