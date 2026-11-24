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
    expect(t.points.length).toBeGreaterThan(50);
  });

  it('au-delà de 10 000 points, l’allure du dernier km suit les derniers points (tracé figé, allure vivante)', () => {
    const fn = (cardio as unknown as { trackLastKmSecPerKm?: (s: TrackState) => number | null }).trackLastKmSecPerKm;
    expect(typeof fn).toBe('function');
    if (fn === undefined) return;
    let t = emptyTrack();
    // 5 m toutes les 2 s (2,5 m/s, 400 s/km) jusqu'au plafond, puis 10 m toutes les 2 s (5 m/s, 200 s/km) sur 1,5 km.
    let lat = 0;
    let ms = 0;
    for (let i = 0; i < TRACK_RULES.maxPoints + 10; i += 1) {
      lat += 5 / (DEG_M * 1000);
      ms += 2_000;
      t = addTrackPoint(t, at(lat, ms));
    }
    expect(t.truncated).toBe(true);
    expect(fn(t)).toBe(400);
    for (let i = 0; i < 150; i += 1) {
      lat += 10 / (DEG_M * 1000);
      ms += 2_000;
      t = addTrackPoint(t, at(lat, ms));
    }
    expect(t.points).toHaveLength(TRACK_RULES.maxPoints);
    expect(fn(t)).toBe(200);
  });

  it('sans plafond atteint, même allure que celle des points gardés', () => {
    const fn = (cardio as unknown as { trackLastKmSecPerKm?: (s: TrackState) => number | null }).trackLastKmSecPerKm;
    expect(typeof fn).toBe('function');
    if (fn === undefined) return;
    let t = emptyTrack();
    for (let i = 0; i <= 300; i += 1) t = addTrackPoint(t, at(i * (5 / (DEG_M * 1000)), i * 2_000));
    expect(fn(t)).toBe(cardio.lastKmSecPerKm(t.points));
  });
});
