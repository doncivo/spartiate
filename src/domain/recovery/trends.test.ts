import { describe, expect, it } from 'vitest';
import { addDays } from '../localDate';
import type { LocalDate } from '../types';
import { recoveryTrends, TREND_DAYS, type TrendDay } from './trends';

/** PROGRES-c (§ 17.1 « Récupération : tendances 30 j », lues depuis `recovery_day`) : séries par jour, absents en null, moyennes. Synthétique. */

const TODAY = '2026-11-18' as LocalDate;
const START = addDays(TODAY, -(TREND_DAYS - 1));
const day = (i: number, patch: Partial<TrendDay> = {}): TrendDay => ({ day: addDays(START, i), recovery: 50 + i, hrvMs: 40, restingHr: 55 + (i % 2), sleepMinutes: 420, ...patch });

describe('recoveryTrends', () => {
  it('30 jours finissant aujourd’hui ; jours sans ligne ou sans mesure : null (jamais 0) ; moyennes 30 j et 7 j, min et max arrondis', () => {
    const days = Array.from({ length: TREND_DAYS }, (_, i) => day(i)).filter((_, i) => i !== 5 && i !== 10);
    // Hors fenêtre : ignoré ; mesure absente un jour : null pour cette mesure seulement.
    days.push({ day: addDays(START, -1), recovery: 0, hrvMs: 0, restingHr: 0, sleepMinutes: 0 });
    days[0] = { ...(days[0] as TrendDay), sleepMinutes: null };
    const t = recoveryTrends(days, TODAY);
    expect(t.days).toHaveLength(TREND_DAYS);
    expect(t.days[0]).toBe(START);
    expect(t.days.at(-1)).toBe(TODAY);
    expect(t.series.recovery.points[5]).toBeNull();
    expect(t.series.recovery.points[29]).toBe(79);
    expect(t.series.recovery).toMatchObject({ measured: 28, mean30: 65, mean7: 76, min: 50, max: 79 });
    expect(t.series.hrv).toMatchObject({ measured: 28, mean30: 40, min: 40, max: 40 });
    expect(t.series.restingHr).toMatchObject({ mean30: 56, min: 55, max: 56 });
    expect(t.series.sleep).toMatchObject({ measured: 27, mean30: 420 });
    expect(t.series.sleep.points[0]).toBeNull();
  });

  it('aucun jour : séries vides (moyennes, min et max null) ; entrée inchangée', () => {
    const t = recoveryTrends([], TODAY);
    expect(t.series.recovery).toMatchObject({ measured: 0, mean30: null, mean7: null, min: null, max: null });
    const days = [day(29)];
    const frozen = JSON.stringify(days);
    recoveryTrends(days, TODAY);
    expect(JSON.stringify(days)).toBe(frozen);
  });
});
