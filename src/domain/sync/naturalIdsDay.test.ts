import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../types';
import { dayCompletenessId, expectedDayCompletenessId, isDayCompletenessId } from './naturalIds';

/** I4-07 (D-81) : identifiant naturel de la déclaration d'une journée, `day|AAAA-MM-JJ`, sans repli UUID. */
describe('identifiant naturel day_completeness', () => {
  it('forme et bijection', () => {
    expect(dayCompletenessId('2026-11-09' as LocalDate)).toBe('day|2026-11-09');
    expect(isDayCompletenessId('day|2026-11-09')).toBe(true);
    expect(isDayCompletenessId('day|2024-02-29')).toBe(true);
  });
  it('refuse une date impossible, un format voisin, un UUID', () => {
    for (const bad of ['day|2026-13-09', 'day|2026-02-30', 'day|2026-11-9', 'day|', 'day|2026-11-09|x', 'weight|2026-11-09|manual', 'Day|2026-11-09', '7d3c2e4f-0000-4000-8000-000000000001', '']) {
      expect(isDayCompletenessId(bad), bad).toBe(false);
    }
  });
  it('identifiant attendu des valeurs d’une ligne', () => {
    expect(expectedDayCompletenessId(new Map([['date', '2026-11-09']]))).toBe('day|2026-11-09');
    expect(expectedDayCompletenessId(new Map([['date', '2026-11-31']]))).toBeNull();
    expect(expectedDayCompletenessId(new Map())).toBeNull();
    expect(expectedDayCompletenessId(new Map([['date', 5]]))).toBeNull();
  });
});
