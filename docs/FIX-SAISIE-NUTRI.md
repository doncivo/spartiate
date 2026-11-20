# FIX-SAISIE-NUTRI — saisie nutrition fiable (lot 0.28.0, phase 2)

Constats de l'audit Claude 0.27.0 : C-032, C-033, C-034, C-036, C-095, C-096, C-097, C-098. Budget M (150 k) ; un dépassement serait seulement consigné ici (D-333). Chapitres : PRD 15 (§ 15.1, § 15.3, § 15.4), 18. Rôles : nutrition, domain-logic. Preuves d'origine : `partie5-nutrition.test.ts` (C-032 à C-036) ; C-095 à C-098 n'ont pas de preuve exécutable dans l'audit (lecture) : tests d'écran écrits ici.

## Périmètre

Dans : `src/domain/nutrition` (`journal.ts`, `offProduct.ts`, `mealEntry.ts`, `tdee.ts`), `src/features/nutrition` (`useCases.ts`, `shared.tsx`, `journal/JournalView.tsx`, `NutritionScreen.tsx`, `NutritionRemainingCard.tsx`, `search/offLookup.ts`, `search/FoodSearchPanel.tsx`, nouveau `useCurrentDay.ts`), catalogue `src/i18n/fr.nutrition.ts`. Hors périmètre : migrations, synchro (`src/sync`, `src/domain/sync` non touchés), schéma, `tests/fixtures`.

## Règles (choix prudents, révisables par Ali)

1. C-032 : `rescaleEntry` ne ramène plus les totaux au dixième à chaque correction (arrondi à 10^-6 seulement) ; l'affichage reste au dixième / à l'entier.
2. C-033 : si kcal × 4,184 s'écarte du kJ de plus de 15 %, la fiche prend kJ / 4,184 et le dit (`energyFromKj`, une ligne sur la fiche). Un seul des deux : inchangé.
3. C-034 : Quick Add : chaque macro ≤ 1 000 g, et 4P + 4G + 9L ≤ 1,15 × kcal + 20 ; refus nommé (message dédié), à la création comme à la correction.
4. C-036 : la dépense mesurée est lissée (EMA 7 j) sur l'historique des 21 derniers jours recalculé à chaque lecture (`estimateTdeeSmoothed`) ; rien n'est persisté ; un pas nul remplace la valeur par la mesure.
5. C-095 : champs numériques de la nutrition en `type="text"` `inputMode="decimal"` (virgule conservée par le moteur).
6. C-096 : le jour « aujourd'hui » est relu au retour au premier plan et à minuit (`useCurrentDay`), le journal qui suivait aujourd'hui le suit.
7. C-097 : pendant qu'un formulaire (recherche, Quick Add, correction) est ouvert, le jour affiché est celui de l'ouverture et la navigation de jour est désactivée.
8. C-098 : supprimer une autre entrée (ou déclarer la journée) ne ferme pas le formulaire en cours ; supprimer l'entrée en correction le ferme.

## Critères (Given / When / Then)

- C-032. Given 100 g à 14 kcal, When 1 g puis 100 g, Then 14 kcal.
- C-033. Given kcal 0, 1 500 kJ, macros 10/5/60, Then ≈ 359 kcal et `energyFromKj` ; Given 63 kcal et 264 kJ (cohérents), Then 63 et pas de signal.
- C-034. Given 100 kcal et 5 000 g de protéines, Then refus ; Given 600 kcal, 30/20/70, Then accepté.
- C-036. Given historique 2 000 puis 3 000 kcal, Then dépense lissée ≠ brute, valeur calculée à la main (2 052,11) ; pas nul : la mesure remplace.
- C-095. Then les champs sont `type="text"` et « 12,5 » est lu 12,5 (Quick Add enregistre 12,5 g de protéines).
- C-096. Given journal ouvert le 9, When l'horloge passe au 10 et l'app revient au premier plan, Then le journal affiche le 10 et « Ajouter » écrit le 10.
- C-097. Given Quick Add ouvert, Then « ‹ » est désactivé et l'entrée est écrite au jour affiché.
- C-098. Given Quick Add rempli, When une autre entrée est supprimée, Then la saisie reste.

## Passes

product-owner (cette fiche), agent du module, qa-test : consignés plus bas. code-reviewer : à faire par l'appelant.
