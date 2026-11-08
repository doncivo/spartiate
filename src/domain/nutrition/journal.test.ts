import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../types';
import { aggregateDay } from './dayTotals';
import { estimateTdee } from './tdee';
import { computeTrend } from './weightTrend';
import { remainingForDay, rescaleEntry, tdeeConfidence, weeklyBalance, weeklyTrendSlope } from './journal';
import type { DayTotals, MealEntryInput, Target } from './types';

/** I4-03 : vues pures du journal et du dashboard. Aucune valeur inconnue ne devient zéro (§ 15.1). */
const D = (n: number): LocalDate => `2026-11-${String(n).padStart(2, '0')}` as LocalDate;
const TARGET: Target = { kcal: 2650, proteinG: 170, fatG: 75, carbG: 300 };
const entry = (date: LocalDate, time: string, kcal: number | null, p: number | null = 10, f: number | null = 5, c: number | null = 20): MealEntryInput =>
  ({ date, time, kcal, proteinG: p, fatG: f, carbG: c }) as MealEntryInput;
const completeDay = (date: LocalDate, kcal: number): DayTotals =>
  aggregateDay(date, [entry(date, '07:00', kcal / 3), entry(date, '13:00', kcal / 3), entry(date, '19:00', kcal / 3)]);

describe('I4-03 : remainingForDay : cibles restantes', () => {
  it('sans cible : null (rien n’est inventé)', () => {
    expect(remainingForDay(null, aggregateDay(D(9), []))).toBeNull();
  });
  it('journée sans entrée : la cible entière reste à faire, la journée reste « unknown »', () => {
    const day = aggregateDay(D(9), []);
    expect(day.state).toBe('unknown');
    expect(remainingForDay(TARGET, day)).toEqual({ kcal: 2650, proteinG: 170, fatG: 75, carbG: 300 });
  });
  it('journée partielle : cible moins le loggé, sans présumer le reste', () => {
    const day = aggregateDay(D(9), [entry(D(9), '07:10', 520, 34, 15, 58)]);
    expect(remainingForDay(TARGET, day)).toEqual({ kcal: 2130, proteinG: 136, fatG: 60, carbG: 242 });
  });
  it('une valeur inconnue dans une entrée rend le restant inconnu (null), jamais 0', () => {
    const day = aggregateDay(D(9), [entry(D(9), '07:10', 520, null, 15, 58)]);
    expect(remainingForDay(TARGET, day)).toEqual({ kcal: 2130, proteinG: null, fatG: 60, carbG: 242 });
  });
  it('dépassement : valeur négative conservée (l’écran le dit)', () => {
    const day = aggregateDay(D(9), [entry(D(9), '07:10', 3000, 10, 10, 10)]);
    expect(remainingForDay(TARGET, day)?.kcal).toBe(-350);
  });
});

describe('I4-03 : weeklyBalance : balance 7 jours', () => {
  const days = (kcals: readonly (number | null)[]): DayTotals[] => kcals.map((k, i) => (k === null ? aggregateDay(D(3 + i), []) : completeDay(D(3 + i), k)));
  it('moyenne des seuls jours complets moins la cible ; jours absents exclus, jamais comptés à 0', () => {
    const b = weeklyBalance(days([2400, null, 2300, 2500, null, 2600, 2400]), [{ date: D(5), kg: 81 }, { date: D(8), kg: 81 }], TARGET, D(9));
    expect(b.completeDays).toBe(5);
    expect(b.weighInDays).toBe(2);
    expect(b.averageKcal).toBe(2440);
    expect(b.deltaKcal).toBe(-210);
  });
  it('aucun jour complet : moyenne et écart null', () => {
    const b = weeklyBalance(days([null, null, null, null, null, null, null]), [], TARGET, D(9));
    expect(b).toMatchObject({ completeDays: 0, averageKcal: null, deltaKcal: null });
  });
  it('sans cible : moyenne connue, écart null', () => {
    const b = weeklyBalance(days([2400, 2400, 2400, 2400, null, null, null]), [], null, D(9));
    expect(b.averageKcal).toBe(2400);
    expect(b.deltaKcal).toBeNull();
  });
  it('jours hors fenêtre de 7 jours ignorés', () => {
    const b = weeklyBalance([completeDay(D(1), 3000), completeDay(D(9), 2000)], [], null, D(9));
    expect(b.completeDays).toBe(1);
    expect(b.averageKcal).toBe(2000);
  });
});

describe('I4-03 : weeklyTrendSlope : pente de la tendance de poids', () => {
  it('kg par semaine entre la tendance à la date et 7 jours avant', () => {
    const points = computeTrend([{ date: D(1), kg: 82 }, { date: D(2), kg: 82 }, { date: D(9), kg: 81 }]);
    const slope = weeklyTrendSlope(points, D(9));
    expect(slope).not.toBeNull();
    expect(slope as number).toBeLessThan(0);
  });
  it('pas assez de recul (première pesée après J-7) : null', () => {
    expect(weeklyTrendSlope(computeTrend([{ date: D(8), kg: 82 }, { date: D(9), kg: 82 }]), D(9))).toBeNull();
  });
  it('aucune pesée : null', () => {
    expect(weeklyTrendSlope([], D(9))).toBeNull();
  });
});

describe('I4-03 : tdeeConfidence : confiance affichée', () => {
  const profile = { sex: 'male' as const, birthYear: 1990, heightCm: 180 };
  it('sans formule ni mesure : none', () => {
    const e = estimateTdee({ endDate: D(9), days: [], weighIns: [], profile: null, activity: null, previousSmoothed: null });
    expect(tdeeConfidence(e)).toBe('none');
  });
  it('formule seule : low', () => {
    const e = estimateTdee({ endDate: D(9), days: [], weighIns: [{ date: D(8), kg: 80 }], profile, activity: 'moderate', previousSmoothed: null });
    expect(e.basis).toBe('formula');
    expect(tdeeConfidence(e)).toBe('low');
  });
});

describe('I4-03 : rescaleEntry : correction des grammes d’une entrée', () => {
  const base = { grams: 100, kcal: 200, proteinG: 10, fatG: 5, carbG: 30 };
  it('proportionnel, au dixième', () => {
    expect(rescaleEntry(base, 150)).toEqual({ grams: 150, kcal: 300, proteinG: 15, fatG: 7.5, carbG: 45 });
  });
  it('une valeur inconnue reste null', () => {
    expect(rescaleEntry({ ...base, proteinG: null }, 50)).toEqual({ grams: 50, kcal: 100, proteinG: null, fatG: 2.5, carbG: 15 });
  });
  it('grammes invalides ou masse d’origine inconnue : null', () => {
    expect(rescaleEntry(base, 0)).toBeNull();
    expect(rescaleEntry(base, Number.NaN)).toBeNull();
    expect(rescaleEntry({ ...base, grams: null }, 100)).toBeNull();
  });
});
