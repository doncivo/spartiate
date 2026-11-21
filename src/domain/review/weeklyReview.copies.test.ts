import { describe, expect, it } from 'vitest';
import { computeTrend } from '../nutrition/weightTrend';
import { weeklyRateKg, weekTrendKg } from '../nutrition/weeklyRate';
import { cycleWeekMarker } from '../training/cycleWeek';
import type { MesocycleState } from '../training/mesocycle';
import type { LocalDate } from '../types';
import { reviewCycleMarker, reviewRateKg, reviewTrendKg } from './weeklyReview';

/** BILAN-029 : règles recopiées pour la mesure du bundle, équivalentes aux originales (weeklyRate.ts, cycleWeek.ts). Valeurs synthétiques. */

const d = (s: string): LocalDate => s as LocalDate;

describe('BILAN-029 : copies équivalentes', () => {
  it('tendance et variation hebdomadaire identiques à weeklyRate.ts sur 60 fins de semaine', () => {
    const trend = computeTrend(Array.from({ length: 40 }, (_, i) => ({ date: d(`2026-${i < 20 ? '10' : '11'}-${String((i % 20) + 1 + (i % 3)).padStart(2, '0')}`), kg: 80 + Math.sin(i) * 1.5 })));
    for (let i = 0; i < 60; i += 1) {
      const end = d(new Date(Date.UTC(2026, 8, 20 + i)).toISOString().slice(0, 10));
      expect(reviewTrendKg(trend, end), end).toBe(weekTrendKg(trend, end));
      expect(reviewRateKg(trend, end), end).toBe(weeklyRateKg(trend, end));
    }
  });

  it('repère du cycle identique à cycleWeek.ts', () => {
    const phases: MesocycleState['phase'][] = ['active', 'paused', 'finished', 'completed', 'not-started', 'invalid'];
    for (const phase of phases)
      for (const totalWeeks of [5, null])
        for (const week of [0, 1, 3, 5, 6])
          for (const kind of ['work', 'deload'] as const) {
            const state = { phase, week, blockWeek: week, blockLength: 4, totalWeeks, kind };
            expect(reviewCycleMarker(state)).toEqual(cycleWeekMarker(state));
          }
  });
});
