import { describe, expect, it } from 'vitest';
import type { LocalDate, Weekday } from './types';
import { daysFromWeekStart, daysSinceWeekStart, FIRST_WEEKDAYS } from './week';
import { weekdayOf } from './localDate';

/** ERGO-02b : `daysFromWeekStart` (jour ISO, sans `localDate`) donne exactement `daysSinceWeekStart` pour chaque réglage. */
describe('ERGO-02b : daysFromWeekStart', () => {
  const dates = ['2026-11-08', '2026-11-09', '2026-11-12', '2026-11-14', '2026-11-15'] as LocalDate[];
  for (const first of FIRST_WEEKDAYS) {
    it(`début de semaine « ${first} » : même résultat que daysSinceWeekStart`, () => {
      for (const date of dates) expect(daysFromWeekStart(weekdayOf(date), first)).toBe(daysSinceWeekStart(date, first));
    });
  }
  it('dimanche 15/11, semaine commençant le dimanche : 0 ; le lundi : 6 ; le samedi : 1', () => {
    expect(daysFromWeekStart(7 as Weekday, 'sunday')).toBe(0);
    expect(daysFromWeekStart(7 as Weekday, 'monday')).toBe(6);
    expect(daysFromWeekStart(7 as Weekday, 'saturday')).toBe(1);
  });
});
