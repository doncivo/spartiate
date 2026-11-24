import { describe, expect, it } from 'vitest';
import { addTrackPoint, emptyTrack, TRACK_RULES, type TrackPoint } from './index';

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
