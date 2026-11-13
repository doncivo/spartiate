import { addDays } from '../../../domain/localDate';
import { dueIntakes, type Supplement, type SupplementIntake } from '../../../domain/nutrition/supplements';
import type { LocalDate } from '../../../domain/types';

/**
 * ERGO-02 (Complements-apres) : bande « Constance · 14 jours ». Un niveau par jour, tiré de `dueIntakes` (règle I6-05, inchangée) :
 * `full` tout pris, `partial` en partie, `none` rien pris, `free` rien de prévu (jamais compté comme un jour manqué).
 */
export type ConstancyLevel = 'full' | 'partial' | 'none' | 'free';

export interface ConstancyDay {
  readonly date: LocalDate;
  readonly due: number;
  readonly taken: number;
  readonly level: ConstancyLevel;
}

/** Les `count` derniers jours finissant à `today`, du plus ancien au plus récent. */
export function constancyDays(supplements: readonly Supplement[], intakes: readonly SupplementIntake[], today: LocalDate, count: number): ConstancyDay[] {
  const days: ConstancyDay[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = addDays(today, -i);
    const due = dueIntakes(supplements, intakes, date);
    const taken = due.filter((x) => x.taken).length;
    days.push({ date, due: due.length, taken, level: due.length === 0 ? 'free' : taken === due.length ? 'full' : taken === 0 ? 'none' : 'partial' });
  }
  return days;
}
