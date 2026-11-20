import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../types';
import { validateMealEntry } from './mealEntry';
import { renphoDayDraft } from './renphoDay';

/**
 * Revue à froid de FIX-SAISIE-NUTRI (point important) : la borne de cohérence de D-343 vise la saisie Quick Add d'Ali, pas l'entrée
 * « Renpho — total du jour » écrite par l'import Santé (kcal d'un fichier, macros éventuellement gardées) : un jour partiel ne doit pas faire
 * échouer tout l'import. Valeurs synthétiques.
 */
const DAY = '2026-11-18' as LocalDate;

describe('D-343 : l’entrée Renpho du jour n’est pas soumise à la cohérence énergie / macros', () => {
  it('Renpho : 300 kcal pour 120 g de protéines et 200 g de glucides (jour partiel) : aucune erreur de cohérence', () => {
    const draft = renphoDayDraft(DAY, { kcal: 300, proteinG: 120, fatG: 40, carbG: 200, fiberG: null });
    expect(validateMealEntry(draft)).toEqual([]);
  });

  it('un Quick Add ordinaire avec les mêmes valeurs reste refusé', () => {
    const draft = { ...renphoDayDraft(DAY, { kcal: 300, proteinG: 120, fatG: 40, carbG: 200, fiberG: null }), foodName: 'Repas rapide' };
    expect(validateMealEntry(draft)).toContain('macros-exceed-energy');
  });
});
