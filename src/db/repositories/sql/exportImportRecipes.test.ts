import { afterEach, describe, expect, it } from 'vitest';
import { ArchiveError, buildExportArchive, canonicalHash, EXPORT_SV, parseExportArchive, TRAINING_EXPORT_TABLES, type ExportData } from '../../../domain/exportImport/archive';
import { planImport } from '../../../domain/exportImport/plan';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * I4-07 : l'export / import (D-57) porte la journée déclarée, les recettes et leurs ingrédients (schéma 9). Une archive plus ancienne, SANS
 * ces clés, s'importe sans rien supprimer de ces tables, même en « remplacer » ; une archive d'un schéma plus récent est refusée.
 */

const A = '60000000-0000-4000-8000-0000000000aa' as DeviceId;
const B = '60000000-0000-4000-8000-0000000000bb' as DeviceId;
const R = '7b5e4d3c-0000-4000-8000-0000000000a1';
const DAY = '2026-11-09' as LocalDate;

const opened: TestDb[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.close()));
});
const open = async (device: DeviceId): Promise<TestDb> => {
  const db = await openBaseDb(device);
  opened.push(db);
  return db;
};
const read = async (db: TestDb): Promise<ExportData> => (await db.data.repos.exportImport()).readExportData();
const seed = async (db: TestDb): Promise<void> => {
  await db.data.transaction(async (repos) => {
    await (await repos.recipes()).create(
      {
        name: 'Poulet-riz synthétique',
        servings: 4,
        cookedWeightG: null,
        ingredients: [
          { name: 'Riz synthétique', source: 'custom', foodRef: null, grams: 300, per100g: { kcal: 130, proteinG: null, fatG: 0.3, carbG: 28, fiberG: null } },
          { name: 'Poulet synthétique', source: 'ciqual', foodRef: 'ciqual:1000', grams: 500, per100g: { kcal: null, proteinG: null, fatG: null, carbG: null, fiberG: null } },
        ],
      },
      { id: R },
    );
    await (await repos.dayCompleteness()).declare(DAY, 'complete');
  });
};
const apply = async (db: TestDb, incoming: ExportData, mode: 'merge' | 'replace', sv: number): Promise<void> => {
  const archive = await buildExportArchive(incoming, { date: '2026-11-09T10:00:00.000Z', sv });
  const parsed = await parseExportArchive(archive.bytes, { currentSv: EXPORT_SV, currentYear: 2026 });
  await db.data.transaction(async (repos) => {
    const repo = await repos.exportImport();
    await repo.applyImport(planImport(await repo.readExportData(), parsed.data, mode), 2026);
  });
};

describe('export / import des recettes et de la journée déclarée (I4-07)', () => {
  it('trois tables exportées après la nutrition et avant la récupération (I5-01), recette avant ingrédient ; schéma 9 puis 10', () => {
    expect(TRAINING_EXPORT_TABLES.slice(-8, -5)).toEqual(['day_completeness', 'recipe', 'recipe_ingredient']);
    expect(EXPORT_SV).toBe(14); // I6-03b : schéma 14 (groupes des lignes de routine).
  });

  it('aller-retour : mêmes données (hash canonique), inconnus conservés nuls, publiées comme toute écriture', async () => {
    const source = await open(A);
    await seed(source);
    const data = await read(source);
    expect(data.training?.day_completeness?.map((r) => [r.id, r.values['state']])).toEqual([['day|2026-11-09', 'complete']]);
    expect(data.training?.recipe_ingredient?.map((r) => [r.values['name'], r.values['kcal_100g'], r.values['protein_100g']]).sort((x, y) => String(x[0]).localeCompare(String(y[0])))).toEqual([
      ['Poulet synthétique', null, null],
      ['Riz synthétique', 130, null],
    ]);
    const target = await open(B);
    await apply(target, data, 'merge', 9);
    expect(await canonicalHash(await read(target))).toBe(await canonicalHash(data));
    expect((await (await target.data.repos.recipes()).get(R))?.ingredients.map((i) => i.per100g.kcal)).toEqual([130, null]);
    expect(await target.driver.select("SELECT table_name FROM sync_outbox WHERE field = '*' AND table_name IN ('day_completeness', 'recipe', 'recipe_ingredient') GROUP BY table_name ORDER BY table_name")).toEqual([
      { table_name: 'day_completeness' },
      { table_name: 'recipe' },
      { table_name: 'recipe_ingredient' },
    ]);
  });

  it('archive de schéma 8 (sans ces clés) : en « remplacer », aucune recette ni déclaration locale n’est supprimée', async () => {
    const db = await open(A);
    await seed(db);
    const withoutNew = (await read(db)).training ?? {};
    const old: ExportData = { ...(await read(db)), training: Object.fromEntries(Object.entries(withoutNew).filter(([k]) => !['day_completeness', 'recipe', 'recipe_ingredient'].includes(k))) };
    // une archive de schéma 8 qui porte d'autres données d'entraînement (ici, une fiche), mais aucune clé de ces trois tables
    await db.data.transaction(async (repos) => (await repos.foods()).create({ source: 'custom', barcode: null, name: 'Fiche synthétique', brand: null, per100g: { kcal: 100, proteinG: null, fatG: null, carbG: null, fiberG: null }, fetchedAt: null }));
    const withFood: ExportData = { ...old, training: { ...old.training, food: (await read(db)).training?.food ?? [] } };
    await apply(db, withFood, 'replace', 8);
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM recipe WHERE deleted_at IS NULL')).toEqual([{ n: 1 }]);
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM recipe_ingredient WHERE deleted_at IS NULL')).toEqual([{ n: 2 }]);
    expect((await (await db.data.repos.dayCompleteness()).get(DAY))?.state).toBe('complete');
  });

  it('archive de schéma 9 sans recette : en « remplacer », les recettes locales sont supprimées (l’absence est une donnée)', async () => {
    const db = await open(A);
    await seed(db);
    const other = await open(B);
    await other.data.transaction(async (repos) => (await repos.foods()).create({ source: 'custom', barcode: null, name: 'Fiche synthétique', brand: null, per100g: { kcal: 100, proteinG: null, fatG: null, carbG: null, fiberG: null }, fetchedAt: null }));
    await apply(db, await read(other), 'replace', 9);
    expect(await (await db.data.repos.recipes()).list()).toEqual([]);
    expect(await (await db.data.repos.dayCompleteness()).get(DAY)).toBeNull();
  });

  it('archive de schéma 8 en « fusionner » : rien ne change', async () => {
    const db = await open(A);
    await seed(db);
    const before = await canonicalHash(await read(db));
    await apply(db, { ...(await read(await open(B))), training: {} }, 'merge', 8);
    expect(await canonicalHash(await read(db))).toBe(before);
  });

  it('archive d’un schéma plus récent (15) : refusée, rien n’est écrit', async () => {
    const db = await open(A);
    const archive = await buildExportArchive(await read(db), { date: '2026-11-09T10:00:00.000Z', sv: 15 });
    await expect(parseExportArchive(archive.bytes, { currentSv: EXPORT_SV, currentYear: 2026 })).rejects.toBeInstanceOf(ArchiveError);
    await expect(parseExportArchive(archive.bytes, { currentSv: EXPORT_SV, currentYear: 2026 })).rejects.toMatchObject({ code: 'future-version' });
  });

  it('archive de schéma 9 portant un ingrédient sans recette, ou une déclaration mal nommée : refusée', async () => {
    const db = await open(A);
    await seed(db);
    const data = await read(db);
    const bad: ExportData = { ...data, training: { ...data.training, day_completeness: [{ id: 'day|2026-11-10', values: { date: '2026-11-09', state: 'complete' } }] } };
    const archive = await buildExportArchive(bad, { date: '2026-11-09T10:00:00.000Z', sv: 9 });
    // soit refusée à la lecture, soit refusée à l'application : jamais écrite
    const target = await open(B);
    let written = true;
    try {
      const parsed = await parseExportArchive(archive.bytes, { currentSv: EXPORT_SV, currentYear: 2026 });
      await target.data.transaction(async (repos) => {
        const repo = await repos.exportImport();
        await repo.applyImport(planImport(await repo.readExportData(), parsed.data, 'merge'), 2026);
      });
    } catch {
      written = false;
    }
    expect(written).toBe(false);
    expect(await target.driver.select('SELECT * FROM day_completeness')).toEqual([]);
  });
});

describe('bornes validées à la lecture de l’archive (invalid-data à l’aperçu, jamais un échec de CHECK à l’application)', () => {
  type Training = NonNullable<ExportData['training']>;
  const lines = async (mutate: (training: Training) => Training): Promise<unknown> => {
    const db = await open(A);
    await seed(db);
    const data = await read(db);
    const archive = await buildExportArchive({ ...data, training: mutate(data.training ?? {}) }, { date: '2026-11-09T10:00:00.000Z', sv: 9 });
    return parseExportArchive(archive.bytes, { currentSv: EXPORT_SV, currentYear: 2026 }).catch((e: unknown) => e);
  };
  const withValues = (table: 'recipe' | 'recipe_ingredient' | 'day_completeness', over: Record<string, string | number | null>, id?: string) => (t: Training): Training => ({
    ...t,
    [table]: (t[table] ?? []).map((r) => ({ id: id ?? r.id, values: { ...r.values, ...over } })),
  });
  it.each([
    ['recipe', { servings: 0 }],
    ['recipe', { servings: 101 }],
    ['recipe', { servings: 2.5 }],
    ['recipe', { cooked_weight_g: 0 }],
    ['recipe', { cooked_weight_g: 20_001 }],
    ['recipe', { name: '' }],
    ['recipe_ingredient', { grams: 0 }],
    ['recipe_ingredient', { grams: 10_001 }],
    ['recipe_ingredient', { position: -1 }],
    ['recipe_ingredient', { kcal_100g: 901 }],
    ['recipe_ingredient', { protein_100g: -1 }],
    ['recipe_ingredient', { carb_100g: 100.5 }],
    ['recipe_ingredient', { name: '' }],
    ['recipe_ingredient', { food_ref: '' }],
  ] as const)('%s %j : refusée en invalid-data', async (table, over) => {
    expect(await lines(withValues(table, over))).toMatchObject({ code: 'invalid-data' });
  });
  it('déclaration dont l’identifiant ne correspond pas à la date : refusée en invalid-data', async () => {
    expect(await lines(withValues('day_completeness', {}, 'day|2026-11-10'))).toMatchObject({ code: 'invalid-data' });
  });
  it('valeurs aux bornes : acceptées', async () => {
    const ok = await lines(withValues('recipe', { servings: 100, cooked_weight_g: 20_000 }));
    expect(ok).not.toBeInstanceOf(Error);
    expect(ok).toHaveProperty('data');
  });
});
