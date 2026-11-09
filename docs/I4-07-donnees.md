# I4-07 — couche données et synchro (migration 0009, schéma 9)

Fichier à fusionner dans `docs/I4-07.md`. Décisions : D-80 (recettes) et D-81 (journée déclarée), `docs/decisions.md`. Mission de nuit du
2026-11-09, aucune question posée à Ali ; choix prudents consignés, révisables par Ali.

## 1. Passe architect

- PRD § 20.2 liste `food`, `food_portion`, `meal_entry`, `nutrition_target` pour I4 ; les recettes et la journée déclarée n'y ont pas de table.
  Découpage retenu (trois tables NEUVES, aucune table existante modifiée) :
  `day_completeness` (une ligne par date locale), `recipe`, `recipe_ingredient` (clé étrangère vers `recipe`).
- Aucune liste ni aucun CHECK de `meal_entry` ou `food` n'est élargi. Raison (relecture sync-icloud de I4-06) : une ligne nouvelle dont un seul
  champ est hors liste sur un appareil en schéma 8 voit ce champ rangé dans `sync_unknown` et les autres mis de côté (`missing-row`) ; ni la
  réintégration ni `retryParked` ne la retrouvent. Une table neuve n'a pas ce défaut : toute la ligne est dans `sync_unknown`.
- Une prise de recette est une `meal_entry` ordinaire : `source custom`, `method search`, `food_id` = `recipe:<UUID>` (43 caractères, la colonne
  admet 128), `food_name` = nom de la recette, `grams` (ou portions converties en grammes par le domaine) et kcal / macros = instantané.
  La modification ou la suppression de la recette ne touche jamais une entrée déjà écrite.
- `recipe_ingredient` porte l'instantané pour 100 g de chaque ingrédient (NULLABLE : inconnu = NULL, jamais 0) : la recette ne dépend ni d'une
  fiche `food` ni de Ciqual à la lecture.

## 2. Passe data-model

| Table | Colonnes | Contraintes |
|---|---|---|
| `day_completeness` | `id` = `day\|AAAA-MM-JJ`, `date`, `state` | `CHECK (id = 'day\|' \|\| date)`, `date` GLOB, `state IN ('complete','incomplete')`, `UNIQUE(date)` |
| `recipe` | `id` UUID, `name`, `servings`, `cooked_weight_g` | nom 1..120, portions entières 1..100, poids cuit NULL ou ]0 ; 20 000] |
| `recipe_ingredient` | `id` UUID, `recipe_id` → `recipe(id)`, `position`, `name`, `source`, `food_ref`, `grams`, `kcal_100g`, `protein_100g`, `fat_100g`, `carb_100g`, `fiber_100g` | rang entier ≥ 0, nom 1..120, source custom / ciqual / off, `food_ref` NULL ou 1..128, grammes ]0 ; 10 000], kcal 0..900, macros 0..100 (comme `food`) ; index `(recipe_id, position)` |

Colonnes communes : `created_at`, `updated_at`, `deleted_at`, `device_id`, `hlc`. Six déclencheurs de capture (`_ai`, `_au`) sur le modèle des
0007 et 0008, copie figée `CAPTURE_TABLES_V9` (test copie = catalogue). Sauvegarde avant migration : inchangée (`migrationBackup.ts`).
Migration 0009 purement additive : aucune donnée à migrer, aucune perte possible.

Positions : le rang n'est pas unique en SQL (deux appareils peuvent insérer le même rang hors ligne) ; la lecture trie par rang, création, id.
`RecipeRepository.update` réutilise la ligne de même rang (seuls les champs modifiés sont écrits donc publiés), crée les rangs en trop et supprime
logiquement les rangs retirés.

## 3. Périmètre de synchro (relecture D-26)

Catalogue `src/domain/sync/syncTables.ts` : trois tables ajoutées EN FIN de `SYNC_TABLE_ORDER` (`day_completeness`, `recipe`, `recipe_ingredient`,
parent d'abord), aucune colonne locale, aucune règle de publication conditionnelle. Libellés : `fr.syncField`, `fr.syncCarryReport`,
`fr.syncVersion`, `CARRY_REPORT_TABLES`, `SyncReportTable`. Identifiant naturel `day|AAAA-MM-JJ` (`naturalIds.ts`, sans repli UUID).

**Règle de conflit de `day_completeness`** : fusion champ par champ par HLC, dernière écriture gagne (règle par défaut, aucune règle propre).
Deux appareils qui déclarent le même jour différemment, hors ligne, convergent sur la déclaration la plus récente ; l'autre est dans
`conflict_log` (champ `state`, valeur gardée / écartée, appareils) identiquement sur les deux appareils (test (c)). Cas limite connu et documenté :
un effacement (`deleted_at`) concurrent d'une redéclaration (`state`) se fusionne champ par champ ; la journée reste effacée tant qu'une écriture
plus récente ne rétablit pas `deleted_at` (`'+'`).

**Comportement exact d'un appareil resté en schéma 8** (test (b)) : `sm` reste à 1, il continue de lire ; `sv` de chaque enregistrement lui dit que
l'écrivain est plus récent. Pour `day_completeness`, `recipe` et `recipe_ingredient` (absentes de son catalogue) : tous les champs de la ligne,
avec leurs HLC, sont rangés dans `sync_unknown` ; aucune erreur, aucune entrée dans `sync_parked`, aucune table créée, ses propres tables
(`meal_entry`, `food`, etc.) intactes. L'application affiche « Mettez à jour l'app ». Une prise de recette (`meal_entry`) est reçue et appliquée
normalement (lisible : nom et instantané figés, `food_id` = référence logique sans clé étrangère). Après sa mise à jour : `migrate()` crée les tables,
`reintegrateUnknownFields` réintègre les lignes (parents d'abord) et vide `sync_unknown`. Limites héritées : plafond de 50 000 champs / 16 Mio de
`sync_unknown` (les plus anciens abandonnés, environ 3 500 repas ou ~800 recettes de 5 ingrédients) ; remplacement par un instantané d'un
appareil en schéma 8 : lignes rangées dans `sync_unknown`, réintégrées au démarrage suivant. Côté écrans du schéma 8 : un « récent » dont le
`food_id` est `recipe:…` n'est pas résolu par `resolveFood` (rend `null`, sans exception) : la prise reste lisible, pas recalculable.

**Ordre** (test (d)) : un ingrédient reçu avant sa recette est mis de côté (`sync_parked`, `missing-parent`), puis rejoué par `retryParked` à la
lecture suivante ; à l'intérieur d'un même HLC le publicateur envoie le parent d'abord (rang du catalogue).

Tests de non-régression : `tests/unit/sync/i4/recipeSync.test.ts` ((a) PC et iPhone simulés, suppression et tombstone, déclaration effacée puis
rétablie, instantané ; (b) schéma 8 ; (c) conflit sur le même champ ; (d) ordre) ; `src/db/migrations/0009_recipes.test.ts` ; fixtures
`spartiate-v9-schema.sql` et `spartiate-0009-statements.sql` (générées, `spartiateSchemaFixture.test.ts` détecte la dérive) ; Rust : 88 références
(40 de Spartiate), `APP_SCHEMA_VERSION = 9`.

## 4. Export / import (schéma 9)

`TRAINING_EXPORT_TABLES` gagne `day_completeness`, `recipe`, `recipe_ingredient` (parents d'abord), `EXPORT_SV = 9`. Une archive de schéma
antérieur n'a pas ces clés : `ExportData.archiveSv` (version du manifeste, hors forme canonique) et `TABLE_SINCE_SV` font qu'un import en
« remplacer » ne supprime JAMAIS les lignes locales d'une table que l'archive ne pouvait pas connaître (correction aussi, sans effet de bord, pour
les tables de 0005 à 0008). Une archive de schéma 9 sans recette, elle, dit que la table est vide : « remplacer » la vide. Archive de schéma 10 :
refusée (`future-version`), comme aujourd'hui.

## 5. Interfaces (src/db/repositories)

```ts
interface DayCompletenessRepository {
  declare(date: LocalDate, state: DayDeclaration): Promise<DayDeclarationRecord>;
  clear(date: LocalDate): Promise<void>;
  get(date: LocalDate): Promise<DayDeclarationRecord | null>;
  listBetween(from: LocalDate, to: LocalDate): Promise<ReadonlyMap<LocalDate, DayDeclaration>>;
}
interface RecipeRepository {
  create(draft: RecipeDraft, options?: { readonly id?: string }): Promise<Recipe>;
  update(id: string, draft: RecipeDraft): Promise<Recipe>;
  softDelete(id: string): Promise<void>;
  get(id: string): Promise<Recipe | null>;
  list(): Promise<readonly Recipe[]>;
}
// Repositories : readonly dayCompleteness: () => Promise<DayCompletenessRepository>; readonly recipes: () => Promise<RecipeRepository>;
```

Erreurs : `RepositoryError('invalid' | 'not-found' | 'conflict')`. Validation (forme = CHECK de la migration, refus propre avant écriture) : nom 1..120
rogné, portions entières 1..100, poids cuit NULL ou ]0 ; 20 000], 1 à 60 ingrédients, grammes ]0 ; 10 000], bornes pour 100 g de `food`.
Écritures publiables : signal de synchro (`signalingWrites`). Domaine : `recipeFoodId(id)` et `parseRecipeFoodId(foodId)` (`food.ts`),
`validateMealEntry` accepte `recipe:<UUID>` en source `custom` seulement ; `parseFoodId` et `FoodRef` inchangés.

## 6. Écarts et limites

- `src/domain/nutrition/food.ts` et `mealEntry.ts` (domaine, hors propriété de ce rôle) : ajout minimal de la référence `recipe:` ; à relire par domain-logic.
- `src/domain/exportImport/{archive,plan}.ts` : `archiveSv` et `TABLE_SINCE_SV` (voir § 4).
- Les CHECK de la base sont plus stricts que le catalogue de synchro (bornes numériques) : une opération reçue hors bornes est rejetée et journalisée
  (`received-unapplied`), comme pour `meal_entry` (remarque de I4-06). Non traité ici : le catalogue n'exprime pas de bornes numériques.
- Champs liés fusionnés séparément (`grams` et valeurs pour 100 g d'un ingrédient ; `servings` et `cooked_weight_g`) : une cohérence entre eux n'est pas imposée.
