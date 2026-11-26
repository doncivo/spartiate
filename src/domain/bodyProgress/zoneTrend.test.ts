import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../types';
import { MEASUREMENT_KINDS } from './measurements';
import { addMonths, BODY_PERIODS, DEFAULT_BODY_PERIOD, periodStart, zoneSeries, type BodySample } from './period';
import { monthlyRate, TREND_STABLE_CM, zoneTrend, zoneTrends } from './zoneTrend';

/** PROG-0301b (BL-178, D-705, D-716, D-718, D-730, D-731) : tendance par zone, rythme par mois, périodes. Valeurs inventées. */
const D = (s: string): LocalDate => s as LocalDate;
const S = (kind: string, date: string, value: number): BodySample => ({ kind, date: D(date), value });

describe('périodes (D-731)', () => {
  it('4 sem. = 28 jours avant la fin, 3 et 6 mois au même jour du calendrier borné au mois, Tout sans début', () => {
    expect([...BODY_PERIODS]).toEqual(['4w', '3m', '6m', 'all']);
    expect(DEFAULT_BODY_PERIOD).toBe('3m');
    expect(periodStart('4w', D('2026-11-26'))).toBe('2026-10-29');
    expect(periodStart('3m', D('2026-11-26'))).toBe('2026-08-26');
    expect(periodStart('6m', D('2026-11-26'))).toBe('2026-05-26');
    expect(periodStart('all', D('2026-11-26'))).toBeNull();
    expect(periodStart('3m', D('2026-05-31'))).toBe('2026-02-28');
    expect(addMonths(D('2026-01-15'), -3)).toBe('2025-10-15');
    expect(addMonths(D('2028-08-31'), -6)).toBe('2028-02-29');
  });
  it('série d’une zone : zones saisies seulement, une valeur par date (la dernière reçue), triée, valeurs illisibles ignorées', () => {
    const samples = [
      S('waist', '2026-10-10', 84),
      S('health_waist_cm', '2026-10-12', 70),
      S('waist', '2026-10-01', 85),
      S('waist', '2026-10-10', 83.5),
      S('waist', '2026-10-11', Number.NaN),
      S('waist', 'pas-une-date', 80),
    ];
    expect(zoneSeries(samples, 'waist')).toEqual([
      { date: '2026-10-01', value: 85 },
      { date: '2026-10-10', value: 83.5 },
    ]);
  });
});

describe('zoneTrend : sens selon l’objectif (D-716)', () => {
  const down = [S('waist', '2026-09-01', 85), S('waist', '2026-09-29', 84), S('arm_left', '2026-09-01', 36), S('arm_left', '2026-09-29', 35)];
  const up = [S('arm_left', '2026-09-01', 35), S('arm_left', '2026-09-29', 36), S('waist', '2026-09-01', 84), S('waist', '2026-09-29', 85)];

  it('baisse de 1 cm sur 28 jours : écart, référence 4 semaines, sens « baisse »', () => {
    const t = zoneTrend(down, 'waist', 'loss');
    expect(t).toMatchObject({ kind: 'waist', delta: -1, span: 'four-weeks', direction: 'down', tone: 'favorable', neutralReason: null });
    expect(t.last).toEqual({ date: '2026-09-29', value: 84 });
    expect(t.reference).toEqual({ date: '2026-09-01', value: 85 });
  });
  it('perte : baisse favorable, hausse défavorable, pour toute zone', () => {
    expect(zoneTrend(down, 'arm_left', 'loss').tone).toBe('favorable');
    expect(zoneTrend(up, 'arm_left', 'loss').tone).toBe('unfavorable');
    expect(zoneTrend(up, 'waist', 'loss').tone).toBe('unfavorable');
  });
  it('prise : hausse favorable, sauf le tour de taille (baisse favorable)', () => {
    expect(zoneTrend(up, 'arm_left', 'gain').tone).toBe('favorable');
    expect(zoneTrend(down, 'arm_left', 'gain').tone).toBe('unfavorable');
    expect(zoneTrend(down, 'waist', 'gain').tone).toBe('favorable');
    expect(zoneTrend(up, 'waist', 'gain').tone).toBe('unfavorable');
  });
  it('maintien : toute évolution hors stable est défavorable', () => {
    expect(zoneTrend(up, 'arm_left', 'maintain').tone).toBe('unfavorable');
    expect(zoneTrend(down, 'waist', 'maintain').tone).toBe('unfavorable');
  });
  it('objectif non renseigné : neutre, raison « no-goal », le sens reste dit', () => {
    expect(zoneTrend(down, 'waist', null)).toMatchObject({ direction: 'down', tone: 'neutral', neutralReason: 'no-goal' });
  });
});

describe('zoneTrend : stable et pas assez de mesures (D-716, D-730)', () => {
  it('écart absolu sous 0,5 cm : stable, neutre', () => {
    expect(TREND_STABLE_CM).toBe(0.5);
    const t = zoneTrend([S('chest', '2026-09-01', 100), S('chest', '2026-09-29', 100.4)], 'chest', 'gain');
    expect(t).toMatchObject({ delta: 0.4, direction: 'stable', tone: 'neutral', neutralReason: 'stable' });
    expect(zoneTrend([S('chest', '2026-09-01', 100), S('chest', '2026-09-29', 99.6)], 'chest', 'loss').direction).toBe('stable');
  });
  it('écart de 0,5 cm (arrondi au dixième avant comparaison) : n’est plus stable', () => {
    expect(zoneTrend([S('neck', '2026-09-01', 38.2), S('neck', '2026-09-29', 38.7)], 'neck', 'gain')).toMatchObject({ delta: 0.5, direction: 'up', tone: 'favorable' });
    expect(zoneTrend([S('neck', '2026-09-01', 38.7), S('neck', '2026-09-29', 38.2)], 'neck', 'gain')).toMatchObject({ delta: -0.5, direction: 'down' });
  });
  it('une seule mesure : pas assez, écart inconnu (jamais 0)', () => {
    expect(zoneTrend([S('hips', '2026-09-01', 100)], 'hips', 'loss')).toMatchObject({ delta: null, reference: null, direction: 'insufficient', tone: 'neutral', neutralReason: 'insufficient' });
    expect(zoneTrend([], 'hips', 'loss')).toMatchObject({ last: null, delta: null, direction: 'insufficient' });
  });
  it('référence à moins de 14 jours : pas assez, l’écart reste donné ; à 14 jours : suffisant', () => {
    expect(zoneTrend([S('hips', '2026-09-01', 100), S('hips', '2026-09-14', 98)], 'hips', 'loss')).toMatchObject({ delta: -2, span: 'since', direction: 'insufficient', tone: 'neutral' });
    expect(zoneTrend([S('hips', '2026-09-01', 100), S('hips', '2026-09-15', 98)], 'hips', 'loss')).toMatchObject({ delta: -2, span: 'since', direction: 'down', tone: 'favorable' });
  });
  it('choix de la référence comme l’écran actuel : 28 à 42 jours, sinon la plus récente au-delà, sinon la plus ancienne', () => {
    const band = [S('calf_left', '2026-07-31', 41), S('calf_left', '2026-08-25', 40), S('calf_left', '2026-09-09', 39.5), S('calf_left', '2026-09-29', 39)];
    expect(zoneTrend(band, 'calf_left', 'loss')).toMatchObject({ reference: { date: '2026-08-25', value: 40 }, span: 'four-weeks', delta: -1 });
    const beyond = [S('calf_left', '2026-07-31', 41), S('calf_left', '2026-08-10', 40.5), S('calf_left', '2026-09-29', 39)];
    expect(zoneTrend(beyond, 'calf_left', 'loss')).toMatchObject({ reference: { date: '2026-08-10', value: 40.5 }, span: 'since', delta: -1.5 });
    const short = [S('calf_left', '2026-09-09', 40), S('calf_left', '2026-09-19', 39.8), S('calf_left', '2026-09-29', 39)];
    expect(zoneTrend(short, 'calf_left', 'loss')).toMatchObject({ reference: { date: '2026-09-09', value: 40 }, span: 'since', delta: -1, direction: 'down' });
  });
  it('le tour de taille de Santé et les notes du matin n’entrent jamais dans la tendance (D-715)', () => {
    const samples = [S('waist', '2026-09-01', 85), S('waist', '2026-09-29', 85.2), S('health_waist_cm', '2026-09-28', 70), S('note_fatigue', '2026-09-29', 9)];
    expect(zoneTrend(samples, 'waist', 'loss')).toMatchObject({ last: { date: '2026-09-29', value: 85.2 }, direction: 'stable' });
  });
  it('zoneTrends rend les 11 zones saisies, et seulement elles', () => {
    const all = zoneTrends([S('waist', '2026-09-01', 85), S('health_waist_cm', '2026-09-01', 80)], 'loss');
    expect(Object.keys(all).sort()).toEqual([...MEASUREMENT_KINDS].sort());
    expect(all.waist.last).toEqual({ date: '2026-09-01', value: 85 });
    expect(all.neck.direction).toBe('insufficient');
  });
});

describe('monthlyRate : rythme par mois (D-718)', () => {
  const end = D('2026-11-26');
  it('pente des moindres carrés × 30,44 jours, au dixième', () => {
    const pts = [S('waist', '2026-10-01', 90), S('waist', '2026-10-15', 89.5), S('waist', '2026-10-29', 89)];
    expect(monthlyRate(pts, 'waist', '3m', end)).toEqual({ status: 'known', cmPerMonth: -1.1, from: '2026-10-01', to: '2026-10-29', count: 3 });
  });
  it('points non alignés : pente de la droite ajustée', () => {
    // x = 0, 10, 20, 30 ; y = 40, 40.6, 40.4, 41 : pente 14 / 500 = 0,028 cm/jour, soit 0,852 cm/mois.
    const pts = [S('arm_right', '2026-10-01', 40), S('arm_right', '2026-10-11', 40.6), S('arm_right', '2026-10-21', 40.4), S('arm_right', '2026-10-31', 41)];
    expect(monthlyRate(pts, 'arm_right', 'all', end)).toMatchObject({ status: 'known', cmPerMonth: 0.9 });
  });
  it('seules les mesures de la période comptent', () => {
    const pts = [S('waist', '2026-06-01', 100), S('waist', '2026-11-01', 90), S('waist', '2026-11-25', 89)];
    expect(monthlyRate(pts, 'waist', '4w', end)).toMatchObject({ status: 'known', from: '2026-11-01', to: '2026-11-25', count: 2 });
    expect(monthlyRate(pts, 'waist', 'all', end)).toMatchObject({ status: 'known', from: '2026-06-01', count: 3 });
  });
  it('moins de 2 mesures ou moins de 14 jours : inconnu, jamais 0', () => {
    expect(monthlyRate([S('waist', '2026-11-01', 90)], 'waist', '3m', end)).toEqual({ status: 'unknown' });
    expect(monthlyRate([S('waist', '2026-11-01', 90), S('waist', '2026-11-14', 90)], 'waist', '3m', end)).toEqual({ status: 'unknown' });
    expect(monthlyRate([S('waist', '2026-11-01', 90), S('waist', '2026-11-15', 90)], 'waist', '3m', end)).toMatchObject({ status: 'known', cmPerMonth: 0 });
  });
  it('le tour de taille de Santé n’entre pas dans le rythme', () => {
    const pts = [S('waist', '2026-11-01', 90), S('health_waist_cm', '2026-11-20', 80)];
    expect(monthlyRate(pts, 'waist', '3m', end)).toEqual({ status: 'unknown' });
  });
});
