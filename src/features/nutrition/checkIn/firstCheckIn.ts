import { addDays } from '../../../domain/localDate';
import { checkInPeriod, coverageOfWindow, NUTRITION_CONFIG } from '../../../domain/nutrition';
import type { Coverage, DayTotals, WeighIn } from '../../../domain/nutrition';
import type { LocalDate, Weekday } from '../../../domain/types';

export type FirstCheckIn =
  | { readonly first: false }
  | {
      readonly first: true;
      /** Jour du premier check-in : le prochain jour de check-in après aujourd'hui. */
      readonly date: LocalDate;
      /** Semaine qu'il analysera. */
      readonly weekStart: LocalDate;
      readonly weekEnd: LocalDate;
      /** Où en est cette semaine (jours complets, pesées) ; `needDays` et `needWeighIns` sont les minimums du § 15.2. */
      readonly coverage: Coverage;
      readonly needDays: number;
      readonly needWeighIns: number;
    };

/**
 * 0.7.1 point 8 : quand la période du dernier jour de check-in passé est antérieure à la première donnée saisie (aucun jour loggé ni pesée
 * jusqu'à sa fin), l'écran annonce le PREMIER check-in au prochain jour de check-in au lieu d'un check-in suspendu sur une semaine vide.
 * N'altère pas la règle de décision (`checkInPeriod`, `proposeCheckIn`) : c'est un état d'affichage seulement.
 */
export function firstCheckIn(today: LocalDate, weekday: Weekday, days: readonly DayTotals[], weighIns: readonly WeighIn[]): FirstCheckIn {
  const period = checkInPeriod(today, weekday);
  const dates = [...days.filter((d) => d.entryCount > 0).map((d) => d.date), ...weighIns.map((w) => w.date)].sort();
  const firstData = dates[0];
  if (firstData !== undefined && firstData <= period.weekEnd) return { first: false };
  const date = addDays(period.checkInDate, 7);
  const weekEnd = addDays(date, -1);
  return {
    first: true,
    date,
    weekStart: addDays(weekEnd, -6),
    weekEnd,
    coverage: coverageOfWindow(days, weighIns, weekEnd),
    needDays: NUTRITION_CONFIG.minLoggedDays,
    needWeighIns: NUTRITION_CONFIG.minWeighIns,
  };
}
