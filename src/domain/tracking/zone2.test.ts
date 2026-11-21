import { describe, expect, it } from 'vitest';
import { hrMaxOf, zone2Range, zone2Weeks, ZONE2_RULE, type Zone2Session } from './zone2';

/** SUIVIS-029b : cardio en zone 2 (FC max saisie ou 220 − âge ; zone 60–70 % ; une séance dans la zone compte pour sa durée). */
const TZ = 'Europe/Paris';
const s = (startedAt: string, minutes: number, avgHr: number | null): Zone2Session => ({ startedAt, durationSec: minutes * 60, avgHr });

describe('hrMaxOf', () => {
  it('FC max saisie : elle prime sur l’âge', () => {
    expect(hrMaxOf({ entered: 182, birthYear: 1990, currentYear: 2026 })).toEqual({ value: 182, source: 'entered', age: null });
  });

  it('sans saisie : 220 − (année courante − année de naissance)', () => {
    expect(ZONE2_RULE).toEqual({ base: 220, lowPct: 60, highPct: 70 });
    expect(hrMaxOf({ entered: null, birthYear: 1990, currentYear: 2026 })).toEqual({ value: 184, source: 'age', age: 36 });
  });

  it('ni saisie ni année de naissance plausible : null (jamais une FC inventée)', () => {
    expect(hrMaxOf({ entered: null, birthYear: null, currentYear: 2026 })).toBeNull();
    expect(hrMaxOf({ entered: null, birthYear: 2030, currentYear: 2026 })).toBeNull();
    expect(hrMaxOf({ entered: null, birthYear: 1890, currentYear: 2026 })).toBeNull();
  });
});

describe('zone2Range', () => {
  it('bornes arrondies au battement, incluses', () => {
    expect(zone2Range(184)).toEqual({ low: 110, high: 129 });
    expect(zone2Range(200)).toEqual({ low: 120, high: 140 });
  });
});

describe('zone2Weeks', () => {
  const range = { low: 110, high: 129 };
  it('séance dans la zone : toute sa durée ; hors zone : 0 ; sans FC : jamais comptée, dite ; 4 semaines du lundi', () => {
    const weeks = zone2Weeks(
      [s('2026-11-17T07:00:00.000Z', 45, 120), s('2026-11-18T07:00:00.000Z', 30, 140), s('2026-11-19T07:00:00.000Z', 20, null), s('2026-11-20T07:00:00.000Z', 30.5, 110), s('2026-11-10T07:00:00.000Z', 60, 129)],
      range,
      '2026-11-21',
      TZ,
    );
    expect(weeks.map((w) => w.weekStart)).toEqual(['2026-11-16', '2026-11-09', '2026-11-02', '2026-10-26']);
    expect(weeks[0]).toEqual({ weekStart: '2026-11-16', minutes: 76, sessions: 4, sessionsInZone: 2, sessionsWithoutHr: 1 });
    expect(weeks[1]).toEqual({ weekStart: '2026-11-09', minutes: 60, sessions: 1, sessionsInZone: 1, sessionsWithoutHr: 0 });
    expect(weeks[2]).toEqual({ weekStart: '2026-11-02', minutes: 0, sessions: 0, sessionsInZone: 0, sessionsWithoutHr: 0 });
  });

  it('séance future ou date illisible ignorée ; jour local de l’appareil ; semaines réglables', () => {
    const weeks = zone2Weeks([s('2026-11-22T07:00:00.000Z', 45, 120), s('pas une date', 45, 120), s('2026-11-15T23:30:00.000Z', 40, 115)], range, '2026-11-21', TZ, 1);
    expect(weeks).toEqual([{ weekStart: '2026-11-16', minutes: 40, sessions: 1, sessionsInZone: 1, sessionsWithoutHr: 0 }]);
  });
});
