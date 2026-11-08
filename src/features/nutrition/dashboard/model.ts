import { addDays } from '../../../domain/localDate';
import { isTrendLearning, tdeeConfidence, trendAt, weeklyBalance, weeklyTrendSlope, type DayState, type TdeeConfidence, type TrendPoint, type WeeklyBalance } from '../../../domain/nutrition';
import type { LocalDate } from '../../../domain/types';
import type { NutritionSnapshot } from '../useCases';

/** Fenêtre de la tendance de poids affichée (jours) : au plus 28 jours. */
export const TREND_WINDOW_DAYS = 28;
/** Fenêtre minimale de l'axe des X : avec peu de données, 7 jours finissant à la date de fin, pas 28 jours presque vides. */
export const TREND_MIN_AXIS_DAYS = 7;

export interface TrendScale {
  readonly startDate: LocalDate;
  /** Nombre de jours de l'axe des X, bornes comprises (7 à 28). */
  readonly spanDays: number;
  readonly min: number;
  readonly max: number;
}

const dayDiff = (from: LocalDate, to: LocalDate): number => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/**
 * Échelle pure du graphique de tendance. X : de la première donnée à `endDate`, au minimum 7 jours et au plus 28. Y : englobe toutes les
 * pesées ET la tendance, avec une marge d'au moins 0,5 kg ou de 15 % de l'amplitude, pour qu'aucun point ne se trouve sur l'axe.
 */
export function trendScale(points: readonly TrendPoint[], endDate: LocalDate): TrendScale {
  const first = points.reduce<LocalDate | null>((acc, p) => (acc === null || p.date < acc ? p.date : acc), null);
  const spanDays = first === null ? TREND_MIN_AXIS_DAYS : Math.min(TREND_WINDOW_DAYS, Math.max(TREND_MIN_AXIS_DAYS, dayDiff(first, endDate) + 1));
  const kgs = points.flatMap((p) => [p.kg, p.trend]);
  const lo = kgs.length === 0 ? 0 : Math.min(...kgs);
  const hi = kgs.length === 0 ? 1 : Math.max(...kgs);
  const margin = Math.max(0.5, (hi - lo) * 0.15);
  return { startDate: addDays(endDate, -(spanDays - 1)), spanDays, min: lo - margin, max: hi + margin };
}

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
  /** Tendance encore « en apprentissage » (moins de 14 pesées, règle commune avec Aujourd'hui) : le chiffre de tendance n'est pas affiché. */
  readonly learning: boolean;
  readonly weighInCount: number;
  readonly lastWeighIn: { readonly date: LocalDate; readonly kg: number } | null;
  readonly confidence: TdeeConfidence;
}

/** Modèle pur des graphiques du dashboard : 7 jours d'apports, 28 jours de tendance. Aucune interpolation des jours absents. */
export function dashboardModel(snapshot: NutritionSnapshot): DashboardModel {
  const { reference, days, weighIns, trend, tdee } = snapshot;
  const target = snapshot.target?.target ?? null;
  const weekStart = addDays(reference, -6);
  const { today } = snapshot;
  const trendStart = addDays(today, -(TREND_WINDOW_DAYS - 1));
  const known = weighIns.filter((w) => w.date <= today);
  return {
    balance: weeklyBalance(days, weighIns, target, reference),
    slope: weeklyTrendSlope(trend, reference),
    bars: days.filter((d) => d.date >= weekStart && d.date <= reference).map((d) => ({ date: d.date, state: d.state, kcal: d.kcal })),
    trendPoints: trend.filter((p) => p.date >= trendStart && p.date <= today),
    trendNow: trendAt(trend, today),
    learning: isTrendLearning(known.length),
    weighInCount: known.length,
    lastWeighIn: known.at(-1) ?? null,
    confidence: tdeeConfidence(tdee),
  };
}
