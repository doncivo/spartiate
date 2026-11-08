import { addDays } from '../../../domain/localDate';
import { tdeeConfidence, trendAt, weeklyBalance, weeklyTrendSlope, type DayState, type TdeeConfidence, type TrendPoint, type WeeklyBalance } from '../../../domain/nutrition';
import type { LocalDate } from '../../../domain/types';
import type { NutritionSnapshot } from '../useCases';

/** Fenêtre de la tendance de poids affichée (jours). */
export const TREND_WINDOW_DAYS = 28;

export interface DayBar {
  readonly date: LocalDate;
  readonly state: DayState;
  /** Total loggé ; `null` pour un jour sans entrée ou dont une entrée ignore l'énergie (jamais 0). */
  readonly kcal: number | null;
}

export interface DashboardModel {
  readonly balance: WeeklyBalance;
  /** kg / semaine ; `null` si la tendance n'a pas assez de recul. */
  readonly slope: number | null;
  readonly bars: readonly DayBar[];
  readonly trendPoints: readonly TrendPoint[];
  readonly trendNow: number | null;
  readonly lastWeighIn: { readonly date: LocalDate; readonly kg: number } | null;
  readonly confidence: TdeeConfidence;
}

/** Modèle pur des graphiques du dashboard : 7 jours d'apports, 28 jours de tendance. Aucune interpolation des jours absents. */
export function dashboardModel(snapshot: NutritionSnapshot): DashboardModel {
  const { reference, days, weighIns, trend, tdee } = snapshot;
  const target = snapshot.target?.target ?? null;
  const weekStart = addDays(reference, -6);
  const trendStart = addDays(reference, -(TREND_WINDOW_DAYS - 1));
  return {
    balance: weeklyBalance(days, weighIns, target, reference),
    slope: weeklyTrendSlope(trend, reference),
    bars: days.filter((d) => d.date >= weekStart && d.date <= reference).map((d) => ({ date: d.date, state: d.state, kcal: d.kcal })),
    trendPoints: trend.filter((p) => p.date >= trendStart && p.date <= reference),
    trendNow: trendAt(trend, reference),
    lastWeighIn: weighIns.filter((w) => w.date <= reference).at(-1) ?? null,
    confidence: tdeeConfidence(tdee),
  };
}
