import { describe, expect, it } from 'vitest';

import { completeDay, partialDay } from '../../../tests/fixtures/nutrition/dayKit';
import { addDays } from '../localDate';
import type { LocalDate, Weekday } from '../types';
import { proposeCheckIn, type CheckInInput } from './checkIn';
import { weeklyBalance } from './journal';
import {
  DEFAULT_REST_GAP_KCAL,
  DEFAULT_TRAINING_DAYS,
  dayTargetFor,
  dayTypeOf,
  formatTrainingDays,
  parseTrainingDays,
  restTargetFromGap,
  restTargetFromKcal,
  weeklyAverageTarget,
  type RestPlan,
} from './restDay';
import type { DayTotals, Target, WeighIn } from './types';

/** PROG-01 (B1 à B5 ; D-270 à D-272) : cible des jours de repos. Valeurs inventées. */
const TRAINING: Target = { kcal: 2600, proteinG: 150, fatG: 80, carbG: 320 };
const PLAN: RestPlan = { rest: { kcal: 2400, proteinG: 150, fatG: 80, carbG: 270 }, trainingDays: DEFAULT_TRAINING_DAYS };
const D = (n: number): LocalDate => `2026-11-${String(n).padStart(2, '0')}` as LocalDate; // 2026-11-02 est un lundi
const none = new Set<LocalDate>();

describe('PROG-01 : cible de repos (D-271)', () => {
  it('écart par défaut -200 kcal : 2 400 kcal, glucides -50 g, protéines et lipides identiques', () => {
    expect(DEFAULT_REST_GAP_KCAL).toBe(-200);
    expect(restTargetFromGap(TRAINING, DEFAULT_REST_GAP_KCAL)).toEqual({ kcal: 2400, proteinG: 150, fatG: 80, carbG: 270 });
  });
  it('saisie en kcal : même écart porté par les glucides', () => {
    expect(restTargetFromKcal(TRAINING, 2250)).toEqual({ kcal: 2250, proteinG: 150, fatG: 80, carbG: 232 });
  });
  it('glucides jamais négatifs', () => {
    const low: Target = { kcal: 2000, proteinG: 200, fatG: 100, carbG: 30 };
    expect(restTargetFromGap(low, -400).carbG).toBe(0);
  });
  it('moyenne hebdomadaire = (n x entraînement + (7 - n) x repos) / 7', () => {
    expect(weeklyAverageTarget(TRAINING, PLAN)).toMatchObject({ kcal: 2543, proteinG: 150, fatG: 80 });
    expect(weeklyAverageTarget(TRAINING, null)).toEqual(TRAINING);
  });
  it('jours d’entraînement : lecture et écriture « 1,2,4,5,6 », valeurs invalides refusées', () => {
    expect(parseTrainingDays('1,2,4,5,6')).toEqual([1, 2, 4, 5, 6]);
    expect(formatTrainingDays([6, 1, 4, 2, 5, 1])).toBe('1,2,4,5,6');
    expect(parseTrainingDays(null)).toBeNull();
    expect(parseTrainingDays('0,9')).toBeNull();
    expect(parseTrainingDays('a')).toBeNull();
    expect(DEFAULT_TRAINING_DAYS).toEqual([1, 2, 4, 5, 6]);
  });
});

describe('PROG-01 : type de jour (D-270)', () => {
  it('jour d’entraînement prévu (jeudi) : cible d’entraînement', () => {
    expect(dayTypeOf(D(5), PLAN, none)).toBe('training');
    expect(dayTargetFor(TRAINING, PLAN, D(5), none)).toEqual({ type: 'training', target: TRAINING });
  });
  it('jour de repos prévu (mercredi, dimanche) : cible de repos', () => {
    expect(dayTargetFor(TRAINING, PLAN, D(4), none)).toEqual({ type: 'rest', target: PLAN.rest });
    expect(dayTypeOf(D(8), PLAN, none)).toBe('rest');
  });
  it('séance de musculation close un jour de repos : jour d’entraînement', () => {
    expect(dayTargetFor(TRAINING, PLAN, D(4), new Set([D(4)]))).toEqual({ type: 'training', target: TRAINING });
  });
  it('jour d’entraînement sans séance : reste un jour d’entraînement', () => {
    expect(dayTypeOf(D(6), PLAN, none)).toBe('training');
  });
  it('sans cible de repos : cible unique, aucun type de jour', () => {
    expect(dayTargetFor(TRAINING, null, D(4), none)).toEqual({ type: null, target: TRAINING });
    expect(dayTypeOf(D(4), null, new Set([D(4)]))).toBeNull();
  });
});

describe('PROG-01 : balance 7 jours comparée à la cible du jour (D-272)', () => {
  const week = (kcalOf: (n: number) => number): DayTotals[] => Array.from({ length: 7 }, (_, i) => completeDay(D(3 + i), kcalOf(3 + i)));
  const planned = (n: number): number => (PLAN.trainingDays.includes(((n - 1) % 7 || 7) as Weekday) ? 2600 : 2400);
  const targetFor = (date: LocalDate): Target => dayTargetFor(TRAINING, PLAN, date, none).target;

  it('manger la cible de chaque jour : écart 0', () => {
    const b = weeklyBalance(week(planned), [], TRAINING, D(9), targetFor);
    expect(b.deltaKcal).toBe(0);
  });
  it('sans fonction de cible du jour : comparaison à la cible unique, inchangée', () => {
    const b = weeklyBalance(week(planned), [], TRAINING, D(9));
    expect(b.averageKcal).toBe(2543);
    expect(b.deltaKcal).toBe(2543 - 2600);
  });
  it('jour non complet exclu de la moyenne, jamais 0', () => {
    const days = [...week(planned).slice(0, 6), partialDay(D(9), 800)];
    const b = weeklyBalance(days, [], TRAINING, D(9), targetFor);
    expect(b.completeDays).toBe(6);
    expect(b.deltaKcal).toBe(0);
  });
});

describe('PROG-01 : check-in sur la moyenne hebdomadaire (D-272)', () => {
  const d0 = '2026-09-07' as LocalDate;
  const at = (i: number) => addDays(d0, i);
  const days = (): DayTotals[] => Array.from({ length: 14 }, (_, i) => completeDay(at(i), 2400));
  const weighIns = (): WeighIn[] => [1, 5, 8, 12].map((i) => ({ date: at(i), kg: 80 }));
  const base = (over: Partial<CheckInInput> = {}): CheckInInput => ({
    style: 'guided',
    weekEnd: at(13),
    days: days(),
    weighIns: weighIns(),
    tdee: 2643,
    weightKg: 80,
    goal: { kind: 'maintain' },
    currentTarget: TRAINING,
    lowFloorConfirmed: false,
    ...over,
  });

  it('2 600 / 2 400, +100 sur la moyenne : 2 700 / 2 500, l’écart de 200 est conservé', () => {
    const r = proposeCheckIn(base({ restPlan: PLAN }));
    expect(r.status).toBe('proposal');
    const p = r.proposal;
    expect(p?.deltaKcal).toBe(100);
    expect(p?.target).toEqual({ kcal: 2700, proteinG: 150, fatG: 80, carbG: 345 });
    expect(p?.restTarget).toEqual({ kcal: 2500, proteinG: 150, fatG: 80, carbG: 295 });
    expect(p?.applied).toBe(false);
  });
  it('borne de 150 kcal par semaine sur la moyenne, appliquée aux deux cibles', () => {
    const p = proposeCheckIn(base({ restPlan: PLAN, tdee: 2900 })).proposal;
    expect(p?.deltaKcal).toBe(150);
    expect(p?.clampedBy).toContain('max-weekly-delta');
    expect(p?.target.kcal).toBe(2750);
    expect(p?.restTarget?.kcal).toBe(2550);
  });
  it('baisse : même écart retiré aux deux cibles, protéines fixes', () => {
    const p = proposeCheckIn(base({ restPlan: PLAN, tdee: 2493 })).proposal;
    expect(p?.deltaKcal).toBe(-50);
    expect(p?.target).toMatchObject({ kcal: 2550, proteinG: 150 });
    expect(p?.restTarget).toMatchObject({ kcal: 2350, proteinG: 150 });
  });
  it('sans cible de repos : proposition strictement identique à celle d’avant (aucune clé restTarget)', () => {
    const p = proposeCheckIn(base({ tdee: 2700 })).proposal;
    expect(p).not.toBeNull();
    expect(p).not.toHaveProperty('restTarget');
    expect(p?.target.kcal).toBe(2700);
    const withNull = proposeCheckIn(base({ tdee: 2700, restPlan: null })).proposal;
    expect(withNull).toEqual(p);
  });
  it('couverture insuffisante : toujours suspendu', () => {
    const r = proposeCheckIn(base({ restPlan: PLAN, days: [], weighIns: [] }));
    expect(r.status).toBe('suspended');
  });
});
