import { describe, expect, it } from 'vitest';
import { day, ROUTINE_ID, START } from '../../../tests/fixtures/training/mesocycle';
import { DEFAULT_GENERATION_CONFIG as CONFIG } from './config';
import { createMesocycleSpec, mesocycleState, type MesocycleSpec } from './mesocycle';
import { countsAsMissedDay, isLightWeekOn, isPausedOn, pausedDaysUntil, pauseProgram, resumeProgram, resumeProposal, sessionNotificationsAllowed } from './programPause';

/**
 * I3-02 (PRD § 12.6 ; D-73 point 9) : pause et reprise. Les jours en pause ne comptent ni pour le cycle (décalage d'autant) ni comme manqués ;
 * aucune notification ; plus de 21 jours : semaine allégée proposée (valeurs de la semaine 1), mésocycle décalé et non recommencé.
 */

const spec = (): MesocycleSpec => {
  const s = createMesocycleSpec({ routineId: ROUTINE_ID, startDate: START, weeks: 5 }, CONFIG);
  if (s === null) throw new Error('spec');
  return s;
};
const pausedAt = (n: number): MesocycleSpec => {
  const s = pauseProgram(spec(), day(n));
  if (s === null) throw new Error('pause');
  return s;
};
const resumed = (from: number, days: number, light: boolean): MesocycleSpec => {
  const s = resumeProgram(pausedAt(from), day(from + days), light, CONFIG);
  if (s === null) throw new Error('resume');
  return s;
};

describe('pause (critère 7)', () => {
  it('le cycle se fige : même semaine pendant toute la pause, état « en pause » depuis la date', () => {
    const s = pausedAt(9);
    expect(s.pauses).toEqual([{ from: day(9), to: null, lightWeek: false }]);
    for (const n of [9, 12, 30, 90]) expect(mesocycleState(s, day(n), CONFIG)).toMatchObject({ phase: 'paused', week: 2, pausedSince: day(9), plan: null });
    expect(pausedDaysUntil(s.pauses, day(30))).toBe(21);
  });

  it('jours en pause : ni manqués (streak gelé) ni notification de séance ; hors pause : comptés, notifications permises', () => {
    const s = pausedAt(9);
    for (const n of [9, 10, 20]) {
      expect(isPausedOn(s.pauses, day(n))).toBe(true);
      expect(countsAsMissedDay(s.pauses, day(n))).toBe(false);
      expect(sessionNotificationsAllowed(s, day(n))).toBe(false);
    }
    expect(isPausedOn(s.pauses, day(8))).toBe(false);
    expect(countsAsMissedDay(s.pauses, day(8))).toBe(true);
    expect(sessionNotificationsAllowed(spec(), day(8))).toBe(true);
    const back = resumed(9, 14, false);
    expect(isPausedOn(back.pauses, day(22))).toBe(true);
    expect(isPausedOn(back.pauses, day(23))).toBe(false);
    expect(countsAsMissedDay(back.pauses, day(15))).toBe(false);
    expect(sessionNotificationsAllowed(back, day(23))).toBe(true);
  });

  it('pause refusée si déjà en pause, avant le début du cycle ou sur un cycle clos', () => {
    expect(pauseProgram(pausedAt(3), day(4))).toBeNull();
    expect(pauseProgram(spec(), day(-1))).toBeNull();
    expect(pauseProgram({ ...spec(), status: 'completed', outcome: 'stopped', endedOn: day(2) }, day(3))).toBeNull();
    expect(resumeProgram(spec(), day(3), false, CONFIG)).toBeNull();
    expect(resumeProgram(pausedAt(5), day(4), false, CONFIG)).toBeNull();
  });
});

describe('reprise (critère 8, D-73 point 9)', () => {
  it('14 et 21 jours : décalage d’autant, aucune semaine allégée ; le cycle reprend où il était (non recommencé)', () => {
    for (const days of [14, 21]) {
      expect(resumeProposal(pausedAt(9), day(9 + days), CONFIG)).toEqual({ pausedDays: days, lightWeekProposed: false });
      const back = resumed(9, days, true);
      expect(back.pauses).toEqual([{ from: day(9), to: day(9 + days), lightWeek: false }]);
      expect(mesocycleState(back, day(9 + days), CONFIG)).toMatchObject({ phase: 'active', week: 2, kind: 'work' });
      // Semaine 2 commencée au jour 7, deux jours faits avant la pause : 5 jours restent, puis semaine 3.
      expect(mesocycleState(back, day(9 + days + 4), CONFIG).week).toBe(2);
      expect(mesocycleState(back, day(9 + days + 5), CONFIG).week).toBe(3);
      expect(mesocycleState(back, day(28 + days), CONFIG).kind).toBe('deload');
    }
  });

  it('plus de 21 jours : semaine allégée proposée ; acceptée, 7 jours aux valeurs de la semaine 1, puis reprise à la même semaine', () => {
    expect(resumeProposal(pausedAt(9), day(31), CONFIG)).toEqual({ pausedDays: 22, lightWeekProposed: true });
    const back = resumed(9, 22, true);
    expect(back.pauses).toEqual([{ from: day(9), to: day(31), lightWeek: true }]);
    const week1 = mesocycleState(spec(), day(0), CONFIG).plan;
    for (const n of [31, 34, 37]) {
      const s = mesocycleState(back, day(n), CONFIG);
      expect(s).toMatchObject({ phase: 'active', kind: 'light', week: 2 });
      expect(isLightWeekOn(back.pauses, day(n))).toBe(true);
      expect(s.plan).toEqual({ ...week1, priorityBonus: 0 });
    }
    expect(mesocycleState(back, day(38), CONFIG)).toMatchObject({ kind: 'work', week: 2 });
    expect(mesocycleState(back, day(43), CONFIG).week).toBe(3);
    expect(isLightWeekOn(back.pauses, day(38))).toBe(false);
    // Les jours de la semaine allégée ne sont pas des jours en pause : ils comptent (séances faites).
    expect(countsAsMissedDay(back.pauses, day(33))).toBe(true);
  });

  it('plus de 21 jours, semaine allégée refusée : décalage seul', () => {
    const back = resumed(9, 30, false);
    expect(back.pauses).toEqual([{ from: day(9), to: day(39), lightWeek: false }]);
    expect(mesocycleState(back, day(39), CONFIG)).toMatchObject({ kind: 'work', week: 2 });
  });

  it('plusieurs pauses s’additionnent ; la reprise après un cycle illimité garde son bloc', () => {
    const first = resumed(3, 4, false);
    const again = pauseProgram(first, day(20));
    if (again === null) throw new Error('again');
    const back = resumeProgram(again, day(27), false, CONFIG);
    if (back === null) throw new Error('back');
    expect(pausedDaysUntil(back.pauses, day(40))).toBe(11);
    expect(mesocycleState(back, day(40), CONFIG).week).toBe(5);
    const unlimited = createMesocycleSpec({ routineId: ROUTINE_ID, startDate: START, weeks: 'unlimited' }, CONFIG);
    if (unlimited === null) throw new Error('unlimited');
    const p = pauseProgram(unlimited, day(36));
    const r = p === null ? null : resumeProgram(p, day(66), true, CONFIG);
    if (r === null) throw new Error('r');
    expect(mesocycleState(r, day(66), CONFIG)).toMatchObject({ kind: 'light', blockIndex: 1, blockWeek: 1 });
    expect(mesocycleState(r, day(73), CONFIG)).toMatchObject({ kind: 'work', blockIndex: 1, blockWeek: 1 });
  });

  it('entrée gelée : la pause et la reprise ne modifient pas le cycle reçu', () => {
    const s = spec();
    const before = JSON.stringify(s);
    pauseProgram(s, day(5));
    expect(JSON.stringify(s)).toBe(before);
    const p = pausedAt(5);
    const pb = JSON.stringify(p);
    resumeProgram(p, day(40), true, CONFIG);
    expect(JSON.stringify(p)).toBe(pb);
  });
});
