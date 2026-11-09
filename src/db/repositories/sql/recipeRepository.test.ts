import { afterEach, describe, expect, it } from 'vitest';
import type { RecipeDraft } from '../../../domain/nutrition/recipeTypes';
import type { DeviceId, LocalDate, LocalTime } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * I4-07 (D-80) : `RecipeRepository` (tables `recipe` et `recipe_ingredient`, migration 0009). Recette et ingrédients écrits en UNE transaction ;
 * modification = remplacement des ingrédients (ceux retirés sont supprimés logiquement) ; suppression logique de la recette et de ses
 * ingrédients ; valeurs inconnues conservées nulles ; lecture d'une prise de recette sans casser les récents. Fixtures synthétiques.
 */

const DEVICE = '60000000-0000-4000-8000-0000000000f9' as DeviceId;
const R = (n: number): string => `7d3c2e4f-0000-4000-8000-0000000000c${n}`;
const NONE = { kcal: null, proteinG: null, fatG: null, carbG: null, fiberG: null };
let db: TestDb;
afterEach(async () => db.close());

const rice = { name: 'Riz synthétique', source: 'custom', foodRef: null, grams: 300, per100g: { kcal: 130, proteinG: 2.7, fatG: 0.3, carbG: 28, fiberG: 0.4 } } as const;
const chicken = { name: 'Poulet synthétique', source: 'ciqual', foodRef: 'ciqual:1000', grams: 500, per100g: NONE } as const;
const oil = { name: 'Huile synthétique', source: 'off', foodRef: '4006381333931', grams: 15, per100g: { kcal: 900, proteinG: 0, fatG: 100, carbG: 0, fiberG: null } } as const;
const draft = (over: Partial<RecipeDraft> = {}): RecipeDraft => ({ name: 'Poulet-riz synthétique', servings: 4, cookedWeightG: 1200, ingredients: [rice, chicken], ...over });
const repo = async () => db.data.repos.recipes();
const outbox = (table: string) => db.driver.select<{ row_id: string; field: string }>('SELECT row_id, field FROM sync_outbox WHERE table_name = ? ORDER BY seq', [table]);
/** Panne SQL simulée, après la validation : tout ingrédient nommé « Boom » est refusé par la base (insertion et modification). */
const boom = async (): Promise<void> => {
  for (const when of ['INSERT', 'UPDATE']) await db.driver.execute(`CREATE TRIGGER boom_${when.toLowerCase()} BEFORE ${when} ON recipe_ingredient WHEN NEW.name = 'Boom' BEGIN SELECT RAISE(ABORT, 'panne simulée'); END`);
};
const live = async (): Promise<number> => Number((await db.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM recipe_ingredient WHERE deleted_at IS NULL'))[0]?.n);

describe('RecipeRepository : création', () => {
  it('create : recette et ingrédients relus tels quels, rangs 0.., identifiants UUID, inconnu null, mise en file en ligne entière', async () => {
    db = await openBaseDb(DEVICE);
    const created = await (await repo()).create(draft(), { id: R(1) });
    expect(created).toMatchObject({ id: R(1), name: 'Poulet-riz synthétique', servings: 4, cookedWeightG: 1200 });
    expect(created.ingredients.map((i) => [i.position, i.name, i.source, i.foodRef, i.grams, i.per100g])).toEqual([
      [0, 'Riz synthétique', 'custom', null, 300, rice.per100g],
      [1, 'Poulet synthétique', 'ciqual', 'ciqual:1000', 500, NONE],
    ]);
    for (const i of created.ingredients) expect(i.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(await (await repo()).get(R(1))).toEqual(created);
    expect(await outbox('recipe')).toEqual([{ row_id: R(1), field: '*' }]);
    expect(await outbox('recipe_ingredient')).toHaveLength(2);
  });

  it('create sans poids cuit : null ; identifiant fabriqué si omis ; nom rogné', async () => {
    db = await openBaseDb(DEVICE);
    const r = await (await repo()).create(draft({ name: '  Soupe synthétique  ', cookedWeightG: null }));
    expect(r.name).toBe('Soupe synthétique');
    expect(r.cookedWeightG).toBeNull();
    expect(r.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('une recette invalide est refusée sans rien écrire (ni recette ni ingrédient)', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    const bad: RecipeDraft[] = [
      draft({ name: '   ' }),
      draft({ name: 'x'.repeat(121) }),
      draft({ servings: 0 }),
      draft({ servings: 101 }),
      draft({ servings: 2.5 }),
      draft({ cookedWeightG: 0 }),
      draft({ cookedWeightG: 20_001 }),
      draft({ cookedWeightG: Number.NaN }),
      draft({ ingredients: [] }),
      draft({ ingredients: Array.from({ length: 61 }, () => rice) }),
      draft({ ingredients: [rice, { ...chicken, grams: 0 }] }),
      draft({ ingredients: [rice, { ...chicken, grams: 10_001 }] }),
      draft({ ingredients: [rice, { ...chicken, name: '' }] }),
      draft({ ingredients: [rice, { ...chicken, source: 'manual' as never }] }),
      draft({ ingredients: [rice, { ...chicken, foodRef: '' }] }),
      draft({ ingredients: [rice, { ...chicken, per100g: { ...NONE, kcal: 901 } }] }),
      draft({ ingredients: [rice, { ...chicken, per100g: { ...NONE, proteinG: -1 } }] }),
      draft({ ingredients: [rice, { ...chicken, per100g: { ...NONE, carbG: 101 } }] }),
    ];
    for (const [i, b] of bad.entries()) await expect(r.create(b, { id: R(1) }), String(i)).rejects.toMatchObject({ code: 'invalid' });
    expect(await db.driver.select('SELECT * FROM recipe')).toEqual([]);
    expect(await db.driver.select('SELECT * FROM recipe_ingredient')).toEqual([]);
  });

  it('identifiant déjà pris : conflit', async () => {
    db = await openBaseDb(DEVICE);
    await (await repo()).create(draft(), { id: R(1) });
    await expect((await repo()).create(draft(), { id: R(1) })).rejects.toMatchObject({ code: 'conflict' });
  });

  it('atomique : un ingrédient refusé par la base annule la recette déjà insérée (une seule transaction)', async () => {
    db = await openBaseDb(DEVICE);
    await boom();
    const sabotage = draft({ ingredients: [rice, { ...chicken, name: 'Boom' }] });
    await expect((await repo()).create(sabotage, { id: R(1) })).rejects.toThrow();
    expect(await db.driver.select('SELECT * FROM recipe')).toEqual([]);
    expect(await db.driver.select('SELECT * FROM recipe_ingredient')).toEqual([]);
    expect(await outbox('recipe')).toEqual([]);
  });

  it('dans DataAccess.transaction : écrit avec la transaction de l’appelant (annulée avec elle)', async () => {
    db = await openBaseDb(DEVICE);
    await expect(
      db.data.transaction(async (repos) => {
        await (await repos.recipes()).create(draft(), { id: R(1) });
        throw new Error('annulée');
      }),
    ).rejects.toThrow('annulée');
    expect(await db.driver.select('SELECT * FROM recipe')).toEqual([]);
  });
});

describe('RecipeRepository : modification', () => {
  it('update : les champs changent, les ingrédients sont remplacés, un seul champ mis en file par valeur modifiée', async () => {
    db = await openBaseDb(DEVICE);
    const created = await (await repo()).create(draft(), { id: R(1) });
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(1_000);
    const updated = await (await repo()).update(R(1), draft({ servings: 6, ingredients: [rice, { ...chicken, grams: 450 }] }));
    expect(updated.servings).toBe(6);
    expect(updated.ingredients.map((i) => [i.name, i.grams])).toEqual([
      ['Riz synthétique', 300],
      ['Poulet synthétique', 450],
    ]);
    expect(updated.ingredients[0]?.id).toBe(created.ingredients[0]?.id); // ingrédient inchangé : même ligne, aucune écriture
    expect((await outbox('recipe')).map((o) => o.field)).toEqual(['servings']);
    expect(await outbox('recipe_ingredient')).toEqual([{ row_id: created.ingredients[1]?.id, field: 'grams' }]);
  });

  it('update : un ingrédient retiré est supprimé logiquement, un ajouté est créé', async () => {
    db = await openBaseDb(DEVICE);
    await (await repo()).create(draft({ ingredients: [rice, chicken, oil] }), { id: R(1) });
    db.clock.advance(1_000);
    const r = await (await repo()).update(R(1), draft({ ingredients: [rice] }));
    expect(r.ingredients.map((i) => i.name)).toEqual(['Riz synthétique']);
    expect(await live()).toBe(1);
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM recipe_ingredient')).toEqual([{ n: 3 }]); // les retirés restent, supprimés logiquement
    db.clock.advance(1_000);
    const back = await (await repo()).update(R(1), draft({ ingredients: [rice, oil, chicken] }));
    expect(back.ingredients.map((i) => [i.position, i.name])).toEqual([
      [0, 'Riz synthétique'],
      [1, 'Huile synthétique'],
      [2, 'Poulet synthétique'],
    ]);
    expect(await live()).toBe(3);
  });

  it('update : poids cuit effacé (null) conservé nul ; recette absente ou supprimée : not-found ; invalide : refusé et rien écrit', async () => {
    db = await openBaseDb(DEVICE);
    await (await repo()).create(draft(), { id: R(1) });
    db.clock.advance(1_000);
    expect((await (await repo()).update(R(1), draft({ cookedWeightG: null }))).cookedWeightG).toBeNull();
    await expect((await repo()).update(R(2), draft())).rejects.toMatchObject({ code: 'not-found' });
    await expect((await repo()).update(R(1), draft({ servings: 0 }))).rejects.toMatchObject({ code: 'invalid' });
    expect((await (await repo()).get(R(1)))?.servings).toBe(4);
    await (await repo()).softDelete(R(1));
    await expect((await repo()).update(R(1), draft())).rejects.toMatchObject({ code: 'not-found' });
  });

  it('update sans aucun changement : aucune écriture', async () => {
    db = await openBaseDb(DEVICE);
    const created = await (await repo()).create(draft(), { id: R(1) });
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(1_000);
    const same = await (await repo()).update(R(1), draft());
    expect(same).toEqual(created);
    expect(await outbox('recipe')).toEqual([]);
    expect(await outbox('recipe_ingredient')).toEqual([]);
  });

  it('atomique : une modification refusée par la base ne laisse aucun ingrédient à moitié remplacé', async () => {
    db = await openBaseDb(DEVICE);
    await (await repo()).create(draft(), { id: R(1) });
    await boom();
    db.clock.advance(1_000);
    await expect((await repo()).update(R(1), draft({ servings: 6, ingredients: [{ ...rice, grams: 100 }, { ...chicken, name: 'Boom' }] }))).rejects.toThrow();
    const r = await (await repo()).get(R(1));
    expect(r?.servings).toBe(4);
    expect(r?.ingredients.map((i) => i.grams)).toEqual([300, 500]);
  });
});

describe('RecipeRepository : suppression et lecture', () => {
  it('softDelete : recette et ingrédients supprimés logiquement en une écriture ; get null ; absente ou déjà supprimée : not-found', async () => {
    db = await openBaseDb(DEVICE);
    await (await repo()).create(draft(), { id: R(1) });
    db.clock.advance(1_000);
    await (await repo()).softDelete(R(1));
    expect(await (await repo()).get(R(1))).toBeNull();
    expect(await live()).toBe(0);
    expect(await db.driver.select('SELECT deleted_at IS NOT NULL AS gone FROM recipe')).toEqual([{ gone: 1 }]);
    await expect((await repo()).softDelete(R(1))).rejects.toMatchObject({ code: 'not-found' });
    await expect((await repo()).softDelete(R(9))).rejects.toMatchObject({ code: 'not-found' });
  });

  it('list : recettes vivantes triées par nom sans casse ni accent d’ordre, ingrédients par rang', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await r.create(draft({ name: 'tarte synthétique', ingredients: [chicken, rice] }), { id: R(1) });
    await r.create(draft({ name: 'Bœuf synthétique' }), { id: R(2) });
    await r.create(draft({ name: 'Algues synthétiques' }), { id: R(3) });
    await r.create(draft({ name: 'Supprimée' }), { id: R(4) });
    await r.softDelete(R(4));
    const list = await r.list();
    expect(list.map((x) => x.name)).toEqual(['Algues synthétiques', 'Bœuf synthétique', 'tarte synthétique']);
    expect(list[2]?.ingredients.map((i) => i.name)).toEqual(['Poulet synthétique', 'Riz synthétique']);
    expect(list.every((x) => x.ingredients.length > 0)).toBe(true);
  });

  it('list : un ingrédient supprimé n’apparaît pas ; une recette sans ingrédient vivant reste lisible avec une liste vide', async () => {
    db = await openBaseDb(DEVICE);
    await (await repo()).create(draft(), { id: R(1) });
    await db.driver.execute('UPDATE recipe_ingredient SET deleted_at = updated_at');
    expect((await (await repo()).list())[0]?.ingredients).toEqual([]);
  });

  it('listes de 60 ingrédients : relues dans l’ordre', async () => {
    db = await openBaseDb(DEVICE);
    const many = Array.from({ length: 60 }, (_, i) => ({ ...rice, name: `Ingrédient ${i}`, grams: i + 1 }));
    const created = await (await repo()).create(draft({ ingredients: many }), { id: R(1) });
    expect(created.ingredients.map((i) => i.position)).toEqual(Array.from({ length: 60 }, (_, i) => i));
    expect((await (await repo()).get(R(1)))?.ingredients.map((i) => i.name)).toEqual(many.map((i) => i.name));
  });

  it('lève le signal de synchro après chaque écriture (create, update, softDelete)', async () => {
    db = await openBaseDb(DEVICE);
    const { onLocalWrite } = await import('../../localWrite');
    let signals = 0;
    const off = onLocalWrite(() => (signals += 1));
    await (await repo()).create(draft(), { id: R(1) });
    await (await repo()).update(R(1), draft({ servings: 5 }));
    await (await repo()).softDelete(R(1));
    off();
    expect(signals).toBe(3);
  });
});

describe('prise d’une recette dans le journal (meal_entry ordinaire, D-80)', () => {
  const take = (over: Record<string, unknown> = {}) => ({
    date: '2026-11-09' as LocalDate,
    time: '12:30' as LocalTime,
    foodId: `recipe:${R(1)}`,
    foodName: 'Poulet-riz synthétique',
    source: 'custom' as const,
    grams: 300,
    kcal: 390,
    proteinG: 30,
    fatG: 10,
    carbG: 40,
    method: 'search' as const,
    confidence: null,
    ...over,
  });

  it('create : acceptée ; relue ; les récents la listent comme un aliment, sans exception, à côté des autres', async () => {
    db = await openBaseDb(DEVICE);
    const meals = await db.data.repos.mealEntries();
    await meals.create(take({ time: '08:00' as LocalTime, foodId: 'ciqual:1000', source: 'ciqual', foodName: 'Pastis' }), { id: R(7) });
    const entry = await meals.create(take(), { id: R(8) });
    expect(entry).toMatchObject({ foodId: `recipe:${R(1)}`, source: 'custom', method: 'search', grams: 300, kcal: 390 });
    const recents = await meals.recentFoods(10);
    expect(recents.map((r) => [r.foodId, r.foodName, r.source])).toEqual([
      [`recipe:${R(1)}`, 'Poulet-riz synthétique', 'custom'],
      ['ciqual:1000', 'Pastis', 'ciqual'],
    ]);
  });

  it('la recette supprimée ou modifiée ensuite ne change pas l’entrée (instantané)', async () => {
    db = await openBaseDb(DEVICE);
    await (await repo()).create(draft(), { id: R(1) });
    const meals = await db.data.repos.mealEntries();
    await meals.create(take(), { id: R(8) });
    await (await repo()).update(R(1), draft({ name: 'Autre nom', servings: 2 }));
    await (await repo()).softDelete(R(1));
    expect(await meals.get(R(8))).toMatchObject({ foodName: 'Poulet-riz synthétique', kcal: 390, grams: 300, foodId: `recipe:${R(1)}` });
    expect((await meals.listByDate('2026-11-09' as LocalDate)).map((e) => e.id)).toEqual([R(8)]);
  });

  it('une prise dont la recette est refusée par la provenance ou la référence reste refusée', async () => {
    db = await openBaseDb(DEVICE);
    const meals = await db.data.repos.mealEntries();
    await expect(meals.create(take({ source: 'off' }), { id: R(8) })).rejects.toMatchObject({ code: 'invalid' });
    await expect(meals.create(take({ foodId: 'recipe:pas-un-uuid' }), { id: R(8) })).rejects.toMatchObject({ code: 'invalid' });
  });
});
