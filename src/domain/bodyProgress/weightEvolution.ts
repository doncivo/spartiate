import { isTrendLearning, TREND_WEIGH_INS_NEEDED } from '../nutrition/trendLearning';
import type { WeighIn } from '../nutrition/types';
import { computeTrend, trendAt } from '../nutrition/weightTrend';
import type { LocalDate } from '../types';
import { inPeriod, periodStart, roundTo, type BodyPeriod } from './period';

/**
 * PROG-0301b (BL-178, D-706, D-718, D-733) : évolution du poids sous la courbe, par la tendance des pesées (`computeTrend`, § 15.1). La
 * tendance se calcule sur toutes les pesées jusqu'à la fin (l'historique d'avant la période compte) ; départ : tendance au premier jour de la
 * période (report de la dernière connue), sinon la première pesée de la période ; arrivée : la dernière tendance jusqu'à la fin.
 */

export type WeightEvolution =
  | { readonly status: 'known'; readonly from: { readonly date: LocalDate; readonly kg: number }; readonly to: { readonly date: LocalDate; readonly kg: number }; readonly deltaKg: number }
  /** Moins de 14 jours de pesée jusqu'à la fin : la tendance est en apprentissage, dite comme telle (jamais 0). */
  | { readonly status: 'learning'; readonly weighIns: number; readonly needed: number }
  /** Aucune pesée dans la période, ou une seule sans historique : rien à comparer. */
  | { readonly status: 'unknown' };

export function weightEvolution(weighIns: readonly WeighIn[], period: BodyPeriod, end: LocalDate): WeightEvolution {
  const points = computeTrend(weighIns.filter((w) => w.date <= end));
  if (isTrendLearning(points.length)) return { status: 'learning', weighIns: points.length, needed: TREND_WEIGH_INS_NEEDED };
  const start = periodStart(period, end);
  const inside = points.filter((p) => inPeriod(p.date, start, end));
  const firstInside = inside[0];
  const last = inside.at(-1);
  if (firstInside === undefined || last === undefined) return { status: 'unknown' };
  const carried = start === null ? null : trendAt(points, start);
  const from = carried !== null && start !== null ? { date: start, kg: carried } : { date: firstInside.date, kg: firstInside.trend };
  if (from.date === last.date) return { status: 'unknown' };
  return { status: 'known', from, to: { date: last.date, kg: last.trend }, deltaKg: roundTo(last.trend - from.kg, 1) };
}
