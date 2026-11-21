import { describe, expect, it } from 'vitest';
import type { LocalDate, LocalTime } from '../types';
import { validateRecipeDraft } from './recipe';
import type { MealEntryDraft } from './mealEntry';
import { entriesOfMoment, favoriteFromLines, linesFromRecipe, linesToDrafts, mealLines, mealMoment, recentMeals, scaleLine } from './quickMeals';

const D = (s: string) => s as LocalDate;
const T = (s: string) => s as LocalTime;
const entry = (over: Partial<MealEntryDraft>): MealEntryDraft => ({
  date: D('2026-11-20'), time: T('08:00'), foodId: 'ciqual:1000', foodName: 'Pain', source: 'ciqual', grams: 100,
  kcal: 250, proteinG: 8, fatG: 2, carbG: 50, method: 'search', confidence: null, ...over,
});

describe('mealMoment (C-1)', () => {
  it('découpe la journée', () => {
    expect(mealMoment(T('00:00'))).toBe('morning');
    expect(mealMoment(T('10:59'))).toBe('morning');
    expect(mealMoment(T('11:00'))).toBe('midday');
    expect(mealMoment(T('14:59'))).toBe('midday');
    expect(mealMoment(T('15:00'))).toBe('afternoon');
    expect(mealMoment(T('17:59'))).toBe('afternoon');
    expect(mealMoment(T('18:00'))).toBe('evening');
    expect(mealMoment(T('23:59'))).toBe('evening');
  });
  it('entriesOfMoment filtre par moment', () => {
    const list = [entry({}), entry({ time: T('12:30') }), entry({ time: T('09:15') })];
    expect(entriesOfMoment(list, 'morning')).toHaveLength(2);
    expect(entriesOfMoment(list, 'evening')).toHaveLength(0);
  });
});

describe('mealLines et copie (C-2, C-5)', () => {
  it('exclut le total Renpho', () => {
    const lines = mealLines([entry({}), entry({ foodName: 'Renpho — total du jour', method: 'quickadd', source: 'manual', foodId: null, grams: null })]);
    expect(lines).toHaveLength(1);
  });
  it('scaleLine : prorata, valeur inconnue reste null, jamais 0', () => {
    const line = mealLines([entry({ fatG: null })])[0];
    if (line === undefined) throw new Error('ligne');
    const half = scaleLine(line, 50);
    expect(half).toMatchObject({ grams: 50, kcal: 125, proteinG: 4, fatG: null, carbG: 25 });
  });
  it('scaleLine : grammes invalides ou ligne sans grammes = null', () => {
    const line = mealLines([entry({})])[0];
    const free = mealLines([entry({ foodId: null, foodName: 'Café', source: 'manual', grams: null, method: 'quickadd' })])[0];
    if (line === undefined || free === undefined) throw new Error('ligne');
    expect(scaleLine(line, 0)).toBeNull();
    expect(scaleLine(line, -3)).toBeNull();
    expect(scaleLine(line, 20_000)).toBeNull();
    expect(scaleLine(free, 50)).toBeNull();
  });
  it('linesToDrafts : date posée, heures gardées ou imposées, méthode et confiance conservées', () => {
    const lines = mealLines([entry({}), entry({ time: T('09:00'), foodId: null, foodName: 'Plat', source: 'estimate', grams: 200, method: 'photo', confidence: 0.6 })]);
    const kept = linesToDrafts(lines, D('2026-11-21'), null);
    expect(kept?.map((d) => d.time)).toEqual(['08:00', '09:00']);
    expect(kept?.every((d) => d.date === '2026-11-21')).toBe(true);
    expect(kept?.[1]).toMatchObject({ method: 'photo', confidence: 0.6 });
    expect(linesToDrafts(lines, D('2026-11-21'), T('13:05'))?.every((d) => d.time === '13:05')).toBe(true);
  });
  it('linesToDrafts : vide ou ligne invalide = null (tout ou rien)', () => {
    expect(linesToDrafts([], D('2026-11-21'), null)).toBeNull();
    const line = mealLines([entry({})])[0];
    if (line === undefined) throw new Error('ligne');
    expect(linesToDrafts([line, { ...line, grams: -1 }], D('2026-11-21'), null)).toBeNull();
  });
});

describe('recentMeals (C-3)', () => {
  const list = [
    entry({ date: D('2026-11-19'), time: T('08:00') }),
    entry({ date: D('2026-11-20'), time: T('08:00') }),
    entry({ date: D('2026-11-20'), time: T('12:00'), foodName: 'Riz', kcal: null }),
    entry({ date: D('2026-11-20'), time: T('12:30'), foodName: 'Poulet' }),
    entry({ date: D('2026-11-22'), time: T('08:00') }),
  ];
  it('du plus récent au plus ancien, sans futur, total inconnu si une valeur manque', () => {
    const meals = recentMeals(list, D('2026-11-21'), 5);
    expect(meals.map((m) => `${m.date}/${m.moment}`)).toEqual(['2026-11-20/midday', '2026-11-20/morning', '2026-11-19/morning']);
    expect(meals[0]?.kcal).toBeNull();
    expect(meals[1]?.kcal).toBe(250);
    expect(meals[0]?.lines).toHaveLength(2);
  });
  it('limite', () => {
    expect(recentMeals(list, D('2026-11-21'), 1)).toHaveLength(1);
  });
});

describe('favoris = recettes d\'une portion (C-4)', () => {
  it('enregistre seulement les lignes avec aliment et grammes, dit le nombre ignoré', () => {
    const lines = mealLines([entry({}), entry({ foodId: null, foodName: 'Café', source: 'manual', grams: null, method: 'quickadd', kcal: 5 })]);
    const result = favoriteFromLines('Petit-déj', lines);
    expect(result).not.toBeNull();
    expect(result?.skipped).toBe(1);
    expect(result?.draft.servings).toBe(1);
    expect(result?.draft.ingredients).toHaveLength(1);
    expect(result?.draft.ingredients[0]).toMatchObject({ source: 'ciqual', foodRef: 'ciqual:1000', grams: 100, per100g: { kcal: 250, fiberG: null } });
    expect(result && validateRecipeDraft(result.draft)).toEqual([]);
  });
  it('nom vide ou aucune ligne enregistrable = null', () => {
    const lines = mealLines([entry({})]);
    expect(favoriteFromLines('  ', lines)).toBeNull();
    expect(favoriteFromLines('X', mealLines([entry({ foodId: null, grams: null, source: 'manual', method: 'quickadd' })]))).toBeNull();
  });
  it('rejouer redonne les mêmes valeurs (au dixième) et garde null', () => {
    const lines = mealLines([entry({ grams: 130, kcal: 325, proteinG: 10.4, fatG: null, carbG: 65 })]);
    const fav = favoriteFromLines('Pain', lines);
    if (fav === null) throw new Error('favori');
    const recipe = { id: 'r', name: 'Pain', servings: 1, cookedWeightG: null, updatedAt: '2026-11-21T00:00:00.000Z', ingredients: fav.draft.ingredients.map((i, n) => ({ ...i, id: `i${n}`, position: n })) };
    const back = linesFromRecipe(recipe as never);
    expect(back).toHaveLength(1);
    expect(back[0]?.kcal).toBeCloseTo(325, 0);
    expect(back[0]?.fatG).toBeNull();
    expect(back[0]?.foodId).toBe('ciqual:1000');
    expect(back[0]?.method).toBe('search');
  });
});
