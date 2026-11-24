import { describe, expect, it } from 'vitest';
import * as cardio from './index';
import { addTrackPoint, emptyTrack, TRACK_RULES, type TrackPoint, type TrackState } from './index';

/**
 * SEANCE-0292 (partie B) : tracé GPS. Positions SYNTHÉTIQUES (ligne vers le nord depuis 0° / 0°) ; 0,001° de latitude ≈ 111,19 m.
 */
const DEG_M = (6_371_000 * Math.PI) / 180 / 1000;
const T0 = 1_800_000_000_000;
const at = (lat: number, ms: number, accuracyM = 5): TrackPoint => ({ lat, lon: 0, at: T0 + ms, accuracyM });

describe('C-008 : bruit à l’arrêt (pas minimal lié à la précision)', () => {
  it('61 points immobiles alternant à 10 m, précision 20 m : aucune distance (était 600 m)', () => {
    let t = emptyTrack();
    const step = 10 / (DEG_M * 1000);
    for (let i = 0; i <= 60; i += 1) t = addTrackPoint(t, at((i % 2) * step, i * 2_000, 20));
    expect(t.distanceM).toBe(0);
  });

  it('marche réelle à 1,4 m/s, précision 20 m : la distance suit le trajet (à la précision près)', () => {
    let t = emptyTrack();
    const perSec = 1.4 / (DEG_M * 1000);
    for (let s = 0; s <= 600; s += 2) t = addTrackPoint(t, at(s * perSec, s * 1_000, 20));
    expect(t.distanceM).toBeGreaterThan(840 - 25);
    expect(t.distanceM).toBeLessThanOrEqual(840 + 0.5);
  });

  it('précision fine (5 m) : le pas minimal reste de 3 m au moins', () => {
    expect(TRACK_RULES.minStepM).toBe(3);
    let t = addTrackPoint(emptyTrack(), at(0, 0));
    t = addTrackPoint(t, at(4 / (DEG_M * 1000), 2_000, 2));
    expect(t.distanceM).toBeCloseTo(4, 1);
  });
});

describe('C-022 : premier point contrôlé ; allure du dernier km au-delà du plafond de points', () => {
  it('premier point décalé de 300 m : il ne bloque pas les suivants et n’ajoute pas 300 m', () => {
    let t = addTrackPoint(emptyTrack(), at(300 / (DEG_M * 1000), 0));
    const perSec = 1.4 / (DEG_M * 1000);
    for (let s = 2; s <= 120; s += 2) t = addTrackPoint(t, at(s * perSec, s * 1_000));
    const real = (120 - 2) * 1.4;
    expect(t.distanceM).toBeLessThan(real + 5);
    expect(t.distanceM).toBeGreaterThan(real - 10);
    // Pas de 2,8 m sous une précision de 5 m : un point sur deux gardé (≈ 30).
    expect(t.points.length).toBeGreaterThanOrEqual(25);
  });

  it('au-delà de 10 000 points, l’allure du dernier km suit les derniers points (tracé figé, allure vivante)', () => {
    const fn = (cardio as unknown as { trackLastKmSecPerKm?: (s: TrackState) => number | null }).trackLastKmSecPerKm;
    expect(typeof fn).toBe('function');
    if (fn === undefined) return;
    let t = emptyTrack();
    // 8 m toutes les 2 s (250 s/km) jusqu'au plafond, puis 16 m toutes les 2 s (125 s/km) sur 2,4 km.
    let lat = 0;
    let ms = 0;
    for (let i = 0; i < TRACK_RULES.maxPoints + 10; i += 1) {
      lat += 8 / (DEG_M * 1000);
      ms += 2_000;
      t = addTrackPoint(t, at(lat, ms));
    }
    expect(t.truncated).toBe(true);
    expect(fn(t)).toBe(250);
    for (let i = 0; i < 150; i += 1) {
      lat += 16 / (DEG_M * 1000);
      ms += 2_000;
      t = addTrackPoint(t, at(lat, ms));
    }
    expect(t.points).toHaveLength(TRACK_RULES.maxPoints);
    expect(fn(t)).toBe(125);
  });

  it('un saut isolé depuis le premier point reste ignoré (le premier point n’est pas remplacé)', () => {
    let t = addTrackPoint(emptyTrack(), at(0, 0));
    t = addTrackPoint(t, at(0.05, 2_000));
    t = addTrackPoint(t, at(20 / (DEG_M * 1000), 4_000));
    expect(t.points.map((q) => q.at)).toEqual([T0, T0 + 4_000]);
    expect(t.distanceM).toBeCloseTo(20, 1);
  });

  it('sans plafond atteint, même allure que celle des points gardés', () => {
    const fn = (cardio as unknown as { trackLastKmSecPerKm?: (s: TrackState) => number | null }).trackLastKmSecPerKm;
    expect(typeof fn).toBe('function');
    if (fn === undefined) return;
    let t = emptyTrack();
    for (let i = 0; i <= 300; i += 1) t = addTrackPoint(t, at(i * (8 / (DEG_M * 1000)), i * 2_000));
    expect(fn(t)).toBe(cardio.lastKmSecPerKm(t.points));
  });
});

describe('C-083 : durée saisie au pavé décimal de l’iPhone (sans « : »)', () => {
  it('« 45,30 » et « 45.30 » valent 45:30 ; « 1,05,00 » vaut 1:05:00 ; « 45,5 » (secondes sur un chiffre) refusé ; « 45 » reste 45 min', () => {
    expect(cardio.parseDurationText('45,30')).toEqual({ ok: true, value: 45 * 60 + 30 });
    expect(cardio.parseDurationText('45.30')).toEqual({ ok: true, value: 45 * 60 + 30 });
    expect(cardio.parseDurationText('1,05,00')).toEqual({ ok: true, value: 3_900 });
    expect(cardio.parseDurationText('45,5')).toEqual({ ok: false, issue: 'format' });
    expect(cardio.parseDurationText('45')).toEqual({ ok: true, value: 2_700 });
    expect(cardio.parseDurationText('45:30')).toEqual({ ok: true, value: 45 * 60 + 30 });
  });
});
