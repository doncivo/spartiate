import { describe, expect, it } from 'vitest';
import { bedtimeProposal } from './bedtimeProposal';
import { bedtimeTarget } from './sleepNeed';
import type { NightRecord } from './types';

/** Heure de coucher cible (§ 16.7, I5-02 point 2.3) : besoin de la nuit à venir − médiane du lever sur 14 jours civils ; jamais sous 7 levers connus. */
const TODAY = '2026-11-08';
const day = (back: number): string => new Date(Date.UTC(2026, 10, 8 - back)).toISOString().slice(0, 10);
const night = (back: number, over: Partial<NightRecord> = {}): NightRecord => ({
  day: day(back), hrvMs: null, restingHr: null, asleepMinutes: 450, bedtimeMinutes: 1380, wakeMinutes: 390, ...over,
});
const nights = (count: number, over: Partial<NightRecord> = {}): NightRecord[] => Array.from({ length: count }, (_, i) => night(i, over));

describe('bedtimeTarget : valeurs non finies', () => {
  it('un lever non fini (NaN) ne compte pas parmi les 7 levers connus : pas encore de proposition', () => {
    const wakes = [390, 390, 390, 390, 390, 390, Number.NaN];
    expect(bedtimeTarget({ needMinutes: 450, wakeMinutes: wakes })).toEqual({ time: null, reason: 'wake_history_incomplete' });
  });
  it('un besoin non fini ne produit jamais une heure', () => {
    expect(bedtimeTarget({ needMinutes: Number.NaN, wakeMinutes: Array(14).fill(390) as number[] }).time).toBeNull();
  });
});

describe('bedtimeProposal', () => {
  it('7 nuits : lever 6 h 30, besoin 7 h 30 (exertion 5, aucune dette) → 23 h 00', () => {
    const r = bedtimeProposal({ nights: nights(7), today: TODAY, exertionToday: 5 });
    expect(r).toMatchObject({ time: '23:00', reason: null, needMinutes: 450, wakeNights: 7 });
  });
  it('6 nuits seulement : « pas encore de proposition », jamais une heure', () => {
    expect(bedtimeProposal({ nights: nights(6), today: TODAY, exertionToday: 5 })).toMatchObject({ time: null, reason: 'wake_history_incomplete', wakeNights: 6 });
  });
  it('aucune nuit : pas de proposition', () => {
    expect(bedtimeProposal({ nights: [], today: TODAY, exertionToday: 0 }).time).toBeNull();
  });
  it('les nuits sans heure de lever (null) ne comptent pas', () => {
    const list = [...nights(7).slice(0, 4), ...nights(7).slice(4).map((n) => ({ ...n, wakeMinutes: null }))];
    expect(bedtimeProposal({ nights: list, today: TODAY, exertionToday: 5 }).time).toBeNull();
  });
  it('seuls les 14 derniers jours civils comptent : une nuit vieille de 20 jours est ignorée, une nuit future aussi', () => {
    const old = nights(7).map((n, i) => ({ ...n, day: day(20 + i) }));
    expect(bedtimeProposal({ nights: old, today: TODAY, exertionToday: 5 }).time).toBeNull();
    const future = [...nights(6), night(-1)];
    expect(bedtimeProposal({ nights: future, today: TODAY, exertionToday: 5 }).time).toBeNull();
  });
  it('médiane et non moyenne : un lever très tardif isolé ne déplace pas la proposition', () => {
    const list = nights(8).map((n, i) => (i === 0 ? { ...n, wakeMinutes: 720 } : n));
    expect(bedtimeProposal({ nights: list, today: TODAY, exertionToday: 5 }).time).toBe('23:00');
  });
  it('le besoin de la nuit à venir suit l’exertion du jour (7 → +24 min) et la dette de sommeil des 7 derniers jours', () => {
    expect(bedtimeProposal({ nights: nights(7), today: TODAY, exertionToday: 7 }).needMinutes).toBe(474);
    const short = nights(7, { asleepMinutes: 390 });
    expect(bedtimeProposal({ nights: short, today: TODAY, exertionToday: 5 }).needMinutes).toBe(450 + 180);
  });
  it('lever 5 h 00, besoin 7 h 30 → 21 h 30', () => {
    const r = bedtimeProposal({ nights: nights(7, { wakeMinutes: 300 }), today: TODAY, exertionToday: 5 });
    expect(r.time).toBe('21:30');
  });
  it('idempotent et sans effet de bord sur l’entrée', () => {
    const list = nights(10);
    const copy = JSON.stringify(list);
    expect(bedtimeProposal({ nights: list, today: TODAY, exertionToday: 6 })).toEqual(bedtimeProposal({ nights: list, today: TODAY, exertionToday: 6 }));
    expect(JSON.stringify(list)).toBe(copy);
  });
});
