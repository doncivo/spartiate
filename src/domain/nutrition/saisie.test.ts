import { describe, expect, it } from 'vitest';
import type { IsoDateTime, LocalDate } from '../types';
import { addDays } from '../localDate';
import { rescaleEntry } from './journal';
import { validateMealEntry, type MealEntryDraft } from './mealEntry';
import { offProductToDraft, type OffRawProduct } from './offProduct';
import { estimateTdeeSmoothed, previousSmoothedFor, smoothTdee } from './tdee';
import type { DayTotals, WeighIn } from './types';

/** FIX-SAISIE-NUTRI (C-032, C-033, C-034, C-036) : valeurs synthétiques, vecteurs recalculés à la main. */
const NOW = '2026-11-20T10:00:00.000Z' as IsoDateTime;

describe('C-032 : correction des grammes sans arrondis cumulés', () => {
  it('100 g à 14 kcal → 1 g → 100 g : 14 kcal', () => {
    const a = rescaleEntry({ grams: 100, kcal: 14, proteinG: null, fatG: null, carbG: null }, 1);
    expect(a?.kcal).toBeCloseTo(0.14, 6);
    expect(rescaleEntry({ ...(a ?? { grams: 1, kcal: null }), proteinG: null, fatG: null, carbG: null }, 100)?.kcal).toBe(14);
  });
  it('un total inconnu reste null, jamais 0', () => {
    expect(rescaleEntry({ grams: 100, kcal: 14, proteinG: null, fatG: 3, carbG: null }, 50)).toMatchObject({ kcal: 7, proteinG: null, fatG: 1.5 });
  });
});

const off = (nutriments: Record<string, unknown>): OffRawProduct => ({ code: '3017620422003', product_name: 'X', nutriments });

describe('C-033 : Open Food Facts, kcal contredit par le kJ', () => {
  it('kcal 0, 1 500 kJ (macros 10/5/60) : 1 500 / 4,184 = 358,5 → 359 kcal, signalé', () => {
    const c = offProductToDraft(off({ 'energy-kcal_100g': 0, 'energy-kj_100g': 1500, proteins_100g: 10, fat_100g: 5, carbohydrates_100g: 60 }), NOW);
    expect(c).toMatchObject({ ok: true, energyFromKj: true, draft: { per100g: { kcal: 359 } } });
  });
  it('kcal et kJ cohérents (63 kcal, 264 kJ) : kcal conservé, pas de signal', () => {
    const c = offProductToDraft(off({ 'energy-kcal_100g': 63, 'energy-kj_100g': 264, proteins_100g: 11, fat_100g: 0.2, carbohydrates_100g: 4 }), NOW);
    expect(c).toMatchObject({ ok: true, energyFromKj: false, draft: { per100g: { kcal: 63 } } });
  });
  it('écart de 14 % toléré, de 16 % corrigé (kJ = 1 000)', () => {
    // 240 kcal = 1 004 kJ (écart 0,4 %) ; 205 kcal × 4,184 = 857,7 kJ (écart 14,2 %) ; 201 kcal × 4,184 = 840,98 kJ (écart 15,9 %).
    const kept = offProductToDraft(off({ 'energy-kcal_100g': 205, 'energy-kj_100g': 1000, proteins_100g: 10 }), NOW);
    expect(kept).toMatchObject({ ok: true, energyFromKj: false, draft: { per100g: { kcal: 205 } } });
    const fixed = offProductToDraft(off({ 'energy-kcal_100g': 201, 'energy-kj_100g': 1000, proteins_100g: 10 }), NOW);
    expect(fixed).toMatchObject({ ok: true, energyFromKj: true, draft: { per100g: { kcal: 239 } } });
  });
  it('kcal seul ou kJ seul : sans signal', () => {
    expect(offProductToDraft(off({ 'energy-kcal_100g': 0, proteins_100g: 1 }), NOW)).toMatchObject({ ok: true, energyFromKj: false, draft: { per100g: { kcal: 0 } } });
    expect(offProductToDraft(off({ 'energy-kj_100g': 1000, proteins_100g: 1 }), NOW)).toMatchObject({ ok: true, energyFromKj: false, draft: { per100g: { kcal: 239 } } });
  });
});

const quick = (kcal: number, proteinG: number | null, fatG: number | null, carbG: number | null): MealEntryDraft => ({
  date: '2026-11-20' as LocalDate, time: '12:00' as never, foodId: null, foodName: 'X', source: 'manual', grams: null, kcal, proteinG, fatG, carbG, method: 'quickadd', confidence: null,
});

describe('C-034 : Quick Add borné sur les macros', () => {
  it('100 kcal et 5 000 g de protéines : refusé', () => {
    expect(validateMealEntry(quick(100, 5000, null, null)).length).toBeGreaterThan(0);
  });
  it('plafond de 1 000 g par macro : 1 000 accepté (4 000 kcal annoncées), 1 001 refusé', () => {
    expect(validateMealEntry(quick(5000, 1000, null, null))).toEqual([]);
    expect(validateMealEntry(quick(5000, 1001, null, null))).toContain('value-invalid');
  });
  it('4P + 4G + 9L ≤ 1,25 × kcal + 20 : 600 kcal avec 30/20/70 (4×30+4×70+9×20 = 580) accepté', () => {
    expect(validateMealEntry(quick(600, 30, 20, 70))).toEqual([]);
  });
  it('limite : 100 kcal → 145 kcal permises ; 36 g de protéines (144) passent, 37 g (148) non', () => {
    expect(validateMealEntry(quick(100, 36, null, null))).toEqual([]);
    expect(validateMealEntry(quick(100, 37, null, null))).toContain('macros-exceed-energy');
  });
  it('macros inconnues : jamais refusées pour cohérence', () => {
    expect(validateMealEntry(quick(100, null, null, null))).toEqual([]);
  });
});

describe('C-036 : dépense mesurée lissée sur 7 jours', () => {
  it('un pas nul remplace la valeur précédente par la mesure', () => {
    expect(smoothTdee({ previous: 2500, raw: 2800, stepDays: 0 })).toBe(2800);
  });

  const E = '2026-11-20' as LocalDate;
  const day = (date: LocalDate, kcal: number): DayTotals => ({ date, state: 'complete', origin: 'declared', entryCount: 3, spanHours: 10, kcal, proteinG: 100, fatG: 40, carbG: 100, usableForTdee: true, reasons: [] }) as never;
  const days: DayTotals[] = [];
  for (let i = 60; i >= 0; i -= 1) days.push(day(addDays(E, -i), i <= 2 ? 3000 : 2000));
  const weighIns: WeighIn[] = [];
  for (let i = 60; i >= 0; i -= 3) weighIns.push({ date: addDays(E, -i), kg: 80 });

  it('vecteur : 2 047,619 (E−2) puis 2 095,238 (E−1) → 2 047,619 + (1 − 2^(−1/7)) × 47,619 = 2 052,108', () => {
    const p = previousSmoothedFor({ days, weighIns, endDate: E, lookbackDays: 2 });
    expect(p?.date).toBe(addDays(E, -1));
    expect(p?.value).toBeCloseTo(2052.108, 2);
  });
  it('sans mesure possible sur l’historique : null (jamais 0)', () => {
    expect(previousSmoothedFor({ days: [], weighIns: [], endDate: E })).toBeNull();
  });
  it('estimateTdeeSmoothed : la dépense lissée diffère de la brute et suit le vecteur', () => {
    const r = estimateTdeeSmoothed({ endDate: E, days, weighIns, profile: null, activity: null, lookbackDays: 2 } as never);
    expect(r.measuredRaw).toBeCloseTo(2142.857, 2); // 18 × 2 000 + 3 × 3 000 = 45 000 / 21
    expect(r.measuredSmoothed).not.toBe(r.measuredRaw);
    expect(r.measuredSmoothed).toBeCloseTo(2052.108 + (1 - 2 ** (-1 / 7)) * (2142.857 - 2052.108), 2);
  });
});
