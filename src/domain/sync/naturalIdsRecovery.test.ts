import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../types';
import { expectedMuscleRecoveryId, expectedRecoveryDayId, isMuscleRecoveryId, isRecoveryDayId, MUSCLE_RECOVERY_MUSCLE_ID_MAX, muscleRecoveryId, recoveryDayId } from './naturalIds';

/**
 * I5-01 (§ 16.4, § 20.2) : identifiants naturels des résumés de récupération, `recovery|AAAA-MM-JJ` et `muscle|AAAA-MM-JJ|<muscle>`, sans
 * repli UUID (les CHECK SQL de la migration 0010 portent les mêmes formes).
 */
describe('identifiant naturel recovery_day', () => {
  it('forme et bijection', () => {
    expect(recoveryDayId('2026-11-09' as LocalDate)).toBe('recovery|2026-11-09');
    expect(isRecoveryDayId('recovery|2026-11-09')).toBe(true);
    expect(isRecoveryDayId('recovery|2024-02-29')).toBe(true);
  });
  it('refuse une date impossible, un format voisin, un UUID', () => {
    for (const bad of ['recovery|2026-13-09', 'recovery|2026-02-30', 'recovery|2026-11-9', 'recovery|', 'recovery|2026-11-09|x', 'day|2026-11-09', 'Recovery|2026-11-09', '7d3c2e4f-0000-4000-8000-000000000001', '']) {
      expect(isRecoveryDayId(bad), bad).toBe(false);
    }
  });
  it('identifiant attendu des valeurs d’une ligne', () => {
    expect(expectedRecoveryDayId(new Map([['date', '2026-11-09']]))).toBe('recovery|2026-11-09');
    expect(expectedRecoveryDayId(new Map([['date', '2026-11-31']]))).toBeNull();
    expect(expectedRecoveryDayId(new Map())).toBeNull();
    expect(expectedRecoveryDayId(new Map([['date', 5]]))).toBeNull();
  });
});

describe('identifiant naturel muscle_recovery', () => {
  it('forme et bijection', () => {
    expect(muscleRecoveryId('2026-11-09' as LocalDate, 'quadriceps')).toBe('muscle|2026-11-09|quadriceps');
    expect(isMuscleRecoveryId('muscle|2026-11-09|quadriceps')).toBe(true);
    expect(isMuscleRecoveryId(`muscle|2026-11-09|${'m'.repeat(MUSCLE_RECOVERY_MUSCLE_ID_MAX)}`)).toBe(true);
    expect(MUSCLE_RECOVERY_MUSCLE_ID_MAX).toBe(64);
  });
  it('refuse une date impossible, un muscle vide, trop long ou contenant « | », un UUID', () => {
    for (const bad of [
      'muscle|2026-13-09|quadriceps',
      'muscle|2026-11-9|quadriceps',
      'muscle|2026-11-09|',
      'muscle|2026-11-09',
      'muscle|2026-11-09|a|b',
      `muscle|2026-11-09|${'m'.repeat(65)}`,
      'recovery|2026-11-09',
      'Muscle|2026-11-09|quadriceps',
      '7d3c2e4f-0000-4000-8000-000000000001',
      '',
    ]) {
      expect(isMuscleRecoveryId(bad), bad).toBe(false);
    }
  });
  it('identifiant attendu des valeurs d’une ligne', () => {
    expect(expectedMuscleRecoveryId(new Map([['date', '2026-11-09'], ['muscle_id', 'quadriceps']]))).toBe('muscle|2026-11-09|quadriceps');
    expect(expectedMuscleRecoveryId(new Map([['date', '2026-11-09']]))).toBeNull();
    expect(expectedMuscleRecoveryId(new Map([['date', '2026-11-09'], ['muscle_id', 'a|b']]))).toBeNull();
    expect(expectedMuscleRecoveryId(new Map([['date', '2026-02-30'], ['muscle_id', 'quadriceps']]))).toBeNull();
    expect(expectedMuscleRecoveryId(new Map<string, unknown>([['date', '2026-11-09'], ['muscle_id', 3]]))).toBeNull();
  });
});
