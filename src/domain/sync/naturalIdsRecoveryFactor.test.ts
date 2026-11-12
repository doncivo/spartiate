import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../types';
import { expectedRecoveryFactorId, isRecoveryFactorId, recoveryFactorId } from './naturalIds';

/** I6-01 (§ 16.7, § 20.2) : identifiant naturel `recovery_factor|AAAA-MM-JJ`, sans repli UUID (le CHECK SQL de la migration 0011 porte la même forme). */
describe('identifiant naturel recovery_factor', () => {
  it('forme et bijection', () => {
    expect(recoveryFactorId('2026-11-09' as LocalDate)).toBe('recovery_factor|2026-11-09');
    expect(isRecoveryFactorId('recovery_factor|2026-11-09')).toBe(true);
    expect(isRecoveryFactorId('recovery_factor|2024-02-29')).toBe(true);
  });
  it('refuse une date impossible, un format voisin, le préfixe de recovery_day, un UUID', () => {
    for (const bad of ['recovery_factor|2026-13-09', 'recovery_factor|2026-02-30', 'recovery_factor|2026-11-9', 'recovery_factor|', 'recovery_factor|2026-11-09|x', 'recovery|2026-11-09', 'Recovery_factor|2026-11-09', '7d3c2e4f-0000-4000-8000-000000000001', '']) {
      expect(isRecoveryFactorId(bad), bad).toBe(false);
    }
  });
  it('identifiant attendu des valeurs d’une ligne', () => {
    expect(expectedRecoveryFactorId(new Map([['date', '2026-11-09']]))).toBe('recovery_factor|2026-11-09');
    expect(expectedRecoveryFactorId(new Map([['date', '2026-11-31']]))).toBeNull();
    expect(expectedRecoveryFactorId(new Map())).toBeNull();
    expect(expectedRecoveryFactorId(new Map([['date', 5]]))).toBeNull();
  });
});
