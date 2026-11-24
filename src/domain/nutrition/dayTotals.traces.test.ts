import { describe, expect, it } from 'vitest';

import type { LocalDate, LocalTime } from '../types';
import { aggregateDay } from './dayTotals';

/**
 * NUTRI-0292 (C-042, D-477) : côté journal, des lipides « traces » comptés pour 0 g laissent le total du jour calculé. Le catalogue Ciqual embarqué
 * écrit encore « traces » en `null` (content/food/ciqual.json) : le correctif de la source relève de content-data (voir la fiche NUTRI-0292).
 */
const day = '2026-11-10' as LocalDate;
const at = (time: string, fatG: number | null) => ({ date: day, time: time as LocalTime, kcal: 100, proteinG: 5, fatG, carbG: 10 });

describe('C-042 : lipides à 0 g (traces)', () => {
  it('une entrée à 0 g de lipides : le total du jour reste calculé', () => {
    expect(aggregateDay(day, [at('08:00', 0), at('12:00', 4.5)]).fatG).toBe(4.5);
  });
  it('lipides inconnus (null, jamais 0) : le total reste inconnu', () => {
    expect(aggregateDay(day, [at('08:00', null), at('12:00', 4.5)]).fatG).toBeNull();
  });
});
