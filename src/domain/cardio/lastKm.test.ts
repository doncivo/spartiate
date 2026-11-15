import { describe, expect, it } from 'vitest';
import { haversineM, lastKmSecPerKm, type TrackPoint } from './index';

/**
 * ERGO-02b (critère 2, revue d'ERGO-02 point 4) : allure du dernier kilomètre du suivi GPS en cours, règle pure du domaine (l'écran CardioGps
 * l'importe). Positions SYNTHÉTIQUES : ligne droite vers le nord depuis 0° / 0°, 0,001° de latitude ≈ 111,19 m.
 */
const T0 = 1_800_000_000_000;
const p = (i: number, atSec: number): TrackPoint => ({ lat: i * 0.001, lon: 0, at: T0 + atSec * 1000, accuracyM: 5 });
const line = (stepsSec: readonly number[]): TrackPoint[] => {
  let at = 0;
  return [p(0, 0), ...stepsSec.map((s, i) => p(i + 1, (at += s)))];
};

describe('allure du dernier kilomètre (lastKmSecPerKm)', () => {
  it('aucun point, un seul point, tracé de moins de 1 km : null', () => {
    expect(lastKmSecPerKm([])).toBeNull();
    expect(lastKmSecPerKm([p(0, 0)])).toBeNull();
    expect(lastKmSecPerKm(line(Array<number>(8).fill(30)))).toBeNull();
  });

  it('1 km atteint à 9 segments de 30 s : durée ramenée à 1 000 m exactement, arrondie à la seconde', () => {
    const points = line(Array<number>(9).fill(30));
    const distance = points.slice(1).reduce((sum, b, i) => sum + haversineM(points[i] as TrackPoint, b), 0);
    expect(distance).toBeGreaterThanOrEqual(1000);
    expect(lastKmSecPerKm(points)).toBe(Math.round(270 * (1000 / distance)));
    expect(lastKmSecPerKm(points)).toBe(270);
  });

  it('compté depuis la fin du tracé : un début lent ne change pas l’allure du dernier kilomètre', () => {
    expect(lastKmSecPerKm(line([...Array<number>(10).fill(60), ...Array<number>(9).fill(30)]))).toBe(270);
    expect(lastKmSecPerKm(line([...Array<number>(9).fill(30), ...Array<number>(9).fill(60)]))).toBe(540);
  });

  it('déterministe, sans modifier les points reçus', () => {
    const points = Object.freeze(line(Array<number>(12).fill(30)));
    expect(lastKmSecPerKm(points)).toBe(lastKmSecPerKm(points));
  });
});
