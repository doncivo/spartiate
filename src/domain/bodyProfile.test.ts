import { describe, expect, it } from 'vitest';
import { PROFILE_ID, parseDecimal, validateManualWeight, validateProfile } from './bodyProfile';
import type { LocalDate } from './types';

/** Profil et poids (D-65 points 2 à 5) : valeurs facultatives (NULL ≠ zéro), validées au domaine. */

describe('validateProfile', () => {
  it('un profil vide est valide : rien n’est obligatoire', () => {
    expect(validateProfile({}, 2026)).toEqual([]);
  });

  it('bornes : année de naissance de 1920 à l’année courante − 10, taille de 100 à 250 cm', () => {
    expect(validateProfile({ birthYear: 1920, heightCm: 100 }, 2026)).toEqual([]);
    expect(validateProfile({ birthYear: 2016, heightCm: 250 }, 2026)).toEqual([]);
    expect(validateProfile({ birthYear: 1919 }, 2026)).toEqual([{ field: 'birthYear', code: 'range' }]);
    expect(validateProfile({ birthYear: 2017 }, 2026)).toEqual([{ field: 'birthYear', code: 'range' }]);
    expect(validateProfile({ heightCm: 99 }, 2026)).toEqual([{ field: 'heightCm', code: 'range' }]);
    expect(validateProfile({ heightCm: 250.5 }, 2026)).toEqual([{ field: 'heightCm', code: 'range' }]);
    expect(validateProfile({ birthYear: 1990.5 }, 2026)).toEqual([{ field: 'birthYear', code: 'range' }]);
  });

  it('énumérations : sex, goal, experience, units', () => {
    expect(validateProfile({ sex: 'male', goal: 'gain', experience: 'advanced', units: 'metric' }, 2026)).toEqual([]);
    const bad = validateProfile({ sex: 'x' as never, goal: 'y' as never, experience: 'z' as never, units: 'imperial' as never }, 2026);
    expect(bad.map((i) => i.field)).toEqual(['sex', 'goal', 'experience', 'units']);
  });
});

describe('validateManualWeight', () => {
  const today = '2026-10-05' as LocalDate;
  it('kg strictement positif, jamais zéro, jamais dans le futur', () => {
    expect(validateManualWeight({ date: today, kg: 82.4 }, today)).toEqual([]);
    expect(validateManualWeight({ date: today, kg: 0 }, today)).toEqual([{ field: 'kg', code: 'range' }]);
    expect(validateManualWeight({ date: today, kg: -1 }, today)).toEqual([{ field: 'kg', code: 'range' }]);
    expect(validateManualWeight({ date: today, kg: 501 }, today)).toEqual([{ field: 'kg', code: 'range' }]);
    expect(validateManualWeight({ date: '2026-10-06' as LocalDate, kg: 80 }, today)).toEqual([{ field: 'date', code: 'future' }]);
    expect(validateManualWeight({ date: '2026-02-30' as LocalDate, kg: 80 }, today)).toEqual([{ field: 'date', code: 'format' }]);
  });
});

describe('parseDecimal', () => {
  it('virgule ou point ; vide ou illisible : null, jamais 0', () => {
    expect(parseDecimal('82,4')).toBe(82.4);
    expect(parseDecimal(' 82.4 ')).toBe(82.4);
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('1e3')).toBeNull();
  });
  it('identité du profil', () => {
    expect(PROFILE_ID).toBe('profile|singleton');
  });
});
