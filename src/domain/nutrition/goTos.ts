/**
 * « Go-tos » (§ 15.3, BL-117, choix prudent révisable par Ali) : les aliments qu'Ali prend souvent, au moins `GO_TO_MIN_COUNT` fois sur les
 * `GO_TO_WINDOW_DAYS` derniers jours, du plus fréquent au moins fréquent (puis du plus récent). Un Quick Add (sans aliment) n'en fait jamais
 * partie ; un jour futur n'est pas compté. Module pur : l'appelant lit les entrées.
 */

import { addDays } from '../localDate';
import type { LocalDate } from '../types';
import type { EntrySource } from './food';

export const GO_TO_WINDOW_DAYS = 90;
export const GO_TO_MIN_COUNT = 3;
export const GO_TO_LIMIT = 6;

export interface GoToEntry {
  readonly foodId: string | null;
  readonly foodName: string;
  readonly source: EntrySource;
  readonly grams: number | null;
  readonly date: LocalDate;
  readonly time: string;
}

export interface GoTo {
  readonly foodId: string;
  readonly foodName: string;
  readonly source: EntrySource;
  readonly count: number;
  readonly lastGrams: number | null;
  readonly lastDate: LocalDate;
}

export function goTos(entries: readonly GoToEntry[], today: LocalDate): GoTo[] {
  const from = addDays(today, -(GO_TO_WINDOW_DAYS - 1));
  const byFood = new Map<string, { count: number; last: GoToEntry }>();
  for (const entry of entries) {
    if (entry.foodId === null || entry.date < from || entry.date > today) continue;
    const seen = byFood.get(entry.foodId);
    const later = seen === undefined || `${entry.date}T${entry.time}` >= `${seen.last.date}T${seen.last.time}`;
    byFood.set(entry.foodId, { count: (seen?.count ?? 0) + 1, last: later ? entry : (seen?.last ?? entry) });
  }
  return [...byFood.entries()]
    .filter(([, v]) => v.count >= GO_TO_MIN_COUNT)
    .map(([foodId, v]) => ({ foodId, foodName: v.last.foodName, source: v.last.source, count: v.count, lastGrams: v.last.grams, lastDate: v.last.date }))
    .sort((a, b) => b.count - a.count || (a.lastDate < b.lastDate ? 1 : a.lastDate > b.lastDate ? -1 : 0) || (a.foodId < b.foodId ? -1 : 1))
    .slice(0, GO_TO_LIMIT);
}
