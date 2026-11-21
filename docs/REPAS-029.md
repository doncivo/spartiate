# REPAS-029 — saisie rapide des repas et dépense ajustée aux pas (lot 0.29.0, IA-0c et PRD-I6)

Statut : en cours (branche REPAS-029, non poussée, sans PR). Budget M à L. Modules : nutrition, domain-logic ; recovery en lecture (échantillons `pas`).
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

## Décisions proposées (sans numéro)

1. Moments de repas par plages horaires (C-1) ; copie d'hier à l'identique (mêmes heures), récents et favoris à l'heure courante.
2. Favoris = recettes d'une portion (C-4, C-6) ; aucune table publiée nouvelle.
3. Ajustement aux pas : 0,04 kcal / pas, base 28 j (≥ 14 j), borne ± 300 kcal, part formule seule, affichage seul, jour de référence la veille.

## Constats d'Ali à faire

À remplir en fin de passe.
