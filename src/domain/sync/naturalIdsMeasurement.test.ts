import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../types';
import { expectedMeasurementId, isMeasurementId, measurementId } from './naturalIds';

/** I6-02 (§ 17.1, § 20.2) : identifiant naturel `measurement|AAAA-MM-JJ|<kind>`, sans repli UUID (le CHECK SQL de la migration 0012 porte la même forme). */
describe('identifiant naturel measurement', () => {
  it('forme et bijection', () => {
    expect(measurementId('2026-11-09' as LocalDate, 'waist')).toBe('measurement|2026-11-09|waist');
    expect(isMeasurementId('measurement|2026-11-09|waist')).toBe(true);
    expect(isMeasurementId('measurement|2024-02-29|arm_left')).toBe(true);
  });
  it('refuse une date impossible, un genre mal formé, un format voisin, un UUID', () => {
    for (const bad of ['measurement|2026-13-09|waist', 'measurement|2026-02-30|waist', 'measurement|2026-11-09|', 'measurement|2026-11-09|Waist', 'measurement|2026-11-09|wa|ist', 'measurement|2026-11-09|' + 'a'.repeat(33), 'measurement|2026-11-9|waist', 'weight|2026-11-09|waist', '7d3c2e4f-0000-4000-8000-000000000001', '']) {
      expect(isMeasurementId(bad), bad).toBe(false);
    }
  });
  it('identifiant attendu des valeurs d’une ligne', () => {
    expect(expectedMeasurementId(new Map([['date', '2026-11-09'], ['kind', 'hips']]))).toBe('measurement|2026-11-09|hips');
    expect(expectedMeasurementId(new Map([['date', '2026-11-31'], ['kind', 'hips']]))).toBeNull();
    expect(expectedMeasurementId(new Map([['date', '2026-11-09'], ['kind', 'Hips']]))).toBeNull();
    expect(expectedMeasurementId(new Map([['date', '2026-11-09']]))).toBeNull();
  });
});
