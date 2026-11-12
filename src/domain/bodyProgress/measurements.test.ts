import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../types';
import {
  isMeasurementKind,
  isPhotoFileName,
  MEASUREMENT_BOUNDS_CM,
  MEASUREMENT_KINDS,
  MEASUREMENT_MAX_ABSOLUTE_CM,
  measurementChange,
  PHOTO_FILE_NAME_MAX,
  photoFileName,
  photoTargetSize,
  PHOTO_MAX_EDGE_PX,
  validateMeasurement,
} from './measurements';

/** I6-02 (§ 17.1) : mensurations en centimètres (liste fermée, bornes nommées, rejet hors bornes), changement entre deux dates, nom de fichier de photo. */
const D = (s: string): LocalDate => s as LocalDate;

describe('liste fermée et bornes', () => {
  it('onze mensurations fixes, chacune avec des bornes en cm', () => {
    expect([...MEASUREMENT_KINDS]).toEqual(['neck', 'shoulders', 'chest', 'waist', 'hips', 'arm_left', 'arm_right', 'thigh_left', 'thigh_right', 'calf_left', 'calf_right']);
    for (const kind of MEASUREMENT_KINDS) {
      const b = MEASUREMENT_BOUNDS_CM[kind];
      expect(b.min).toBeGreaterThan(0);
      expect(b.max).toBeGreaterThan(b.min);
      expect(b.max).toBeLessThan(MEASUREMENT_MAX_ABSOLUTE_CM);
    }
    expect(isMeasurementKind('waist')).toBe(true);
    expect(isMeasurementKind('weight')).toBe(false);
    expect(isMeasurementKind('')).toBe(false);
  });
});

describe('validateMeasurement', () => {
  it('accepte une valeur plausible, virgule ou point', () => {
    expect(validateMeasurement('waist', '82,5', D('2026-11-12'), D('2026-11-12'))).toEqual({ ok: true, value: 82.5 });
    expect(validateMeasurement('arm_left', '36.2', D('2026-11-12'), D('2026-11-12'))).toEqual({ ok: true, value: 36.2 });
  });
  it('bornes incluses, refus juste en dehors', () => {
    const { min, max } = MEASUREMENT_BOUNDS_CM.waist;
    expect(validateMeasurement('waist', String(min), D('2026-11-12'), D('2026-11-12'))).toEqual({ ok: true, value: min });
    expect(validateMeasurement('waist', String(max), D('2026-11-12'), D('2026-11-12'))).toEqual({ ok: true, value: max });
    expect(validateMeasurement('waist', String(min - 0.1), D('2026-11-12'), D('2026-11-12'))).toEqual({ ok: false, reason: 'range' });
    expect(validateMeasurement('waist', String(max + 0.1), D('2026-11-12'), D('2026-11-12'))).toEqual({ ok: false, reason: 'range' });
  });
  it('vide, illisible, négatif, zéro : refus, jamais un faux zéro', () => {
    for (const text of ['', ' ', 'abc', '-5', '0', '12 cm', '1e3']) expect(validateMeasurement('waist', text, D('2026-11-12'), D('2026-11-12')).ok, text).toBe(false);
    expect(validateMeasurement('waist', '', D('2026-11-12'), D('2026-11-12'))).toEqual({ ok: false, reason: 'empty' });
    expect(validateMeasurement('waist', 'abc', D('2026-11-12'), D('2026-11-12'))).toEqual({ ok: false, reason: 'format' });
  });
  it('date : format, futur refusé, aujourd’hui accepté', () => {
    expect(validateMeasurement('waist', '80', D('2026-11-13'), D('2026-11-12'))).toEqual({ ok: false, reason: 'future' });
    expect(validateMeasurement('waist', '80', D('2026-13-01'), D('2026-11-12'))).toEqual({ ok: false, reason: 'date' });
    expect(validateMeasurement('waist', '80', D('2026-11-12'), D('2026-11-12')).ok).toBe(true);
  });
});

describe('measurementChange', () => {
  it('sans mesure ou avec une seule : aucun changement (jamais un faux zéro)', () => {
    expect(measurementChange([])).toBeNull();
    expect(measurementChange([{ date: D('2026-11-01'), value: 80 }])).toBeNull();
  });
  it('dernière mesure moins la précédente, quel que soit l’ordre reçu', () => {
    const list = [
      { date: D('2026-11-12'), value: 81 },
      { date: D('2026-10-01'), value: 84 },
      { date: D('2026-11-01'), value: 82.5 },
    ];
    expect(measurementChange(list)).toEqual({ from: D('2026-11-01'), to: D('2026-11-12'), delta: -1.5 });
  });
  it('arrondi à 0,1 cm', () => {
    expect(measurementChange([{ date: D('2026-11-01'), value: 80.1 }, { date: D('2026-11-02'), value: 80.3 }])?.delta).toBe(0.2);
  });
});

describe('nom de fichier de photo', () => {
  it('forme : identifiant + .jpg, sans séparateur de chemin', () => {
    const id = '7d3c2e4f-0000-4000-8000-000000000001';
    expect(photoFileName(id)).toBe(`${id}.jpg`);
    expect(isPhotoFileName(`${id}.jpg`)).toBe(true);
    expect(photoFileName(id).length).toBeLessThanOrEqual(PHOTO_FILE_NAME_MAX);
  });
  it('refuse un chemin, un point-point, un nom vide ou trop long', () => {
    for (const bad of ['', '../a.jpg', 'a/b.jpg', 'a' + String.fromCharCode(92) + 'b.jpg', '..', 'a.exe', 'x'.repeat(PHOTO_FILE_NAME_MAX + 1) + '.jpg', 'a b.jpg']) expect(isPhotoFileName(bad), bad).toBe(false);
  });
});

describe('photoTargetSize (réduction avant enregistrement)', () => {
  it('garde une image déjà petite telle quelle', () => {
    expect(photoTargetSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it('réduit le plus grand côté à la taille maximale, proportions gardées, arrondi à l’entier', () => {
    expect(photoTargetSize(4032, 3024)).toEqual({ width: PHOTO_MAX_EDGE_PX, height: 1200 });
    expect(photoTargetSize(3024, 4032)).toEqual({ width: 1200, height: PHOTO_MAX_EDGE_PX });
  });
  it('jamais une dimension nulle, dimensions invalides refusées (null)', () => {
    expect(photoTargetSize(100000, 10)).toEqual({ width: PHOTO_MAX_EDGE_PX, height: 1 });
    for (const [w, h] of [[0, 10], [10, 0], [-1, 5], [Number.NaN, 5], [5, Number.POSITIVE_INFINITY]] as const) expect(photoTargetSize(w, h), String(w) + 'x' + String(h)).toBeNull();
  });
});
