import { describe, expect, it } from 'vitest';
import type { LocalDate, LocalTime } from '../types';
import { parseFoodId, parseRecipeFoodId, recipeFoodId } from './food';
import { validateMealEntry, type MealEntryDraft } from './mealEntry';

/**
 * I4-07 (D-80) : une prise de recette est une entrée de journal ordinaire dont `food_id` vaut `recipe:<UUID>` (source `custom`, méthode
 * `search`). `parseFoodId` (fiche stockée ou Ciqual) ne change PAS : les écrans existants lisent une référence de recette comme inconnue.
 */

const R = '7d3c2e4f-0000-4000-8000-000000000001';
const entry = (over: Partial<MealEntryDraft> = {}): MealEntryDraft => ({
  date: '2026-11-09' as LocalDate,
  time: '12:30' as LocalTime,
  foodId: `recipe:${R}`,
  foodName: 'Poulet-riz synthétique',
  source: 'custom',
  grams: 300,
  kcal: 390,
  proteinG: 30,
  fatG: 10,
  carbG: 40,
  method: 'search',
  confidence: null,
  ...over,
});

describe('référence de recette dans le journal', () => {
  it('recipeFoodId et parseRecipeFoodId sont inverses ; la référence tient dans les 128 caractères de la colonne', () => {
    expect(recipeFoodId(R)).toBe(`recipe:${R}`);
    expect(recipeFoodId(R).length).toBe(43);
    expect(parseRecipeFoodId(`recipe:${R}`)).toBe(R);
  });
  it('refuse ce qui n’est pas « recipe: » + un identifiant', () => {
    for (const bad of ['recipe:', 'recipe:abc', 'recipe: ' + R, `Recipe:${R}`, R, 'ciqual:1000', `recipe:${R}:x`, '']) expect(parseRecipeFoodId(bad), bad).toBeNull();
  });
  it('parseFoodId n’est pas modifié : une référence de recette n’est ni Ciqual ni fiche stockée', () => {
    expect(parseFoodId(`recipe:${R}`)).toBeNull();
    expect(parseFoodId('ciqual:1000')).toEqual({ kind: 'ciqual', code: '1000' });
    expect(parseFoodId(R)).toEqual({ kind: 'stored', id: R });
  });
  it('validateMealEntry : prise de recette valide en source custom, méthode search', () => {
    expect(validateMealEntry(entry())).toEqual([]);
  });
  it('validateMealEntry : recette avec une autre provenance, ou référence mal formée : refusée', () => {
    expect(validateMealEntry(entry({ source: 'ciqual' }))).toContain('source-food-mismatch');
    expect(validateMealEntry(entry({ source: 'off' }))).toContain('source-food-mismatch');
    expect(validateMealEntry(entry({ foodId: 'recipe:abc' }))).toContain('food-id-invalid');
  });
});
