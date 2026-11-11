import { describe, expect, it } from 'vitest';
import { RECOVERY_CONFIG } from './config';
import { summarizeRecoveryDay } from './daySummary';
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

/** I5-05 (sommeil) : une nuit est le plus long épisode qui se termine le jour du réveil ; les siestes ne sont jamais des nuits. */
describe('nuits et siestes (I5-05)', () => {
  const iso = (day: number, hhmm: string): string => `2026-11-${String(day).padStart(2, '0')}T${hhmm}:00+01:00`;
  const seg = (a: string, b: string, stage = 'Endormi'): string => `${a};${b};${stage}`;
  const today = '2026-11-08';
  const segmentsOf = (lines: readonly string[]) => parseShortcutSleep(lines.join('\n'), today, TZ).segments;

  it('constante nommée : un épisode regroupe les segments séparés de moins de 60 min', () => {
    expect(RECOVERY_CONFIG.sleep.episodeGapMinutes).toBe(60);
  });

  it('semaine réelle simplifiée : couchers 1 h à 4 h, levers 9 h à 11 h 30, trois siestes l’après-midi : dette proche de 0, besoin proche de 7 h 30', () => {
    // [jour de réveil, coucher, lever, minutes dormies] ; moyenne dormie 7 h 28 (448 min)
    const week: readonly [number, string, string, number][] = [
      [2, '01:00', '09:00', 450],
      [3, '02:30', '10:30', 445],
      [4, '04:00', '11:30', 460],
      [5, '03:00', '11:00', 440],
      [6, '01:30', '09:30', 455],
      [7, '03:30', '11:00', 430],
      [8, '02:00', '10:00', 456],
    ];
    const lines: string[] = [];
    for (const [day, bed, wake, asleep] of week) {
      // Un seul épisode : l’« Endormi » couvre `asleep` minutes, le reste de la nuit est « Au lit ».
      const [bh = 0, bm = 0] = bed.split(':').map(Number);
      const end = bh * 60 + bm + asleep;
      const endHhmm = `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
      lines.push(seg(iso(day, bed), iso(day, endHhmm)), seg(iso(day, endHhmm), iso(day, wake), 'Au lit'));
    }
    // Trois siestes (jeudi 5, samedi 7, dimanche 8), 3 h après le lever (donc à plus de 60 min de la nuit), 45 à 90 min.
    lines.push(seg(iso(5, '15:00'), iso(5, '16:30')), seg(iso(7, '15:00'), iso(7, '15:45')), seg(iso(8, '14:30'), iso(8, '15:30')));
    const { nights } = buildSleepNights(segmentsOf(lines), TZ);
    expect(nights.map((n) => n.asleepMinutes)).toEqual([450, 445, 460, 440, 455, 430, 456]);
    const records = toNightRecords({ nights, hrv: [], restingHrByDay: [], timeZone: TZ });
    const out = summarizeRecoveryDay({ today, now: '2026-11-08T12:00:00.000Z', timeZone: TZ, nights: records, workouts: [] });
    expect(out.summary.sleepNeedMinutes).toBeLessThanOrEqual(7 * 60 + 30 + 60);
    expect(out.summary.sleepNeedMinutes).toBeGreaterThanOrEqual(7 * 60 + 30);
    expect(out.summary.explanationKeys ?? []).not.toContain('sleep_debt_cap');
    // Les heures de lever et de coucher sont celles des nuits, jamais d’une sieste.
    expect(records.every((r) => (r.wakeMinutes ?? 0) <= 11.5 * 60 && (r.bedtimeMinutes ?? 0) >= 60)).toBe(true);
  });

  it('une sieste à moins de 60 min de la fin de la nuit n’est pas une sieste : épisode unique (nuit coupée par un réveil de 30 min)', () => {
    const { nights } = buildSleepNights(segmentsOf([seg(iso(8, '00:00'), iso(8, '03:00')), seg(iso(8, '03:30'), iso(8, '07:30'))]), TZ);
    expect(nights).toHaveLength(1);
    expect(nights[0]).toMatchObject({ day: '2026-11-08', asleepMinutes: 420 });
  });

  it('un trou de 3 h n’est plus un seul épisode : la sieste de 14 h après un lever à 11 h n’est pas absorbée par la nuit', () => {
    const { nights, ignoredGroups } = buildSleepNights(segmentsOf([seg(iso(8, '03:00'), iso(8, '11:00')), seg(iso(8, '14:00'), iso(8, '15:00'))]), TZ);
    expect(nights).toHaveLength(1);
    expect(nights[0]).toMatchObject({ asleepMinutes: 480, wakeAt: new Date(iso(8, '11:00')).toISOString() });
    expect(ignoredGroups).toBe(1);
  });

  it('la nuit est le plus long épisode du jour du réveil même si la sieste est plus récente', () => {
    const { nights } = buildSleepNights(segmentsOf([seg(iso(8, '02:00'), iso(8, '09:00')), seg(iso(8, '16:00'), iso(8, '17:30'))]), TZ);
    expect(nights[0]?.asleepMinutes).toBe(420);
  });

  it('une nuit sous 180 min dormies n’entre pas dans la dette, ni dans le coucher ni dans le lever', () => {
    const short = { day: '2026-11-07', hrvMs: null, restingHr: null, asleepMinutes: 60, bedtimeMinutes: 14 * 60, wakeMinutes: 15 * 60 };
    const ok = { day: '2026-11-06', hrvMs: null, restingHr: null, asleepMinutes: 450, bedtimeMinutes: 90, wakeMinutes: 540 };
    const out = summarizeRecoveryDay({ today, now: '2026-11-08T12:00:00.000Z', timeZone: TZ, nights: [ok, short], workouts: [] });
    expect(out.summary.sleepNeedMinutes).toBe(450);
    const records = toNightRecords({ nights: [{ day: '2026-11-07', bedAt: iso(7, '14:00'), wakeAt: iso(7, '15:00'), asleepMinutes: 60, inBedMinutes: null }], hrv: [], restingHrByDay: [], timeZone: TZ });
    expect(records[0]).toMatchObject({ asleepMinutes: 60, bedtimeMinutes: null, wakeMinutes: null });
  });
});
