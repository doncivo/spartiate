import { describe, expect, it } from 'vitest';
import { buildBaseline } from './baseline';
import { summarizeRecoveryDay } from './daySummary';
import type { NightRecord } from './types';

/** NUTRI-0292 (C-061, D-479) : la baseline ne retient que les nuits valides des 30 derniers jours calendaires ; sous 14 nuits : en reconstruction, jamais « good ». Valeurs inventées. */
const TODAY = '2026-11-08';
const addDays = (day: string, n: number): string => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const night = (day: string, i: number, over: Partial<NightRecord> = {}): NightRecord => ({ day, hrvMs: i % 2 === 0 ? 48 : 52, restingHr: i % 2 === 0 ? 54 : 56, asleepMinutes: 450, bedtimeMinutes: 1380, wakeMinutes: 390, ...over });
const tonight = night(TODAY, 0, { hrvMs: 50, restingHr: 55 });

describe('C-061 : fenêtre de 30 jours calendaires', () => {
  it('14 nuits valides, mais toutes vieilles de plus de 30 jours : aucune retenue', () => {
    const old = Array.from({ length: 14 }, (_, i) => night(addDays(TODAY, -60 + i), i));
    expect(buildBaseline([...old, tonight], TODAY, 'hrvMs').validNights).toBe(0);
  });

  it('la fenêtre est les 30 jours avant aujourd\'hui : le 30e jour est retenu, le 31e non', () => {
    const nights = [night(addDays(TODAY, -30), 0), night(addDays(TODAY, -31), 1), tonight];
    expect(buildBaseline(nights, TODAY, 'hrvMs').validNights).toBe(1);
  });

  it('14 nuits dont 5 hors fenêtre : 9 retenues, score calculé mais qualité « partial » (en reconstruction)', () => {
    const recent = Array.from({ length: 9 }, (_, i) => night(addDays(TODAY, -9 + i), i));
    const old = Array.from({ length: 5 }, (_, i) => night(addDays(TODAY, -50 + i), i));
    const { summary } = summarizeRecoveryDay({ today: TODAY, now: '2026-11-08T08:00:00.000Z', timeZone: 'Europe/Paris', workouts: [], nights: [...old, ...recent, tonight] });
    expect(summary.learningNights).toBe(9);
    expect(summary.recovery).not.toBeNull();
    expect(summary.quality).toBe('partial');
  });

  it('14 nuits valides dans la fenêtre : qualité « good », comme avant', () => {
    const recent = Array.from({ length: 14 }, (_, i) => night(addDays(TODAY, -14 + i), i));
    const { summary } = summarizeRecoveryDay({ today: TODAY, now: '2026-11-08T08:00:00.000Z', timeZone: 'Europe/Paris', workouts: [], nights: [...recent, tonight] });
    expect(summary.quality).toBe('good');
  });
});
