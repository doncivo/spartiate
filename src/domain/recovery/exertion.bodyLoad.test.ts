import { describe, expect, it } from 'vitest';
import { STRENGTH_SCALE } from './config';
import { dayExertion } from './exertion';
import type { RecoverySet, RecoveryWorkout } from './types';

/** NUTRI-0292 (BL-139) : au poids du corps, assisté et chronométré, une série compte (jamais 0) : charge totale, charge par minute. Valeurs inventées. */
const TZ = 'Europe/Paris';
const day = '2026-11-07';
const set = (over: Partial<RecoverySet> = {}): RecoverySet => ({ kg: 100, reps: 10, difficulty: 'ok', isWarmup: false, completed: true, muscles: [{ id: 'lats', weight: 1 }], ...over });
const load = (sets: RecoverySet[]): number => dayExertion([{ endedAt: '2026-11-07T17:00:00.000Z', sets } as RecoveryWorkout], day, TZ).muscuLoad;

describe('BL-139 : séries sans charge saisie', () => {
  it('traction au poids du corps (lest 0, poids de corps × fraction connu) : charge totale = poids de corps', () => {
    expect(load([set({ kg: 0, reps: 10, baseKg: 80, loadSign: 1 })])).toBeCloseTo((80 * 10 * STRENGTH_SCALE) / 1000, 10);
  });
  it('lestée : poids de corps + lest', () => {
    expect(load([set({ kg: 10, reps: 5, baseKg: 80, loadSign: 1 })])).toBeCloseTo((90 * 5 * STRENGTH_SCALE) / 1000, 10);
  });
  it('lest absent (null) : lu comme 0, la série compte', () => {
    expect(load([set({ kg: null, reps: 10, baseKg: 80, loadSign: 1 })])).toBeCloseTo((80 * 10 * STRENGTH_SCALE) / 1000, 10);
  });
  it('assistée : poids de corps − assistance', () => {
    expect(load([set({ kg: 30, reps: 8, baseKg: 80, loadSign: -1 })])).toBeCloseTo((50 * 8 * STRENGTH_SCALE) / 1000, 10);
  });
  it('assistance supérieure au poids de corps : charge totale nulle, série ignorée (jamais négative)', () => {
    expect(load([set({ kg: 90, reps: 8, baseKg: 80, loadSign: -1 })])).toBe(0);
  });
  it('poids de corps inconnu : la série n\'est pas devinée (ignorée, comme avant)', () => {
    expect(load([set({ kg: 0, reps: 10, baseKg: null, loadSign: 1 })])).toBe(0);
  });
  it('chronométrée : charge totale × minutes × répétitions équivalentes par minute (12) ; 30 s = la moitié de 60 s', () => {
    const sixty = load([set({ kg: 0, reps: null, durationSec: 60, baseKg: 40, loadSign: 1 })]);
    expect(sixty).toBeCloseTo((40 * 1 * 12 * STRENGTH_SCALE) / 1000, 10);
    expect(load([set({ kg: 0, reps: null, durationSec: 30, baseKg: 40, loadSign: 1 })])).toBeCloseTo(sixty / 2, 10);
  });
  it('chronométrée lestée sans poids de corps (charge saisie seule) : charge × minutes', () => {
    expect(load([set({ kg: 20, reps: null, durationSec: 60 })])).toBeCloseTo((20 * 12 * STRENGTH_SCALE) / 1000, 10);
  });
  it('série ordinaire inchangée', () => {
    expect(load([set()])).toBeCloseTo((100 * 10 * STRENGTH_SCALE) / 1000, 10);
  });
  it('ordinaire sans répétitions ni durée : ignorée', () => {
    expect(load([set({ reps: null })])).toBe(0);
  });
});
