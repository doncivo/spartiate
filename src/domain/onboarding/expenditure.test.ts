import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../types';
import { startingExpenditure, weeklyRateKg, GOAL_RATE_MAX_PCT, GOAL_RATE_MIN_PCT } from './expenditure';

const ON = '2026-11-12' as LocalDate;

/** Vecteurs écrits à la main : BMR = 10 kg + 6,25 cm − 5 âge + 5 (homme) ou − 161 (femme), puis × facteur déclaré, arrondi à 10 kcal. */
describe('Dépense de départ, Mifflin-St Jeor (I3-07)', () => {
  it.each([
    // homme 1996 (30 ans), 180 cm, 80 kg : 800 + 1125 − 150 + 5 = 1780 ; × 1,55 = 2759 → 2760
    { sex: 'male', birthYear: 1996, heightCm: 180, weightKg: 80, activity: 'moderate', bmr: 1780, kcal: 2760 },
    // femme 2001 (25 ans), 165 cm, 60 kg : 600 + 1031,25 − 125 − 161 = 1345,25 ; × 1,375 = 1849,7 → 1850
    { sex: 'female', birthYear: 2001, heightCm: 165, weightKg: 60, activity: 'light', bmr: 1345.25, kcal: 1850 },
    // homme 1976 (50 ans), 175 cm, 95 kg : 950 + 1093,75 − 250 + 5 = 1798,75 ; × 1,2 = 2158,5 → 2160
    { sex: 'male', birthYear: 1976, heightCm: 175, weightKg: 95, activity: 'sedentary', bmr: 1798.75, kcal: 2160 },
    // femme 1986 (40 ans), 170 cm, 70 kg : 700 + 1062,5 − 200 − 161 = 1401,5 ; × 1,725 = 2417,6 → 2420
    { sex: 'female', birthYear: 1986, heightCm: 170, weightKg: 70, activity: 'active', bmr: 1401.5, kcal: 2420 },
  ] as const)('$sex $birthYear $heightCm cm $weightKg kg $activity : $kcal kcal', (v) => {
    const result = startingExpenditure({ sex: v.sex, birthYear: v.birthYear, heightCm: v.heightCm, weightKg: v.weightKg, activity: v.activity, onDate: ON });
    expect(result.bmr).toBeCloseTo(v.bmr, 5);
    expect(result.kcal).toBe(v.kcal);
    expect(result.reasons).toEqual([]);
  });

  it('un champ manquant : aucune valeur (jamais zéro), la cause est dite', () => {
    const base = { sex: 'male', birthYear: 1996, heightCm: 180, weightKg: 80, activity: 'moderate', onDate: ON } as const;
    expect(startingExpenditure({ ...base, sex: null }).kcal).toBeNull();
    expect(startingExpenditure({ ...base, sex: null }).reasons).toContain('profile-incomplete');
    expect(startingExpenditure({ ...base, birthYear: null }).kcal).toBeNull();
    expect(startingExpenditure({ ...base, heightCm: null }).kcal).toBeNull();
    expect(startingExpenditure({ ...base, weightKg: null }).kcal).toBeNull();
    expect(startingExpenditure({ ...base, weightKg: null }).reasons).toContain('no-weight');
    expect(startingExpenditure({ ...base, activity: null }).kcal).toBeNull();
    expect(startingExpenditure({ ...base, activity: null }).reasons).toContain('activity-not-declared');
  });

  it('l’âge est celui de l’année de la date du jour : un an plus tard, 5 kcal de moins au repos', () => {
    const a = startingExpenditure({ sex: 'male', birthYear: 1996, heightCm: 180, weightKg: 80, activity: 'moderate', onDate: '2026-11-12' as LocalDate });
    const b = startingExpenditure({ sex: 'male', birthYear: 1996, heightCm: 180, weightKg: 80, activity: 'moderate', onDate: '2027-11-12' as LocalDate });
    expect(a.bmr).toBe(1780);
    expect(b.bmr).toBe(1775);
  });
});

describe('Rythme en % du poids par semaine (§ 10.1 : borné −1 % à +0,5 %)', () => {
  it('bornes', () => {
    expect(GOAL_RATE_MIN_PCT).toBe(-1);
    expect(GOAL_RATE_MAX_PCT).toBe(0.5);
  });

  it('convertit en kg par semaine, arrondi au centième, signe conservé', () => {
    expect(weeklyRateKg(80, -0.5)).toBe(-0.4);
    expect(weeklyRateKg(80, 0.25)).toBe(0.2);
    expect(weeklyRateKg(72.5, -1)).toBe(-0.73);
    expect(weeklyRateKg(80, 0)).toBe(0);
  });

  it('hors bornes ou sans poids : null', () => {
    expect(weeklyRateKg(80, -1.5)).toBeNull();
    expect(weeklyRateKg(80, 0.6)).toBeNull();
    expect(weeklyRateKg(null, -0.5)).toBeNull();
    expect(weeklyRateKg(80, Number.NaN)).toBeNull();
  });
});
