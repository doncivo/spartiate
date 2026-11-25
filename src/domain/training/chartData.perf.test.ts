import { describe, expect, it } from 'vitest';
import { addDays } from '../localDate';
import { recoveryTrends, type TrendDay } from '../recovery/trends';
import type { LocalDate } from '../types';
import { constancy, monthCalendar, weeklyMuscleVolume, type ProgressWorkout } from './progressStats';

/**
 * SHELL-0294e (C-167, § 23.1 g) : budget « graphiques < 300 ms » du PRD § 23.1. Les graphiques de Spartiate sont des SVG calculés dans le
 * domaine (Recharts n'a jamais été importé, D-394) : le budget garde le calcul des séries sur trois ans d'historique, hors rendu (le rendu
 * d'un SVG de quelques points ne dépend pas de la taille de l'historique). `npm run test:perf` (hors `npm run test`).
 */
const BUDGET_MS = 300;
const TODAY = '2026-11-25' as LocalDate;
const THREE_YEARS = 3 * 365;

const dayAt = (offset: number): LocalDate => addDays(TODAY, -offset);

/** Quatre séances par semaine, vingt séries validées chacune, sur trois ans. */
const workouts: ProgressWorkout[] = Array.from({ length: THREE_YEARS }, (_, offset) => offset)
  .filter((offset) => offset % 7 < 4)
  .map((offset) => ({
    day: dayAt(offset),
    sets: Array.from({ length: 20 }, (_, i) => ({ exerciseId: `exo-${String(i % 12)}`, setKind: 'work' as const, done: i % 9 !== 0 })),
  }));
const musclesOf = (exerciseId: string) => [
  { id: `muscle-${exerciseId.slice(4)}`, weight: 1 },
  { id: 'muscle-secondaire', weight: 0.5 },
];

function elapsedMs(run: () => unknown): number {
  const start = performance.now();
  run();
  return performance.now() - start;
}

describe('graphiques < 300 ms (§ 23.1, C-167) : séries calculées sur trois ans', () => {
  it('volume hebdomadaire par muscle (trois ans de semaines)', () => {
    const ms = elapsedMs(() => weeklyMuscleVolume({ workouts, musclesOf, today: TODAY, weeks: 156 }));
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it('constance et calendrier du mois (trois ans de séances)', () => {
    const days = workouts.map((w) => w.day);
    expect(elapsedMs(() => constancy({ days, today: TODAY, target: { perWeek: 3, since: dayAt(THREE_YEARS) }, pauses: [] }))).toBeLessThan(BUDGET_MS);
    expect(elapsedMs(() => monthCalendar({ today: TODAY, days, pauses: [] }))).toBeLessThan(BUDGET_MS);
  });

  it('tendances de récupération (trois ans de nuits, fenêtre de 30 jours et fenêtre de trois ans)', () => {
    const nights: TrendDay[] = Array.from({ length: THREE_YEARS }, (_, offset) => ({ day: dayAt(offset), recovery: 60 + (offset % 30), hrvMs: 40 + (offset % 20), restingHr: 50 + (offset % 8), sleepMinutes: 400 + (offset % 90) }));
    expect(elapsedMs(() => recoveryTrends(nights, TODAY))).toBeLessThan(BUDGET_MS);
    expect(elapsedMs(() => recoveryTrends(nights, TODAY, THREE_YEARS))).toBeLessThan(BUDGET_MS);
  });
});
