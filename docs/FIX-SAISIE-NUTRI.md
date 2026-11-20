# FIX-SAISIE-NUTRI — saisie nutrition fiable (lot 0.28.0, phase 2)

Constats de l'audit Claude 0.27.0 : C-032, C-033, C-034, C-036, C-095, C-096, C-097, C-098. Budget M (150 k) ; un dépassement serait seulement consigné ici (D-333). Chapitres : PRD 15 (§ 15.1, § 15.3, § 15.4), 18. Rôles : nutrition, domain-logic. Preuves d'origine : `partie5-nutrition.test.ts` (C-032 à C-036) ; C-095 à C-098 n'ont pas de preuve exécutable dans l'audit (lecture) : tests d'écran écrits ici.

## Périmètre

Dans : `src/domain/nutrition` (`journal.ts`, `offProduct.ts`, `mealEntry.ts`, `tdee.ts`), `src/features/nutrition` (`useCases.ts`, `shared.tsx`, `journal/JournalView.tsx`, `NutritionScreen.tsx`, `NutritionRemainingCard.tsx`, `search/offLookup.ts`, `search/FoodSearchPanel.tsx`, nouveau `useCurrentDay.ts`), catalogue `src/i18n/fr.nutrition.ts`. Hors périmètre : migrations, synchro (`src/sync`, `src/domain/sync` non touchés), schéma, `tests/fixtures`.

## Règles (choix prudents, révisables par Ali)

1. C-032 : `rescaleEntry` ne ramène plus les totaux au dixième à chaque correction (arrondi à 10^-6 seulement) ; l'affichage reste au dixième / à l'entier.
2. C-033 : si kcal × 4,184 s'écarte du kJ de plus de 15 %, la fiche prend kJ / 4,184 et le dit (`energyFromKj`, une ligne sur la fiche). Un seul des deux : inchangé.
3. C-034 : Quick Add : chaque macro ≤ 1 000 g, et 4P + 4G + 9L ≤ 1,25 × kcal + 20 ; refus nommé (message dédié), à la création comme à la correction.
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

## Passes consignées

- product-owner : fiche ci-dessus, avant les tests. Rouge `2d545dde` : 12 échecs de domaine et 4 d'écran, tous pour la bonne cause (C-098 : le champ Calories a disparu après la suppression).
- Agent du module : `journal.ts` (aller-retour exact), `offProduct.ts` (`energyFromKj`), `mealEntry.ts` (`QUICK_ADD_MACRO_MAX_G`, marge d'énergie, motif `macros-exceed-energy`), `tdee.ts` (`previousSmoothedFor`, `estimateTdeeSmoothed`, pas nul remplace), `useCases.ts` ; écrans : `shared.tsx` (champs texte), `JournalView.tsx` (jour figé, écriture étrangère), nouveau `useCurrentDay.ts` (Journal, carte « nutrition restante »), `offLookup.ts` et `FoodSearchPanel.tsx` (signal kJ), `QuickAddForm.tsx` et `EntryEditor.tsx` (message dédié), `fr.nutrition.ts` (2 clés). Tests existants mis à jour parce que la spécification a changé : `toHaveValue` numérique → texte (4 fichiers), pas nul de `smoothTdee`, OFF kcal/kJ cohérents.
- qa-test : marge d'énergie portée de 1,15 à 1,25 (+ 20 kcal) après échec de données de test réalistes (20/10/50 g pour 300 kcal = 370 kcal annoncés, fibres et polyols) ; ajoutés : refus 100 kcal / 5 000 g à l'écran, suppression de l'entrée en correction, formulaire ouvert à travers minuit. Hors périmètre : vecteurs `tests/fixtures/nutrition` 8 semaines inchangés (verts, ils passent `previousSmoothed` explicitement). `src/sync` et `src/domain/sync` non touchés ; aucune migration, aucune dépendance.
- code-reviewer : à faire par l'appelant.

## Passe code-reviewer (à froid, agent distinct) : à corriger, puis corrigé

Contrôles : 728 tests ciblés verts, eslint vide, rouge `2d545dde` avant vert `fca6f662`, couches respectées, `useCurrentDay` hors du départ
(`NutritionRemainingCard` à la demande), EMA recalculée à la main (2 052,108), tests existants modifiés justifiés. Important : la borne de D-343
bloquait l'import Renpho (entrée Quick Add revalidée par le dépôt) : corrigé (rouge `521b51ef`, vert suivant ; 770 tests de la nutrition et de
l'import Santé verts). Suggestions : (2) « 1 200 », « 1e3 », « 0x10 » : corrigé avec D-344 ; (3) test du minuteur de minuit en fausses horloges et
de démontage de `useCurrentDay`, (5) motif `macro-too-large` dans le domaine : registre BL-103 ; (4) les cas qa-test de `Saisie.test.tsx` sont
arrivés avec le vert (ajouts après implémentation).

## Décisions : D-341, D-342, D-343, D-344 (docs/decisions.md)

- **D-341** : une correction de grammes d'une entrée ne perd plus de précision (valeurs au millionième, affichage arrondi) : l'aller-retour 100 g → 1 g → 100 g rend la valeur d'origine (C-032).
- **D-342** : Open Food Facts : si kcal × 4,184 s'écarte du kJ annoncé de plus de 15 %, la fiche prend kJ / 4,184 et le dit sur la fiche récupérée (« estimation ») ; un seul des deux champs : inchangé (C-033).
- **D-343** : Quick Add (création et correction) : chaque macro ≤ 1 000 g et 4P + 4G + 9L ≤ 1,25 × kcal + 20, sinon refus avec un message dédié (C-034). Revue : l'entrée « Renpho — total du jour » de l'import Santé n'est pas soumise à ces bornes (sinon un jour partiel faisait échouer tout l'import). Limite : une entrée Quick Add ancienne et incohérente doit être corrigée pour être enregistrée de nouveau.
- **D-344** : saisie : champs numériques de la nutrition en texte `inputMode="decimal"` (C-095) ; le jour d'« aujourd'hui » est relu au retour au premier plan, au focus et à minuit (`useCurrentDay`) (C-096) ; un formulaire ouvert garde son jour et la navigation de jour est désactivée (C-097) ; une écriture étrangère (suppression d'une autre entrée) ne ferme pas le formulaire (C-098). Revue : `parseNumber` retire les espaces de milliers (ordinaires, insécables, fines : « 1 200 ») et n'accepte que chiffres et un séparateur décimal (refus de « 1e3 », « 0x10 », « ,5 »).
- **D-357** : dépense mesurée (§ 15.1) lissée par l'EMA de demi-vie 7 j rejouée sur les 21 derniers jours à chaque lecture (`estimateTdeeSmoothed`), sans valeur persistée (rien à synchroniser) ; un pas nul remplace la valeur par la mesure (C-036).

## Constats d'Ali à faire

- Vérifier sur iPhone (WebKit) : « 12,5 » dans Quick Add, clavier décimal ; PC ouvert de part et d'autre de minuit.
- Valider les bornes de D-342 (15 %) et D-343 (1 000 g, marge 25 % + 20 kcal) ; la dépense affichée peut changer (lissée) par rapport à 0.27.
- C-095 n'a pas d'e2e `iphone-webkit` (non ajouté ici : CI seulement, à demander à qa-test).

## Écarts au brief

- Persistance de la valeur lissée remplacée par un recalcul de l'historique (D-357) : pas de nouveau réglage, cohérent entre appareils. Le critère « vecteurs 8 semaines » n'est pas modifié.
