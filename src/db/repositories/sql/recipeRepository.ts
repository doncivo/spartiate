import type { WriteStamper } from '../../../domain/hlc';
import { uuidGenerator, type IdGenerator } from '../../../domain/id';
import type { Per100g } from '../../../domain/nutrition/food';
import {
  RECIPE_COOKED_WEIGHT_MAX_G,
  RECIPE_INGREDIENT_GRAMS_MAX,
  RECIPE_INGREDIENT_MAX,
  RECIPE_INGREDIENT_NAME_MAX,
  RECIPE_NAME_MAX,
  RECIPE_SERVINGS_MAX,
  type IngredientSource,
  type Recipe,
  type RecipeDraft,
  type RecipeIngredient,
} from '../../../domain/nutrition/recipeTypes';
import { isId, type IsoDateTime } from '../../../domain/types';
import type { SqlDriver, SqlExecutor, SqlRow } from '../../driver';
import { RepositoryError } from '../common';
import type { RecipeRepository } from '../recipeRepository';
import type { SyncRow } from './sqlHelpers';

interface RecipeRow extends SqlRow, SyncRow {
  readonly name: string;
  readonly servings: number;
  readonly cooked_weight_g: number | null;
}

interface IngredientRow extends SqlRow, SyncRow {
  readonly recipe_id: string;
  readonly position: number;
  readonly name: string;
  readonly source: string;
  readonly food_ref: string | null;
  readonly grams: number;
  readonly kcal_100g: number | null;
  readonly protein_100g: number | null;
  readonly fat_100g: number | null;
  readonly carb_100g: number | null;
  readonly fiber_100g: number | null;
}

type IngredientDraft = RecipeDraft['ingredients'][number];

const SOURCES: readonly string[] = ['custom', 'ciqual', 'off'];
const FOOD_REF_MAX = 128;

const toIngredient = (row: IngredientRow): RecipeIngredient => ({
  id: row.id,
  position: row.position,
  name: row.name,
  source: row.source as IngredientSource,
  foodRef: row.food_ref,
  grams: row.grams,
  per100g: { kcal: row.kcal_100g, proteinG: row.protein_100g, fatG: row.fat_100g, carbG: row.carb_100g, fiberG: row.fiber_100g },
});

const toRecipe = (row: RecipeRow, ingredients: readonly IngredientRow[]): Recipe => ({
  id: row.id,
  name: row.name,
  servings: row.servings,
  cookedWeightG: row.cooked_weight_g,
  ingredients: ingredients.map(toIngredient),
  updatedAt: row.updated_at as IsoDateTime,
});

/** Valeur pour 100 g : inconnue (`null`) ou finie dans [0 ; max]. Reprend les bornes de `food` (kcal 900, macros 100). */
const per100Ok = (value: number | null, max: number): boolean => value === null || (Number.isFinite(value) && value >= 0 && value <= max);
const per100Valid = (p: Per100g): boolean => per100Ok(p.kcal, 900) && per100Ok(p.proteinG, 100) && per100Ok(p.fatG, 100) && per100Ok(p.carbG, 100) && per100Ok(p.fiberG, 100);

/** Les mêmes bornes que les CHECK de la migration 0009, vérifiées avant toute écriture pour refuser proprement (`'invalid'`). */
function normalized(draft: RecipeDraft): RecipeDraft | null {
  const name = draft.name.trim();
  if (name.length < 1 || name.length > RECIPE_NAME_MAX) return null;
  if (!Number.isInteger(draft.servings) || draft.servings < 1 || draft.servings > RECIPE_SERVINGS_MAX) return null;
  const cooked = draft.cookedWeightG;
  if (cooked !== null && (!Number.isFinite(cooked) || cooked <= 0 || cooked > RECIPE_COOKED_WEIGHT_MAX_G)) return null;
  if (draft.ingredients.length < 1 || draft.ingredients.length > RECIPE_INGREDIENT_MAX) return null;
  const ingredients: IngredientDraft[] = [];
  for (const ingredient of draft.ingredients) {
    const ingredientName = ingredient.name.trim();
    if (ingredientName.length < 1 || ingredientName.length > RECIPE_INGREDIENT_NAME_MAX) return null;
    if (!SOURCES.includes(ingredient.source)) return null;
    if (ingredient.foodRef !== null && (ingredient.foodRef.length < 1 || ingredient.foodRef.length > FOOD_REF_MAX)) return null;
    if (!Number.isFinite(ingredient.grams) || ingredient.grams <= 0 || ingredient.grams > RECIPE_INGREDIENT_GRAMS_MAX) return null;
    if (!per100Valid(ingredient.per100g)) return null;
    ingredients.push({ ...ingredient, name: ingredientName });
  }
  return { name, servings: draft.servings, cookedWeightG: cooked, ingredients };
}

const ingredientValues = (i: IngredientDraft, position: number): (string | number | null)[] => [
  position,
  i.name,
  i.source,
  i.foodRef,
  i.grams,
  i.per100g.kcal,
  i.per100g.proteinG,
  i.per100g.fatG,
  i.per100g.carbG,
  i.per100g.fiberG,
];

const sameIngredient = (row: IngredientRow, i: IngredientDraft, position: number): boolean =>
  row.position === position &&
  row.name === i.name &&
  row.source === i.source &&
  row.food_ref === i.foodRef &&
  row.grams === i.grams &&
  row.kcal_100g === i.per100g.kcal &&
  row.protein_100g === i.per100g.proteinG &&
  row.fat_100g === i.per100g.fatG &&
  row.carb_100g === i.per100g.carbG &&
  row.fiber_100g === i.per100g.fiberG;

export function createRecipeRepository(db: SqlExecutor, stamper: WriteStamper, ids: IdGenerator = uuidGenerator): RecipeRepository {
  const atomic = <T>(work: (inTx: RecipeRepository) => Promise<T>): Promise<T> | null =>
    typeof (db as Partial<SqlDriver>).transaction === 'function' ? (db as SqlDriver).transaction((tx) => work(createRecipeRepository(tx, stamper, ids))) : null;
  const readRecipe = async (id: string): Promise<RecipeRow | undefined> => (await db.select<RecipeRow>('SELECT * FROM recipe WHERE id = ?', [id]))[0];
  const liveRecipe = async (id: string): Promise<RecipeRow> => {
    const row = await readRecipe(id);
    if (!row || row.deleted_at !== null) throw new RepositoryError('not-found', 'recipe', id);
    return row;
  };
  const liveIngredients = (id: string): Promise<IngredientRow[]> =>
    db.select<IngredientRow>('SELECT * FROM recipe_ingredient WHERE recipe_id = ? AND deleted_at IS NULL ORDER BY position, created_at, id', [id]);
  const reload = async (id: string): Promise<Recipe> => {
    const row = await readRecipe(id);
    if (!row) throw new RepositoryError('not-found', 'recipe', id);
    return toRecipe(row, await liveIngredients(id));
  };
  const insertIngredient = (recipeId: string, i: IngredientDraft, position: number, stamp: { at: string; deviceId: string; hlc: string }): Promise<unknown> =>
    db.execute(
      `INSERT INTO recipe_ingredient (id, recipe_id, position, name, source, food_ref, grams, kcal_100g, protein_100g, fat_100g, carb_100g, fiber_100g, created_at, updated_at, device_id, hlc)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ids.next(), recipeId, ...ingredientValues(i, position), stamp.at, stamp.at, stamp.deviceId, stamp.hlc],
    );

  return {
    async create(draft, options) {
      const outer = atomic((r) => r.create(draft, options));
      if (outer) return outer;
      const id = options?.id ?? ids.next();
      if (!isId(id)) throw new RepositoryError('invalid', 'recipe', id);
      const clean = normalized(draft);
      if (clean === null) throw new RepositoryError('invalid', 'recipe', id);
      if ((await readRecipe(id)) !== undefined) throw new RepositoryError('conflict', 'recipe', id);
      const stamp = stamper.next();
      await db.execute('INSERT INTO recipe (id, name, servings, cooked_weight_g, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
        id,
        clean.name,
        clean.servings,
        clean.cookedWeightG,
        stamp.at,
        stamp.at,
        stamp.deviceId,
        stamp.hlc,
      ]);
      for (const [position, ingredient] of clean.ingredients.entries()) await insertIngredient(id, ingredient, position, stamp);
      return reload(id);
    },

    async update(id, draft) {
      const outer = atomic((r) => r.update(id, draft));
      if (outer) return outer;
      const row = await liveRecipe(id);
      const clean = normalized(draft);
      if (clean === null) throw new RepositoryError('invalid', 'recipe', id);
      const existing = await liveIngredients(id);
      const byId = new Map(existing.map((row) => [row.id, row] as const));
      const kept = new Set<string>();
      let changed = row.name !== clean.name || row.servings !== clean.servings || row.cooked_weight_g !== clean.cookedWeightG;
      const stamp = stamper.next();
      // Réutilisation PAR IDENTIFIANT : un ingrédient conservé garde sa ligne (et donc sa fusion champ par champ avec l'autre appareil) ;
      // un identifiant inconnu ou déjà utilisé dans ce brouillon est un ingrédient nouveau ; les lignes non reprises sont supprimées.
      for (const [position, next] of clean.ingredients.entries()) {
        const old = next.id !== undefined && !kept.has(next.id) ? byId.get(next.id) : undefined;
        if (old) {
          kept.add(old.id);
          if (sameIngredient(old, next, position)) continue;
          changed = true;
          await db.execute(
            `UPDATE recipe_ingredient SET position = ?, name = ?, source = ?, food_ref = ?, grams = ?, kcal_100g = ?, protein_100g = ?, fat_100g = ?, carb_100g = ?, fiber_100g = ?,
               updated_at = ?, device_id = ?, hlc = ? WHERE id = ?`,
            [...ingredientValues(next, position), stamp.at, stamp.deviceId, stamp.hlc, old.id],
          );
        } else {
          changed = true;
          await insertIngredient(id, next, position, stamp);
        }
      }
      for (const old of existing) {
        if (kept.has(old.id)) continue;
        changed = true;
        await db.execute('UPDATE recipe_ingredient SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, old.id]);
      }
      if (changed) {
        await db.execute('UPDATE recipe SET name = ?, servings = ?, cooked_weight_g = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [
          clean.name,
          clean.servings,
          clean.cookedWeightG,
          stamp.at,
          stamp.deviceId,
          stamp.hlc,
          id,
        ]);
      }
      return reload(id);
    },

    async softDelete(id) {
      const outer = atomic((r) => r.softDelete(id));
      if (outer) return outer;
      await liveRecipe(id);
      const stamp = stamper.next();
      await db.execute('UPDATE recipe_ingredient SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE recipe_id = ? AND deleted_at IS NULL', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, id]);
      await db.execute('UPDATE recipe SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, id]);
    },

    async get(id) {
      const row = await readRecipe(id);
      if (!row || row.deleted_at !== null) return null;
      return toRecipe(row, await liveIngredients(id));
    },

    async list() {
      const recipes = await db.select<RecipeRow>('SELECT * FROM recipe WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE, id');
      if (recipes.length === 0) return [];
      const rows = await db.select<IngredientRow>(
        'SELECT * FROM recipe_ingredient WHERE deleted_at IS NULL AND recipe_id IN (SELECT id FROM recipe WHERE deleted_at IS NULL) ORDER BY recipe_id, position, created_at, id',
      );
      const byRecipe = new Map<string, IngredientRow[]>();
      for (const row of rows) byRecipe.set(row.recipe_id, [...(byRecipe.get(row.recipe_id) ?? []), row]);
      return recipes.map((recipe) => toRecipe(recipe, byRecipe.get(recipe.id) ?? []));
    },
  };
}
