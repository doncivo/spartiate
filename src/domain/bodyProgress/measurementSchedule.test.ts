import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../types';
import {
  DEFAULT_MEASUREMENT_RHYTHM_DAYS,
  lastMeasurementSession,
  MEASUREMENT_RHYTHMS_DAYS,
  measurementSchedule,
  parseMeasurementRhythm,
} from './measurementSchedule';
import type { BodySample } from './period';

/** PROG-0301b (BL-178, D-710, D-713, D-734) : dernière et prochaine séance de mesures. Valeurs inventées. */
const D = (s: string): LocalDate => s as LocalDate;
const S = (kind: string, date: string, value = 50): BodySample => ({ kind, date: D(date), value });

describe('dernière séance de mesures (D-713)', () => {
  it('date de la dernière mesure saisie de l’une des 11 zones, hors health_*, note_* et visbody_*', () => {
    const samples = [S('waist', '2026-11-01'), S('arm_left', '2026-11-10'), S('health_waist_cm', '2026-11-20'), S('note_sleep', '2026-11-25', 7), S('visbody_weight_kg', '2026-11-24')];
    expect(lastMeasurementSession(samples, D('2026-11-26'))).toBe('2026-11-10');
  });
  it('aucune zone saisie : null', () => {
    expect(lastMeasurementSession([S('health_height_cm', '2026-11-20', 180)], D('2026-11-26'))).toBeNull();
    expect(lastMeasurementSession([], D('2026-11-26'))).toBeNull();
  });
  it('une mesure datée après aujourd’hui (horloge d’un autre appareil) est ignorée', () => {
    expect(lastMeasurementSession([S('waist', '2026-11-10'), S('waist', '2026-11-30')], D('2026-11-26'))).toBe('2026-11-10');
  });
});

describe('rythme (D-713, D-734)', () => {
  it('7, 14 ou 28 jours, 7 par défaut ; toute autre valeur lue revient à 7', () => {
    expect([...MEASUREMENT_RHYTHMS_DAYS]).toEqual([7, 14, 28]);
    expect(DEFAULT_MEASUREMENT_RHYTHM_DAYS).toBe(7);
    expect(parseMeasurementRhythm(14)).toBe(14);
    expect(parseMeasurementRhythm('28')).toBe(28);
    expect(parseMeasurementRhythm('7')).toBe(7);
    for (const bad of [null, undefined, '', '10', 0, -7, 7.5, '14 ', '07', '028', 'abc', {}]) expect(parseMeasurementRhythm(bad)).toBe(7);
  });
});

describe('prochaine séance conseillée (D-713)', () => {
  const samples = [S('waist', '2026-11-10'), S('chest', '2026-11-08')];
  it('dernière + rythme ; jours écoulés et jours restants', () => {
    expect(measurementSchedule(samples, 7, D('2026-11-14'))).toEqual({ status: 'scheduled', last: '2026-11-10', daysSince: 4, dueDate: '2026-11-17', nextDate: '2026-11-17', daysUntil: 3, overdue: false });
  });
  it('le jour prévu : 0 jour, pas en retard', () => {
    expect(measurementSchedule(samples, 7, D('2026-11-17'))).toMatchObject({ nextDate: '2026-11-17', daysUntil: 0, overdue: false });
  });
  it('échéance passée : prochaine conseillée aujourd’hui, jamais un nombre négatif', () => {
    expect(measurementSchedule(samples, 7, D('2026-11-20'))).toEqual({ status: 'scheduled', last: '2026-11-10', daysSince: 10, dueDate: '2026-11-17', nextDate: '2026-11-20', daysUntil: 0, overdue: true });
  });
  it('rythmes de 14 et 28 jours', () => {
    expect(measurementSchedule(samples, 14, D('2026-11-14'))).toMatchObject({ dueDate: '2026-11-24', daysUntil: 10 });
    expect(measurementSchedule(samples, 28, D('2026-11-14'))).toMatchObject({ dueDate: '2026-12-08', daysUntil: 24 });
  });
  it('mesure du jour : 0 jour écoulé', () => {
    expect(measurementSchedule([S('neck', '2026-11-26')], 7, D('2026-11-26'))).toMatchObject({ daysSince: 0, daysUntil: 7, nextDate: '2026-12-03' });
  });
  it('sans mesure saisie : aucune séance, sans prochaine', () => {
    expect(measurementSchedule([S('note_fatigue', '2026-11-20', 5)], 7, D('2026-11-26'))).toEqual({ status: 'none' });
  });
});
