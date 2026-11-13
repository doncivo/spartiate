import { describe, expect, it } from 'vitest';
import { addTrackPoint, decodeTrack, emptyTrack, encodeTrack, haversineM, TRACK_RULES, trackDistanceM, type TrackPoint } from './index';

/**
 * I6-06 (D-222) : tracé GPS, règles pures. Positions SYNTHÉTIQUES (aucune position réelle) : une ligne droite vers le nord depuis 0° / 0°.
 * 0,001° de latitude ≈ 111,19 m (rayon moyen 6 371 km).
 */
const DEG_M = (6_371_000 * Math.PI) / 180 / 1000;
const p = (i: number, over: Partial<TrackPoint> = {}): TrackPoint => ({ lat: i * 0.001, lon: 0, at: 1_800_000_000_000 + i * 30_000, accuracyM: 5, ...over });

describe('distance entre deux points (haversine)', () => {
  it('0,001° de latitude ≈ 111,19 m ; même point : 0', () => {
    expect(haversineM(p(0), p(1))).toBeCloseTo(DEG_M, 3);
    expect(haversineM(p(3), p(3))).toBe(0);
  });
});

describe('accumulation d’un tracé (premier plan seulement)', () => {
  it('somme des segments retenus', () => {
    let t = emptyTrack();
    for (let i = 0; i <= 10; i += 1) t = addTrackPoint(t, p(i));
    expect(t.points).toHaveLength(11);
    expect(t.distanceM).toBeCloseTo(10 * DEG_M, 2);
    expect(trackDistanceM(t.points)).toBeCloseTo(t.distanceM, 6);
  });

  it('point trop imprécis (au-delà de 50 m) ignoré ; saut irréaliste (au-delà de 15 m/s) ignoré ; instant qui recule ignoré', () => {
    expect(TRACK_RULES.maxAccuracyM).toBe(50);
    expect(TRACK_RULES.maxSpeedMps).toBe(15);
    let t = addTrackPoint(emptyTrack(), p(0));
    t = addTrackPoint(t, p(1, { accuracyM: 80 }));
    expect(t.points).toHaveLength(1);
    t = addTrackPoint(t, p(1, { lat: 0.05 }));
    expect(t.points).toHaveLength(1);
    t = addTrackPoint(t, p(-1));
    expect(t.points).toHaveLength(1);
    t = addTrackPoint(t, p(1));
    expect(t.points).toHaveLength(2);
    expect(t.distanceM).toBeCloseTo(DEG_M, 3);
  });

  it('valeurs non finies ou hors du globe ignorées', () => {
    let t = emptyTrack();
    for (const bad of [p(0, { lat: Number.NaN }), p(0, { lat: 91 }), p(0, { lon: -181 }), p(0, { at: Number.NaN }), p(0, { accuracyM: -1 })]) t = addTrackPoint(t, bad);
    expect(t.points).toEqual([]);
  });

  it('pas de moins de 3 m (bruit à l’arrêt) : ni gardé ni compté, la distance se mesure depuis le dernier point gardé', () => {
    expect(TRACK_RULES.minStepM).toBe(3);
    let t = addTrackPoint(emptyTrack(), p(0));
    t = addTrackPoint(t, p(0, { lat: 0.00001, at: p(0).at + 1_000 }));
    t = addTrackPoint(t, p(0, { lat: 0.00002, at: p(0).at + 2_000 }));
    expect(t.points).toHaveLength(1);
    expect(t.distanceM).toBe(0);
    t = addTrackPoint(t, p(0, { lat: 0.00004, at: p(0).at + 3_000 }));
    expect(t.points).toHaveLength(2);
    expect(t.distanceM).toBeCloseTo(0.04 * DEG_M, 3);
  });

  it('plafond de points : au-delà, les points ne sont plus gardés mais la distance continue de compter', () => {
    let t = emptyTrack();
    const n = TRACK_RULES.maxPoints + 5;
    for (let i = 0; i < n; i += 1) t = addTrackPoint(t, { lat: (i % 2) * 0.0001, lon: 0, at: 1_800_000_000_000 + i * 2_000, accuracyM: 5 });
    expect(t.points).toHaveLength(TRACK_RULES.maxPoints);
    expect(t.truncated).toBe(true);
    expect(t.distanceM).toBeCloseTo((n - 1) * 0.1 * DEG_M, 1);
  });
});

describe('codage local du tracé (jamais publié, jamais exporté)', () => {
  it('aller-retour au millionième de degré, instants en millisecondes', () => {
    const pts = [p(0), p(1), p(2, { lon: -0.123456 })];
    const back = decodeTrack(encodeTrack(pts));
    expect(back).not.toBeNull();
    expect(back?.map((q) => [Math.round(q.lat * 1e6), Math.round(q.lon * 1e6), q.at])).toEqual(pts.map((q) => [Math.round(q.lat * 1e6), Math.round(q.lon * 1e6), q.at]));
  });

  it('tracé vide codé ; texte illisible : null', () => {
    expect(decodeTrack(encodeTrack([]))).toEqual([]);
    for (const bad of ['', 'x', '{}', '{"v":2,"p":[]}', '{"v":1,"p":[[1,2]]}', '{"v":1,"p":[["a",0,0,0]]}']) expect(decodeTrack(bad), bad).toBeNull();
  });
});
