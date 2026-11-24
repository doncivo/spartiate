import { describe, expect, it } from 'vitest';

import type { LocalDate, LocalTime } from '../types';
import { aggregateDay } from './dayTotals';
import { renphoDayDraft } from './renphoDay';
import { toMealEntryInput } from './mealEntry';

/** NUTRI-0292 (C-039, D-476) : le total du jour importé couvre la journée ; l'origine de la pesée n'intervient pas dans la complétude. */
const day = '2026-11-10' as LocalDate;
const renpho = (kcal: number | null) => renphoDayDraft(day, { kcal, proteinG: 150, fatG: 70, carbG: 300, fiberG: null });

describe('C-039 : jour importé de Renpho', () => {
  it('une seule entrée « total du jour » à énergie connue : jour complet, utilisable pour la dépense', () => {
    const d = aggregateDay(day, [toMealEntryInput(renpho(2600))]);
    expect(d.state).toBe('complete');
    expect(d.usableForTdee).toBe(true);
    expect(d.kcal).toBe(2600);
  });

  it('déclaré incomplet par Ali : la déclaration prime', () => {
    const d = aggregateDay(day, [toMealEntryInput(renpho(2600))], 'incomplete');
    expect(d.state).toBe('partial');
    expect(d.usableForTdee).toBe(false);
  });

  it('une seule saisie ordinaire du même jour reste partielle (règle inchangée)', () => {
    const d = aggregateDay(day, [{ date: day, time: '00:00' as LocalTime, kcal: 2600, proteinG: 150, fatG: 70, carbG: 300 }]);
    expect(d.state).toBe('partial');
  });
});
