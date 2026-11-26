import { describe, expect, it } from 'vitest';
import { addDays } from '../localDate';
import { computeTrend, trendAt } from '../nutrition/weightTrend';
import type { WeighIn } from '../nutrition/types';
import type { LocalDate } from '../types';
import { weightEvolution } from './weightEvolution';

/** PROG-0301b (BL-178, D-706, D-718, D-733) : évolution du poids (tendance des pesées) sur la période. Valeurs inventées. */
const D = (s: string): LocalDate => s as LocalDate;
/** Pesées quotidiennes inventées : `days` jours depuis `from`, de `kg0` en ajoutant `step` chaque jour. */
const daily = (from: string, days: number, kg0: number, step: number): WeighIn[] =>
  Array.from({ length: days }, (_, i) => ({ date: addDays(D(from), i), kg: Math.round((kg0 + step * i) * 100) / 100 }));
const round1 = (n: number): number => Math.round(n * 10) / 10;

describe('weightEvolution (D-718, D-733)', () => {
  const end = D('2026-11-26');
  const weighIns = daily('2026-07-01', 148, 82, -0.02); // du 1er juillet au 25 novembre

  it('tendance à la fin moins tendance au début de la période (report de la dernière tendance connue)', () => {
    const points = computeTrend(weighIns);
    const start = D('2026-08-26');
    const from = trendAt(points, start);
    const to = trendAt(points, end);
    if (from === null || to === null) throw new Error('vecteur invalide');
    const r = weightEvolution(weighIns, '3m', end);
    expect(r).toEqual({ status: 'known', from: { date: '2026-08-26', kg: from }, to: { date: '2026-11-25', kg: to }, deltaKg: round1(to - from) });
    if (r.status !== 'known') throw new Error('attendu connu');
    expect(r.deltaKg).toBeLessThan(0);
  });
  it('Tout : depuis la première pesée', () => {
    expect(weightEvolution(weighIns, 'all', end)).toMatchObject({ status: 'known', from: { date: '2026-07-01', kg: 82 } });
  });
  it('aucune pesée avant le début : départ à la première pesée de la période', () => {
    const late = daily('2026-11-01', 20, 80, 0.05);
    expect(weightEvolution(late, '3m', end)).toMatchObject({ status: 'known', from: { date: '2026-11-01', kg: 80 }, to: { date: '2026-11-20' } });
  });
  it('moins de 14 pesées : en apprentissage, jamais 0', () => {
    expect(weightEvolution(daily('2026-11-10', 5, 80, 0), '3m', end)).toEqual({ status: 'learning', weighIns: 5, needed: 14 });
    expect(weightEvolution([], '3m', end)).toEqual({ status: 'learning', weighIns: 0, needed: 14 });
  });
  it('aucune pesée dans la période : inconnu (le report ne fait pas un faux zéro)', () => {
    expect(weightEvolution(daily('2026-07-01', 30, 80, 0), '4w', end)).toEqual({ status: 'unknown' });
  });
  it('une seule pesée dans la période, un historique avant : départ au report du premier jour', () => {
    const sparse = [...daily('2026-07-01', 20, 80, 0), { date: D('2026-11-20'), kg: 78 }];
    const r = weightEvolution(sparse, '4w', end);
    expect(r).toMatchObject({ status: 'known', from: { date: '2026-10-29', kg: 80 }, to: { date: '2026-11-20' } });
    if (r.status !== 'known') throw new Error('attendu connu');
    expect(r.deltaKg).toBeLessThan(0);
  });
  it('pesées seulement après la fin, historique trop court jusqu’à la fin : en apprentissage', () => {
    expect(weightEvolution([...daily('2026-11-20', 1, 80, 0), ...daily('2026-12-01', 13, 80, 0)], '4w', end)).toEqual({ status: 'learning', weighIns: 1, needed: 14 });
  });
  it('les pesées après la fin sont ignorées', () => {
    const withFuture = [...weighIns, { date: D('2026-12-10'), kg: 60 }];
    expect(weightEvolution(withFuture, '3m', end)).toEqual(weightEvolution(weighIns, '3m', end));
  });
});
