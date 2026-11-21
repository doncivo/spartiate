# REPAS-029 — saisie rapide des repas et dépense ajustée aux pas (lot 0.29.0, IA-0c et PRD-I6)

Statut : code et tests verts en local (branche REPAS-029, non poussée, sans PR). Budget M à L. Modules : nutrition, domain-logic ; recovery en lecture (échantillons `pas`).
Chapitres : PRD § 15.1 (formules), § 15.2 (modificateurs), § 15.3 (saisie), § 18.4 (charte). Décisions : D-410 (aucune IA), D-415 (pas de repas à la
voix), D-396 (assiette, écriture tout ou rien), D-26 (synchro : AUCUNE table ni colonne publiée nouvelle ici). H-25 (`pas.csv`) reste UNVERIFIED.

## REPAS-029a — saisie rapide (§ 15.3)

### Critères

- C-1 (moment de repas) — Given une heure locale, When `mealMoment` est appelée, Then elle rend matin (avant 11:00), midi (11:00 à 14:59), après-midi
  (15:00 à 17:59) ou soir (dès 18:00) ; les entrées d'un même jour et d'un même moment forment « un repas » (le modèle n'a pas de colonne de repas).
- C-2 (copier) — Given la veille avec un repas du même moment, When « Copier le repas d'hier » est touché, Then un aperçu liste les lignes (nom,
  provenance, grammes modifiables, kcal) ; « Ajouter au journal » écrit toutes les lignes à AUJOURD'HUI (mêmes heures), en une transaction
  (`createMany`), rien avant ; une quantité modifiée recalcule les valeurs de la ligne au prorata ; sans repas hier à ce moment : message, jamais un
  repas vide. « Copier la journée d'hier » : toutes les lignes de la veille, même mécanique.
- C-3 (récents) — Given des repas des jours passés, When la liste des récents s'ouvre (Journal, et carte Nutrition d'Aujourd'hui, déjà à la demande),
  Then les 5 repas les plus récents (jour, moment, aliments, total kcal ; « — » si une valeur manque) sont proposés ; un geste ouvre l'aperçu, qui écrit à l'heure
  courante.
- C-4 (favoris) — Given les lignes d'un repas du journal, When « Enregistrer comme favori » (nom obligatoire) est touché, Then le repas est
  conservé comme RECETTE d'une portion (ingrédients = lignes avec aliment et grammes, valeurs pour 100 g dérivées) ; les lignes sans grammes ou sans
  aliment (Ajout rapide, estimation de photo) ne sont pas enregistrées et le nombre est dit ; rejouer un favori ouvre l'aperçu (C-2) et écrit une
  entrée PAR aliment à l'heure courante.
- C-5 (jamais 0, provenance) — Given une ligne à valeur inconnue, Then elle reste « — » et un total qui l'inclut est « — » ; la provenance de chaque
  ligne est visible ; la méthode et la confiance d'une ligne copiée sont conservées.
- C-6 (aucune table nouvelle) — Les favoris réutilisent `recipe` et `recipe_ingredient` (déjà publiées) : aucune migration, aucune modification de
  `src/sync/**` ni `src/domain/sync/**`.
- C-7 (bundle) — Le panneau est chargé à la demande ; la mesure normalisée de fin ne dépasse pas celle du début (193 879 octets).

### Stockage des favoris (choix prudent)

Une recette est « une composition d'aliments avec quantités » : sémantiquement un repas favori (D-396 renvoyait déjà « assiette en recette » à BL-117).
Table nouvelle écartée : elle imposerait migration, catalogue de synchro, export / import, déclencheurs de sauvegarde Rust (≈ 80 fichiers, cf.
FIX-0181). Limites : un favori apparaît aussi dans Recettes ; une ligne sans aliment ou sans grammes ne s'y range pas.

## REPAS-029b — dépense ajustée aux pas (§ 15.2 modificateurs)

### Règle proposée (choix prudent, révisable par Ali ; constantes dans `config.ts`)

- Pas du jour de référence J (la veille : jour complet ; les pas du jour en cours sont partiels et jamais utilisés) ; base = moyenne des jours à pas
  connus (> 0) des 28 jours avant J, au moins 14 jours connus.
- Écart brut = (pas de J − base) × 0,04 kcal par pas, borné à ± 300 kcal.
- Part de la formule : seule la part « formule » de la dépense retenue reçoit l'ajustement : appliqué = écart × (1 − poids de la mesure). Dépense
  mesurée seule (poids de la mesure = 1) : ajustement 0, « déjà comprise dans la mesure » : les pas ne sont jamais comptés deux fois.
- Le check-in, la dépense mesurée (TDEE par tendance), le lissage et les cibles n'utilisent JAMAIS la dépense ajustée : affichage seul
  (Dashboard › Dépense), avec sa source (« pas.csv, import Santé ») et sa raison quand il n'y a pas d'ajustement.
- Raisons sans ajustement : `no-steps` (aucun pas importé : fichier absent, ou PC), `unreadable` (lecture impossible), `day-unknown` (pas de J absents),
  `baseline-short` (< 14 jours de base), `no-estimate` (aucune dépense), `measured-only`.

### Critères

- C-8 — Given la dépense, les pas et un poids de mesure, When `adjustForSteps` est appelée, Then les vecteurs de
  `tests/fixtures/nutrition/steps-adjustment.json` sont tenus (signe, borne ± 300, part de la formule, jamais 0 inventé, raisons).
- C-9 — Given une dépense mesurée seule, Then l'ajustement est nul et dit « déjà comprise » ; Given le check-in, Then sa proposition est identique avec
  ou sans pas importés (test).
- C-10 — Given le Dashboard, When la dépense est affichée, Then la ligne « Hier, N pas (base M) : +X kcal sur la part formule » ou la raison s'affiche
  avec la source.

## Preuves et écarts

- 029a : rouge a8b57464 (domaine) ; vert 14925475 puis corrections de graphe de chunks (voir 029b) ; `quickMeals.test.ts` (12 cas), `QuickMeals.test.tsx` (5 cas, base SQLite réelle : aperçu sans écriture, quantité modifiée au prorata, hier vide, quantité invalide, favori puis rejeu, récents).
- 029b : rouge e106ea9c ; vert db27b5d0 ; `steps-adjustment.json` (13 vecteurs), `stepsAdjustment.test.ts`, `StepsAdjustment.test.tsx` (affichage, raisons, mesure seule, C-9 : l'instantané garde la même dépense avec ou sans pas).
- Écart : les tests d'écran de 029a ont été écrits avec le code (le rouge de 029a ne porte que le domaine).
- Bundle : le départ a d'abord gagné +3 octets normalisés (193 882 contre 193 879) parce que le Journal importait le domaine des recettes en statique et sortait `recipeTypes` et `renphoDay` de la vue Recettes ; QuickMeals est donc chargé à la demande depuis le Journal (lazy), et les textes « Repas rapides » du bouton passent par le catalogue Nutrition existant. Mesure finale : 193 879 (début : 193 879).
- Synchro : aucune table, aucune colonne, aucun fichier de src/sync ou src/domain/sync touché (favoris = recettes déjà publiées).

## Décisions proposées (sans numéro)

1. Moments de repas par plages horaires (C-1) ; copie d'hier à l'identique (mêmes heures), récents et favoris à l'heure courante.
2. Favoris = recettes d'une portion (C-4, C-6) ; aucune table publiée nouvelle.
3. Ajustement aux pas : 0,04 kcal / pas, base 28 j (≥ 14 j), borne ± 300 kcal, part formule seule, affichage seul, jour de référence la veille.

## Constats d'Ali à faire

À remplir en fin de passe.

## Relecture à froid

Verdict : à corriger, corrigé. Rouge 5847c3c4 (tests d'écran et de domaine), vert dans le commit suivant (« REPAS-029a : relecture à froid »).

- BLOQUANT : les favoris étaient `recipes.list()` sans filtre et `linesFromRecipe` ignorait `servings` ; un « Chili » de 4 portions rejoué écrivait 4 portions. Corrigé : un favori est une recette d'UNE portion sans poids cuit (`isFavoriteRecipe`, filtre à l'affichage) ; `linesFromRecipe` divise par les portions par sécurité. Preuves : tests d'écran (Chili 4 portions et recette à poids cuit absents de la liste) et de domaine (4 × 400 g = 100 g). Limite : une recette de plusieurs portions n'est pas rejouable ici (BL-117).
- Garde contre le double appui sur « Enregistrer comme favori » (une seule recette), test d'écran.
- Copie d'hier répétée : si toutes les lignes (heure, nom, grammes, kcal) sont déjà au journal du jour, message « déjà dans le journal » et aperçu non ouvert ; test d'écran.
- Pluriels par `tPlural` (« 1 aliment », lignes non enregistrées au singulier / pluriel) ; ingrédient de favori sans référence d'aliment ou aux valeurs inconnues retiré et dit à l'aperçu (`replaySkipped`) ; test d'écran.
- I1 : la preuve rouge d'écran de 029a arrive avec ce commit (5847c3c4), les tests d'écran de 029a initiaux ayant été écrits avec le code.
- Bundle après correction : 193 879 octets normalisés (inchangé).
