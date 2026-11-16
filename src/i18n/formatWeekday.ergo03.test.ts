import { describe, expect, it } from 'vitest';
import { formatWeekdayDate, formatWeekdayList } from './nutritionText';

/** ERGO-03 : dates et jours de Stratégie en toutes lettres. */
describe('ERGO-03 : formatWeekdayDate et formatWeekdayList', () => {
  it('« lundi 16/11 », « dimanche 01/03 »', () => {
    expect(formatWeekdayDate('2026-11-16')).toBe('lundi 16/11');
    expect(formatWeekdayDate('2026-03-01')).toBe('dimanche 01/03');
  });
  it('un, deux, trois jours', () => {
    expect(formatWeekdayList([7])).toBe('le dimanche');
    expect(formatWeekdayList([3, 7])).toBe('le mercredi et le dimanche');
    expect(formatWeekdayList([3, 6, 7])).toBe('le mercredi, le samedi et le dimanche');
  });
});
