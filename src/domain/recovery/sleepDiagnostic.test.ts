import { describe, expect, it } from 'vitest';
import { RECOVERY_CONFIG } from './config';
import { summarizeRecoveryDay } from './daySummary';
import { toNightRecords } from './nights';
import { buildSleepNights, parseShortcutSleep } from './shortcutFiles';
import { sleepDebtDiagnostic } from './sleepNeed';

/**
 * FIX-0115 : constat d'Ali en 0.11.4, « Besoin : 10 h 30 » alors que la moyenne Apple Santé est de 7 h 28. Fixture qui reflète ses nuits :
 * couchers après 1 h, levers entre 9 h et 11 h 30, durées dormies très variables (moyenne ≈ 7 h 30).
 */
const TZ = 'Europe/Paris';
const TODAY = '2026-11-12';
// [coucher (jour J-1 ou J, heure locale), lever (jour J), minutes dormies voulues]
const NIGHTS: readonly (readonly [string, string, number])[] = [
  ['2026-11-04T01:40', '2026-11-04T10:30', 525],
  ['2026-11-05T02:10', '2026-11-05T09:00', 370],
  ['2026-11-06T01:20', '2026-11-06T09:30', 470],
  ['2026-11-07T02:40', '2026-11-07T09:00', 350],
  ['2026-11-08T01:10', '2026-11-08T10:50', 510],
  ['2026-11-09T02:30', '2026-11-09T09:10', 400],
  ['2026-11-10T01:00', '2026-11-10T11:30', 540],
  ['2026-11-11T01:30', '2026-11-11T09:20', 468],
];
const offset = (local: string): string => `${local}:00+01:00`;
function csv(): string {
  return NIGHTS.flatMap(([bed, wake, asleep]) => {
    // Un seul épisode : sommeil, éveil au lit (segment « Éveillé », sans trou), sommeil jusqu'au lever.
    const bedMs = Date.parse(offset(bed));
    const wakeMs = Date.parse(offset(wake));
    const awake = (wakeMs - bedMs) / 60_000 - asleep;
    const half = Math.round(asleep / 2);
    const at = (minutes: number): string => new Date(bedMs + minutes * 60_000).toISOString();
    return [`${at(0)};${at(half)};Endormi`, `${at(half)};${at(half + awake)};Éveillé`, `${at(half + awake)};${at(half + awake + (asleep - half))};Endormi`];
  }).join('\n');
}

describe('fixture des nuits d’Ali', () => {
  const parsed = parseShortcutSleep(csv(), TODAY, TZ);
  const { nights } = buildSleepNights(parsed.segments, TZ);
  const records = toNightRecords({ nights, hrv: [], restingHrByDay: [], timeZone: TZ });

  it('huit nuits, couchers après 1 h, levers entre 9 h et 11 h 30, moyenne proche de 7 h 30', () => {
    expect(records).toHaveLength(8);
    for (const r of records) {
      expect(r.bedtimeMinutes).toBeGreaterThanOrEqual(60);
      expect(r.wakeMinutes).toBeGreaterThanOrEqual(9 * 60);
      expect(r.wakeMinutes).toBeLessThanOrEqual(11 * 60 + 30);
    }
    const mean = records.reduce((s, r) => s + (r.asleepMinutes ?? 0), 0) / records.length;
    expect(Math.round(mean)).toBeGreaterThanOrEqual(445);
    expect(Math.round(mean)).toBeLessThanOrEqual(460);
  });

  it('diagnostic : nuits retenues sur 7 jours, écartées par raison, dette arrondie à l’heure (chiffres seulement)', () => {
    const diag = sleepDebtDiagnostic(records, TODAY);
    expect(diag).toEqual({ retained: 7, excludedNoAsleep: 0, excludedShort: 0, debtHours: 3 });
  });

  it('caractérise la règle actuelle : la dette ne compense pas les excédents, elle atteint le plafond de 3 h et le besoin 10 h 30', () => {
    const out = summarizeRecoveryDay({ today: TODAY, now: '2026-11-12T10:00:00.000Z', timeZone: TZ, nights: records, workouts: [] });
    expect(out.summary.sleepNeedMinutes).toBe(Math.round(RECOVERY_CONFIG.sleep.baseSleepHours * 60) + Math.round(RECOVERY_CONFIG.sleep.debtCapHours * 60));
  });

  it('une nuit sous 180 min ou sans sommeil mesuré est comptée écartée, par raison ; hors fenêtre de 7 jours, elle n’est pas comptée', () => {
    const blank = { hrvMs: null, restingHr: null, bedtimeMinutes: null, wakeMinutes: null } as const;
    const extra = [{ day: '2026-11-12', asleepMinutes: null, ...blank }, { day: '2026-11-11', asleepMinutes: 120, ...blank }, { day: '2026-11-01', asleepMinutes: 100, ...blank }];
    const diag = sleepDebtDiagnostic([...records.filter((r) => r.day < '2026-11-11'), ...extra], '2026-11-13');
    expect(diag).toEqual({ retained: 5, excludedNoAsleep: 1, excludedShort: 1, debtHours: 3 });
  });
});
