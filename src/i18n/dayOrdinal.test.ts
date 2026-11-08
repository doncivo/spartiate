import { describe, expect, it } from 'vitest';
import { formatDayMonth, formatDayMonthYear, formatWeekRange, formatDayFull, formatDayLabel, frFirst } from './format';
import { formatDayLong, formatDayMonth as formatDayMonthLong, formatDayShort } from './nutritionText';

describe('premier du mois en français (point 9)', () => {
  it('écrit « 1er » le 1er janvier et le 1er novembre', () => {
    expect(formatDayMonthLong('2027-01-01')).toBe('1er janvier');
    expect(formatDayMonthLong('2026-11-01')).toBe('1er novembre');
    expect(formatDayMonth('2026-11-01')).toBe('1er nov.');
    expect(formatDayMonth('2027-01-01')).toBe('1er janv.');
    expect(formatDayMonthYear('2026-11-01')).toBe('1er nov. 2026');
    expect(formatDayLong('2026-11-01')).toBe('dimanche 1er novembre');
    expect(formatDayShort('2026-11-01')).toBe('dim. 1er nov.');
    expect(formatDayFull('2026-11-01')).toBe('dimanche 1er nov.');
    expect(formatDayLabel('2026-11-01')).toBe('dim. 1er nov.');
    expect(formatWeekRange('2026-11-01', '2026-11-07', 'long')).toBe('1er – 7 novembre 2026');
  });
  it('ne touche ni 11, ni 21, ni 31, ni les autres jours', () => {
    expect(formatDayMonthLong('2026-11-11')).toBe('11 novembre');
    expect(formatDayMonthLong('2026-10-21')).toBe('21 octobre');
    expect(formatDayMonthLong('2026-10-31')).toBe('31 octobre');
    expect(formatDayMonthLong('2026-11-02')).toBe('2 novembre');
    expect(frFirst('lundi 9 novembre')).toBe('lundi 9 novembre');
  });
});
