import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isStoredMeasurementKind, isStoredMeasurementValue, measurementUnit } from '../bodyProgress';
import { canEditRating, isRatingValue, RATING_KINDS, ratingSeries } from './ratings';

/** SUIVIS-029c : notes du matin (fatigue, qualité du sommeil) de 1 à 10 ; genres de la table publiée `measurement` ; aucun effet sur la récupération. */
describe('notes de 1 à 10', () => {
  it('deux genres, entiers de 1 à 10 seulement', () => {
    expect(RATING_KINDS).toEqual(['note_fatigue', 'note_sleep']);
    for (const v of [1, 5, 10]) expect(isRatingValue(v)).toBe(true);
    for (const v of [0, 11, 7.5, Number.NaN, -1]) expect(isRatingValue(v)).toBe(false);
  });

  it('genres stockés dans `measurement` (unité « score »), mêmes bornes au dépôt et à l’import d’archive', () => {
    for (const kind of RATING_KINDS) {
      expect(isStoredMeasurementKind(kind)).toBe(true);
      expect(measurementUnit(kind)).toBe('score');
      expect(isStoredMeasurementValue(kind, 7)).toBe(true);
      expect(isStoredMeasurementValue(kind, 7.5)).toBe(false);
      expect(isStoredMeasurementValue(kind, 0)).toBe(false);
      expect(isStoredMeasurementValue(kind, 11)).toBe(false);
    }
  });

  it('une fois par jour, modifiable le jour même seulement', () => {
    expect(canEditRating('2026-11-21', '2026-11-21')).toBe(true);
    expect(canEditRating('2026-11-20', '2026-11-21')).toBe(false);
    expect(canEditRating('2026-11-22', '2026-11-21')).toBe(false);
  });
});

describe('ratingSeries', () => {
  it('30 jours du plus ancien au plus récent ; jour sans note : null (jamais 0) ; moyenne au dixième et jours notés', () => {
    const s = ratingSeries(
      [
        { day: '2026-11-21', value: 7 },
        { day: '2026-11-19', value: 4 },
        { day: '2026-11-20', value: 6 },
        { day: '2026-10-01', value: 9 },
        { day: '2026-11-22', value: 1 },
      ],
      '2026-11-21',
    );
    expect(s.points).toHaveLength(30);
    expect(s.points.slice(-3)).toEqual([4, 6, 7]);
    expect(s.points.slice(0, 27).every((p) => p === null)).toBe(true);
    expect(s.average).toBe(5.7);
    expect(s.days).toBe(3);
  });

  it('aucune note : moyenne null, 0 jour noté', () => {
    expect(ratingSeries([], '2026-11-21', 7)).toEqual({ points: [null, null, null, null, null, null, null], average: null, days: 0 });
  });
});

describe('C-4 : aucun effet sur la récupération', () => {
  const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
  it('ni le moteur (src/domain/recovery) ni le calcul des résumés (import des fichiers Raccourcis) ne lisent les notes', () => {
    const sources = [...files('src/domain/recovery'), ...files('src/features/settings/recoveryImport')].filter((f) => /\.tsx?$/.test(f) && !f.includes('.test.'));
    expect(sources.length).toBeGreaterThan(5);
    for (const f of sources) {
      const text = readFileSync(f, 'utf8');
      expect(text, f).not.toMatch(/note_fatigue|note_sleep|domain\/tracking|\.\.\/tracking|measurements\(\)/);
    }
  });
});
