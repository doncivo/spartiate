import { describe, expect, it } from 'vitest';
import { summarizeRecoveryDay } from './daySummary';
import { recoveryScore } from './recoveryScore';
import type { NightRecord } from './types';

/** NUTRI-0292 (C-059, C-060) : validité de la nuit du jour, niveau B. Valeurs inventées. */
const TODAY = '2026-11-08';
const addDays = (day: string, n: number): string => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const night = (day: string, i: number, over: Partial<NightRecord> = {}): NightRecord => ({ day, hrvMs: i % 2 === 0 ? 48 : 52, restingHr: i % 2 === 0 ? 54 : 56, asleepMinutes: 450, bedtimeMinutes: 1380, wakeMinutes: 390, ...over });
const history = Array.from({ length: 20 }, (_, i) => night(addDays(TODAY, -20 + i), i));
const base = { today: TODAY, now: '2026-11-08T08:00:00.000Z', timeZone: 'Europe/Paris', workouts: [] };

describe('C-059 : la nuit du jour est soumise au seuil de 180 min', () => {
  it('moins de 180 min dormies : pas de score (sommeil inutilisable), jamais un score sur une nuit non valide', () => {
    const short = night(TODAY, 0, { hrvMs: 50, restingHr: 55, asleepMinutes: 120 });
    const r = recoveryScore({ today: TODAY, nights: [...history, short], sleepRatio: 120 / 450 });
    expect(r.score).toBeNull();
    expect(r.reason).toBe('measure_missing_sleep');
  });
  it('exactement 180 min : valide, score calculé', () => {
    const edge = night(TODAY, 0, { hrvMs: 50, restingHr: 55, asleepMinutes: 180 });
    expect(recoveryScore({ today: TODAY, nights: [...history, edge], sleepRatio: 180 / 450 }).score).not.toBeNull();
  });
});

describe('C-060 : niveau B, libellé figé', () => {
  it('σ = 0 (nuits toutes identiques) : pas de score, niveau B (seuils absolus), qualité « insufficient »', () => {
    const flat = Array.from({ length: 20 }, (_, i) => night(addDays(TODAY, -20 + i), i, { hrvMs: 50, restingHr: 55 }));
    const { summary } = summarizeRecoveryDay({ ...base, nights: [...flat, night(TODAY, 0, { hrvMs: 50, restingHr: 55 })] });
    expect(summary).toMatchObject({ recovery: null, abstainReason: 'zero_variance', level: 'B', quality: 'insufficient' });
  });
  it('HRV du jour absente, sommeil et FC repos connus : niveau B', () => {
    const { summary } = summarizeRecoveryDay({ ...base, nights: [...history, night(TODAY, 0, { hrvMs: null, restingHr: 55 })] });
    expect(summary).toMatchObject({ recovery: null, abstainReason: 'measure_missing_hrv', level: 'B' });
  });
});
