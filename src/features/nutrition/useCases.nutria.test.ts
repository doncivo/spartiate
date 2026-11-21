import { describe, expect, it } from 'vitest';
import { addDays } from '../../domain/localDate';
import { DEFAULT_NUTRITION_PREFS, estimateTdee, previousSmoothedFor, type DayTotals, type WeighIn } from '../../domain/nutrition';
import { computeTrend } from '../../domain/nutrition/weightTrend';
import type { LocalDate } from '../../domain/types';
import { tdeeAt, type NutritionSnapshot } from './useCases';

/** NUTRI-a (§ 15.1, C-036) : le lissage EMA de 7 jours est appliqué par le chemin que l'application emprunte (`tdeeAt`). Valeurs synthétiques. */
const E = '2026-11-20' as LocalDate;
const day = (date: LocalDate, kcal: number): DayTotals => ({ date, state: 'complete', origin: 'declared', entryCount: 3, spanHours: 10, kcal, proteinG: 100, fatG: 40, carbG: 100, usableForTdee: true, reasons: [] });

function snapshot(skip: ReadonlySet<number>): NutritionSnapshot {
  const days: DayTotals[] = [];
  for (let i = 59; i >= 0; i -= 1) if (!skip.has(i)) days.push(day(addDays(E, -i), i <= 2 ? 3000 : 2000));
  const weighIns: WeighIn[] = [];
  for (let i = 59; i >= 0; i -= 2) weighIns.push({ date: addDays(E, -i), kg: 80 });
  const tdee = estimateTdee({ endDate: E, days, weighIns, profile: null, activity: null, previousSmoothed: null });
  return { today: addDays(E, 1), reference: E, days, weighIns, trend: computeTrend(weighIns), tdee, prefs: DEFAULT_NUTRITION_PREFS, profile: null, target: null, targets: [] };
}

describe('NUTRI-a : lissage de la dépense mesurée', () => {
  it('tdeeAt rejoue l’EMA : la valeur lissée n’est pas la mesure brute après un saut d’apports', () => {
    const r = tdeeAt(snapshot(new Set()), E);
    expect(r.measuredRaw).not.toBeNull();
    expect(r.measuredSmoothed).not.toBeNull();
    expect(r.measuredSmoothed).not.toBe(r.measuredRaw);
    // La brute vaut (18 × 2 000 + 3 × 3 000) / 21 ; la lissée reste entre la valeur précédente (3 jours plus tôt) et la brute.
    expect(r.measuredRaw).toBeCloseTo(2142.857, 2);
    expect(r.measuredSmoothed).toBeLessThan(r.measuredRaw ?? 0);
    expect(r.measuredSmoothed).toBeGreaterThan(2000);
  });

  it('jours non loggés : ignorés pour le lissage, jamais comptés comme 0 kcal', () => {
    const skip = new Set([5, 9, 13]);
    const s = snapshot(skip);
    const previous = previousSmoothedFor({ days: s.days, weighIns: s.weighIns, endDate: E });
    expect(previous).not.toBeNull();
    // Une moyenne tirée par des zéros tomberait très en dessous de 2 000.
    expect(previous?.value).toBeGreaterThan(1900);
    const r = tdeeAt(s, E);
    expect(r.measuredSmoothed ?? 0).toBeGreaterThan(1900);
  });
});
