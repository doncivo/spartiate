import { describe, expect, it } from 'vitest';
import { summarizeRecoveryDay } from './daySummary';
import { muscleRecoveryPercentAt } from './muscleRecovery';
import type { MuscleRecoveryRow, RecoveryCardio } from './types';

/** NUTRI-0292 (C-062) : récupération musculaire relue à l'heure courante (jamais figée au calcul) ; cardio importé : aucun muscle chargé (D-498). Valeurs inventées. */
const row = (over: Partial<MuscleRecoveryRow> = {}): MuscleRecoveryRow => ({
  muscleId: 'quads',
  group: 'Jambes',
  percent: 25,
  hours: 100,
  lastWorkedAt: '2026-11-07T10:00:00.000Z',
  readyAt: '2026-11-11T14:00:00.000Z',
  ...over,
});

describe('muscleRecoveryPercentAt', () => {
  it('le pourcentage avance avec l\'heure (25 h sur 100 h : 25 %, 50 h : 50 %)', () => {
    expect(muscleRecoveryPercentAt(row(), '2026-11-08T11:00:00.000Z')).toBe(25);
    expect(muscleRecoveryPercentAt(row(), '2026-11-09T12:00:00.000Z')).toBe(50);
  });
  it('borné à 100 % après l\'heure de reprise, et jamais sous la valeur enregistrée', () => {
    expect(muscleRecoveryPercentAt(row(), '2026-11-20T00:00:00.000Z')).toBe(100);
    expect(muscleRecoveryPercentAt(row({ percent: 60 }), '2026-11-07T11:00:00.000Z')).toBe(60);
  });
  it('heure illisible : valeur enregistrée', () => {
    expect(muscleRecoveryPercentAt(row(), 'pas une date')).toBe(25);
  });
});

describe('cardio importé (D-498, § 16.3 amendé)', () => {
  it('une séance cardio du jour ne crée aucune ligne de récupération musculaire', () => {
    const cardio: RecoveryCardio[] = [{ startedAt: '2026-11-08T06:00:00.000Z', durationSec: 3600, rpe: 8 }];
    const { muscles } = summarizeRecoveryDay({ today: '2026-11-08', now: '2026-11-08T08:00:00.000Z', timeZone: 'Europe/Paris', workouts: [], nights: [], cardio });
    expect(muscles).toEqual([]);
  });
});
