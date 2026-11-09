import { describe, expect, it } from 'vitest';
import { toNightRecords } from './nights';
import { buildSleepNights, parseShortcutHrv, parseShortcutRestingHr, parseShortcutSleep } from './shortcutFiles';

/** Assemblage des fichiers Raccourcis en nuits pour le moteur : HRV pendant la nuit, FC repos du jour de réveil, heures locales. */
const TODAY = '2026-11-08';
const TZ = 'Europe/Paris';

describe('toNightRecords', () => {
  const sleep = parseShortcutSleep('2026-11-07T23:30:00+01:00;2026-11-08T06:30:00+01:00;Endormi\n2026-11-06T23:30:00+01:00;2026-11-07T06:00:00+01:00;Endormi', TODAY, TZ);
  const { nights } = buildSleepNights(sleep.segments, TZ);

  it('moyenne des HRV prises entre le coucher et le réveil ; FC repos du jour du réveil ; heures locales en minutes', () => {
    const hrv = parseShortcutHrv('2026-11-08T02:00:00+01:00;40\n2026-11-08T04:00:00+01:00;50\n2026-11-08T12:00:00+01:00;90', TODAY, TZ);
    const rhr = parseShortcutRestingHr('2026-11-08T09:00:00+01:00;55', TODAY, TZ);
    const records = toNightRecords({ nights, hrv: hrv.samples, restingHrByDay: rhr.latestByDay, timeZone: TZ });
    expect(records).toEqual([
      { day: '2026-11-07', hrvMs: null, restingHr: null, asleepMinutes: 390, bedtimeMinutes: 1410, wakeMinutes: 360 },
      { day: '2026-11-08', hrvMs: 45, restingHr: 55, asleepMinutes: 420, bedtimeMinutes: 1410, wakeMinutes: 390 },
    ]);
  });

  it('aucune mesure : null, jamais 0 ; historique vide : tableau vide', () => {
    expect(toNightRecords({ nights, hrv: [], restingHrByDay: [], timeZone: TZ })[0]).toMatchObject({ hrvMs: null, restingHr: null });
    expect(toNightRecords({ nights: [], hrv: [], restingHrByDay: [], timeZone: TZ })).toEqual([]);
  });
});
