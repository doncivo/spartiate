import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../types';
import type { BodySample } from './period';
import { BODY_RATIOS, bodyRatio, bodyRatios, RATIO_PARTS, resolveHeight } from './ratios';

/** PROG-0301b (BL-178, D-707, D-715, D-717, D-718, D-732) : hauteur, ratios et leur évolution. Valeurs inventées ; aucun repère (BL-181). */
const D = (s: string): LocalDate => s as LocalDate;
const S = (kind: string, date: string, value: number): BodySample => ({ kind, date: D(date), value });
const end = D('2026-11-26');

describe('resolveHeight : profil, puis Santé (D-715)', () => {
  it('le profil d’abord ; Santé à 2 cm près : pas de note', () => {
    expect(resolveHeight(178, [S('health_height_cm', '2026-10-01', 176)])).toEqual({ cm: 178, source: 'profile', healthDiffers: false });
  });
  it('profil et Santé à plus de 2 cm : signalé, le profil reste utilisé', () => {
    expect(resolveHeight(178, [S('health_height_cm', '2026-10-01', 175.5)])).toEqual({ cm: 178, source: 'profile', healthDiffers: true });
    expect(resolveHeight(178, [S('health_height_cm', '2026-09-01', 170), S('health_height_cm', '2026-10-01', 177)])).toMatchObject({ healthDiffers: false });
  });
  it('sans profil : la dernière hauteur importée de Santé', () => {
    expect(resolveHeight(null, [S('health_height_cm', '2026-10-01', 180), S('health_height_cm', '2026-08-01', 179)])).toEqual({ cm: 180, source: 'health', healthDiffers: false });
  });
  it('aucune hauteur valable : null (le ratio dira « inconnu »)', () => {
    expect(resolveHeight(null, [])).toBeNull();
    expect(resolveHeight(90, [])).toBeNull();
    expect(resolveHeight(Number.NaN, [S('waist', '2026-10-01', 180)])).toBeNull();
    expect(resolveHeight(null, [S('health_height_cm', '2026-10-01', 300)])).toBeNull();
  });
});

describe('ratios sur les dernières mesures (D-707, D-715)', () => {
  it('quatre ratios, dans l’ordre, chacun avec ses deux zones', () => {
    expect([...BODY_RATIOS]).toEqual(['waist_height', 'shoulders_waist', 'waist_hips', 'chest_waist']);
    expect(RATIO_PARTS.waist_height).toEqual({ numerator: 'waist', denominator: 'height' });
    expect(RATIO_PARTS.shoulders_waist).toEqual({ numerator: 'shoulders', denominator: 'waist' });
    expect(RATIO_PARTS.waist_hips).toEqual({ numerator: 'waist', denominator: 'hips' });
    expect(RATIO_PARTS.chest_waist).toEqual({ numerator: 'chest', denominator: 'waist' });
  });
  it('valeurs au centième, la hauteur et sa source jointes à taille / hauteur', () => {
    const samples = [S('waist', '2026-11-20', 85), S('shoulders', '2026-11-20', 120), S('hips', '2026-11-22', 100), S('chest', '2026-11-14', 100)];
    const r = bodyRatios(samples, 180, '3m', end);
    expect(r.waist_height.current).toEqual({ status: 'known', value: 0.47, numeratorDate: '2026-11-20', denominatorDate: null });
    expect(r.waist_height.height).toEqual({ cm: 180, source: 'profile', healthDiffers: false });
    expect(r.shoulders_waist.current).toMatchObject({ status: 'known', value: 1.41 });
    expect(r.waist_hips.current).toEqual({ status: 'known', value: 0.85, numeratorDate: '2026-11-20', denominatorDate: '2026-11-22' });
    expect(r.chest_waist.current).toMatchObject({ status: 'known', value: 1.18 });
    expect(r.shoulders_waist.height).toBeNull();
  });
  it('sans hauteur : taille / hauteur « inconnu », jamais 0 ; les autres ratios restent calculés', () => {
    const r = bodyRatios([S('waist', '2026-11-20', 85), S('hips', '2026-11-20', 100)], null, '3m', end);
    expect(r.waist_height.current).toEqual({ status: 'unknown', reason: 'no-height' });
    expect(r.waist_height.evolution).toEqual({ status: 'unknown' });
    expect(r.waist_hips.current).toMatchObject({ status: 'known', value: 0.85 });
  });
  it('hauteur prise de Santé quand le profil n’en a pas', () => {
    const r = bodyRatios([S('waist', '2026-11-20', 90), S('health_height_cm', '2026-10-01', 180)], null, '3m', end);
    expect(r.waist_height.current).toMatchObject({ status: 'known', value: 0.5 });
    expect(r.waist_height.height).toMatchObject({ source: 'health' });
  });
  it('les deux zones à plus de 7 jours d’écart : « inconnu » ; 7 jours : connu', () => {
    expect(bodyRatios([S('waist', '2026-11-12', 85), S('hips', '2026-11-20', 100)], null, '3m', end).waist_hips.current).toEqual({ status: 'unknown', reason: 'gap' });
    expect(bodyRatios([S('waist', '2026-11-13', 85), S('hips', '2026-11-20', 100)], null, '3m', end).waist_hips.current).toMatchObject({ status: 'known' });
  });
  it('une zone absente : « inconnu » ; le tour de taille de Santé ne remplace jamais la zone saisie', () => {
    expect(bodyRatios([S('hips', '2026-11-20', 100)], 180, '3m', end).waist_hips.current).toEqual({ status: 'unknown', reason: 'missing' });
    const onlyHealth = bodyRatios([S('health_waist_cm', '2026-11-20', 85), S('hips', '2026-11-20', 100)], 180, '3m', end);
    expect(onlyHealth.waist_height.current).toEqual({ status: 'unknown', reason: 'missing' });
    expect(onlyHealth.waist_hips.current).toEqual({ status: 'unknown', reason: 'missing' });
  });
  it('aucun repère : le résultat ne porte que la valeur et l’évolution (D-717, BL-181)', () => {
    const r = bodyRatio('waist_hips', [S('waist', '2026-11-20', 85), S('hips', '2026-11-20', 100)], null, '3m', end);
    expect(Object.keys(r).sort()).toEqual(['current', 'evolution', 'height', 'kind']);
  });
});

describe('évolution d’un ratio sur la période (D-718, D-732)', () => {
  it('valeur actuelle moins la valeur à la première date de la période où les deux zones sont mesurées', () => {
    const samples = [S('waist', '2026-09-01', 88), S('hips', '2026-09-05', 102), S('waist', '2026-11-20', 85), S('hips', '2026-11-20', 100)];
    const r = bodyRatio('waist_hips', samples, null, '3m', end);
    // 88 / 102 = 0,8627 ; 85 / 100 = 0,85 : −0,0127, au centième −0,01.
    expect(r.evolution).toEqual({ status: 'known', delta: -0.01, from: '2026-09-05', fromValue: 0.86 });
  });
  it('taille / hauteur : la première taille de la période, avec la hauteur actuelle', () => {
    const samples = [S('waist', '2026-09-01', 88), S('waist', '2026-11-20', 85)];
    // 88 / 180 = 0,4889 ; 85 / 180 = 0,4722 : −0,0167, au centième −0,02.
    expect(bodyRatios(samples, 180, '3m', end).waist_height.evolution).toEqual({ status: 'known', delta: -0.02, from: '2026-09-01', fromValue: 0.49 });
  });
  it('une seule paire dans la période (la paire actuelle) : évolution inconnue, jamais 0', () => {
    const samples = [S('waist', '2026-11-20', 85), S('hips', '2026-11-20', 100)];
    expect(bodyRatio('waist_hips', samples, null, '3m', end).evolution).toEqual({ status: 'unknown' });
  });
  it('les mesures d’avant la période ne servent pas de départ', () => {
    const samples = [S('waist', '2026-06-01', 95), S('hips', '2026-06-01', 105), S('waist', '2026-11-01', 86), S('hips', '2026-11-02', 100), S('waist', '2026-11-20', 85), S('hips', '2026-11-20', 100)];
    expect(bodyRatio('waist_hips', samples, null, '4w', end).evolution).toEqual({ status: 'known', delta: -0.01, from: '2026-11-02', fromValue: 0.86 });
    expect(bodyRatio('waist_hips', samples, null, 'all', end).evolution).toMatchObject({ status: 'known', from: '2026-06-01', delta: -0.05 });
  });
  it('aucune paire à 7 jours dans la période : inconnu', () => {
    const samples = [S('waist', '2026-09-01', 88), S('hips', '2026-09-20', 102), S('waist', '2026-11-20', 85), S('hips', '2026-11-20', 100)];
    // Paires de la période : (09-01, 09-20) écart 19 ; (11-20, 11-20) est la paire actuelle ; la première paire valable est la paire actuelle.
    expect(bodyRatio('waist_hips', samples, null, '3m', end).evolution).toEqual({ status: 'unknown' });
  });
  it('ratio actuel inconnu : évolution inconnue', () => {
    const samples = [S('waist', '2026-09-01', 88), S('hips', '2026-09-01', 102), S('waist', '2026-11-20', 85), S('hips', '2026-11-01', 100)];
    expect(bodyRatio('waist_hips', samples, null, '3m', end)).toMatchObject({ current: { status: 'unknown', reason: 'gap' }, evolution: { status: 'unknown' } });
  });
});
