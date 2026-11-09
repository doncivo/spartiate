import { afterEach, describe, expect, it } from 'vitest';
import type { SearchableFood } from '../../../domain/nutrition/foodSearch';
import { ingredientFromFood } from '../../../domain/nutrition/recipe';
import type { RecipeDraft } from '../../../domain/nutrition/recipeTypes';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/** REV-01 constat 7 : un aliment au nom long, ajouté à une recette, s'enregistre ; la limite exacte est testée dans la base. */
const DEVICE = '60000000-0000-4000-8000-0000000000fa' as DeviceId;
let db: TestDb;
afterEach(async () => db.close());
const food = (name: string): SearchableFood => ({ ref: 'ciqual:20047', provenance: 'ciqual', name, brand: null, barcode: null, per100g: { kcal: 18, proteinG: 0.9, fatG: 0.2, carbG: 3.9, fiberG: null } });
const draftFor = (ingredient: NonNullable<ReturnType<typeof ingredientFromFood>>): RecipeDraft => ({ name: 'Recette', servings: 2, cookedWeightG: null, ingredients: [ingredient] });

describe('REV-01 constat 7 : enregistrement d’un ingrédient au nom long', () => {
  it('150 et 200 caractères : l’ajout depuis un aliment s’enregistre (nom rogné à la borne)', async () => {
    db = await openBaseDb(DEVICE);
    for (const length of [120, 150, 200]) {
      const ingredient = ingredientFromFood(food('y'.repeat(length)), 100);
      if (!ingredient) throw new Error('ingrédient attendu');
      const saved = await (await db.data.repos.recipes()).create(draftFor(ingredient));
      expect(saved.ingredients[0]?.name.length).toBe(120);
    }
  });

  it('121 caractères saisis à la main : refus propre, rien n’est écrit', async () => {
    db = await openBaseDb(DEVICE);
    const ingredient = ingredientFromFood(food('z'), 100);
    if (!ingredient) throw new Error('ingrédient attendu');
    await expect((await db.data.repos.recipes()).create(draftFor({ ...ingredient, name: 'z'.repeat(121) }))).rejects.toMatchObject({ code: 'invalid' });
    expect(await (await db.data.repos.recipes()).list()).toEqual([]);
  });
});
