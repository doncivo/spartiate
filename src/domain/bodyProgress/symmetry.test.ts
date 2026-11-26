import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../types';
import type { BodySample } from './period';
import { SYMMETRY_FLAG_PCT, SYMMETRY_PAIRS, SYMMETRY_SIDES, symmetry, symmetryAll } from './symmetry';

/** PROG-0301b (BL-178, D-708, D-718, D-730) : symétrie gauche / droite. Valeurs inventées. */
const D = (s: string): LocalDate => s as LocalDate;
const S = (kind: string, date: string, value: number): BodySample => ({ kind, date: D(date), value });

describe('symétrie gauche / droite (D-708, D-718)', () => {
  it('trois paires : bras, cuisses, mollets', () => {
    expect([...SYMMETRY_PAIRS]).toEqual(['arm', 'thigh', 'calf']);
    expect(SYMMETRY_SIDES).toEqual({ arm: { left: 'arm_left', right: 'arm_right' }, thigh: { left: 'thigh_left', right: 'thigh_right' }, calf: { left: 'calf_left', right: 'calf_right' } });
    expect(SYMMETRY_FLAG_PCT).toBe(2);
  });
  it('écart en cm au dixième et en % de la moyenne ; au-dessus de 2 % : signalé, côté le plus grand nommé', () => {
    // |36 − 35| = 1 cm ; 1 / 35,5 = 2,82 %.
    expect(symmetry('arm', [S('arm_left', '2026-11-20', 36), S('arm_right', '2026-11-20', 35)])).toEqual({
      status: 'known',
      pair: 'arm',
      left: { date: '2026-11-20', value: 36 },
      right: { date: '2026-11-20', value: 35 },
      diffCm: 1,
      diffPct: 2.8,
      flagged: true,
      larger: 'left',
    });
    expect(symmetry('arm', [S('arm_left', '2026-11-20', 35), S('arm_right', '2026-11-20', 36)])).toMatchObject({ larger: 'right', flagged: true });
  });
  it('exactement 2 % : non signalé (strictement au-dessus)', () => {
    // |40,4 − 39,6| = 0,8 ; 0,8 / 40 = 2 %.
    expect(symmetry('calf', [S('calf_left', '2026-11-20', 40.4), S('calf_right', '2026-11-20', 39.6)])).toMatchObject({ diffCm: 0.8, diffPct: 2, flagged: false, larger: 'left' });
  });
  it('côtés égaux : écart nul, aucun côté plus grand', () => {
    expect(symmetry('thigh', [S('thigh_left', '2026-11-20', 58), S('thigh_right', '2026-11-20', 58)])).toMatchObject({ diffCm: 0, diffPct: 0, flagged: false, larger: null });
  });
  it('dernière mesure de chaque côté', () => {
    const samples = [S('arm_left', '2026-10-01', 30), S('arm_left', '2026-11-18', 36), S('arm_right', '2026-11-20', 36.2), S('arm_right', '2026-10-01', 40)];
    expect(symmetry('arm', samples)).toMatchObject({ left: { date: '2026-11-18', value: 36 }, right: { date: '2026-11-20', value: 36.2 }, diffCm: 0.2, flagged: false, larger: 'right' });
  });
  it('les deux côtés à plus de 7 jours : pas de mesure récente des deux côtés ; 7 jours : connu', () => {
    expect(symmetry('thigh', [S('thigh_left', '2026-11-01', 58), S('thigh_right', '2026-11-09', 58)])).toEqual({ status: 'unknown', pair: 'thigh', reason: 'gap' });
    expect(symmetry('thigh', [S('thigh_left', '2026-11-02', 58), S('thigh_right', '2026-11-09', 58)])).toMatchObject({ status: 'known' });
  });
  it('un côté absent : inconnu ; aucun genre importé ou note n’est lu', () => {
    expect(symmetry('calf', [S('calf_left', '2026-11-20', 40), S('health_waist_cm', '2026-11-20', 40)])).toEqual({ status: 'unknown', pair: 'calf', reason: 'missing' });
  });
  it('symmetryAll rend les trois paires', () => {
    const all = symmetryAll([S('arm_left', '2026-11-20', 36), S('arm_right', '2026-11-20', 35)]);
    expect(all.arm.status).toBe('known');
    expect(all.thigh).toEqual({ status: 'unknown', pair: 'thigh', reason: 'missing' });
    expect(all.calf.status).toBe('unknown');
  });
});
