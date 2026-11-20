// AUDIT-CLAUDE-0.27.0, partie 5 : nutrition et compléments. Jamais branché sur la CI. Données synthétiques (D-38).
// « ROUGE C-xxx » : assertion de la spécification, l'échec est la preuve. « VECTEUR » : valeur recalculée à la main, attendue verte.
import { describe, expect, it } from 'vitest';
import { proposeCheckIn } from '../../../src/domain/nutrition/checkIn';
import { rescaleEntry } from '../../../src/domain/nutrition/journal';
import { offProductToDraft } from '../../../src/domain/nutrition/offProduct';
import { validateMealEntry } from '../../../src/domain/nutrition/mealEntry';
import { aggregateDay } from '../../../src/domain/nutrition/dayTotals';
import { effectiveTarget } from '../../../src/domain/nutrition/targetRecord';
import { restTargetFromGap, weeklyAverageTarget } from '../../../src/domain/nutrition/restDay';
import { computeTrend } from '../../../src/domain/nutrition/weightTrend';
import { measuredTdee, mifflinStJeor, smoothTdee } from '../../../src/domain/nutrition/tdee';
import { isValidBarcode } from '../../../src/domain/nutrition/food';
import { recipePerServing } from '../../../src/domain/nutrition/recipe';
import { isDueOn } from '../../../src/domain/nutrition/supplements';
import { planSupplementNotifications } from '../../../src/domain/supplementNotificationPlan';
import { fireAtInstant } from '../../../src/domain/notificationInstant';
import { intakesToTake } from '../../../src/domain/supplementNotificationActions';

const day = (date: string, kcal = 1200) => ({ date, state: 'complete', origin: 'declared', entryCount: 3, spanHours: 10, kcal, proteinG: 100, fatG: 40, carbG: 100, usableForTdee: true, reasons: [] }) as never;
const COVER_DAYS = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'].map((d) => day(d));
const COVER_WEIGH = ['2026-11-03', '2026-11-05', '2026-11-10', '2026-11-12'].map((date) => ({ date, kg: 70 })) as never;
const checkIn = (over: Record<string, unknown>) =>
  proposeCheckIn({ style: 'guided', weekEnd: '2026-11-15', days: COVER_DAYS, weighIns: COVER_WEIGH, tdee: 2000, weightKg: 80, goal: { kind: 'maintain' }, currentTarget: null, lowFloorConfirmed: false, ...over } as never);

describe('C-031 check-in à deux cibles : plancher contrôlé sur la moyenne seulement', () => {
  it('ROUGE cible de repos jamais sous 1 200 kcal sans demande de confirmation', () => {
    const r = checkIn({ tdee: 1100, weightKg: 70, currentTarget: { kcal: 1300, proteinG: 120, fatG: 50, carbG: 133 }, restPlan: { rest: { kcal: 1250, proteinG: 120, fatG: 50, carbG: 120 }, trainingDays: [1, 2, 4, 5, 6] } });
    const rest = r.proposal?.restTarget?.kcal as number;
    expect(rest >= 1200 || r.proposal?.belowStandardFloor === true).toBe(true);
  });
});

describe('C-032 correction des grammes d’une entrée du journal', () => {
  it('ROUGE 100 g à 14 kcal → 1 g → 100 g : 14 kcal', () => {
    const a = rescaleEntry({ grams: 100, kcal: 14, proteinG: null, fatG: null, carbG: null }, 1);
    expect(rescaleEntry(a as never, 100)?.kcal).toBe(14);
  });
});

describe('C-033 Open Food Facts : kcal contredit par le kJ', () => {
  it('ROUGE kcal 0 mais 1 500 kJ (macros 10/5/60) : ≈ 359 kcal', () => {
    const c = offProductToDraft({ code: '3017620422003', product_name: 'X', nutriments: { 'energy-kcal_100g': 0, 'energy-kj_100g': 1500, proteins_100g: 10, fat_100g: 5, carbohydrates_100g: 60 } } as never, '2026-11-20T10:00:00.000Z' as never) as never as { draft: { per100g: { kcal: number } } };
    expect(c.draft.per100g.kcal).toBeGreaterThan(300);
  });
});

describe('C-034 Quick Add sans borne sur les macros', () => {
  it('ROUGE 100 kcal et 5 000 g de protéines refusés', () => {
    const issues = validateMealEntry({ date: '2026-11-20', time: '12:00', foodId: null, foodName: 'X', source: 'manual', grams: null, kcal: 100, proteinG: 5000, fatG: null, carbG: null, method: 'quickadd', confidence: null } as never);
    expect(issues.length).toBeGreaterThan(0);
  });
});

describe('C-035 rappel de complément le jour du passage à l’heure d’été', () => {
  it('ROUGE complément à 02:30, replanification le 29/03/2026 à 03:10 (iOS le fait sonner à 03:30) : le rappel du jour reste au plan', () => {
    const S = { id: 's1', name: 'Mg', dose: null, unit: null, times: ['02:30'], days: 127, active: true, since: '2026-03-01' };
    const plan = planSupplementNotifications({ now: '2026-03-29T03:10', enabled: true, supplements: [S], intakes: [] } as never);
    expect(plan.items.map((i) => i.id)).toContain('supplement:2026-03-29T02:30');
  });
});

describe('C-036 dépense mesurée : lissage 7 jours (§ 15.1) jamais appliqué', () => {
  it('ROUGE sans valeur précédente fournie (useCases.ts:96 et :112 passent toujours null), lissée = brute ; un pas nul ignore la mesure', () => {
    expect(smoothTdee({ previous: 2500, raw: 2800, stepDays: 0 })).not.toBe(2500);
  });
});

describe('VECTEURS nutrition recalculés à la main', () => {
  const U = '0f8fad5b-d9cb-469f-a165-70867728950e';
  const A = { id: 'a', weekStart: '2026-11-16', accepted: true, hlc: `001794484800000-0000-${U}` }; // décidée le 12/11, prise d'effet 16/11
  const C = { id: 'c', weekStart: '2026-11-09', accepted: true, hlc: `001794484800000-0001-${U}` }; // décidée le 12/11, prise d'effet 12/11
  const B = { id: 'b', weekStart: '2026-11-09', accepted: true, hlc: `001794830400000-0000-${U}` }; // décidée le 16/11, prise d'effet 16/11
  it('D-314 cible en vigueur : prise d’effet, puis HLC', () => {
    expect(effectiveTarget([A, C] as never, '2026-11-17' as never)?.id).toBe('a');
    expect(effectiveTarget([A, C] as never, '2026-11-13' as never)?.id).toBe('c');
    expect(effectiveTarget([A, B, C] as never, '2026-11-17' as never)?.id).toBe('b');
  });
  it('D-271 moyenne hebdo (5 × 2 400 + 2 × 2 200) / 7 = 2 343 ; écart −200 par les glucides, jamais négatifs', () => {
    const T = { kcal: 2400, proteinG: 160, fatG: 70, carbG: 300 };
    expect(weeklyAverageTarget(T, { rest: { kcal: 2200, proteinG: 160, fatG: 70, carbG: 250 }, trainingDays: [1, 2, 4, 5, 6] } as never).kcal).toBe(2343);
    expect(restTargetFromGap(T, -200)).toMatchObject({ kcal: 2200, carbG: 250 });
    expect(restTargetFromGap({ ...T, carbG: 30 }, -200).carbG).toBe(0);
  });
  it('check-in : bornes ± 150, plancher de lipides 0,6 g/kg, plancher 1 200', () => {
    expect(checkIn({ tdee: 2500, currentTarget: { kcal: 2000, proteinG: 150, fatG: 70, carbG: 230 } }).proposal?.target).toMatchObject({ kcal: 2150, proteinG: 150, fatG: 70 });
    expect(checkIn({ tdee: 1700, currentTarget: { kcal: 2000, proteinG: 150, fatG: 70, carbG: 230 } }).proposal?.target.kcal).toBe(1850);
    expect(checkIn({ tdee: 2000, currentTarget: { kcal: 2000, proteinG: 150, fatG: 40, carbG: 250 } }).proposal?.target.fatG).toBe(48);
    expect(checkIn({ tdee: 1000, weightKg: 60, currentTarget: { kcal: 1250, proteinG: 100, fatG: 40, carbG: 122 } }).proposal?.target.kcal).toBe(1200);
  });
  it('tendance EMA demi-vie 14 j, pesée > 2 % pondérée 0,25', () => {
    const t = computeTrend([{ date: '2026-11-01', kg: 80 }, { date: '2026-11-08', kg: 80.5 }, { date: '2026-11-15', kg: 79 }] as never);
    expect(t.map((p) => p.trend)).toEqual([80, expect.closeTo(80.14645, 4), expect.closeTo(79.81066, 4)]);
  });
  it('dépense mesurée 21 j : 2 500 + (0,646447 / 21) × 7 700 = 2 737,03', () => {
    const days = Array.from({ length: 21 }, (_, i) => day(`2026-11-${String(i + 1).padStart(2, '0')}`, 2500));
    const trend = computeTrend([{ date: '2026-10-31', kg: 80 }, { date: '2026-11-21', kg: 79 }] as never);
    const m = measuredTdee({ days, trend, endDate: '2026-11-21' } as never) as never as { value?: number } | number | null;
    const v = typeof m === 'number' ? m : (m as { value: number } | null)?.value;
    expect(v).toBeCloseTo(2737.03, 1);
  });
  it('Mifflin-St Jeor homme 80 kg 180 cm 30 ans = 1 780', () => {
    expect(mifflinStJeor({ sex: 'male', weightKg: 80, heightCm: 180, age: 30 })).toBe(1780);
  });
  it('journée à deux entrées, recette 3 portions, EAN-13', () => {
    const e = (time: string, kcal: number, proteinG: number, fatG: number, carbG: number) => ({ date: '2026-11-20', time, kcal, proteinG, fatG, carbG });
    const d = aggregateDay('2026-11-20' as never, [e('08:00', 375, 15, 7.5, 60), e('12:00', 233.4, 7.9, 4.2, 35.2)] as never);
    expect(d.kcal).toBeCloseTo(608.4, 6);
    expect(d.state).toBe('partial');
    const ing = (grams: number, kcal: number, proteinG: number, fatG: number, carbG: number, fiberG: number | null, id: string) => ({ id, position: 0, name: id, source: 'ciqual', foodRef: null, grams, per100g: { kcal, proteinG, fatG, carbG, fiberG } });
    expect(recipePerServing({ ingredients: [ing(200, 350, 7, 1, 78, 1, 'r'), ing(300, 120, 23, 2, 0, null, 'p')], servings: 3 } as never)).toMatchObject({ kcal: 353.3, proteinG: 27.7, carbG: 52, fiberG: null });
    expect([isValidBarcode('3017620422003'), isValidBarcode('3017620422004'), isValidBarcode('96385074')]).toEqual([true, false, true]);
  });
  it('compléments : masque ISO, instants au changement d’heure, « Pris »', () => {
    const S = { id: 's1', name: 'Mg', dose: null, unit: null, times: ['08:00'], days: 21, active: true, since: '2026-01-01' };
    expect(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'].map((d) => isDueOn(S as never, d as never))).toEqual([true, false, true, false, true, false, false]);
    expect(fireAtInstant('2026-03-29T08:00' as never, 'Europe/Paris')).toBe(Date.UTC(2026, 2, 29, 6, 0));
    expect(fireAtInstant('2026-10-25T08:00' as never, 'Europe/Paris')).toBe(Date.UTC(2026, 9, 25, 7, 0));
    expect(intakesToTake([{ ...S, days: 127 }] as never, [], '2026-10-25' as never, '08:00' as never)).toEqual(['s1']);
    expect(intakesToTake([{ ...S, days: 127 }] as never, [{ supplementId: 's1', date: '2026-10-25', moment: '08:00' }] as never, '2026-10-25' as never, '08:00' as never)).toEqual([]);
  });
});
