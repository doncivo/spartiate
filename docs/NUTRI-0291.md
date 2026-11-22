# NUTRI-0291 — Nutrition et récupération : restes des revues

Lot 0.29.1 (docs/LOT-0.29.1.md), registre « nutrition et récupération » : BL-124, BL-107, BL-102, BL-103, BL-101. Chapitres : 15 (nutrition),
16 (récupération, import Santé). Agents : product-owner, nutrition / recovery, qa-test, code-reviewer. Aucune migration, aucune synchro.
Reporté : BL-117 (taille M, go-tos et assiette en recette), test d'écran de la case « Accepter » du check-in (reste de BL-101).

## Passe product-owner (critères)

1. BL-124 : une même pesée aux deux extrémités de la semaine (fenêtres qui se recouvrent la veille) ne donne jamais une variation de 0 kg
   au check-in : `null` (copie du bilan alignée, garde d'équivalence verte).
2. BL-107 : sous des résultats Ciqual de la recherche d'aliments, l'attribution du catalogue embarqué (Anses, Ciqual 2025, Licence Ouverte
   Etalab 2.0) est écrite ; absente sans résultat Ciqual.
3. BL-102 : un fichier de pas s'écrit en une transaction (totaux et jour partiel, tout ou rien) ; guide Raccourcis, partie A : `poids.csv`
   du plus ancien au plus récent, comme la partie C.
4. BL-103 : motif `macro-too-large` dans `validateMealEntry` (les écrans ne recopient plus la borne) ; minuteur de minuit de
   `useCurrentDay` testé en fausses horloges, démontage sans fuite.
5. BL-101 : cible comparée du tableau de bord exposée par `weeklyBalance` (`targetKcal`), plus recalculée dans les écrans.

## Passe agent du module

- `src/domain/nutrition/weeklyRate.ts`, `src/domain/review/weeklyReview.ts` (BL-124) ; `src/features/nutrition/search/catalogueSearch.ts`,
  `FoodSearchPanel.tsx` (BL-107) ; `src/db/repositories/recoverySampleRepository.ts` et `sql/`, `src/features/settings/recoveryImport/service.ts`,
  `docs/guide-raccourcis-sante.md` (BL-102) ; `src/domain/nutrition/mealEntry.ts`, `QuickAddForm.tsx`, `EntryEditor.tsx` (BL-103) ;
  `src/domain/nutrition/journal.ts`, `src/features/nutrition/dashboard/model.ts` (BL-101).

## Passe qa-test

- Rouge → vert : BL-124 (rouge puis `99f9af89`), BL-107 (rouge puis `5f8d7129`), BL-102 `68928e4d` → `d3a4837c`, BL-103 `6102b774` →
  `074a60db`, BL-101 `990cbaca` → `67c2409a` ; tests seuls (pas de défaut) : `useCurrentDay.test.tsx` (`1150e8c8`).
- Changement d'attente assumé : `saisie.test.ts`, 1 001 g d'une macro : `macro-too-large` au lieu de `value-invalid` (refus inchangé).
- Lancés en local (`--maxWorkers=1`) : src/domain/nutrition, src/domain/review, src/features/nutrition, recoverySampleRepository,
  recoveryImport (verts) ; tsc et eslint propres.

## Passe code-reviewer (à froid)

À consigner après la relecture.
