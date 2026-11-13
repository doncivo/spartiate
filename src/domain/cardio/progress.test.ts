import { describe, expect, it } from 'vitest';
import { cardioWeeks, sessionLocalDay, type CardioWeekSession } from './index';

/** I6-06 (D-223) : Progrès › Cardio, totaux par semaine (lundi), 4 semaines, la plus récente d'abord. */
const TZ = 'Europe/Paris';
const s = (startedAt: string, durationSec: number, distanceM: number | null = null): CardioWeekSession => ({ startedAt, durationSec, distanceM });

describe('jour local d’une séance', () => {
  it('jour du début, dans le fuseau de l’appareil', () => {
    expect(sessionLocalDay('2026-11-12T23:30:00.000Z', TZ)).toBe('2026-11-13');
    expect(sessionLocalDay('2026-11-12T22:30:00.000Z', TZ)).toBe('2026-11-12');
  });
});

describe('cardioWeeks', () => {
  it('quatre semaines (lundi), la plus récente d’abord ; distance inconnue ≠ 0', () => {
    const weeks = cardioWeeks(
      [
        s('2026-11-13T07:00:00.000Z', 1800, 5000),
        s('2026-11-10T07:00:00.000Z', 2700, null),
        s('2026-11-08T07:00:00.000Z', 3600, 10000),
        s('2026-10-01T07:00:00.000Z', 3600, 10000),
      ],
      '2026-11-13',
      TZ,
    );
    expect(weeks.map((w) => w.weekStart)).toEqual(['2026-11-09', '2026-11-02', '2026-10-26', '2026-10-19']);
    expect(weeks[0]).toEqual({ weekStart: '2026-11-09', count: 2, durationSec: 4500, distanceM: 5000, sessionsWithoutDistance: 1 });
    expect(weeks[1]).toEqual({ weekStart: '2026-11-02', count: 1, durationSec: 3600, distanceM: 10000, sessionsWithoutDistance: 0 });
    expect(weeks[2]).toEqual({ weekStart: '2026-10-26', count: 0, durationSec: 0, distanceM: null, sessionsWithoutDistance: 0 });
  });

  it('séance future (après aujourd’hui) ignorée ; nombre de semaines réglable', () => {
    const weeks = cardioWeeks([s('2026-11-20T07:00:00.000Z', 1800, 5000)], '2026-11-13', TZ, 2);
    expect(weeks).toHaveLength(2);
    expect(weeks.every((w) => w.count === 0)).toBe(true);
  });
});
