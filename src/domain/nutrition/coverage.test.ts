import { describe, expect, it } from 'vitest';

import { completeDay, partialDay } from '../../../tests/fixtures/nutrition/dayKit';
import { addDays } from '../localDate';
import type { LocalDate } from '../types';
import { coverageOfWindow, sufficientDataDays, twoWeekCoverage } from './coverage';
import type { DayTotals, WeighIn } from './types';

const d0 = '2026-09-07' as LocalDate;
const at = (i: number) => addDays(d0, i);

/** `pattern[i]` : true = jour complet, false = partiel, pour les jours i = 0… */
const daysFrom = (pattern: boolean[]): DayTotals[] =>
  pattern.map((c, i) => (c ? completeDay(at(i), 2400) : partialDay(at(i), 900)));
const weigh = (...idx: number[]): WeighIn[] => idx.map((i) => ({ date: at(i), kg: 80 }));

describe('I4-01 : coverageOfWindow (§ 15.2)', () => {
  it('4 jours complets et 2 pesées sur 7 jours : suffisant', () => {
    const c = coverageOfWindow(daysFrom([true, true, true, true, false, false, false]), weigh(0, 3), at(6));
    expect(c).toMatchObject({ completeDays: 4, weighInDays: 2, windowDays: 7, sufficient: true });
  });

  it('3 jours complets : insuffisant', () => {
    const c = coverageOfWindow(daysFrom([true, true, true, false, false, false, false]), weigh(0, 3), at(6));
    expect(c.completeDays).toBe(3);
    expect(c.sufficient).toBe(false);
  });

  it('1 seule pesée : insuffisant', () => {
    const c = coverageOfWindow(daysFrom([true, true, true, true, true, true, true]), weigh(2), at(6));
    expect(c.sufficient).toBe(false);
  });

  it('deux pesées le même jour comptent pour une', () => {
    const c = coverageOfWindow(daysFrom([true, true, true, true, true, true, true]), [...weigh(2), ...weigh(2)], at(6));
    expect(c.weighInDays).toBe(1);
  });

  it('un jour absent de la liste compte comme non complet, jamais comme zéro', () => {
    const c = coverageOfWindow(daysFrom([true, true]), weigh(0, 1), at(6));
    expect(c.completeDays).toBe(2);
    expect(c.sufficient).toBe(false);
  });

  it('les jours hors fenêtre sont ignorés', () => {
    const c = coverageOfWindow(daysFrom(Array<boolean>(14).fill(true)), weigh(0, 1), at(13));
    expect(c.completeDays).toBe(7);
    expect(c.weighInDays).toBe(0);
  });
});

describe('I4-01 : twoWeekCoverage', () => {
  const full = Array<boolean>(14).fill(true);

  it('les deux semaines suffisantes : ajustement possible', () => {
    const c = twoWeekCoverage(daysFrom(full), weigh(1, 5, 8, 12), at(13));
    expect(c.sufficient).toBe(true);
    expect(c.weeks).toHaveLength(2);
  });

  it('une semaine sans pesée suffisante : pas d\'ajustement', () => {
    const c = twoWeekCoverage(daysFrom(full), weigh(1, 5, 8), at(13));
    expect(c.sufficient).toBe(false);
    expect(c.weeks[1]?.sufficient).toBe(false);
  });

  it('une semaine à 3 jours complets : pas d\'ajustement', () => {
    const pattern = [...Array<boolean>(7).fill(true), true, true, true, false, false, false, false];
    expect(twoWeekCoverage(daysFrom(pattern), weigh(1, 5, 8, 12), at(13)).sufficient).toBe(false);
  });
});

describe('I4-01 : sufficientDataDays (D-74 point 4)', () => {
  it('compte les jours dont la fenêtre de 7 jours est suffisante', () => {
    const days = daysFrom(Array<boolean>(10).fill(true));
    const weighIns = weigh(0, 1, 2, 3, 4, 5, 6, 7, 8, 9);
    // Fenêtre terminée au jour i : i + 1 jours complets avant la fin des données ; suffisante dès le jour 3 (4 jours, 4 pesées).
    expect(sufficientDataDays(days, weighIns, at(0), at(9))).toBe(7);
  });

  it('aucune donnée : 0', () => {
    expect(sufficientDataDays([], [], at(0), at(20))).toBe(0);
  });
});
