import { addDays } from '../../domain/localDate';
import { reviewCycleMarker, reviewWeekStarts, type ReviewData } from '../../domain/review/weeklyReview';
import { DEFAULT_GENERATION_CONFIG } from '../../domain/training/config';
import { mesocycleState } from '../../domain/training/mesocycle';
import type { MuscleWeight } from '../../domain/training/types';
import type { IsoDateTime, LocalDate } from '../../domain/types';
import type { FirstWeekday } from '../../domain/week';
import type { DataAccess } from '../../db/repositories/dataAccess';
import { loadNutritionSnapshot } from '../nutrition/useCases';
import { CONSTANCY_TABLES, localDayOf, readConstancy } from './constancyData';

/**
 * BILAN-029 : lecture des faits du bilan (lecture seule, repositories). Aucune table : chaque semaine archivée est recalculée depuis les
 * données. Les règles sont dans le domaine (`weeklyReview`) ; ici, seulement la mise en forme des lignes lues.
 */

export const REVIEW_TABLES = [...new Set(['workout', 'workout_set', 'exercise', ...CONSTANCY_TABLES, 'body_weight', 'meal_entry', 'day_completeness', 'nutrition_target', 'recovery_day'])];

export interface ReviewLoaded {
  readonly data: ReviewData;
  /** Semaines du bilan, la plus récente d'abord. */
  readonly weeks: readonly LocalDate[];
  readonly muscleName: (id: string) => string;
}

const localMidnightIso = (day: LocalDate): IsoDateTime => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toISOString() as IsoDateTime;
};

export async function loadWeeklyReview(access: DataAccess, today: LocalDate, first: FirstWeekday): Promise<ReviewLoaded> {
  const weeks = reviewWeekStarts(today, first);
  const oldest = weeks.at(-1) ?? today;
  const latestEnd = addDays(weeks[0] ?? today, 6);
  const repos = access.repos;
  // Journal et pesées : instantané de Nutrition (60 jours, déclarations d'Ali comprises), mêmes jours complets que le check-in.
  const [exercisesModule, musclesModule, customsRepo, workoutsRepo, targetsRepo, recoveryRepo, mesocyclesRepo, constancy, nutrition] = await Promise.all([
    import('../../../content/exercises/exercises.json'),
    import('../../../content/exercises/muscles.json'),
    repos.exercises(),
    repos.workouts(),
    repos.nutritionTargets(),
    repos.recovery(),
    repos.mesocycles(),
    readConstancy(access),
    loadNutritionSnapshot(access, today),
  ]);
  const [customs, workouts, nights, cycles] = await Promise.all([
    customsRepo.list({ includeDeleted: true }),
    workoutsRepo.closedSince(localMidnightIso(oldest)),
    recoveryRepo.listDays(oldest, latestEnd),
    mesocyclesRepo.list(),
  ]);
  // Records : mêmes règles que le résumé de séance (historique antérieur, aberrantes et assistés exclus), séance par séance.
  const summaries = await Promise.all(workouts.map(async (w) => ({ day: localDayOf(Date.parse(w.startedAt)), summary: await workoutsRepo.summary(w.id) })));
  const targetByWeek = new Map<LocalDate, number | null>();
  await Promise.all(
    weeks.map(async (start) => {
      const end = addDays(start, 6);
      const target = await targetsRepo.effective(end);
      // Cible unique seulement : avec une cible de repos (PROG-01), comparer la moyenne à la cible d'entraînement serait faux.
      targetByWeek.set(end, target === null || (target.restPlan !== null && target.restPlan !== undefined) ? null : target.target.kcal);
    }),
  );

  const catalog = exercisesModule.default.exercises as readonly { readonly id: string; readonly muscles: readonly MuscleWeight[] }[];
  const muscles = new Map<string, readonly MuscleWeight[]>();
  for (const x of [...catalog, ...customs]) muscles.set(x.id, x.muscles.map((m) => ({ id: m.id, weight: m.weight })));
  const names = new Map((musclesModule.default as { readonly muscles: readonly { readonly id: string; readonly nameFr: string }[] }).muscles.map((m) => [m.id, m.nameFr]));
  const live = cycles.filter((c) => c.deletedAt === null).sort((a, b) => (a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0));

  const data: ReviewData = {
    firstWeekday: first,
    sessionDays: constancy.days,
    target: constancy.target,
    pauses: constancy.pauses,
    workouts: workouts.map((w) => ({ day: localDayOf(Date.parse(w.startedAt)), sets: w.sets })),
    musclesOf: (id) => muscles.get(id) ?? null,
    records: summaries.flatMap(({ day, summary }) => summary.records.map((r) => ({ day, exerciseName: r.exerciseName }))),
    weighIns: nutrition.weighIns,
    nutritionDays: nutrition.days,
    targetKcal: (date) => targetByWeek.get(date) ?? null,
    sleep: nights.map((n) => ({ day: n.summary.day as LocalDate, minutes: n.summary.sleepMinutes })),
    cycleAt: (date) => {
      const cycle = live.find((c) => c.startDate <= date);
      return cycle === undefined ? null : reviewCycleMarker(mesocycleState(cycle, date, DEFAULT_GENERATION_CONFIG));
    },
  };
  return { data, weeks, muscleName: (id) => names.get(id) ?? id };
}
