# FIX-PLANCHER — plancher de 1 200 kcal avec deux cibles (lot 0.28.0, phase 2)

Constats de l'audit Claude 0.27.0 : C-031, C-086, C-087, C-088. Budget M (150 k) ; un dépassement serait seulement consigné ici (D-333). Chapitres : PRD 15 (§ 15.1, § 15.2, § 15.7), 18. Décisions liées : D-74 (points 5 et 7), D-82, D-270 à D-272, D-291, D-296, D-314. Rôles : nutrition (check-in, Stratégie, cibles, tableau de bord), domain-logic (`src/domain/nutrition`).

## Périmètre

Dans : `src/domain/nutrition` (nouveau `floor.ts`, `checkIn.ts`, `targetRecord.ts`), `src/features/nutrition` (`useCases.ts`, `strategy/TargetForm.tsx`, `strategy/RestTargetForm.tsx`, `strategy/StrategyView.tsx`, `checkIn/CheckInView.tsx`, `dashboard/*`), catalogue `src/i18n/fr.nutrition.ts`. Hors périmètre : migrations, synchro, schéma `nutrition_target` (aucune colonne nouvelle : la confirmation reste une condition d'écriture, non stockée), `tests/fixtures`.

## Règles (choix prudents, révisables par Ali)

1. Le plancher se contrôle sur la plus basse des deux cibles (entraînement, repos) : une seule fonction de domaine (`floorVerdict(target, plan)`), réutilisée par `validateTargetRecord`, le check-in, Stratégie, les deux formulaires et `saveRestPlan`.
2. Sous 1 200 kcal (et au moins 800), une confirmation explicite par une case réelle ; sous 800 : refus, dit comme tel. Jamais de refus silencieux ni de message qui ne correspond pas à la cause.
3. Le check-in ne propose jamais, de lui-même, une cible de repos sous le plancher : elle est relevée à 1 200 kcal (`clampedBy` « floor »), comme la moyenne. Sous plancher confirmé (800), `belowStandardFloor` vaut vrai si l'une des deux cibles est sous 1 200 et « Accepter » demande la case.
4. Une confirmation en vigueur est reprise quand on ajoute ou retire la cible de repos, tant que la plus basse des deux cibles ne descend pas plus bas qu'avant ; descendre plus bas redemande la case.
5. `dayTargetFor` (D-270) partout : restant du tableau de bord, ligne de cible du graphique (par jour), comparaison « par rapport à la cible ».

## Critères (Given / When / Then)

- C-031. Given entraînement 1 300, repos 1 250, dépense 1 100, 70 kg, When le moteur propose, Then la cible de repos proposée est ≥ 1 200 ou `belowStandardFloor` est vrai ; Given cette proposition, When Ali accepte, Then une ligne est écrite (aucune erreur de `validateTargetRecord`).
- C-086. Given une cible d'entraînement de 1 300 et un repos à −200 (1 100), When Ali ouvre le formulaire de cible, Then la case de confirmation est visible (elle l'était seulement sous 1 200 pour l'entraînement) ; Given la case cochée, Then l'enregistrement réussit ; Given une cible de repos sous 800, Then le message dit « sous 800 kcal », pas « l'enregistrement a échoué ». Au check-in « Personnaliser » : même règle.
- C-087. Given une cible de 1 100 kcal confirmée avec cible de repos, When Ali coupe l'interrupteur de repos, Then l'enregistrement réussit sans nouvelle case ; Given une cible de repos plus basse que la plus basse confirmée, Then une case est demandée et le refus sans case dit pourquoi.
- C-088. Given entraînement 2 500, repos 2 300, 2 000 mangées un jour de repos, When le tableau de bord s'affiche, Then « il reste 300 » comme dans le Journal ; la ligne de cible du graphique et « par rapport à la cible » suivent le type de chaque jour.

## Passes

product-owner (cette fiche), agent du module, qa-test, code-reviewer : consignés plus bas.

## Passes consignées

- product-owner : fiche ci-dessus, avant les tests.
- Agent du module : `src/domain/nutrition/floor.ts` (nouveau), `checkIn.ts`, `targetRecord.ts` ; `useCases.ts`, `TargetForm`, `RestTargetForm`, `StrategyView`, `CheckInView`, `dashboard/*`. Aucune clé i18n nouvelle (textes existants, désormais vrais : « confirme explicitement » n'apparaît plus qu'avec la case).
- qa-test : bornes 799 / 800 / 1 199 / 1 200, repos plus haut que l'entraînement ajoutés ; 101 fichiers / 991 tests verts sur `src/features/nutrition`, `src/domain/nutrition`, `src/features/app`, dépôt de cibles ; `tsc` et eslint propres. Non couvert par un test d'écran : la case « Accepter » du check-in (relue, même composant que les autres cases).
- code-reviewer : à faire par l'appelant.

## Décisions : D-337, D-338, D-339, D-340 (docs/decisions.md)

- D-337 : le plancher de 1 200 kcal (800 sur confirmation) se contrôle sur la plus basse des deux cibles (`floorVerdict`, `src/domain/nutrition/floor.ts`) ; une seule règle pour l'enregistrement, le check-in, Stratégie et les formulaires.
- D-338 : le check-in ne propose jamais de cible, d'entraînement ou de repos, sous 1 200 kcal sans confirmation : elle est relevée au plancher (`clampedBy` « floor ») ; une cible en vigueur sous 1 200 est reprise par le moteur comme confirmée ; « Accepter » une proposition sous 1 200 demande une case.
- D-339 : une confirmation en vigueur est reprise à l'ajout ou au retrait de la cible de repos (et pour les cibles futures héritées) tant que la plus basse des deux cibles ne descend pas plus bas ; sinon nouvelle case. Aucune colonne ajoutée.
- D-340 : le tableau de bord applique `dayTargetFor` (restant d'aujourd'hui, un trait de cible par jour dans le graphique, cible moyenne comparée affichée).

## Constats d'Ali à faire

- Vérifier à l'écran sur iPhone : case de confirmation en Stratégie avec un repos sous 1 200, après « Retirer la cible de repos » d'une cible confirmée, et au check-in ; le graphique des 7 jours avec un trait de cible par jour.
- Valider le choix prudent « relever au plancher » plutôt que « demander la case » pour la proposition automatique du check-in (D-338).

## Passe code-reviewer (à froid) : à corriger, puis corrigé

Fond approuvé (une seule fonction de domaine, aucune voie de refus muet, reprise de confirmation sans descente, `dayTargetFor` au tableau de bord ; rouge `1e430952` rejoué : 9 échecs justes). À corriger : 6 erreurs eslint (assertions `!` dans `floor.test.ts`, textes en dur dans `Plancher.test.tsx`) : corrigées (garde explicite, `tNutrition('saveTarget')`) ; la mention « eslint propres » de la passe du module était fausse. Suggestions reportées au registre (BL-101) : moyenne des cibles par jour à exposer depuis `src/domain/nutrition/journal.ts` ; test d'écran de la case « Accepter » du check-in. Constat d'Ali (D-338) : une cible reprise comme confirmée sous 1 200 laisse le moteur proposer jusqu'à 800, mais « Accepter » demande toujours la case.
