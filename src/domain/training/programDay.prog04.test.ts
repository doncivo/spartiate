import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../types';
import { defaultTrainingDays } from '../nutrition/restDay';
import { programDayFor, routineTrainingDays, weekdayFromDayName } from './programDay';
import { validateRoutine } from './routineRules';

/** PROG-04 (D-316) : séance du jour selon le jour de la semaine. Le 19/11/2026 est un jeudi. */
const day = (id: string, dayOrder: number, weekday: number | null, exercises = 1) => ({ id, dayOrder, weekday, exercises: Array.from({ length: exercises }, () => ({})) });
const WEEK = [day('lun', 1, 1), day('mar', 2, 2), day('jeu', 3, 4), day('ven', 4, 5), day('sam', 5, 6)];
const closedOn = (dayId: string) => ({ routineId: 'r', routineDayId: dayId });

describe('programDayFor', () => {
  it('jours rattachés : jeudi après une seule séance close le lundi → le jour du jeudi (pas la rotation)', () => {
    expect(programDayFor(WEEK, [closedOn('lun')], 'r', '2026-11-19' as LocalDate)).toEqual({ kind: 'day', dayId: 'jeu' });
  });
  it('jour sans séance prévue : repos, avec le prochain jour prévu', () => {
    expect(programDayFor(WEEK, [], 'r', '2026-11-18' as LocalDate)).toEqual({ kind: 'rest', nextDayId: 'jeu', nextWeekday: 4 });
    expect(programDayFor(WEEK, [], 'r', '2026-11-22' as LocalDate)).toEqual({ kind: 'rest', nextDayId: 'lun', nextWeekday: 1 });
  });
  it('séance manquée : sautée, pas décalée (mardi manqué, mercredi = repos, jeudi = jeudi)', () => {
    expect(programDayFor(WEEK, [closedOn('lun')], 'r', '2026-11-18' as LocalDate)).toMatchObject({ kind: 'rest' });
    expect(programDayFor(WEEK, [closedOn('lun')], 'r', '2026-11-19' as LocalDate)).toEqual({ kind: 'day', dayId: 'jeu' });
  });
  it('un jour rattaché sans exercice n’est jamais proposé', () => {
    expect(programDayFor([...WEEK.filter((d) => d.id !== 'jeu'), day('jeu', 3, 4, 0)], [], 'r', '2026-11-19' as LocalDate)).toMatchObject({ kind: 'rest', nextDayId: 'ven' });
  });
  it('aucun jour rattaché : rotation inchangée (le jour qui suit le dernier fait)', () => {
    const free = WEEK.map((d) => ({ ...d, weekday: null }));
    expect(programDayFor(free, [closedOn('lun')], 'r', '2026-11-19' as LocalDate)).toEqual({ kind: 'day', dayId: 'mar' });
  });
  it('revue sync-icloud : deux jours au même jour de la semaine (fusion de deux appareils) : le premier dans l’ordre de la routine', () => {
    expect(programDayFor([day('b', 2, 4), day('a', 1, 4)], [], 'r', '2026-11-19' as LocalDate)).toEqual({ kind: 'day', dayId: 'a' });
  });

  it('aucun jour garni : null', () => {
    expect(programDayFor([day('a', 1, 1, 0)], [], 'r', '2026-11-16' as LocalDate)).toBeNull();
  });
});

describe('weekdayFromDayName', () => {
  it('« Lundi — … » à « Dimanche … », casse indifférente, mot entier seulement', () => {
    expect(weekdayFromDayName('Lundi — Poussée')).toBe(1);
    expect(weekdayFromDayName('mardi - Bas du corps')).toBe(2);
    expect(weekdayFromDayName('MERCREDI')).toBe(3);
    expect(weekdayFromDayName('Jeudi: tirage')).toBe(4);
    expect(weekdayFromDayName('  Vendredi')).toBe(5);
    expect(weekdayFromDayName('Samedi — Jambes')).toBe(6);
    expect(weekdayFromDayName('Dimanche')).toBe(7);
    expect(weekdayFromDayName('Lundis')).toBeNull();
    expect(weekdayFromDayName('Haut A')).toBeNull();
  });
});

describe('jours d’entraînement de la nutrition (D-270)', () => {
  it('déduits des jours rattachés quand ils existent ; sinon répartition par nombre de jours', () => {
    expect(routineTrainingDays([day('sam', 5, 6), ...WEEK, day('vide', 6, 7, 0)])).toEqual([1, 2, 4, 5, 6]);
    expect(routineTrainingDays(WEEK.map((d) => ({ ...d, weekday: null })))).toBeNull();
    expect(defaultTrainingDays(3, [1, 3, 5])).toEqual([1, 3, 5]);
    expect(defaultTrainingDays(3, null)).toEqual(defaultTrainingDays(3));
  });
});

describe('validateRoutine : jour de la semaine', () => {
  const routine = (weekdays: (number | null)[]) => ({ name: 'R', mode: 'programme' as const, days: weekdays.map((weekday, i) => ({ name: `J${String(i)}`, dayOrder: i, weekday, exercises: [] })) });
  it('1 à 7 ou nul ; deux jours au même jour de la semaine refusés', () => {
    const codes = (w: (number | null)[]) => validateRoutine(routine(w) as never).map((i) => i.code);
    expect(codes([1, 2, null])).toEqual([]);
    expect(codes([0])).toContain('day-weekday');
    expect(codes([8])).toContain('day-weekday');
    expect(codes([1, 1])).toContain('day-weekday-duplicate');
  });
});
