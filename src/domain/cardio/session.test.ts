import { describe, expect, it } from 'vitest';
import {
  CARDIO_BOUNDS,
  CARDIO_KINDS,
  formatDurationText,
  paceSecPerKm,
  parseAvgHrText,
  parseDistanceKmText,
  parseDurationText,
  parseRpe,
  toCardioKind,
  validateCardioSession,
  type CardioSessionInput,
} from './index';

/** I6-06 (D-221, D-224) : saisie d'une séance cardio, règles pures. */
const NOW = '2026-11-13T18:00:00.000Z';
const input = (over: Partial<CardioSessionInput> = {}): CardioSessionInput => ({
  kind: 'run',
  startedAt: '2026-11-13T17:00:00.000Z',
  durationSec: 2700,
  distanceM: 7500,
  avgHr: 152,
  rpe: 7,
  notes: '',
  source: 'manual',
  ...over,
});

describe('types de cardio (D-221)', () => {
  it('sept types, dans l’ordre de l’écran ; un type inconnu (version plus récente) se lit « autre »', () => {
    expect(CARDIO_KINDS).toEqual(['walk', 'run', 'bike', 'row', 'elliptical', 'skierg', 'other']);
    for (const k of CARDIO_KINDS) expect(toCardioKind(k)).toBe(k);
    expect(toCardioKind('swim')).toBe('other');
    expect(toCardioKind(null)).toBe('other');
  });
});

describe('durée : minutes, mm:ss ou h:mm:ss (D-224)', () => {
  it.each([
    ['45', 2700],
    [' 45 ', 2700],
    ['45:30', 2730],
    ['1:05:00', 3900],
    ['0:30', 30],
    ['1440', 86400],
  ])('« %s » → %i s', (text, sec) => {
    expect(parseDurationText(text)).toEqual({ ok: true, value: sec });
  });

  it('vide, illisible, nulle ou au-delà de 24 h : refusée avec sa raison', () => {
    expect(parseDurationText('')).toEqual({ ok: false, issue: 'empty' });
    for (const bad of ['abc', '1:2:3:4', '45:60', '1:60:00', '-5', '4,5', '1::00']) expect(parseDurationText(bad), bad).toEqual({ ok: false, issue: 'format' });
    expect(parseDurationText('0')).toEqual({ ok: false, issue: 'range' });
    expect(parseDurationText('0:00')).toEqual({ ok: false, issue: 'range' });
    expect(parseDurationText('24:00:01')).toEqual({ ok: false, issue: 'range' });
  });

  it('mise en forme : h:mm:ss au-delà d’une heure, mm:ss en dessous', () => {
    expect(formatDurationText(2730)).toBe('45:30');
    expect(formatDurationText(3900)).toBe('1:05:00');
    expect(formatDurationText(59)).toBe('0:59');
  });
});

describe('distance en km, facultative (virgule ou point)', () => {
  it('vide → aucune distance ; « 5,2 » et « 5.25 » → mètres', () => {
    expect(parseDistanceKmText('')).toEqual({ ok: true, value: null });
    expect(parseDistanceKmText('  ')).toEqual({ ok: true, value: null });
    expect(parseDistanceKmText('5,2')).toEqual({ ok: true, value: 5200 });
    expect(parseDistanceKmText('5.25')).toEqual({ ok: true, value: 5250 });
    expect(parseDistanceKmText('0,001')).toEqual({ ok: true, value: 1 });
  });

  it('illisible, nulle ou au-delà de 1 000 km : refusée', () => {
    for (const bad of ['x', '5,2,1', '-3', '1e3']) expect(parseDistanceKmText(bad), bad).toEqual({ ok: false, issue: 'format' });
    expect(parseDistanceKmText('0')).toEqual({ ok: false, issue: 'range' });
    expect(parseDistanceKmText('1000,1')).toEqual({ ok: false, issue: 'range' });
  });
});

describe('FC moyenne, facultative (battements par minute, entier)', () => {
  it('vide → aucune ; 30 à 250 admis ; sinon refusée', () => {
    expect(parseAvgHrText('')).toEqual({ ok: true, value: null });
    expect(parseAvgHrText('145')).toEqual({ ok: true, value: 145 });
    expect(parseAvgHrText('29')).toEqual({ ok: false, issue: 'range' });
    expect(parseAvgHrText('251')).toEqual({ ok: false, issue: 'range' });
    expect(parseAvgHrText('14,5')).toEqual({ ok: false, issue: 'format' });
  });
});

describe('ressenti (RPE) de 1 à 10, entier', () => {
  it('admis de 1 à 10 ; 0, 11, décimal ou absent refusés', () => {
    for (let r = 1; r <= 10; r += 1) expect(parseRpe(r)).toBe(r);
    for (const bad of [0, 11, 5.5, null, Number.NaN]) expect(parseRpe(bad), String(bad)).toBeNull();
  });
});

describe('validation d’une séance (bornes = CHECK de la migration)', () => {
  it('séance correcte : aucune erreur', () => {
    expect(validateCardioSession(input(), NOW)).toEqual([]);
    expect(validateCardioSession(input({ distanceM: null, avgHr: null, notes: 'x'.repeat(CARDIO_BOUNDS.notesMax) }), NOW)).toEqual([]);
  });

  it('chaque champ fautif est nommé ; un début dans le futur (au-delà de 5 min) est refusé', () => {
    expect(validateCardioSession(input({ kind: 'swim' as never }), NOW)).toEqual(['kind']);
    expect(validateCardioSession(input({ startedAt: 'hier' }), NOW)).toEqual(['start']);
    expect(validateCardioSession(input({ startedAt: '2026-11-13T18:06:00.000Z' }), NOW)).toEqual(['future']);
    expect(validateCardioSession(input({ startedAt: '2026-11-13T18:04:00.000Z' }), NOW)).toEqual([]);
    expect(validateCardioSession(input({ durationSec: 0 }), NOW)).toEqual(['duration']);
    expect(validateCardioSession(input({ durationSec: 86401 }), NOW)).toEqual(['duration']);
    expect(validateCardioSession(input({ durationSec: 12.5 }), NOW)).toEqual(['duration']);
    expect(validateCardioSession(input({ distanceM: 0 }), NOW)).toEqual(['distance']);
    expect(validateCardioSession(input({ distanceM: 1_000_001 }), NOW)).toEqual(['distance']);
    expect(validateCardioSession(input({ avgHr: 300 }), NOW)).toEqual(['avgHr']);
    expect(validateCardioSession(input({ rpe: 0 }), NOW)).toEqual(['rpe']);
    expect(validateCardioSession(input({ notes: 'x'.repeat(CARDIO_BOUNDS.notesMax + 1) }), NOW)).toEqual(['notes']);
    expect(validateCardioSession(input({ source: 'watch' as never }), NOW)).toEqual(['source']);
  });
});

describe('allure', () => {
  it('secondes par km ; sans distance : null', () => {
    expect(paceSecPerKm(2700, 7500)).toBe(360);
    expect(paceSecPerKm(2700, null)).toBeNull();
  });
});
