import { describe, expect, it } from 'vitest';

import type { LocalDate, LocalTime } from '../types';
import { aggregateDay } from './dayTotals';

/** NUTRI-0292 (C-041) : les totaux du jour n'exposent pas d'erreur de virgule flottante. */
const day = '2026-11-10' as LocalDate;
const entry = (time: string, v: number) => ({ date: day, time: time as LocalTime, kcal: v, proteinG: v, fatG: v, carbG: v });

describe('C-041 : totaux du jour arrondis', () => {
  it('0,1 + 0,2 vaut 0,3 (et non 0,30000000000000004)', () => {
    const d = aggregateDay(day, [entry('08:00', 0.1), entry('12:00', 0.2)]);
    expect([d.kcal, d.proteinG, d.fatG, d.carbG]).toEqual([0.3, 0.3, 0.3, 0.3]);
  });

  it('une valeur inconnue reste inconnue, jamais 0', () => {
    const d = aggregateDay(day, [entry('08:00', 0.1), { ...entry('12:00', 0.2), kcal: null }]);
    expect(d.kcal).toBeNull();
  });
});
