import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../../domain/types';
import { SILHOUETTE_DOTS, curveGeometry, summarizeZone, type ZonePoint } from './bodyZone';

function need<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('valeur attendue');
  return value;
}
const p = (date: string, value: number): ZonePoint => ({ date: date as LocalDate, value });

/** ERGO-02 (C1, C2) : écart sur 4 semaines et courbe de Progrès › Corps, calculs d'affichage seulement (aucune règle métier). */
describe('summarizeZone : dernière mesure et écart', () => {
  it('aucune mesure : rien d’inventé', () => {
    expect(summarizeZone([])).toEqual({ last: null, reference: null, delta: null, span: null });
  });

  it('une seule mesure : dernière connue, aucun écart', () => {
    expect(summarizeZone([p('2026-11-10', 86.5)])).toEqual({ last: p('2026-11-10', 86.5), reference: null, delta: null, span: null });
  });

  it('une mesure au moins 28 jours avant la dernière : écart « sur 4 semaines » (la plus récente de celles-là)', () => {
    const s = summarizeZone([p('2026-10-01', 90), p('2026-10-12', 88.5), p('2026-10-20', 87.5), p('2026-11-09', 86.5)]);
    expect(s.span).toBe('four-weeks');
    expect(s.reference).toEqual(p('2026-10-12', 88.5));
    expect(s.delta).toBe(-2);
  });

  it('exactement 28 jours : compte comme 4 semaines', () => {
    expect(summarizeZone([p('2026-10-12', 88), p('2026-11-09', 89)])).toMatchObject({ span: 'four-weeks', delta: 1 });
  });

  it('historique plus court que 4 semaines : écart depuis la plus ancienne mesure, jamais présenté comme 4 semaines', () => {
    const s = summarizeZone([p('2026-11-01', 84), p('2026-11-05', 83.5), p('2026-11-10', 82.5)]);
    expect(s).toMatchObject({ span: 'since', reference: p('2026-11-01', 84), delta: -1.5 });
  });

  it('points donnés dans le désordre : triés par date ; écart arrondi au dixième, 0 si égal', () => {
    expect(summarizeZone([p('2026-11-10', 82.54), p('2026-11-01', 82.5)]).delta).toBe(0);
    expect(summarizeZone([p('2026-11-10', 82), p('2026-11-01', 84)]).last).toEqual(p('2026-11-10', 82));
  });
});

describe('curveGeometry : courbe de la zone', () => {
  it('moins de deux mesures : pas de courbe', () => {
    expect(curveGeometry([p('2026-11-10', 80)], 200, 56)).toBeNull();
  });

  it('une valeur plus haute est plus haut dans l’image ; le dernier point est marqué ; x suit les dates', () => {
    const g = need(curveGeometry([p('2026-11-01', 90), p('2026-11-11', 88), p('2026-11-21', 86)], 200, 60));
    expect(g.dots).toHaveLength(3);
    expect(g.dots.map((d) => d.last)).toEqual([false, false, true]);
    expect(need(g.dots[0]).y).toBeLessThan(need(g.dots[2]).y);
    expect(need(g.dots[1]).x).toBeCloseTo(100, 5);
    expect(g.path.startsWith('M')).toBe(true);
    expect([g.min, g.max]).toEqual([86, 90]);
  });

  it('valeurs toutes égales : droite au milieu, sans division par zéro', () => {
    const g = need(curveGeometry([p('2026-11-01', 80), p('2026-11-08', 80)], 200, 60));
    expect(g.dots.every((d) => Number.isFinite(d.y) && d.y === 30)).toBe(true);
  });

  it('au plus douze dernières mesures', () => {
    const points = Array.from({ length: 20 }, (_, i) => p(`2026-10-${String(i + 1).padStart(2, '0')}`, 80 + i));
    expect(need(curveGeometry(points, 200, 60)).dots).toHaveLength(12);
  });
});

describe('silhouette', () => {
  it('une position pour chacune des 11 zones', () => {
    expect(Object.keys(SILHOUETTE_DOTS)).toHaveLength(11);
  });
});
