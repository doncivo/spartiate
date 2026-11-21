import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../types';
import type { MesocyclePause } from './mesocycle';
import { constancy, monthCalendar, programWeeklyTarget } from './progressStats';

/** PROGRES-b (§ 17.1 « Constance », § 12.6 streak gelé en pause) : streak en semaines, semaine en cours, calendrier du mois. Valeurs synthétiques. */

const d = (s: string): LocalDate => s as LocalDate;
const TODAY = d('2026-11-18'); // mercredi ; semaine du lundi 16/11
const week = (monday: string, n: number): LocalDate[] => Array.from({ length: n }, (_, i) => d(`${monday.slice(0, 8)}${String(Number(monday.slice(8)) + i).padStart(2, '0')}`));
// S-1 (09/11) 3, S-2 (02/11) 3, S-3 (26/10) 0 en pause, S-4 (19/10) 3, S-5 (12/10) 2.
const HISTORY = [...week('2026-11-09', 3), ...week('2026-11-02', 3), ...week('2026-10-19', 3), ...week('2026-10-12', 2)];
const PAUSE: MesocyclePause[] = [{ from: d('2026-10-26'), to: d('2026-11-02'), lightWeek: false }];

describe('constancy', () => {
  it('objectif 3 : la semaine en pause ne casse pas la série, une semaine sous l’objectif l’arrête ; semaine en cours non atteinte : ni comptée ni cassante', () => {
    const c = constancy({ days: [...HISTORY, d('2026-11-16')], today: TODAY, target: { perWeek: 3, since: d('2026-10-01') }, pauses: PAUSE });
    expect(c.streakWeeks).toBe(3);
    expect(c.thisWeek).toEqual({ done: 1, target: 3 });
  });

  it('semaine en cours atteinte : elle s’ajoute ; sans la pause, la semaine vide casse la série', () => {
    const current = [d('2026-11-16'), d('2026-11-17'), d('2026-11-18')];
    expect(constancy({ days: [...HISTORY, ...current], today: TODAY, target: { perWeek: 3, since: d('2026-10-01') }, pauses: PAUSE }).streakWeeks).toBe(4);
    expect(constancy({ days: HISTORY, today: TODAY, target: { perWeek: 3, since: d('2026-10-01') }, pauses: [] }).streakWeeks).toBe(2);
  });

  it('avant le début du programme, ou sans programme suivi : 1 séance par semaine suffit', () => {
    expect(constancy({ days: HISTORY, today: TODAY, target: { perWeek: 3, since: d('2026-11-02') }, pauses: PAUSE }).streakWeeks).toBe(4);
    const none = constancy({ days: HISTORY, today: TODAY, target: null, pauses: [] });
    expect(none.streakWeeks).toBe(2);
    expect(none.thisWeek).toEqual({ done: 0, target: 1 });
    expect(constancy({ days: [], today: TODAY, target: null, pauses: [] }).streakWeeks).toBe(0);
  });

  it('début de semaine réglable (dimanche) et entrée inchangée', () => {
    const days = [d('2026-11-15'), d('2026-11-08')];
    const frozen = JSON.stringify(days);
    const c = constancy({ days, today: TODAY, target: null, pauses: [], firstWeekday: 'sunday' });
    expect(c.thisWeek.done).toBe(1);
    expect(c.streakWeeks).toBe(2);
    expect(JSON.stringify(days)).toBe(frozen);
  });
});

describe('programWeeklyTarget', () => {
  it('jours de la semaine rattachés, sinon jours garnis ; aucun jour garni : null', () => {
    const day = (id: string, n: number, weekday: number | null = null) => ({ id, dayOrder: Number(id), weekday, exercises: Array.from({ length: n }) });
    expect(programWeeklyTarget([day('1', 2, 1), day('2', 3, 3), day('3', 1, 3), day('4', 0, 5)])).toBe(2);
    expect(programWeeklyTarget([day('1', 2), day('2', 3), day('3', 0)])).toBe(2);
    expect(programWeeklyTarget([day('1', 0)])).toBeNull();
  });
});

describe('monthCalendar', () => {
  it('novembre 2026, semaine du lundi : 6 cases vides avant le dimanche 1er ; séances comptées par jour ; jours en pause et jour courant marqués', () => {
    const cal = monthCalendar({ today: TODAY, days: [d('2026-11-10'), d('2026-11-10'), d('2026-11-12'), d('2026-10-31')], pauses: [{ from: d('2026-11-03'), to: d('2026-11-05'), lightWeek: false }] });
    expect(cal.month).toBe('2026-11');
    expect(cal.cells.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(cal.cells.filter((c) => c !== null)).toHaveLength(30);
    const at = (day: string) => cal.cells.find((c) => c?.date === day);
    expect(at('2026-11-10')).toMatchObject({ sessions: 2, paused: false, today: false });
    expect(at('2026-11-03')).toMatchObject({ sessions: 0, paused: true });
    expect(at('2026-11-05')).toMatchObject({ paused: false });
    expect(at('2026-11-18')).toMatchObject({ today: true });
    expect(monthCalendar({ today: TODAY, days: [], pauses: [], firstWeekday: 'sunday' }).cells[0]?.date).toBe('2026-11-01');
  });
});
