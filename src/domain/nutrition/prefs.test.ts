import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../types';
import { checkInPeriod, DEFAULT_NUTRITION_PREFS, parseNutritionPrefs } from './prefs';

/** I4-03 : préférences de nutrition (D-74 : maintien, lundi, activité déclarée) et période du check-in. */
describe('parseNutritionPrefs', () => {
  it('défauts D-74 : maintien, lundi, activité non déclarée', () => {
    expect(DEFAULT_NUTRITION_PREFS).toMatchObject({ activity: null, goal: { kind: 'maintain' }, checkInWeekday: 1 });
    expect(parseNutritionPrefs(null)).toEqual(DEFAULT_NUTRITION_PREFS);
    expect(parseNutritionPrefs('x')).toEqual(DEFAULT_NUTRITION_PREFS);
  });
  it('relit une valeur valide', () => {
    const raw = { activity: 'light', style: 'guided', goal: { kind: 'loss', weeklyRateKg: 0.4 }, checkInWeekday: 7 };
    expect(parseNutritionPrefs(raw)).toEqual({ activity: 'light', style: 'guided', goal: { kind: 'loss', weeklyRateKg: 0.4 }, checkInWeekday: 7 });
  });
  it('champ invalide : sa valeur par défaut, les autres champs gardés', () => {
    const p = parseNutritionPrefs({ activity: 'extreme', style: 'manual', goal: { kind: 'loss', weeklyRateKg: -1 }, checkInWeekday: 9 });
    expect(p.activity).toBeNull();
    expect(p.style).toBe('manual');
    expect(p.goal).toEqual({ kind: 'maintain' });
    expect(p.checkInWeekday).toBe(1);
  });
});

describe('checkInPeriod : semaine couverte par un check-in', () => {
  const d = (s: string): LocalDate => s as LocalDate;
  it('le jour même : la semaine se termine la veille, la nouvelle cible commence ce jour', () => {
    expect(checkInPeriod(d('2026-11-09'), 1)).toEqual({ checkInDate: '2026-11-09', weekEnd: '2026-11-08' });
  });
  it('en milieu de semaine : dernier jour de check-in écoulé', () => {
    expect(checkInPeriod(d('2026-11-12'), 1)).toEqual({ checkInDate: '2026-11-09', weekEnd: '2026-11-08' });
  });
  it('jour de check-in dimanche, un lundi', () => {
    expect(checkInPeriod(d('2026-11-09'), 7)).toEqual({ checkInDate: '2026-11-08', weekEnd: '2026-11-07' });
  });
});
