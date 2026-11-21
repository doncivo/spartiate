import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../types';
import { isStoredMeasurementKind, isStoredMeasurementValue, measurementUnit } from './measurements';
import { parseVisbodyForm, VISBODY_FIELDS, VISBODY_KINDS, visbodyChange, visbodyDisplayValue, visbodyReports } from './visbody';

/** SUIVIS-029d : bilans VISBODY saisis à la main (genres `visbody_*` de `measurement`, chaque champ facultatif, bornes plausibles). */
const TODAY = '2026-11-21' as LocalDate;

describe('genres VISBODY', () => {
  it('poids, masse grasse, masse musculaire, graisse viscérale, eau, métabolisme de base et 10 mesures segmentaires', () => {
    expect(VISBODY_KINDS.slice(0, 6)).toEqual(['visbody_weight_kg', 'visbody_fat_pct', 'visbody_muscle_kg', 'visbody_visceral_level', 'visbody_water_kg', 'visbody_bmr_dakcal']);
    expect(VISBODY_KINDS).toHaveLength(16);
    expect(VISBODY_FIELDS.filter((f) => f.segment)).toHaveLength(10);
    for (const kind of VISBODY_KINDS) {
      expect(kind).toMatch(/^[a-z_]{1,32}$/);
      expect(isStoredMeasurementKind(kind)).toBe(true);
      expect(measurementUnit(kind)).not.toBeNull();
    }
    expect(measurementUnit('visbody_bmr_dakcal')).toBe('dakcal');
    expect(measurementUnit('visbody_visceral_level')).toBe('level');
  });

  it('valeur stockée toujours sous le plafond du CHECK SQL (< 1 000) ; viscérale entière', () => {
    for (const f of VISBODY_FIELDS) expect(f.storedMax, f.kind).toBeLessThan(1000);
    expect(isStoredMeasurementValue('visbody_visceral_level', 8)).toBe(true);
    expect(isStoredMeasurementValue('visbody_visceral_level', 8.5)).toBe(false);
    expect(isStoredMeasurementValue('visbody_bmr_dakcal', 165.3)).toBe(true);
    expect(isStoredMeasurementValue('visbody_weight_kg', 400)).toBe(false);
  });
});

describe('parseVisbodyForm', () => {
  it('champs facultatifs, virgule admise ; métabolisme saisi en kcal, stocké en décakilocalories', () => {
    const r = parseVisbodyForm({ visbody_weight_kg: '78,4', visbody_fat_pct: '18.2', visbody_bmr_dakcal: '1 653', visbody_visceral_level: '7', visbody_muscle_kg: '' }, '2026-11-20', TODAY);
    expect(r).toEqual({ ok: true, date: '2026-11-20', values: { visbody_weight_kg: 78.4, visbody_fat_pct: 18.2, visbody_bmr_dakcal: 165.3, visbody_visceral_level: 7 } });
    expect(visbodyDisplayValue('visbody_bmr_dakcal', 165.3)).toBe(1653);
    expect(visbodyDisplayValue('visbody_weight_kg', 78.4)).toBe(78.4);
  });

  it('refus : aucun champ, date future ou impossible, valeur illisible ou hors bornes (jamais corrigée)', () => {
    expect(parseVisbodyForm({}, '2026-11-20', TODAY)).toEqual({ ok: false, empty: true, date: null, fields: {} });
    expect(parseVisbodyForm({ visbody_weight_kg: '78' }, '2026-11-22', TODAY)).toMatchObject({ ok: false, date: 'future' });
    expect(parseVisbodyForm({ visbody_weight_kg: '78' }, '2026-02-30', TODAY)).toMatchObject({ ok: false, date: 'date' });
    expect(parseVisbodyForm({ visbody_weight_kg: 'abc', visbody_fat_pct: '90', visbody_visceral_level: '7,5', visbody_bmr_dakcal: '200' }, '2026-11-20', TODAY)).toEqual({
      ok: false,
      empty: false,
      date: null,
      fields: { visbody_weight_kg: 'format', visbody_fat_pct: 'range', visbody_visceral_level: 'format', visbody_bmr_dakcal: 'range' },
    });
  });
});

describe('bilans et écart au précédent', () => {
  const rows = [
    { day: '2026-11-02', kind: 'visbody_weight_kg', value: 79 },
    { day: '2026-11-02', kind: 'visbody_fat_pct', value: 19 },
    { day: '2026-11-20', kind: 'visbody_weight_kg', value: 78.4 },
    { day: '2026-11-20', kind: 'visbody_bmr_dakcal', value: 165.3 },
    { day: '2026-11-10', kind: 'waist', value: 80 },
  ];

  it('bilans par date, du plus ancien au plus récent, genres VISBODY seulement', () => {
    expect(visbodyReports(rows)).toEqual([
      { date: '2026-11-02', values: { visbody_weight_kg: 79, visbody_fat_pct: 19 } },
      { date: '2026-11-20', values: { visbody_weight_kg: 78.4, visbody_bmr_dakcal: 165.3 } },
    ]);
  });

  it('écart au bilan précédent qui porte la mesure ; une seule mesure : pas d’écart (jamais 0) ; aucune : null', () => {
    const reports = visbodyReports(rows);
    expect(visbodyChange(reports, 'visbody_weight_kg')).toEqual({ last: { date: '2026-11-20', value: 78.4 }, previous: { date: '2026-11-02', value: 79 }, delta: -0.6, points: [79, 78.4] });
    expect(visbodyChange(reports, 'visbody_fat_pct')).toEqual({ last: { date: '2026-11-02', value: 19 }, previous: null, delta: null, points: [19] });
    expect(visbodyChange(reports, 'visbody_bmr_dakcal')).toMatchObject({ last: { date: '2026-11-20', value: 1653 }, delta: null });
    expect(visbodyChange(reports, 'visbody_water_kg')).toBeNull();
  });
});
