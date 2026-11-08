import { describe, expect, it } from 'vitest';

import { addDays } from '../localDate';
import type { LocalDate } from '../types';
import { computeTrend, trendAt } from './weightTrend';

const d0 = '2026-09-07' as LocalDate;
const w = (offset: number, kg: number) => ({ date: addDays(d0, offset), kg });

describe('I4-01 : computeTrend : EMA demi-vie 14 j (§ 15.1)', () => {
  it('aucune pesée : aucune tendance, jamais zéro', () => {
    expect(computeTrend([])).toEqual([]);
    expect(trendAt([], d0)).toBeNull();
  });

  it('la première pesée initialise la tendance', () => {
    const [p] = computeTrend([w(0, 80)]);
    expect(p?.trend).toBe(80);
    expect(p?.outlier).toBe(false);
  });

  it('après 14 jours, alpha = 0,5 : 80 puis 79,2 donne 79,6', () => {
    const pts = computeTrend([w(0, 80), w(14, 79.2)]);
    expect(pts[1]?.trend).toBeCloseTo(79.6, 10);
    expect(pts[1]?.outlier).toBe(false);
  });

  it('alpha dépend du pas : 7 jours donnent 1 - 2^(-1/2)', () => {
    const alpha = 1 - 2 ** -0.5;
    const pts = computeTrend([w(0, 80), w(7, 79.5)]);
    expect(pts[1]?.trend).toBeCloseTo(80 + alpha * -0.5, 10);
  });

  it('pesée à 2,25 % : pondérée 0,25 dans la mise à jour (D-74 point 3)', () => {
    const alpha = 1 - 2 ** -0.5;
    const pts = computeTrend([w(0, 80), w(7, 81.8)]);
    expect(pts[1]?.outlier).toBe(true);
    expect(pts[1]?.trend).toBeCloseTo(80 + alpha * 0.25 * 1.8, 10);
  });

  it('pas exclue : l\'effet est non nul mais inférieur à celui d\'une pesée normale', () => {
    const outlier = computeTrend([w(0, 80), w(7, 81.8)])[1]?.trend ?? 0;
    expect(outlier).toBeGreaterThan(80);
    expect(outlier - 80).toBeLessThan(0.25 * (1 - 2 ** -0.5) * 1.8 + 1e-9);
  });

  it('exactement 2 % : pas aberrante (seuil strict)', () => {
    expect(computeTrend([w(0, 100), w(7, 102)])[1]?.outlier).toBe(false);
    expect(computeTrend([w(0, 100), w(7, 98)])[1]?.outlier).toBe(false);
  });

  it('l\'écart se mesure à la tendance, pas à la pesée précédente', () => {
    // Tendance ≈ 80 ; 78,3 est à 2,1 % de la tendance.
    expect(computeTrend([w(0, 80), w(1, 78.3)])[1]?.outlier).toBe(true);
  });

  it('trie par date et garde la dernière pesée d\'un même jour', () => {
    const pts = computeTrend([w(7, 79.5), w(0, 80), w(7, 79.4)]);
    expect(pts.map((p) => p.date)).toEqual([d0, addDays(d0, 7)]);
    expect(pts[1]?.kg).toBe(79.4);
  });

  it('ignore les pesées non positives ou non finies', () => {
    const pts = computeTrend([w(0, 0), w(1, -3), w(2, Number.NaN), w(3, 80)]);
    expect(pts).toHaveLength(1);
    expect(pts[0]?.kg).toBe(80);
  });

  it('une absence de pesée n\'est jamais imputée : pas de point entre deux pesées', () => {
    expect(computeTrend([w(0, 80), w(20, 80)])).toHaveLength(2);
  });
});

describe('I4-01 : trendAt', () => {
  const pts = computeTrend([w(0, 80), w(14, 79.2)]);
  it('avant la première pesée : null', () => {
    expect(trendAt(pts, addDays(d0, -1))).toBeNull();
  });
  it('report de la dernière tendance connue', () => {
    expect(trendAt(pts, addDays(d0, 5))).toBe(80);
    expect(trendAt(pts, addDays(d0, 14))).toBeCloseTo(79.6, 10);
    expect(trendAt(pts, addDays(d0, 40))).toBeCloseTo(79.6, 10);
  });
});
