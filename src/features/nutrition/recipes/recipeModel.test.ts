import { describe, expect, it } from 'vitest';
import { validateRecipeDraft, type RecipeDraft, type RecipeProblemCode } from '../../../domain/nutrition';
import { problemMessage, totalsRows, unknownIngredients } from './recipeModel';

/**
 * I4-07 point 2.2 : modèle d'affichage des recettes (messages français par code de problème, totaux avec cause d'un inconnu). Les calculs
 * restent ceux du domaine (`recipeTotals`, `recipePerServing`) ; ici seulement la mise en forme : « — » et la cause, jamais une somme partielle.
 */
const per = (kcal: number | null, proteinG: number | null, fatG: number | null, carbG: number | null, fiberG: number | null) => ({ kcal, proteinG, fatG, carbG, fiberG });
const ing = (name: string, grams: number, p: ReturnType<typeof per>, i: number) => ({ id: `i${String(i)}`, position: i, name, source: 'custom' as const, foodRef: null, grams, per100g: p });

const rice = ing('Riz', 200, per(130, 2.7, 0.3, 28, null), 0);
const chicken = ing('Poulet', 150, per(160, 31, 3.6, 0, 0), 1);

describe('I4-07 : messages par code de problème (aucun échec silencieux)', () => {
  const codes: readonly RecipeProblemCode[] = [
    'name-empty',
    'name-too-long',
    'servings-invalid',
    'cooked-weight-invalid',
    'cooked-weight-inconsistent',
    'ingredients-empty',
    'ingredients-too-many',
    'ingredient-name-empty',
    'ingredient-source-invalid',
    'ingredient-grams-invalid',
    'ingredient-value-invalid',
  ];

  it('chaque code a un message français distinct et non vide', () => {
    const messages = codes.map((code) => problemMessage({ code, index: null }, []));
    expect(messages.every((m) => m.trim().length > 0)).toBe(true);
    expect(new Set(messages).size).toBe(codes.length);
  });

  it('un problème d’ingrédient cite l’ingrédient par son nom, ou par son rang s’il n’a pas de nom', () => {
    expect(problemMessage({ code: 'ingredient-grams-invalid', index: 1 }, ['Riz', 'Poulet'])).toContain('Poulet');
    expect(problemMessage({ code: 'ingredient-grams-invalid', index: 0 }, [''])).toContain('1');
  });

  it('les problèmes réels du domaine sont tous couverts', () => {
    const draft: RecipeDraft = { name: ' ', servings: 0, cookedWeightG: -1, ingredients: [] };
    const problems = validateRecipeDraft(draft);
    expect(problems.length).toBeGreaterThanOrEqual(3);
    for (const p of problems) expect(problemMessage(p, []).length).toBeGreaterThan(5);
  });
});

describe('I4-07 : totaux de la recette et par portion (affichage)', () => {
  const rows = totalsRows({ ingredients: [rice, chicken], servings: 2 });
  const byKey = (key: string) => rows.find((r) => r.key === key);

  it('valeurs connues : total et portion au dixième, sans cause', () => {
    expect(byKey('kcal')).toMatchObject({ total: '500', perServing: '250', unknownIn: null });
    expect(byKey('carbG')).toMatchObject({ total: '56', perServing: '28', unknownIn: null });
  });

  it('nutriment inconnu dans un ingrédient : « — » (jamais une somme partielle) et la cause', () => {
    expect(byKey('fiberG')).toMatchObject({ total: '—', perServing: '—', unknownIn: 'inconnu dans : Riz' });
  });

  it('plusieurs ingrédients inconnus : tous nommés, dans l’ordre de la recette', () => {
    const list = [ing('Sauce', 50, per(null, null, null, null, null), 0), rice, ing('Huile', 10, per(900, 0, 100, 0, null), 2)];
    expect(unknownIngredients(list, 'fiberG')).toEqual(['Sauce', 'Riz', 'Huile']);
    expect(unknownIngredients(list, 'kcal')).toEqual(['Sauce']);
    expect(totalsRows({ ingredients: list, servings: 1 }).find((r) => r.key === 'kcal')).toMatchObject({ total: '—', unknownIn: 'inconnu dans : Sauce' });
  });

  it('recette sans ingrédient : tout en « — », sans cause', () => {
    for (const row of totalsRows({ ingredients: [], servings: 1 })) expect(row).toMatchObject({ total: '—', perServing: '—', unknownIn: null });
  });
});
