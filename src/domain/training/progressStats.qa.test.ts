import { describe, expect, it } from 'vitest';
import { recoveryZoneTier } from '../recovery/recoveryScore';
import { recoveryTrends } from '../recovery/trends';
import type { LocalDate } from '../types';
import { isPausedOn } from './programPause';
import { adherence, constancy, monthCalendar, pausedOn, weeklyMuscleVolume } from './progressStats';

/** PROGRES, passe qa-test : cas limites des règles de Progrès. Valeurs synthétiques. */

const d = (s: string): LocalDate => s as LocalDate;
const TODAY = d('2026-11-18');

describe('PROGRES qa', () => {
  it('pause en cours (sans fin) qui couvre les semaines passées : série gelée, jamais cassée ; semaine en pause hors adhérence', () => {
    const pauses = [{ from: d('2026-10-26'), to: null, lightWeek: false }];
    const days = [d('2026-10-20'), d('2026-10-13')];
    expect(constancy({ days, today: TODAY, target: null, pauses }).streakWeeks).toBe(2);
    expect(adherence({ days, today: TODAY, target: { perWeek: 2, since: d('2026-10-01') }, pauses })).toEqual({ percent: 50, done: 1, planned: 2, weeks: 1 });
  });

  it('objectif nul ou incohérent : adhérence non calculée ; séance future ignorée par la série', () => {
    expect(adherence({ days: [TODAY], today: TODAY, target: { perWeek: 0, since: d('2026-10-01') }, pauses: [] })).toBeNull();
    expect(constancy({ days: [d('2026-12-01')], today: TODAY, target: null, pauses: [] }).streakWeeks).toBe(0);
  });

  it('calendrier d’un mois de 28 jours commençant un lundi, semaine du samedi ; volume d’un muscle de poids nul ignoré', () => {
    const feb = monthCalendar({ today: d('2027-02-10'), days: [], pauses: [], firstWeekday: 'saturday' });
    expect(feb.cells.filter((c) => c !== null)).toHaveLength(28);
    expect(feb.cells.indexOf(feb.cells.find((c) => c?.date === '2027-02-01') ?? null)).toBe(2);
    const v = weeklyMuscleVolume({ workouts: [{ day: TODAY, sets: [{ exerciseId: 'x', setKind: 'work', done: true }] }], musclesOf: () => [{ id: 'abs', weight: 0 }], today: TODAY });
    expect(v.muscles).toEqual([]);
  });

  it('tendances : valeur non finie lue comme absente ; paliers de zone aux bornes 33, 34, 65, 66', () => {
    const t = recoveryTrends([{ day: TODAY, recovery: Number.NaN, hrvMs: 50, restingHr: null, sleepMinutes: 400 }], TODAY);
    expect(t.series.recovery.measured).toBe(0);
    expect(t.series.hrv.points.at(-1)).toBe(50);
    expect([33, 34, 65, 66, null].map(recoveryZoneTier)).toEqual(['low', 'mid', 'mid', 'high', null]);
  });

  it('pausedOn : même règle qu’isPausedOn (programPause.ts) sur des pauses closes, en cours et contiguës', () => {
    const pauses = [
      { from: d('2026-10-05'), to: d('2026-10-12'), lightWeek: false },
      { from: d('2026-10-12'), to: d('2026-10-14'), lightWeek: true },
      { from: d('2026-11-01'), to: null, lightWeek: false },
    ];
    const days = Array.from({ length: 70 }, (_, i) => new Date(Date.UTC(2026, 8, 28 + i)).toISOString().slice(0, 10) as LocalDate);
    expect(days.map((day) => pausedOn(pauses, day))).toEqual(days.map((day) => isPausedOn(pauses, day)));
  });
});
