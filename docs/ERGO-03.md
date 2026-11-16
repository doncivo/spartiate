# ERGO-03 — Stratégie lisible (cible à venir, cible non pré-remplie, repos) et repère du cycle sur Aujourd'hui (lot 0.26.0)

Statut : **en cours.** Budget M. Branche `ERGO-03` depuis `origin/main` (`a35f9f70`, 0.25.0, schéma 19). Aucune migration attendue. Lot 0.26.0 (docs/LOT-0.26.0.md, § 2) : pas de tag à la fusion.
Rôles : ui-design-system, nutrition, accessibility-i18n. Décisions : D-295 à D-299. Origine : énoncé d'Ali du 15/11 (après le constat FIX-0244 de la cible importée du 16/11).
Chapitres PRD : 15 (nutrition, Stratégie : docs/prd/15-nutrition.md), 12 (mésocycle et décharge), 18 (écrans, charte § 18.4, accessibilité § 18.6 : docs/prd/18-navigation-ecrans-et-etats-degrades.md).
Règles de cible : D-74, D-82 (cible en vigueur), D-270 à D-272 (cible de repos), D-291 (FIX-0244). Hypothèses H-n : aucune touchée. Fixtures synthétiques uniquement.

## Passe product-owner : critères

| # | Critère (Given / When / Then) | Tests |
| --- | --- | --- |
| 1 | Une cible en vigueur (2 600 kcal depuis le 09/11) et une cible acceptée datée du lundi 16/11 (2 450 kcal, P 190, G 250, L 75) → j'ouvre Stratégie (iPhone ou PC) → la cible en vigueur reste affichée en chiffre héros et, à côté, « À partir du lundi 16/11 : 2 450 kcal · P 190 · G 250 · L 75 ». Plusieurs cibles futures : seule la plus proche (D-295). Aucune cible future, ou une cible future masquée par une décision plus récente : rien. | domaine `upcomingTargets` (vecteurs) ; écran (StrategyErgo03.test.tsx) |
| 2 | Stratégie ouverte → aucun champ de cible n'est affiché ; « Modifier ma cible » (« Fixer ma cible » sans cible) déplie le formulaire, champs vides. | écran |
| 3 | Une cible future existe → j'enregistre une cible du jour → une confirmation explicite dit qu'elle passera devant la cible prévue à partir du lundi 16/11 ; « Annuler » n'écrit rien, « Enregistrer quand même » écrit (D-296). Sans cible future : pas de confirmation, comportement d'avant. | écran |
| 4 | Cible des jours de repos : section titrée « Jours de repos » ; interrupteur nommé et libellé visible (FIX-0244, D-291 : vérifié, non refait) ; avec une cible de repos, les jours de repos sont écrits en toutes lettres (« Jours de repos : mercredi et dimanche »). | écran ; test FIX-0244 existant vert |
| 5 | Écran groupé Style / Objectif / Cible / Jours de repos / Historique (titres de section dans cet ordre) ; une ligne par réglage avec sa valeur (« Style du check-in · Collaboratif », « Jour du check-in · lundi », « Objectif · Maintien », « Niveau d'activité · Non déclaré »), comme Plus ; la ligne déplie son réglage (`aria-expanded`). | écran |
| 6 | Aujourd'hui (iPhone et PC) avec un cycle actif de 4 semaines → « Semaine 1 sur 4 » ; en semaine de décharge → « Semaine 4 sur 4 » et le badge bronze « Décharge » ; sans cycle (ou cycle fini, pas commencé, clos) → rien (D-297). Calcul pur `cycleWeekMarker` dans src/domain/training, testé par vecteurs. | domaine ; carte (TodaySessionCycle.test.tsx) |
| 7 | Tokens seulement ; contraste AA du badge et des lignes (contrastCss, deux thèmes) ; lignes ≥ 44 pt (`--ct-hit-target-min`) ; très grand texte : retour à la ligne, aucune coupure (`flex-wrap`, `overflow-wrap`). | règles CSS (test), contrastCss |
| 8 | Bundle de départ non augmenté (main `a35f9f70`) : le repère vit dans la carte Séance (bloc à la demande), Stratégie est à la demande. | `measureStart`, octets consignés |
| 9 | Captures avant / après depuis la CI : scènes `Nutrition-strategie`, `PC-Nutrition-strategie`, `Aujourdhui-cycle`, `PC-Aujourdhui-cycle` (tests/visual/capture.spec.ts). | job `visual` |

## Passes

(à compléter)

## Captures (job « Captures app et maquettes », artefact `visual-pairs`)

(à compléter)

## code-reviewer

(laissé vide : relecture à froid par l'orchestrateur)
