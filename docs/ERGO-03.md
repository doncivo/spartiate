# ERGO-03 — Stratégie lisible (cible à venir, cible non pré-remplie, repos) et repère du cycle sur Aujourd'hui (lot 0.26.0)

Statut : **fait** (passes product-owner, modules, qa-test et code-reviewer faites ; revue 2 approuvée). Budget M. Branche `ERGO-03` depuis `origin/main` (`a35f9f70`, 0.25.0, schéma 19). Aucune migration attendue. Lot 0.26.0 (docs/LOT-0.26.0.md, § 2) : pas de tag à la fusion.
Rôles : ui-design-system, nutrition, accessibility-i18n. Décisions : D-295 à D-299. Origine : énoncé d'Ali du 15/11 (après le constat FIX-0244 de la cible importée du 16/11).
Chapitres PRD : 15 (nutrition, Stratégie : docs/prd/15-nutrition.md), 12 (mésocycle et décharge), 18 (écrans, charte § 18.4, accessibilité § 18.6 : docs/prd/18-navigation-ecrans-et-etats-degrades.md).
Règles de cible : D-74, D-82 (cible en vigueur), D-270 à D-272 (cible de repos), D-291 (FIX-0244). Hypothèses H-n : aucune touchée. Fixtures synthétiques uniquement.

## Passe product-owner : critères

| # | Critère (Given / When / Then) | Tests |
| --- | --- | --- |
| 1 | Une cible en vigueur (2 600 kcal depuis le 09/11) et une cible acceptée datée du lundi 16/11 (2 450 kcal, P 190, G 250, L 75) → j'ouvre Stratégie (iPhone ou PC) → la cible en vigueur reste affichée en chiffre héros et, à côté, « À partir du lundi 16/11 : 2 450 kcal · P 190 · G 250 · L 75 ». Plusieurs cibles futures : seule la plus proche (D-295). Aucune cible future, ou une cible future masquée par une décision plus récente : rien. | domaine `upcomingTargets` (vecteurs) ; écran (StrategyErgo03.test.tsx) |
| 2 | Stratégie ouverte → aucun champ de cible n'est affiché ; « Modifier ma cible » (« Fixer ma cible » sans cible) déplie le formulaire, champs vides. | écran |
| 3 | Une cible future existe → j'enregistre une cible du jour → une confirmation explicite dit qu'elle passera devant la cible prévue à partir du lundi 16/11 ; « Annuler » n'écrit rien, « Enregistrer quand même » écrit (D-296). Sans cible future : pas de confirmation, comportement d'avant. | écran |
| 4 | Cible des jours de repos : section titrée « Jours de repos » ; interrupteur nommé et libellé visible (FIX-0244, D-291 : vérifié, non refait) ; avec une cible de repos, les jours de repos sont écrits en toutes lettres (« Repos le mercredi et le dimanche »). | écran ; test FIX-0244 existant vert |
| 5 | Écran groupé Style / Objectif / Cible / Jours de repos / Historique (titres de section dans cet ordre) ; une ligne par réglage avec sa valeur (« Style du check-in · Collaboratif », « Jour du check-in · lundi », « Objectif · Maintien », « Niveau d'activité · Non déclaré »), comme Plus ; la ligne déplie son réglage (`aria-expanded`). | écran |
| 6 | Aujourd'hui (iPhone et PC) avec un cycle actif de 4 semaines → « Semaine 1 sur 4 » ; en semaine de décharge → « Semaine 4 sur 4 » et le badge bronze « Décharge » ; sans cycle (ou cycle fini, pas commencé, clos) → rien (D-297). Calcul pur `cycleWeekMarker` dans src/domain/training, testé par vecteurs. | domaine ; carte (TodaySessionCycle.test.tsx) |
| 7 | Tokens seulement ; contraste AA du badge et des lignes (contrastCss, deux thèmes) ; lignes ≥ 44 pt (`--ct-hit-target-min`) ; très grand texte : retour à la ligne, aucune coupure (`flex-wrap`, `overflow-wrap`). | règles CSS (test), contrastCss |
| 8 | Bundle de départ non augmenté (main `a35f9f70`) : le repère vit dans la carte Séance (bloc à la demande), Stratégie est à la demande. | `measureStart`, octets consignés |
| 9 | Captures avant / après depuis la CI : scènes `Nutrition-strategie`, `PC-Nutrition-strategie`, `Aujourdhui-cycle`, `PC-Aujourdhui-cycle` (tests/visual/capture.spec.ts). | job `visual` |

## Passes

**Agents des modules (ui-design-system, nutrition, accessibility-i18n ; rouge puis vert).** Rouge `b0229d62` (bouchons `upcomingTargets` et `cycleWeekMarker` qui ne renvoient rien, tests, scènes de capture) : 28 tests rouges ; échecs observés : « Unable to find role="button" and name "Modifier ma cible" », « Unable to find role="region" and name "Jours de repos" », « Unable to find an element with the text: Semaine 1 sur 4 », « expected [] to deeply equal [ 'f' ] », règles CSS absentes (`expected '' to contain 'min-height: var(--ct-hit-target-min)'`). Vert `75c33037`.
Données de test corrigées entre le rouge et le vert, sans rien affaiblir : dans le rouge, les cibles futures étaient enregistrées AVANT la cible en vigueur. Elles étaient donc plus anciennes par HLC, et masquées selon D-82 (pas « à venir »). L'ordre d'écriture est inversé, comme dans le cas réel de FIX-0244 (cible importée après la cible du jour). Le cas « cible future plus ancienne, masquée » devient un test à part.

| Critère | Point | Rouge | Vert |
| --- | --- | --- | --- |
| 1 | `upcomingTargets` (domaine, 7 vecteurs) ; ligne « À partir du lundi 16/11 : 2 450 kcal · P 190 · G 250 · L 75 » ; la plus proche seulement ; rien sans cible future ; `saveRestPlan` (FIX-0244) relève les cibles futures avec la même fonction | `b0229d62` | `75c33037` |
| 2 | Formulaire replié derrière « Modifier ma cible » / « Fixer ma cible », `aria-expanded`, champs vides | `b0229d62` | `75c33037` |
| 3 | `ConfirmDialog` « Elle passera devant la cible prévue à partir du lundi 16/11 (2 450 kcal) » ; « Annuler » n'écrit rien (résultat `cancelled`, aucun message) ; « Enregistrer quand même » écrit ; sans cible future, pas de fenêtre | `b0229d62` | `75c33037` |
| 4 | Section « Jours de repos » (région nommée) ; interrupteur de FIX-0244 vérifié, non refait (test FIX-0244 inchangé, vert) ; « Repos le mercredi et le dimanche » | `b0229d62` | `75c33037` |
| 5 | Groupes Style / Objectif / Cible / Jours de repos / Historique ; lignes « étiquette : valeur » qui se déplient | `b0229d62` | `75c33037` |
| 6 | `cycleWeekMarker` (domaine, 13 vecteurs : 4 et 6 semaines, illimité, décharge anticipée, pause, pas commencé, fini, clos, invalide) ; carte Séance iPhone et PC : « Semaine 1 sur 4 », « Semaine 4 sur 4 » + « Décharge », rien sans cycle | `b0229d62` | `75c33037` |
| 7 | Règles CSS : `.ct-strategy__row` à `min-height: var(--ct-hit-target-min)`, `flex-wrap`, `overflow-wrap: anywhere` ; badge `.ct-session-card__deload` bronze par jetons ; contrastes calculés par `contrastCss.test.ts` (texte et fond de la même règle, deux thèmes) | `b0229d62` | `75c33037` |
| 8 | Bundle de départ : main `a35f9f70` 195 861 octets normalisés (brut 195 865), 44 blocs ; après `75c33037` 195 861 normalisés (brut 195 880), 44 blocs ; marge 162 539 ; `start-modules.json` inchangé | — | `75c33037` |

Tests existants adaptés à l'écran replié, sans assertion retirée : chaque réglage est d'abord déplié par sa ligne. Fichiers : NutritionScreen.test.tsx (I4-03 : valeurs par défaut, style et activité, cible manuelle ; FIX-0244 revue 1 : confirmation devant la cible future du 16/11) et NutritionStates.test.tsx (cible manuelle). Sans cible, la section Jours de repos affiche « Fixe d'abord ta cible… », un texte distinct de « Aucune cible définie ».
Typecheck et eslint (fichiers touchés) verts. Une suite large a vu `GeneratedSession.test.tsx` (« propose la séance du jour… ») échouer une fois sous charge, puis passer à la relance seule. Le fichier n'est pas touché par ce ticket : à surveiller en CI.

**qa-test (passe distincte).** Rouge rejoué : l'échec de `b0229d62` est celui consigné plus haut (28 rouges, aucun vert parasite). Six cas limites ajoutés, tous verts : Stratégie (objectif de perte, ligne « Objectif : Perte · 0,25 kg / semaine » ; une seule ligne ouverte à la fois ; sans cible, section Jours de repos sans interrupteur ; cible future masquée par une décision plus récente, ni ligne ni confirmation) et `formatWeekday.ergo03.test.ts` (« lundi 16/11 », « dimanche 01/03 » ; listes d'un, deux et trois jours). Deux mutations prouvées puis annulées : `deload` forcé à faux dans `cycleWeekMarker` (5 vecteurs rouges) ; garde `winner.weekStart === date` retirée de `upcomingTargets` (2 vecteurs rouges). Suites ciblées vertes : src/i18n, src/domain/training, src/domain/nutrition, useCases, session, ErgoScreens, TrainingScreen (1 344) ; nutrition et session (58 et 494, voir l'instabilité de GeneratedSession) ; src/ui/theme (contrastes et charte), règles de mise en page (225). `npm run typecheck` et `npm run lint` verts. Constats sans défaut bloquant : (a) un enregistrement sous 1 200 kcal avec une cible future demande d'abord la confirmation D-296, puis celle du plancher : deux étapes, l'ordre est voulu ; (b) le repère apparaît aussi dans l'accueil d'Entraînement, qui reprend la carte Séance (D-297) ; (c) Dynamic Type « Très grand » : tailles en rem et retours à la ligne vérifiés par les règles CSS ; reste à le constater sur l'iPhone.

## Captures (job « Captures app et maquettes », artefact `visual-pairs`)

Quatre scènes ajoutées à tests/visual/capture.spec.ts dès le commit rouge. Elles portent des données synthétiques en SQL : cible en vigueur au 02/11, cible à venir au lundi 09/11, cycle de 4 semaines en décharge le dimanche 08/11. Les scènes : `Nutrition-strategie` et `PC-Nutrition-strategie` (Stratégie), `Aujourdhui-cycle` et `PC-Aujourdhui-cycle` (Aujourd'hui).
- **Avant** : artefact `visual-pairs` du run Tests du commit rouge `b0229d62`, qui a l'ancien écran avec les mêmes données.
- **Après** : artefact `visual-pairs` du run Tests du dernier commit de la PR.
- Emplacement où l'orchestrateur reporte les liens des deux runs et sa relecture : (à compléter par l'orchestrateur)

## code-reviewer

**Revue 1 (à froid, orchestrateur) : à corriger.** Un important et quatre mineurs.

| # | Constat | Rouge | Vert | Échec observé au rouge |
| --- | --- | --- | --- | --- |
| 1 (important) | Le check-in contournait D-296 : « Accepter » ou « Personnaliser » écrivait une décision acceptée datée du jour du check-in, qui masquait sans rien dire la cible du 16/11. Même confirmation désormais (CheckInErgo03.test.tsx : Accepter, Annuler n'écrit rien, Refuser sans fenêtre) ; D-296 (4) | `c81ce460` | `33be944d` | « Unable to find role="alertdialog" » |
| 2 | Cible future + saisie sous 1 200 kcal : D-296 demandée deux fois. La confirmation est retenue pour la même saisie et la même cible future (Stratégie et check-in) | `c81ce460` | `33be944d` | 2 décisions au lieu de 3 (la 2e fenêtre bloquait) ; « Unable to find role="alertdialog" » côté check-in |
| 3 | Promesse jamais résolue si la cible future disparaît, fenêtre ouverte, ou au démontage. Résolue à faux (`useFutureConfirm.test.tsx`, 4 cas) | `c81ce460` | `33be944d` | « Failed to resolve import "./useFutureConfirm" » (crochet absent) |
| 4 | Test « seule la plus proche » : la cible du 23/11 est maintenant écrite en dernier. Mutation prouvée puis annulée : `.at(-1)` à la place de `[0]` fait échouer le test | `c81ce460` | `33be944d` | vert dès le rouge (garde) ; rouge sous la mutation |
| 5 | Fiche, critère 4 : texte aligné sur « Repos le mercredi et le dimanche » | — | `c81ce460` | — |

Suites après correction : nutrition (Stratégie, check-in, écran, états, crochet) vertes ; `npm run typecheck` et eslint verts. Code changé hors du départ (Stratégie et check-in sont à la demande).

**Budget.** Le budget M (≈ 150k jetons) est dépassé avec la revue 1. Décision d'Ali du 16/11 : poursuivre malgré tout.

**Revue 2 (à froid) : approuvé.** Les cinq constats sont corrigés (vitest ciblé CheckInErgo03, StrategyErgo03, useFutureConfirm : 23 verts). Autres chemins d'écriture de `nutrition_target` relus : `saveManualTarget` (Stratégie, confirmé), `recordCheckInDecision` (confirmé), `saveRestPlan` (recopie les cibles futures, D-291) ; import d'archive et synchro ne sont pas des gestes d'enregistrement. Deux mineurs :
1. La clé de confirmation de « Accepter » au check-in (`'accept'`) ne contenait pas les valeurs proposées : une proposition changée après un échec d'écriture s'écrivait sans fenêtre. **Corrigé** par l'orchestrateur (`accept|` + `targetKey(proposal.target)`, CheckInView.tsx:170), sans test rouge propre : le crochet re-demande déjà pour une autre clé (`useFutureConfirm.test.tsx`) ; check-in et Stratégie 35 verts, typecheck et eslint verts.
2. Une décision reçue par la synchro peut masquer une cible future sans le dire : hors du périmètre de D-296, signalé dans docs/reprise.md pour sync-icloud.
